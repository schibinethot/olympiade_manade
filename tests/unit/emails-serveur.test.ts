import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { creerEmails, emailsDepuisEnvironnement } from '../../serveur/emails.mjs';
import { verifierAdmin } from '../../serveur/admin-serveur.mjs';
import { emailsDepuisEnvironnement as courrielEmails } from '../../serveur/courriel.mjs';
import { CONSENTEMENT_ANNONCES_TEXTE, ETAPES, MODELES_DEFAUT } from '../../serveur/gabarits-emails.mjs';
import { finDeJourParis, signerLien, verifierLien } from '../../serveur/liens-emails.mjs';

// ——— Faux PostgREST en mémoire ———
// Il interprète les filtres, l'ordre, la limite, les embarquements à une table, on_conflict et Prefer,
// et reproduit les déclencheurs utiles de la migration (clic de confirmation, retrait d'un abonnement).

type Ligne = Record<string, unknown>;
type Appel = { methode: string; chemin: string; params: URLSearchParams; corps: unknown; prefer: string; auth: string };

const SUPABASE = 'http://127.0.0.1:54321';
const ORIGINE = 'http://127.0.0.1:4173';
const CLE = 'a1'.repeat(32);
const EXPEDITEUR = 'Olympiade des Manades <bonjour@olympiadedesmanades.fr>';

const RELATIONS: Record<string, Record<string, { local: string; table: string }>> = {
  envois_emails: { destinataires_emails: { local: 'destinataire_id', table: 'destinataires_emails' } },
  rattachements_emails: { destinataires_emails: { local: 'destinataire_id', table: 'destinataires_emails' } },
};

/** Découpe une liste PostgREST aux virgules de premier niveau. */
function decouper(texte: string): string[] {
  const parties: string[] = [];
  let profondeur = 0;
  let courant = '';
  for (const c of texte) {
    if (c === '(') profondeur += 1;
    if (c === ')') profondeur -= 1;
    if (c === ',' && profondeur === 0) {
      parties.push(courant);
      courant = '';
    } else courant += c;
  }
  if (courant) parties.push(courant);
  return parties;
}

function comparer(a: unknown, b: string): number {
  const ta = typeof a === 'string' ? Date.parse(a) : NaN;
  const tb = Date.parse(b);
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && /\d{4}-\d{2}-\d{2}/.test(b)) return ta - tb;
  if (typeof a === 'number') return a - Number(b);
  return String(a) < b ? -1 : String(a) > b ? 1 : 0;
}

function correspond(valeur: unknown, filtre: string): boolean {
  const negation = filtre.startsWith('not.');
  const f = negation ? filtre.slice(4) : filtre;
  const point = f.indexOf('.');
  const op = f.slice(0, point);
  const brut = f.slice(point + 1);
  let ok: boolean;
  switch (op) {
    case 'eq': ok = valeur !== null && valeur !== undefined && String(valeur) === brut; break;
    case 'neq': ok = valeur !== null && valeur !== undefined && String(valeur) !== brut; break;
    case 'is': ok = brut === 'null' ? valeur === null || valeur === undefined : String(valeur) === brut; break;
    case 'in': ok = brut.replace(/^\(|\)$/g, '').split(',').map((v) => v.replace(/^"|"$/g, '')).includes(String(valeur)); break;
    case 'lt': ok = valeur !== null && valeur !== undefined && comparer(valeur, brut) < 0; break;
    case 'lte': ok = valeur !== null && valeur !== undefined && comparer(valeur, brut) <= 0; break;
    case 'gt': ok = valeur !== null && valeur !== undefined && comparer(valeur, brut) > 0; break;
    case 'gte': ok = valeur !== null && valeur !== undefined && comparer(valeur, brut) >= 0; break;
    default: throw new Error(`opérateur non simulé : ${op}`);
  }
  return negation ? !ok : ok;
}

const NON_FILTRES = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

class FauxSupabase {
  tables: Record<string, Ligne[]> = {
    modeles_emails: [], destinataires_emails: [], rattachements_emails: [], messages_inscrits: [],
    envois_emails: [], abonnements_actualites: [], calendrier: [], palmares: [], profils: [],
  };
  appels: Appel[] = [];
  utilisateurs = new Map<string, { id: string; email: string }>();
  /** Réponse forcée pour un appel (panne, concurrence). */
  intercepter: ((appel: Appel) => Response | null) | null = null;
  constructor(public horloge: () => number) {}

  get fetch(): typeof fetch {
    return (async (entree: URL | RequestInfo, init?: RequestInit) => this.repondre(String(entree), init)) as typeof fetch;
  }

  ecritures() {
    return this.appels.filter((a) => a.methode !== 'GET' && !a.chemin.startsWith('/auth/') && a.chemin !== '/rest/v1/rpc/emails_a_traiter');
  }

  private json(statut: number, corps: unknown) {
    return new Response(corps === undefined ? null : JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } });
  }

  private repondre(adresse: string, init?: RequestInit): Response {
    const url = new URL(adresse);
    const methode = (init?.method ?? 'GET').toUpperCase();
    const entetes = new Headers(init?.headers);
    const corps = typeof init?.body === 'string' && init.body ? JSON.parse(init.body) : undefined;
    const appel: Appel = { methode, chemin: url.pathname, params: url.searchParams, corps, prefer: entetes.get('Prefer') ?? '', auth: entetes.get('Authorization') ?? '' };
    this.appels.push(appel);
    const force = this.intercepter?.(appel);
    if (force) return force;
    if (url.origin !== SUPABASE) return this.json(404, { message: 'hôte inconnu' });
    if (url.pathname === '/auth/v1/user') {
      const utilisateur = this.utilisateurs.get(appel.auth.replace(/^Bearer /, ''));
      return utilisateur ? this.json(200, utilisateur) : this.json(401, { message: 'invalide' });
    }
    if (url.pathname === '/rest/v1/rpc/emails_a_traiter') return this.json(200, this.rpc(corps as { p_maintenant: string; p_reel: boolean }));
    const table = url.pathname.replace('/rest/v1/', '');
    const lignes = this.tables[table];
    if (!lignes) return this.json(404, { code: 'PGRST205' });
    const representation = appel.prefer.includes('return=representation');
    if (methode === 'GET') return this.json(200, this.lire(table, url.searchParams));
    if (methode === 'POST') {
      const entrees = (Array.isArray(corps) ? corps : [corps]) as Ligne[];
      const conflit = url.searchParams.get('on_conflict')?.split(',') ?? null;
      const ignorer = appel.prefer.includes('resolution=ignore-duplicates');
      const inserees: Ligne[] = [];
      for (const entree of entrees) {
        const cles = conflit ?? this.clesUniques(table);
        const doublon = cles && lignes.some((l) => cles.every((c) => (l[c] ?? null) === (entree[c] ?? null)));
        if (doublon) {
          if (ignorer) continue;
          return this.json(409, { code: '23505', details: 'Key (email)=(secret@exemple.fr) already exists.' });
        }
        const ligne = { ...this.defauts(table), ...entree };
        lignes.push(ligne);
        inserees.push(ligne);
      }
      return representation ? this.json(201, inserees.map((l) => this.projeter(table, l, url.searchParams.get('select')))) : this.json(201, undefined);
    }
    const cibles = lignes.filter((l) => this.filtrer(table, l, url.searchParams));
    if (methode === 'PATCH') {
      for (const ligne of cibles) this.mettreAJour(table, ligne, corps as Ligne);
      return representation ? this.json(200, cibles.map((l) => this.projeter(table, l, url.searchParams.get('select')))) : this.json(204, undefined);
    }
    if (methode === 'DELETE') {
      this.tables[table] = lignes.filter((l) => !cibles.includes(l));
      if (table === 'abonnements_actualites') for (const a of cibles) this.retirerAbonne(String(a.email));
      return this.json(204, undefined);
    }
    return this.json(405, {});
  }

  private clesUniques(table: string): string[] | null {
    if (table === 'rattachements_emails') return ['destinataire_id', 'calendrier_id'];
    if (table === 'envois_emails') return ['destinataire_id', 'etape', 'calendrier_id', 'message_id', 'reel'];
    if (table === 'modeles_emails') return ['cle'];
    return null;
  }

  private defauts(table: string): Ligne {
    const maintenant = new Date(this.horloge()).toISOString();
    if (table === 'envois_emails') return { id: randomUUID(), calendrier_id: null, message_id: null, statut: 'en_attente', raison: null, tentatives: 0, prevu_le: maintenant, envoye_le: null, cree_le: maintenant };
    if (table === 'messages_inscrits') return { id: randomUUID(), cree_le: maintenant };
    if (table === 'rattachements_emails') return { cree_le: maintenant };
    return {};
  }

  private filtrer(table: string, ligne: Ligne, params: URLSearchParams): boolean {
    for (const [cle, valeur] of params) {
      if (NON_FILTRES.has(cle)) continue;
      const [tete, colonne] = cle.includes('.') ? cle.split('.') : [null, cle];
      if (tete) {
        const relation = RELATIONS[table]?.[tete];
        const cible = relation ? this.tables[relation.table].find((l) => l.id === ligne[relation.local]) : undefined;
        if (!cible || !correspond(cible[colonne], valeur)) return false;
      } else if (!correspond(ligne[colonne], valeur)) return false;
    }
    return true;
  }

  private projeter(table: string, ligne: Ligne, select: string | null): Ligne {
    if (!select || select === '*') return { ...ligne };
    const resultat: Ligne = {};
    for (const partie of decouper(select)) {
      const embarque = /^([a-z_]+)(!inner)?\((.*)\)$/.exec(partie);
      if (!embarque) {
        resultat[partie] = ligne[partie] ?? null;
        continue;
      }
      const [, nom, , colonnes] = embarque;
      if (table === 'calendrier' && nom === 'soirees') {
        const soiree = ligne.soiree as { slug: string; statut: string } | null;
        resultat.soirees = soiree
          ? { ...soiree, soiree_manades: (ligne.manades as string[]).map((m, i) => ({ ordre: i + 1, manades: { nom: m } })) }
          : null;
        continue;
      }
      const relation = RELATIONS[table]?.[nom];
      if (!relation) throw new Error(`embarquement non simulé : ${table}.${nom}`);
      const cible = this.tables[relation.table].find((l) => l.id === ligne[relation.local]);
      resultat[nom] = cible ? this.projeter(relation.table, cible, colonnes) : null;
    }
    return resultat;
  }

  private lire(table: string, params: URLSearchParams): Ligne[] {
    let lignes = this.tables[table].filter((l) => this.filtrer(table, l, params));
    const select = params.get('select');
    for (const partie of decouper(select ?? '')) {
      const inner = /^([a-z_]+)!inner\(/.exec(partie);
      const relation = inner ? RELATIONS[table]?.[inner[1]] : undefined;
      if (relation) lignes = lignes.filter((l) => this.tables[relation.table].some((c) => c.id === l[relation.local]));
    }
    const ordre = params.get('order');
    if (ordre) {
      const criteres = ordre.split(',').map((c) => c.split('.'));
      lignes = [...lignes].sort((a, b) => {
        for (const [colonne, sens] of criteres) {
          const x = String(a[colonne] ?? '');
          const y = String(b[colonne] ?? '');
          if (x !== y) return (x < y ? -1 : 1) * (sens === 'desc' ? -1 : 1);
        }
        return 0;
      });
    }
    const debut = Number(params.get('offset') ?? 0);
    const limite = params.get('limit');
    lignes = lignes.slice(debut, limite === null ? undefined : debut + Number(limite));
    return lignes.map((l) => this.projeter(table, l, select));
  }

  private mettreAJour(table: string, ligne: Ligne, champs: Ligne) {
    if (table === 'destinataires_emails' && 'abonnement_confirme_le' in champs) {
      // prive.confirmer_abonnement_email : seul un clic sur une demande en attente, abonnement présent, compte.
      const maintenant = new Date(this.horloge()).toISOString();
      if (ligne.abonnement_a_confirmer && this.tables.abonnements_actualites.some((a) => a.email === ligne.email)) {
        Object.assign(ligne, {
          abonnement_a_confirmer: false, abonnement_confirme_le: maintenant, confirme_le: ligne.confirme_le ?? maintenant,
          desinscrit_le: null, annonces: true,
        });
      }
      return;
    }
    Object.assign(ligne, champs);
  }

  /** prive.retirer_abonne_emails */
  private retirerAbonne(email: string) {
    const d = this.tables.destinataires_emails.find((l) => l.email === email);
    if (!d) return;
    if (d.profil_id === null && d.desinscrit_le === null) {
      this.tables.destinataires_emails = this.tables.destinataires_emails.filter((l) => l !== d);
      this.tables.envois_emails = this.tables.envois_emails.filter((l) => l.destinataire_id !== d.id);
      this.tables.rattachements_emails = this.tables.rattachements_emails.filter((l) => l.destinataire_id !== d.id);
      return;
    }
    Object.assign(d, { abonne: false, abonnement_a_confirmer: false, annonces: d.desinscrit_le !== null ? false : d.annonces });
  }

  private rpc({ p_maintenant, p_reel }: { p_maintenant: string; p_reel: boolean }) {
    const t = this.tables;
    const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(p_maintenant));
    const confirmes = new Set(t.destinataires_emails.filter((d) => d.confirme_le && !d.desinscrit_le).map((d) => d.id));
    const dates = t.calendrier.map((c) => ({
      id: c.id, nom: c.nom, ville: c.ville, arenes: c.arenes, date_soiree: c.date_soiree, heure: c.heure, statut: c.statut,
      lien_billetterie: c.lien_billetterie, infos_pratiques: c.infos_pratiques, soiree: c.soiree, manades: c.manades, vainqueur: c.vainqueur,
    }));
    return {
      modeles: t.modeles_emails.map((m) => ({
        cle: m.cle, nom: m.nom, actif: m.actif, sujet: m.sujet, preheader: m.preheader, corps: m.corps, encart: m.encart,
        jours_decalage: m.jours_decalage, heure_envoi: m.heure_envoi,
      })),
      dates,
      prochaines: dates.filter((d) => d.statut === 'confirmee' && String(d.date_soiree) > jour).slice(0, 6),
      destinataires: t.destinataires_emails.map((d) => ({
        id: d.id, email: d.email, prenom: d.prenom, profil_id: d.profil_id, abonne: d.abonne,
        abonnement_a_confirmer: d.abonnement_a_confirmer, desinscrit: d.desinscrit_le !== null, annonces: d.annonces,
        confirme_le: d.confirme_le, inscrit_le: d.inscrit_le,
      })),
      rattachements: t.rattachements_emails.filter((r) => confirmes.has(r.destinataire_id)),
      envois: t.envois_emails.filter((e) => e.reel === p_reel),
    };
  }
}

// ——— Données ———

const MAINTENANT = Date.parse('2027-07-29T08:05:00Z'); // jeudi 29/07/2027, 10:05 à Paris

function modeles(): Ligne[] {
  return ETAPES.map((cle) => ({ cle, actif: true, ...MODELES_DEFAUT[cle] }));
}

function date(id: string, date_soiree: string, plus: Ligne = {}): Ligne {
  return {
    id, nom: 'Rencontre des manades', ville: `Ville ${id}`, arenes: 'Arènes municipales', date_soiree, heure: '21:30:00',
    statut: 'confirmee', lien_billetterie: null, infos_pratiques: null, soiree: null, manades: [], vainqueur: null, ...plus,
  };
}

function destinataire(id: string, email: string, plus: Ligne = {}): Ligne {
  return {
    id, email, prenom: 'Camille', profil_id: null, abonne: false, abonnement_a_confirmer: false, abonnement_confirme_le: null,
    annonces: false, confirme_le: '2027-06-01T10:00:00Z', inscrit_le: '2027-06-01T10:00:00Z', desinscrit_le: null, ...plus,
  };
}

const ID = {
  alice: '11111111-1111-4111-8111-111111111111',
  bruno: '22222222-2222-4222-8222-222222222222',
  chloe: '33333333-3333-4333-8333-333333333333',
  denis: '44444444-4444-4444-8444-444444444444',
  demain: 'aaaaaaaa-0000-4000-8000-000000000001',
  aujourdhui: 'aaaaaaaa-0000-4000-8000-000000000002',
  aout: 'aaaaaaaa-0000-4000-8000-000000000003',
  aout2: 'aaaaaaaa-0000-4000-8000-000000000004',
};

function envoi(destinataire_id: string, etape: string, calendrier_id: string | null, plus: Ligne = {}): Ligne {
  return {
    id: randomUUID(), destinataire_id, etape, calendrier_id, message_id: null, reel: false, statut: 'simule', raison: null,
    tentatives: 0, prevu_le: '2027-07-20T08:00:00Z', envoye_le: '2027-07-20T08:00:00Z', cree_le: '2027-07-20T08:00:00Z', ...plus,
  };
}

/** Alice vient de confirmer (bienvenue due) ; Bruno, rattaché à la date du jour, attend son jour J (10:00). */
function scenarioDeBase(base: FauxSupabase) {
  base.tables.modeles_emails = modeles();
  base.tables.calendrier = [date(ID.demain, '2027-07-30'), date(ID.aujourdhui, '2027-07-29')];
  base.tables.destinataires_emails = [
    destinataire(ID.alice, 'alice@exemple.fr', { confirme_le: '2027-07-29T07:00:00Z', inscrit_le: '2027-07-29T07:00:00Z' }),
    destinataire(ID.bruno, 'bruno@exemple.fr', { prenom: null }),
  ];
  base.tables.rattachements_emails = [
    { destinataire_id: ID.alice, calendrier_id: ID.demain, origine: 'inscription', cree_le: '2027-07-29T07:00:00Z' },
    { destinataire_id: ID.bruno, calendrier_id: ID.aujourdhui, origine: 'inscription', cree_le: '2027-06-01T10:00:00Z' },
  ];
  base.tables.envois_emails = [
    envoi(ID.bruno, 'bienvenue', null), envoi(ID.bruno, 'j_moins_7', ID.aujourdhui), envoi(ID.bruno, 'veille', ID.aujourdhui),
  ];
}

type Courriel = { mode: 'off' | 'log' | 'smtp'; pret: boolean; envoyer: ReturnType<typeof vi.fn> };

function faussePoste(mode: Courriel['mode'], echec = false): Courriel {
  return {
    mode,
    pret: true,
    envoyer: vi.fn(async () => ({ mode, envoye: mode === 'smtp' && !echec, echec })),
  };
}

function preparer(options: { mode?: Courriel['mode']; courriel?: unknown; cleLiens?: string | null; horloge?: { t: number }; plus?: Record<string, unknown> } = {}) {
  const horloge = options.horloge ?? { t: MAINTENANT };
  const base = new FauxSupabase(() => horloge.t);
  const journal: unknown[] = [];
  const courriel = options.courriel ?? faussePoste(options.mode ?? 'log');
  const emails = creerEmails({
    supabaseUrl: SUPABASE,
    publishableKey: 'cle-publique',
    serviceRoleKey: 'cle-service',
    origine: ORIGINE,
    cleLiens: options.cleLiens === undefined ? CLE : options.cleLiens,
    expediteur: EXPEDITEUR,
    courriel: courriel as never,
    fetchFn: base.fetch,
    maintenant: () => horloge.t,
    timers: false,
    journal: (ligne: unknown) => journal.push(ligne),
    ...options.plus,
  });
  return { base, emails, journal, horloge, courriel: courriel as Courriel };
}

const serveurs: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(serveurs.splice(0).map((fermer) => fermer()));
});

async function lancer(emails: ReturnType<typeof creerEmails>) {
  const serveur = createServer((req, res) => {
    if (!emails.estRoute(req.url)) {
      res.writeHead(404).end();
      return;
    }
    void emails.repondre(req, res);
  });
  await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
  serveurs.push(() => new Promise<void>((ok) => serveur.close(() => ok())));
  return `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
}

function lien(base: string, corps: unknown, entetes: Record<string, string> = {}) {
  return fetch(`${base}/api/emails/lien`, {
    method: 'POST',
    headers: { Origin: ORIGINE, 'Content-Type': 'application/json', ...entetes },
    body: JSON.stringify(corps),
  });
}

const jetonAdmin = (aal: 'aal1' | 'aal2') => `e30.${Buffer.from(JSON.stringify({ aal })).toString('base64url')}.signature`;

function admin(base: FauxSupabase, { aal = 'aal2', role = 'admin' }: { aal?: 'aal1' | 'aal2'; role?: string } = {}) {
  const jeton = jetonAdmin(aal);
  const id = '99999999-9999-4999-8999-999999999999';
  base.utilisateurs.set(jeton, { id, email: 'admin@exemple.fr' });
  base.tables.profils = [{ id, role }];
  return { jeton, id };
}

// ——— Planificateur ———

describe('planificateur des e-mails', () => {
  it('mode log : réserve, journalise sans adresse en clair, passe en simule, puis ne refait rien', async () => {
    const horloge = { t: MAINTENANT };
    const journal: unknown[] = [];
    const courriel = courrielEmails({ SMTP_MODE: 'log', EMAILS_FROM: EXPEDITEUR }, { journal: (l) => journal.push(l) });
    const { base, emails, journal: journalPlanificateur } = preparer({ courriel, horloge });
    scenarioDeBase(base);

    const bilan = await emails.passer();
    expect(bilan).toMatchObject({ reserves: 2, simules: 2, envoyes: 0, echecs: 0 });
    expect(bilan.sautes).toBeGreaterThan(0);

    const alice = base.tables.envois_emails.find((e) => e.destinataire_id === ID.alice && e.etape === 'bienvenue');
    const bruno = base.tables.envois_emails.find((e) => e.destinataire_id === ID.bruno && e.etape === 'jour_j');
    expect(alice).toMatchObject({ statut: 'simule', reel: false, calendrier_id: null });
    expect(bruno).toMatchObject({ statut: 'simule', reel: false, calendrier_id: ID.aujourdhui });
    expect(alice?.envoye_le).toBe(new Date(MAINTENANT).toISOString());

    const journalises = journal.filter((l) => (l as { message?: string }).message === 'email journalisé');
    expect(journalises).toHaveLength(2);
    expect(journalises.map((l) => (l as { to: string }).to).sort()).toEqual(['a***@exemple.fr', 'b***@exemple.fr']);
    const tout = JSON.stringify([journal, journalPlanificateur]);
    expect(tout).not.toContain('alice@exemple.fr');
    expect(tout).not.toContain('bruno@exemple.fr');

    // La réservation utilise la clé d'unicité complète et n'écrase rien.
    const reservation = base.appels.find((a) => a.methode === 'POST' && a.chemin === '/rest/v1/envois_emails');
    expect(reservation?.params.get('on_conflict')).toBe('destinataire_id,etape,calendrier_id,message_id,reel');
    expect(reservation?.prefer).toContain('resolution=ignore-duplicates');
    expect(reservation?.prefer).toContain('return=representation');
    const rpc = base.appels.find((a) => a.chemin === '/rest/v1/rpc/emails_a_traiter');
    expect(rpc?.corps).toEqual({ p_maintenant: new Date(MAINTENANT).toISOString(), p_reel: false });

    horloge.t += 60_000;
    const second = await emails.passer();
    expect(second).toMatchObject({ reserves: 0, simules: 0, envoyes: 0, echecs: 0 });
    expect(journal.filter((l) => (l as { message?: string }).message === 'email journalisé')).toHaveLength(2);
    expect(emails.etat()).toMatchObject({ mode: 'log', pret: true, cleLiens: true, dernierPassage: new Date(horloge.t).toISOString() });
  });

  it('mode off : passer() ne fait aucun appel réseau', async () => {
    const { base, emails } = preparer({ mode: 'off' });
    scenarioDeBase(base);
    expect(await emails.passer()).toEqual({ reserves: 0, envoyes: 0, simules: 0, echecs: 0, sautes: 0 });
    expect(base.appels).toHaveLength(0);
  });

  it('clé de liens absente ou invalide : planificateur inactif, aucun appel, liens en 503', async () => {
    for (const cleLiens of [null, 'trop-courte']) {
      const { base, emails } = preparer({ cleLiens });
      scenarioDeBase(base);
      expect(emails.configure).toBe(false);
      expect(await emails.passer()).toEqual({ reserves: 0, envoyes: 0, simules: 0, echecs: 0, sautes: 0 });
      expect(base.appels).toHaveLength(0);
      const serveur = await lancer(emails);
      expect((await lien(serveur, { jeton: 'x.y', action: 'decrire' })).status).toBe(503);
      expect(emails.etat()).toMatchObject({ pret: false, cleLiens: false });
    }
  });

  it('SMTP en échec trois fois : nouvel essai à +5 puis +10 min, puis echec définitif avec tentatives = 3', async () => {
    const horloge = { t: MAINTENANT };
    const { base, emails, courriel } = preparer({ mode: 'smtp', courriel: faussePoste('smtp', true), horloge });
    scenarioDeBase(base);
    base.tables.destinataires_emails = base.tables.destinataires_emails.filter((d) => d.id === ID.alice);

    expect(await emails.passer()).toMatchObject({ reserves: 1, echecs: 1, envoyes: 0 });
    const ligne = () => base.tables.envois_emails.find((e) => e.destinataire_id === ID.alice && e.etape === 'bienvenue');
    expect(ligne()).toMatchObject({ statut: 'en_attente', tentatives: 1, reel: true, prevu_le: new Date(MAINTENANT + 5 * 60_000).toISOString() });

    horloge.t += 60_000;
    await emails.passer();
    expect(courriel.envoyer).toHaveBeenCalledTimes(1);

    horloge.t = MAINTENANT + 5 * 60_000;
    await emails.passer();
    expect(ligne()).toMatchObject({ statut: 'en_attente', tentatives: 2, prevu_le: new Date(horloge.t + 10 * 60_000).toISOString() });

    horloge.t += 10 * 60_000;
    expect(await emails.passer()).toMatchObject({ echecs: 1 });
    expect(ligne()).toMatchObject({ statut: 'echec', tentatives: 3 });
    expect(courriel.envoyer).toHaveBeenCalledTimes(3);

    horloge.t += 60 * 60_000;
    await emails.passer();
    expect(courriel.envoyer).toHaveBeenCalledTimes(3);
  });

  it('mode smtp : en-têtes List-Unsubscribe (un clic + mailto), adresse nue, statut envoye', async () => {
    const { base, emails, courriel } = preparer({ mode: 'smtp' });
    scenarioDeBase(base);
    base.tables.destinataires_emails = base.tables.destinataires_emails.filter((d) => d.id === ID.alice);

    expect(await emails.passer()).toMatchObject({ reserves: 1, envoyes: 1 });
    expect(courriel.envoyer).toHaveBeenCalledTimes(1);
    const message = courriel.envoyer.mock.calls[0][0] as { to: string; subject: string; html: string; text: string; headers: Record<string, string> };
    expect(message.to).toBe('alice@exemple.fr');
    expect(message.subject).toBe(MODELES_DEFAUT.bienvenue.sujet);
    expect(message.html).toContain('Ville ' + ID.demain);
    expect(message.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    const entete = /^<(http:\/\/127\.0\.0\.1:4173\/api\/emails\/desinscription\?j=([^>]+))>, <mailto:bonjour@olympiadedesmanades\.fr\?subject=[A-Za-z]+>$/.exec(message.headers['List-Unsubscribe']);
    expect(entete).not.toBeNull();
    expect(verifierLien(CLE, entete?.[2], MAINTENANT, 'desinscription')).toMatchObject({ d: ID.alice });
    expect(base.tables.envois_emails.find((e) => e.etape === 'bienvenue' && e.destinataire_id === ID.alice)).toMatchObject({ statut: 'envoye', reel: true });
  });

  it('sans adresse dans EMAILS_FROM, List-Unsubscribe ne contient que le lien un clic', async () => {
    const { base, emails, courriel } = preparer({ mode: 'smtp', plus: { expediteur: 'Olympiade' } });
    scenarioDeBase(base);
    base.tables.destinataires_emails = base.tables.destinataires_emails.filter((d) => d.id === ID.alice);
    await emails.passer();
    const message = courriel.envoyer.mock.calls[0][0] as { headers: Record<string, string> };
    expect(message.headers['List-Unsubscribe']).toMatch(/^<http:\/\/127\.0\.0\.1:4173\/api\/emails\/desinscription\?j=[^>]+>$/);
  });

  it('relit la date au moment de l’envoi : date annulée ou soirée suspendue entre la réservation et l’envoi', async () => {
    for (const [changement, raison] of [
      [{ statut: 'annulee' }, 'date_annulee'],
      [{ soiree: { slug: 'soiree-du-jour', statut: 'reportee' } }, 'soiree_suspendue'],
      [{ soiree: { slug: 'soiree-du-jour', statut: 'annulee' } }, 'soiree_suspendue'],
      [{ statut: 'previsionnelle' }, 'date_non_confirmee'],
    ] as const) {
      const { base, emails, courriel } = preparer({ mode: 'smtp' });
      scenarioDeBase(base);
      base.tables.destinataires_emails = base.tables.destinataires_emails.filter((d) => d.id === ID.bruno);
      base.tables.envois_emails.push(envoi(ID.bruno, 'jour_j', ID.aujourdhui, {
        reel: true, statut: 'en_attente', envoye_le: null, prevu_le: '2027-07-29T08:00:00Z', cree_le: '2027-07-29T08:00:00Z',
      }));
      Object.assign(base.tables.calendrier[1], changement);

      const bilan = await emails.passer();
      expect(courriel.envoyer).not.toHaveBeenCalled();
      expect(bilan.envoyes).toBe(0);
      expect(base.tables.envois_emails.find((e) => e.etape === 'jour_j')).toMatchObject({ statut: 'saute', raison });
    }
  });

  it('une ligne restée en attente plus de 12 h (serveur arrêté) est sautée, pas envoyée en retard', async () => {
    const { base, emails, courriel } = preparer({ mode: 'smtp' });
    scenarioDeBase(base);
    base.tables.destinataires_emails = base.tables.destinataires_emails.filter((d) => d.id === ID.bruno);
    base.tables.envois_emails.push(envoi(ID.bruno, 'jour_j', ID.aujourdhui, {
      reel: true, statut: 'en_attente', envoye_le: null, prevu_le: '2027-07-28T19:00:00Z', cree_le: '2027-07-28T19:00:00Z',
    }));
    await emails.passer();
    expect(courriel.envoyer).not.toHaveBeenCalled();
    expect(base.tables.envois_emails.find((e) => e.etape === 'jour_j')).toMatchObject({ statut: 'saute', raison: 'fenetre_depassee' });
  });

  it('relit le consentement et la désinscription au moment de l’envoi', async () => {
    const { base, emails, courriel } = preparer({ mode: 'smtp' });
    base.tables.modeles_emails = modeles();
    base.tables.calendrier = [date(ID.aout, '2027-08-06')];
    base.tables.destinataires_emails = [
      destinataire(ID.chloe, 'chloe@exemple.fr', { annonces: false }),
      destinataire(ID.denis, 'denis@exemple.fr', { desinscrit_le: '2027-07-29T07:00:00Z', annonces: false }),
    ];
    const attente = { reel: true, statut: 'en_attente', envoye_le: null, prevu_le: '2027-07-29T08:00:00Z', cree_le: '2027-07-29T08:00:00Z' };
    base.tables.envois_emails = [envoi(ID.chloe, 'annonce', ID.aout, attente), envoi(ID.denis, 'jour_j', ID.aout, attente)];
    await emails.passer();
    expect(courriel.envoyer).not.toHaveBeenCalled();
    expect(base.tables.envois_emails.find((e) => e.destinataire_id === ID.chloe)).toMatchObject({ statut: 'saute', raison: 'sans_consentement' });
    expect(base.tables.envois_emails.find((e) => e.destinataire_id === ID.denis)).toMatchObject({ statut: 'saute', raison: 'desinscrit' });
  });

  it('une annonce sur deux dates part en un seul e-mail, avec un lien « Je viens » par date', async () => {
    const { base, emails, courriel } = preparer({ mode: 'smtp' });
    base.tables.modeles_emails = modeles();
    base.tables.calendrier = [date(ID.aout, '2027-08-06'), date(ID.aout2, '2027-08-07')];
    base.tables.destinataires_emails = [destinataire(ID.chloe, 'chloe@exemple.fr', {
      annonces: true, annonces_le: '2027-06-01T10:00:00Z', annonces_texte: CONSENTEMENT_ANNONCES_TEXTE, annonces_version: '2026-10-17',
    })];
    const attente = { reel: true, statut: 'en_attente', envoye_le: null, prevu_le: '2027-07-29T08:00:00Z', cree_le: '2027-07-29T08:00:00Z' };
    base.tables.envois_emails = [envoi(ID.chloe, 'annonce', ID.aout, attente), envoi(ID.chloe, 'annonce', ID.aout2, attente)];

    const bilan = await emails.passer();
    expect(courriel.envoyer).toHaveBeenCalledTimes(1);
    expect(bilan.envoyes).toBe(1);
    const message = courriel.envoyer.mock.calls[0][0] as { html: string; text: string };
    expect(message.text).toContain(`Ville ${ID.aout}`);
    expect(message.text).toContain(`Ville ${ID.aout2}`);
    expect((message.html.match(/\/emails\/je-viens\?j=/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(base.tables.envois_emails.filter((e) => e.statut === 'envoye')).toHaveLength(2);
  });

  it('n’envoie pas une ligne réclamée entre-temps par une autre instance', async () => {
    const { base, emails, courriel } = preparer({ mode: 'smtp' });
    scenarioDeBase(base);
    base.tables.destinataires_emails = base.tables.destinataires_emails.filter((d) => d.id === ID.bruno);
    base.tables.envois_emails.push(envoi(ID.bruno, 'jour_j', ID.aujourdhui, {
      reel: true, statut: 'en_attente', envoye_le: null, prevu_le: '2027-07-29T08:00:00Z', cree_le: '2027-07-29T08:00:00Z',
    }));
    base.intercepter = (appel) => {
      if (appel.methode === 'PATCH' && appel.chemin === '/rest/v1/envois_emails' && appel.params.get('statut') === 'eq.en_attente') {
        // L'autre instance a déjà repoussé prevu_le : la réclamation ne touche aucune ligne.
        return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return null;
    };
    await emails.passer();
    expect(courriel.envoyer).not.toHaveBeenCalled();
  });

  it('respecte le débit maximal par seconde', async () => {
    const attentes: number[] = [];
    const { base, emails, courriel } = preparer({
      mode: 'smtp',
      plus: { debitParSeconde: 2, attendre: async (ms: number) => { attentes.push(ms); } },
    });
    base.tables.modeles_emails = modeles();
    base.tables.calendrier = [date(ID.aujourdhui, '2027-07-29')];
    for (let i = 0; i < 5; i++) {
      const id = `55555555-5555-4555-8555-00000000000${i}`;
      base.tables.destinataires_emails.push(destinataire(id, `p${i}@exemple.fr`));
      base.tables.envois_emails.push(envoi(id, 'jour_j', ID.aujourdhui, {
        reel: true, statut: 'en_attente', envoye_le: null, prevu_le: '2027-07-29T08:00:00Z', cree_le: '2027-07-29T08:00:00Z',
      }));
    }
    await emails.passer();
    expect(courriel.envoyer).toHaveBeenCalledTimes(5);
    expect(attentes.length).toBeGreaterThanOrEqual(2);
    expect(attentes.every((ms) => ms > 0 && ms <= 1000)).toBe(true);
  });

  it('purge au premier passage après 03:00 (Paris), une fois par jour', async () => {
    const horloge = { t: Date.parse('2027-07-29T00:30:00Z') }; // 02:30 à Paris
    const { base, emails } = preparer({ mode: 'smtp', horloge });
    base.tables.modeles_emails = modeles();
    base.tables.destinataires_emails = [
      destinataire(ID.chloe, 'chloe@exemple.fr', { abonne: true, abonnement_a_confirmer: true, confirme_le: null, inscrit_le: '2027-06-01T10:00:00Z' }),
      destinataire(ID.denis, 'denis@exemple.fr', { abonne: true, abonnement_a_confirmer: true, confirme_le: null, inscrit_le: '2027-07-15T10:00:00Z' }),
    ];
    base.tables.abonnements_actualites = [{ email: 'chloe@exemple.fr' }, { email: 'denis@exemple.fr' }];
    base.tables.envois_emails = [
      envoi(ID.chloe, 'confirmation', null, { reel: true, statut: 'envoye', envoye_le: '2027-06-27T10:00:00Z', cree_le: '2027-06-27T10:00:00Z' }),
      envoi(ID.denis, 'confirmation', null, { reel: true, statut: 'envoye', envoye_le: '2027-07-19T10:00:00Z', cree_le: '2027-07-19T10:00:00Z' }),
    ];
    const purges = () => base.appels.filter((a) => a.methode === 'DELETE');

    await emails.passer();
    expect(purges()).toHaveLength(0);

    horloge.t = Date.parse('2027-07-29T01:30:00Z'); // 03:30 à Paris
    await emails.passer();
    const anciens = purges().find((a) => a.chemin === '/rest/v1/envois_emails');
    expect(anciens?.params.get('cree_le')).toBe('lt.2026-07-29T01:30:00.000Z');
    const abonnements = purges().filter((a) => a.chemin === '/rest/v1/abonnements_actualites');
    expect(abonnements.map((a) => a.params.get('email'))).toEqual(['eq.chloe@exemple.fr']);
    expect(base.tables.abonnements_actualites).toEqual([{ email: 'denis@exemple.fr' }]);

    const avant = purges().length;
    horloge.t += 60 * 60_000;
    await emails.passer();
    expect(purges()).toHaveLength(avant);
  });

  it('demarrer() sème les 9 modèles sans écraser une ligne existante, et retente après un échec', async () => {
    const { base, emails } = preparer();
    base.tables.modeles_emails = [{ cle: 'bienvenue', actif: true, ...MODELES_DEFAUT.bienvenue, sujet: 'Sujet modifié par l’admin' }];
    let pannes = 1;
    base.intercepter = (appel) => {
      if (appel.chemin === '/rest/v1/modeles_emails' && pannes > 0) {
        pannes -= 1;
        return new Response(JSON.stringify({ code: '42501', details: 'secret@exemple.fr' }), { status: 403 });
      }
      return null;
    };
    await emails.demarrer();
    expect(base.tables.modeles_emails).toHaveLength(1);

    await emails.passer();
    const semis = base.appels.filter((a) => a.chemin === '/rest/v1/modeles_emails' && a.methode === 'POST');
    expect(semis).toHaveLength(2);
    expect(semis[1].params.get('on_conflict')).toBe('cle');
    expect(semis[1].prefer).toContain('resolution=ignore-duplicates');
    expect((semis[1].corps as Ligne[]).map((m) => m.cle)).toEqual([...ETAPES]);
    expect(base.tables.modeles_emails).toHaveLength(9);
    expect(base.tables.modeles_emails.find((m) => m.cle === 'bienvenue')?.sujet).toBe('Sujet modifié par l’admin');
    expect(base.tables.modeles_emails.find((m) => m.cle === 'veille')).toMatchObject({ jours_decalage: -1, heure_envoi: '18:00', encart: null });

    await emails.passer();
    expect(base.appels.filter((a) => a.chemin === '/rest/v1/modeles_emails' && a.methode === 'POST')).toHaveLength(2);
  });

  it('ne journalise jamais le corps ni les détails d’une erreur PostgREST', async () => {
    const { base, emails, journal } = preparer();
    scenarioDeBase(base);
    base.intercepter = (appel) => appel.chemin === '/rest/v1/rpc/emails_a_traiter'
      ? new Response(JSON.stringify({ code: '23505', details: 'Key (email)=(alice@exemple.fr)', message: 'alice@exemple.fr' }), { status: 409 })
      : null;
    await emails.passer();
    const texte = JSON.stringify(journal);
    expect(texte).toContain('23505');
    expect(texte).toContain('409');
    expect(texte).not.toContain('alice@exemple.fr');
  });
});

// ——— Liens publics ———

describe('liens publics des e-mails', () => {
  const jeton = (charge: Parameters<typeof signerLien>[1]) => signerLien(CLE, charge);

  it('GET (scanner de liens) : 405 et aucune écriture', async () => {
    const { base, emails } = preparer();
    scenarioDeBase(base);
    const serveur = await lancer(emails);
    const j = jeton({ t: 'desinscription', d: ID.alice });
    for (const chemin of ['/api/emails/lien', `/api/emails/desinscription?j=${j}`]) {
      const reponse = await fetch(`${serveur}${chemin}`);
      expect(reponse.status).toBe(405);
      expect(reponse.headers.get('allow')).toBe('POST');
    }
    expect(base.appels.filter((a) => a.methode === 'PATCH' || a.methode === 'DELETE' || a.methode === 'POST')).toHaveLength(0);
  });

  it('decrire : ne modifie rien et renvoie l’état attendu par les pages', async () => {
    const { base, emails } = preparer();
    scenarioDeBase(base);
    base.tables.destinataires_emails[0].abonne = true;
    base.tables.destinataires_emails[0].annonces = true;
    const serveur = await lancer(emails);

    const confirmation = await lien(serveur, { jeton: jeton({ t: 'confirmation', d: ID.alice, e: MAINTENANT + 60_000 }), action: 'decrire' });
    expect(confirmation.status).toBe(200);
    expect(await confirmation.json()).toEqual({ ok: true, etat: { type: 'confirmation', abonne: true, annonces: true, desinscrit: false } });

    const jeViens = await lien(serveur, { jeton: jeton({ t: 'je_viens', d: ID.alice, c: ID.demain, e: finDeJourParis('2027-07-30') }), action: 'decrire' });
    expect(await jeViens.json()).toEqual({
      ok: true,
      etat: { type: 'je_viens', date: { nom: 'Rencontre des manades', ville: `Ville ${ID.demain}`, date: '2027-07-30' }, abonne: true, annonces: true, desinscrit: false },
    });

    const absent = await lien(serveur, { jeton: jeton({ t: 'desinscription', d: '00000000-0000-4000-8000-000000000000' }), action: 'decrire' });
    expect(await absent.json()).toEqual({ ok: true, etat: { type: 'desinscription', abonne: false, annonces: false, desinscrit: true } });

    expect(base.ecritures()).toHaveLength(0);
  });

  it('jeton expiré : 410 ; jeton invalide, altéré ou d’un autre type : 400', async () => {
    const { base, emails } = preparer();
    scenarioDeBase(base);
    const serveur = await lancer(emails);
    const expire = jeton({ t: 'confirmation', d: ID.alice, e: MAINTENANT - 1 });
    expect((await lien(serveur, { jeton: expire, action: 'decrire' })).status).toBe(410);
    expect((await lien(serveur, { jeton: expire, action: 'confirmer' })).status).toBe(410);
    const valide = jeton({ t: 'desinscription', d: ID.alice });
    expect((await lien(serveur, { jeton: `${valide.slice(0, -2)}AA`, action: 'decrire' })).status).toBe(400);
    expect((await lien(serveur, { jeton: valide, action: 'confirmer' })).status).toBe(400);
    expect((await lien(serveur, { jeton: valide, action: 'inconnue' })).status).toBe(400);
    expect((await lien(serveur, { jeton: valide, action: 'decrire', intrus: 1 })).status).toBe(400);
    expect((await lien(serveur, { jeton: signerLien('b2'.repeat(32), { t: 'desinscription', d: ID.alice }), action: 'decrire' })).status).toBe(400);
    expect(base.ecritures()).toHaveLength(0);
  });

  it('refuse une origine tierce, un autre format et limite à 30 requêtes par IP et par 10 minutes', async () => {
    const { base, emails } = preparer();
    scenarioDeBase(base);
    const serveur = await lancer(emails);
    const j = jeton({ t: 'desinscription', d: ID.alice });
    expect((await lien(serveur, { jeton: j, action: 'decrire' }, { Origin: 'https://tiers.example' })).status).toBe(403);
    expect((await lien(serveur, { jeton: j, action: 'decrire' }, { 'Content-Type': 'text/plain' })).status).toBe(415);
    for (let i = 0; i < 28; i++) expect((await lien(serveur, { jeton: j, action: 'decrire' })).status).toBe(200);
    const refus = await lien(serveur, { jeton: j, action: 'decrire' });
    expect(refus.status).toBe(429);
    expect(refus.headers.get('retry-after')).toBe('600');
  });

  it('confirmer : un seul PATCH du clic, idempotent', async () => {
    const { base, emails } = preparer();
    scenarioDeBase(base);
    Object.assign(base.tables.destinataires_emails[0], { abonne: true, abonnement_a_confirmer: true, confirme_le: null });
    base.tables.abonnements_actualites = [{ email: 'alice@exemple.fr' }];
    const serveur = await lancer(emails);
    const j = jeton({ t: 'confirmation', d: ID.alice, e: MAINTENANT + 60_000 });

    expect(await (await lien(serveur, { jeton: j, action: 'confirmer' })).json()).toEqual({ ok: true, etat: 'fait' });
    const patchs = base.appels.filter((a) => a.methode === 'PATCH');
    expect(patchs).toHaveLength(1);
    expect(patchs[0].chemin).toBe('/rest/v1/destinataires_emails');
    expect(patchs[0].params.get('id')).toBe(`eq.${ID.alice}`);
    expect(patchs[0].params.get('abonnement_a_confirmer')).toBe('is.true');
    expect(patchs[0].corps).toEqual({ abonnement_confirme_le: new Date(MAINTENANT).toISOString() });
    expect(base.tables.destinataires_emails[0]).toMatchObject({ abonnement_a_confirmer: false, annonces: true });

    expect(await (await lien(serveur, { jeton: j, action: 'confirmer' })).json()).toEqual({ ok: true, etat: 'deja_fait' });
  });

  it('desinscrire : PATCH desinscrit_le et annonces, PUIS suppression de l’abonnement (la ligne d’opposition reste)', async () => {
    const { base, emails } = preparer();
    scenarioDeBase(base);
    Object.assign(base.tables.destinataires_emails[0], { abonne: true, annonces: true, annonces_le: 'x', annonces_texte: 'x', annonces_version: 'x' });
    base.tables.abonnements_actualites = [{ email: 'alice@exemple.fr' }];
    const serveur = await lancer(emails);
    const j = jeton({ t: 'desinscription', d: ID.alice });

    expect(await (await lien(serveur, { jeton: j, action: 'desinscrire' })).json()).toEqual({ ok: true, etat: 'fait' });
    const ecritures = base.ecritures();
    expect(ecritures.map((a) => `${a.methode} ${a.chemin}`)).toEqual([
      'PATCH /rest/v1/destinataires_emails',
      'DELETE /rest/v1/abonnements_actualites',
    ]);
    expect(ecritures[0].corps).toEqual({ desinscrit_le: new Date(MAINTENANT).toISOString(), annonces: false });
    expect(ecritures[1].params.get('email')).toBe('eq.alice@exemple.fr');
    expect(base.tables.abonnements_actualites).toHaveLength(0);
    expect(base.tables.destinataires_emails.find((d) => d.id === ID.alice)).toMatchObject({ desinscrit_le: new Date(MAINTENANT).toISOString(), annonces: false, abonne: false });

    expect(await (await lien(serveur, { jeton: j, action: 'desinscrire' })).json()).toEqual({ ok: true, etat: 'deja_fait' });
  });

  it('arreter_annonces : PATCH annonces = false seulement, sans toucher à l’abonnement', async () => {
    const { base, emails } = preparer();
    scenarioDeBase(base);
    Object.assign(base.tables.destinataires_emails[0], { abonne: true, annonces: true });
    base.tables.abonnements_actualites = [{ email: 'alice@exemple.fr' }];
    const serveur = await lancer(emails);
    const j = jeton({ t: 'desinscription', d: ID.alice });
    expect(await (await lien(serveur, { jeton: j, action: 'arreter_annonces' })).json()).toEqual({ ok: true, etat: 'fait' });
    expect(base.ecritures().map((a) => `${a.methode} ${a.chemin}`)).toEqual(['PATCH /rest/v1/destinataires_emails']);
    expect(base.ecritures()[0].corps).toEqual({ annonces: false });
    expect(base.tables.abonnements_actualites).toHaveLength(1);
    expect(await (await lien(serveur, { jeton: j, action: 'arreter_annonces' })).json()).toEqual({ ok: true, etat: 'deja_fait' });
  });

  it('je_viens : ajoute un rattachement « je_viens », idempotent ; date déplacée ou annulée : 410', async () => {
    const { base, emails } = preparer();
    scenarioDeBase(base);
    const serveur = await lancer(emails);
    const j = jeton({ t: 'je_viens', d: ID.bruno, c: ID.demain, e: finDeJourParis('2027-07-30') });
    expect(await (await lien(serveur, { jeton: j, action: 'je_viens' })).json()).toEqual({ ok: true, etat: 'fait' });
    expect(base.tables.rattachements_emails.find((r) => r.destinataire_id === ID.bruno && r.calendrier_id === ID.demain)).toMatchObject({ origine: 'je_viens' });
    const insertion = base.appels.find((a) => a.methode === 'POST' && a.chemin === '/rest/v1/rattachements_emails');
    expect(insertion?.params.get('on_conflict')).toBe('destinataire_id,calendrier_id');
    expect(insertion?.prefer).toContain('resolution=ignore-duplicates');
    expect(await (await lien(serveur, { jeton: j, action: 'je_viens' })).json()).toEqual({ ok: true, etat: 'deja_fait' });

    base.tables.calendrier[0].date_soiree = '2027-07-31';
    expect((await lien(serveur, { jeton: j, action: 'decrire' })).status).toBe(410);
    expect((await lien(serveur, { jeton: j, action: 'je_viens' })).status).toBe(410);
    base.tables.calendrier[0].date_soiree = '2027-07-30';
    base.tables.calendrier[0].statut = 'annulee';
    expect((await lien(serveur, { jeton: j, action: 'je_viens' })).status).toBe(410);
  });

  it('désinscription en un clic (RFC 8058) : POST sans Origin, corps List-Unsubscribe=One-Click', async () => {
    const { base, emails } = preparer();
    scenarioDeBase(base);
    const serveur = await lancer(emails);
    const j = jeton({ t: 'desinscription', d: ID.bruno });
    const sansCorps = await fetch(`${serveur}/api/emails/desinscription?j=${j}`, { method: 'POST' });
    expect(sansCorps.status).toBe(400);
    const invalide = await fetch(`${serveur}/api/emails/desinscription?j=abc.def`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click',
    });
    expect(invalide.status).toBe(400);
    expect(base.ecritures()).toHaveLength(0);

    const reponse = await fetch(`${serveur}/api/emails/desinscription?j=${j}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click',
    });
    expect(reponse.status).toBe(200);
    expect(base.tables.destinataires_emails.find((d) => d.id === ID.bruno)).toMatchObject({ desinscrit_le: new Date(MAINTENANT).toISOString(), annonces: false });
  });
});

// ——— Admin ———

describe('endpoints admin des e-mails', () => {
  const brouillon = { sujet: 'Bonjour {{prenom}}', preheader: '', corps: 'C’est {{compte_a_rebours}} à {{ville}}.', encart: null };

  function test(serveur: string, jeton: string | null, corps: unknown = { cle: 'veille', brouillon, calendrierId: ID.demain }) {
    return fetch(`${serveur}/api/admin/emails/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
      body: JSON.stringify(corps),
    });
  }

  it('verifierAdmin : 401 sans jeton ou jeton refusé, 403 en AAL1 ou sans rôle admin', async () => {
    const base = new FauxSupabase(() => MAINTENANT);
    const options = { supabaseUrl: SUPABASE, publishableKey: 'cle-publique', demander: base.fetch };
    const requete = (jeton?: string) => ({ headers: jeton ? { authorization: `Bearer ${jeton}` } : {} }) as never;
    expect(await verifierAdmin(requete(), options)).toMatchObject({ ok: false, statut: 401 });
    expect(await verifierAdmin(requete('inconnu'), options)).toMatchObject({ ok: false, statut: 401 });
    const { jeton, id } = admin(base);
    expect(await verifierAdmin(requete(jeton), options)).toEqual({ ok: true, id, email: 'admin@exemple.fr' });
    const aal1 = admin(base, { aal: 'aal1' });
    expect(await verifierAdmin(requete(aal1.jeton), options)).toMatchObject({ ok: false, statut: 403 });
    const spectateur = admin(base, { role: 'spectateur' });
    expect(await verifierAdmin(requete(spectateur.jeton), options)).toMatchObject({ ok: false, statut: 403 });
  });

  it('/test : 401, 403 (AAL1, non-admin), envoi à l’adresse de /auth/v1/user, 429 au 11e envoi de l’heure', async () => {
    const { base, emails, courriel } = preparer({ mode: 'log' });
    scenarioDeBase(base);
    const serveur = await lancer(emails);
    expect((await test(serveur, null)).status).toBe(401);
    expect((await test(serveur, admin(base, { aal: 'aal1' }).jeton)).status).toBe(403);
    expect((await test(serveur, admin(base, { role: 'spectateur' }).jeton)).status).toBe(403);
    expect(courriel.envoyer).not.toHaveBeenCalled();

    const { jeton } = admin(base);
    const reponse = await test(serveur, jeton);
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ ok: true, mode: 'log' });
    const message = courriel.envoyer.mock.calls[0][0] as { to: string; subject: string; text: string };
    expect(message.to).toBe('admin@exemple.fr');
    expect(message.subject).toBe('[Test] Bonjour Camille');
    expect(message.text).toContain(`demain à Ville ${ID.demain}`);

    expect((await test(serveur, jeton, { cle: 'veille', brouillon: { ...brouillon, corps: '' }, calendrierId: null })).status).toBe(400);
    for (let i = 0; i < 9; i++) expect((await test(serveur, jeton)).status).toBe(200);
    expect((await test(serveur, jeton)).status).toBe(429);
    expect(courriel.envoyer).toHaveBeenCalledTimes(10);
    expect(base.ecritures()).toHaveLength(0);
  });

  it('/message : insère messages_inscrits puis les envois des rattachés confirmés non désinscrits', async () => {
    const { base, emails } = preparer({ mode: 'smtp' });
    scenarioDeBase(base);
    base.tables.destinataires_emails.push(
      destinataire(ID.chloe, 'chloe@exemple.fr', { desinscrit_le: '2027-07-01T00:00:00Z' }),
      destinataire(ID.denis, 'denis@exemple.fr', { confirme_le: null }),
    );
    base.tables.rattachements_emails.push(
      { destinataire_id: ID.bruno, calendrier_id: ID.demain, origine: 'je_viens', cree_le: '2027-07-01T00:00:00Z' },
      { destinataire_id: ID.chloe, calendrier_id: ID.demain, origine: 'inscription', cree_le: '2027-07-01T00:00:00Z' },
      { destinataire_id: ID.denis, calendrier_id: ID.demain, origine: 'inscription', cree_le: '2027-07-01T00:00:00Z' },
    );
    const serveur = await lancer(emails);
    const { jeton, id } = admin(base);
    const corps = { calendrierId: ID.demain, sujet: 'Changement d’horaire', corps: 'Bonjour {{prenom}}, la soirée commence à 22 h.' };
    const envoyer = () => fetch(`${serveur}/api/admin/emails/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` }, body: JSON.stringify(corps),
    });

    const reponse = await envoyer();
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ ok: true, destinataires: 2 });
    const ecritures = base.ecritures().map((a) => `${a.methode} ${a.chemin}`);
    expect(ecritures).toEqual(['POST /rest/v1/messages_inscrits', 'POST /rest/v1/envois_emails']);
    const message = base.tables.messages_inscrits[0];
    expect(message).toMatchObject({ calendrier_id: ID.demain, sujet: corps.sujet, corps: corps.corps, cree_par: id, destinataires: 2 });
    const envois = base.tables.envois_emails.filter((e) => e.etape === 'message');
    expect(envois.map((e) => e.destinataire_id).sort()).toEqual([ID.alice, ID.bruno]);
    expect(envois[0]).toMatchObject({ message_id: message.id, calendrier_id: ID.demain, reel: true, statut: 'en_attente' });

    // Un double clic ne crée ni second message ni second envoi.
    expect(await (await envoyer()).json()).toEqual({ ok: true, destinataires: 2 });
    expect(base.tables.messages_inscrits).toHaveLength(1);
    expect(base.tables.envois_emails.filter((e) => e.etape === 'message')).toHaveLength(2);

    // Le texte d'exemple n'est jamais envoyé tel quel.
    const defaut = await fetch(`${serveur}/api/admin/emails/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ ...corps, corps: MODELES_DEFAUT.message.corps }),
    });
    expect(defaut.status).toBe(400);
  });

  it('/message en mode off : 503, rien n’est écrit', async () => {
    const { base, emails } = preparer({ mode: 'off' });
    scenarioDeBase(base);
    const serveur = await lancer(emails);
    const { jeton } = admin(base);
    const reponse = await fetch(`${serveur}/api/admin/emails/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ calendrierId: ID.demain, sujet: 'Info', corps: 'Un message.' }),
    });
    expect(reponse.status).toBe(503);
    expect(base.ecritures()).toHaveLength(0);
  });

  it('/etat : mode, planificateur prêt, présence de la clé, dernier passage et bilan', async () => {
    const { base, emails } = preparer({ mode: 'log' });
    scenarioDeBase(base);
    const serveur = await lancer(emails);
    const { jeton } = admin(base);
    const lire = async () => (await fetch(`${serveur}/api/admin/emails/etat`, { headers: { Authorization: `Bearer ${jeton}` } })).json();
    expect(await lire()).toEqual({ mode: 'log', pret: true, cleLiens: true, dernierPassage: null, dernierBilan: null });
    await emails.passer();
    expect(await lire()).toEqual({
      mode: 'log', pret: true, cleLiens: true, dernierPassage: new Date(MAINTENANT).toISOString(),
      dernierBilan: expect.objectContaining({ reserves: 2, simules: 2 }),
    });
    expect((await fetch(`${serveur}/api/admin/emails/etat`, { method: 'POST', headers: { Authorization: `Bearer ${jeton}` } })).status).toBe(405);
  });
});

describe('configuration et textes figés', () => {
  it('emailsDepuisEnvironnement : sans Supabase, clé ni SMTP, le module se crée sans planter et reste inactif', async () => {
    const emails = emailsDepuisEnvironnement({});
    expect(emails.configure).toBe(false);
    expect(emails.mode).toBe('off');
    expect(await emails.passer()).toEqual({ reserves: 0, envoyes: 0, simules: 0, echecs: 0, sautes: 0 });
    await emails.demarrer();
    emails.arreter();
    const actif = emailsDepuisEnvironnement({
      VITE_SUPABASE_URL: SUPABASE, SUPABASE_SERVICE_ROLE_KEY: 'cle-service', CONTACT_ORIGIN: ORIGINE,
      EMAILS_CLE_LIENS: CLE, SMTP_MODE: 'log', EMAILS_DEBIT_PAR_SECONDE: '50',
    });
    expect(actif.configure).toBe(true);
    expect(actif.mode).toBe('log');
    expect(actif.confirmationActive).toBe(false);
    const reel = emailsDepuisEnvironnement({
      VITE_SUPABASE_URL: SUPABASE, SUPABASE_SERVICE_ROLE_KEY: 'cle-service', CONTACT_ORIGIN: ORIGINE, EMAILS_CLE_LIENS: CLE,
      SMTP_MODE: 'smtp', SMTP_HOST: 'smtp.exemple.fr', SMTP_USER: 'u', SMTP_PASS: 'p', EMAILS_FROM: EXPEDITEUR,
    });
    expect(reel.confirmationActive).toBe(true);
  });

  it('la migration contient CONSENTEMENT_ANNONCES_TEXTE à l’identique', () => {
    const migration = readFileSync(new URL('../../supabase/migrations/20261017160000_sequence_emails.sql', import.meta.url), 'utf8');
    expect(migration).toContain(`'${CONSENTEMENT_ANNONCES_TEXTE}'`);
  });
});
