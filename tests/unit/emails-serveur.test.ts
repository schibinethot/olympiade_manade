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
// et reproduit les déclencheurs utiles de la migration (clic de confirmation, retrait d'un abonnement) et
// les RPC du serveur (emails_a_traiter en forme compacte, retrait, purge). Le vrai SQL est testé à part
// (tests/db) et contre un vrai PostgREST (tests/postgrest).

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

/** Identité de l'organisateur par défaut (pied des e-mails, condition du mode smtp). */
const IDENTITE = { raison_sociale: 'Association des Manades', forme_juridique: 'association loi 1901', adresse: '1 place des Arènes, 30250 Sommières' };
const LIGNE_IDENTITE = 'L’Olympiade des Manades est organisée par Association des Manades, association loi 1901, 1 place des Arènes, 30250 Sommières.';

class FauxSupabase {
  tables: Record<string, Ligne[]> = {
    modeles_emails: [], destinataires_emails: [], rattachements_emails: [], messages_inscrits: [],
    envois_emails: [], abonnements_actualites: [], calendrier: [], palmares: [], profils: [],
    identite_legale: [{ ...IDENTITE }],
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
    if (url.pathname === '/rest/v1/rpc/retirer_abonnement_destinataire') {
      const d = this.tables.destinataires_emails.find((l) => l.id === (corps as { p_destinataire: string }).p_destinataire);
      if (d) this.supprimerAbonnement(String(d.email));
      return this.json(200, null);
    }
    if (url.pathname === '/rest/v1/rpc/purger_demandes_non_confirmees') {
      return this.json(200, this.purger(corps as { p_maintenant: string; p_limite: number }));
    }
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
      // Le serveur ne supprime plus d'abonnement lui-même (droit retiré) : seules les RPC le font.
      if (table === 'abonnements_actualites') return this.json(403, { code: '42501' });
      this.tables[table] = lignes.filter((l) => !cibles.includes(l));
      return this.json(204, undefined);
    }
    return this.json(405, {});
  }

  /** Suppression d'un abonnement par son adresse (côté base) et déclencheur de retrait. */
  private supprimerAbonnement(email: string) {
    const avant = this.tables.abonnements_actualites.length;
    this.tables.abonnements_actualites = this.tables.abonnements_actualites.filter((a) => a.email !== email);
    if (this.tables.abonnements_actualites.length < avant) this.retirerAbonne(email);
  }

  /** public.purger_demandes_non_confirmees : 30 jours après l'envoi réel, ou après le dépôt si rien n'est parti. */
  private purger({ p_maintenant, p_limite }: { p_maintenant: string; p_limite: number }) {
    const limite = Date.parse(p_maintenant) - 30 * 86_400_000;
    const cibles = this.tables.destinataires_emails.filter((d) => {
      const abonnement = this.tables.abonnements_actualites.find((a) => a.email === d.email);
      if (!d.abonnement_a_confirmer || !abonnement) return false;
      const confirmations = this.tables.envois_emails.filter((e) => e.destinataire_id === d.id && e.etape === 'confirmation' && e.reel);
      const partie = confirmations.some((e) => e.statut === 'envoye' && Date.parse(String(e.envoye_le)) < limite);
      const enCours = confirmations.some((e) => e.statut === 'envoye' || e.statut === 'en_attente');
      return partie || (Date.parse(String(abonnement.cree_le ?? d.inscrit_le)) < limite && !enCours);
    }).slice(0, p_limite);
    for (const d of cibles) this.supprimerAbonnement(String(d.email));
    return cibles.length;
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

  /** Réponse compacte de emails_a_traiter (voir la migration) : tout le monde, toutes les dates, tous les envois du mode. */
  rpcAppels = 0;
  private rpc({ p_maintenant, p_reel }: { p_maintenant: string; p_reel: boolean }) {
    this.rpcAppels += 1;
    const t = this.tables;
    const jour = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date(p_maintenant));
    const dates = t.calendrier.map((c) => ({
      id: c.id, nom: c.nom, ville: c.ville, arenes: c.arenes, date_soiree: c.date_soiree, heure: c.heure, statut: c.statut,
      lien_billetterie: c.lien_billetterie, infos_pratiques: c.infos_pratiques, soiree: c.soiree, manades: c.manades, vainqueur: c.vainqueur,
    }));
    const position = (id: unknown) => {
      const i = dates.findIndex((d) => d.id === id);
      return i >= 0 ? i : (id ?? null);
    };
    const ms = (valeur: unknown) => (valeur === null || valeur === undefined ? null : Date.parse(String(valeur)));
    return {
      modeles: t.modeles_emails.map((m) => ({
        cle: m.cle, nom: m.nom, actif: m.actif, sujet: m.sujet, preheader: m.preheader, corps: m.corps, encart: m.encart,
        jours_decalage: m.jours_decalage, heure_envoi: m.heure_envoi,
      })),
      dates,
      prochaines: dates.filter((d) => d.statut === 'confirmee' && String(d.date_soiree) > jour
        && !['annulee', 'reportee'].includes(String((d.soiree as { statut?: string } | null)?.statut))).slice(0, 6),
      destinataires: t.destinataires_emails.map((d) => [
        d.id, d.abonnement_a_confirmer === true, d.desinscrit_le !== null && d.desinscrit_le !== undefined, d.annonces === true, ms(d.confirme_le),
        d.confirme_le && !d.desinscrit_le
          ? t.rattachements_emails.filter((r) => r.destinataire_id === d.id && dates.some((x) => x.id === r.calendrier_id))
            .map((r) => [position(r.calendrier_id), r.origine, ms(r.cree_le)])
          : [],
        t.envois_emails.filter((e) => e.destinataire_id === d.id && e.reel === p_reel)
          .map((e) => [e.etape, position(e.calendrier_id), e.statut, e.raison ?? null, ms(e.prevu_le)]),
      ]),
    };
  }
}

// ——— Données ———

const MAINTENANT = Date.parse('2027-07-29T08:05:00Z'); // jeudi 29/07/2027, 10:05 à Paris
const BILAN_VIDE = { reserves: 0, envoyes: 0, simules: 0, echecs: 0, sautes: 0, liberes: 0 };
const MINUTE = 60_000;
/** Jeton d'un lien : fragment `#j=` des pages, requête `?j=` du POST en un clic. */
function jetonDe(url: string) {
  const adresse = new URL(url);
  return new URLSearchParams(adresse.hash.slice(1)).get('j') ?? adresse.searchParams.get('j');
}

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
    expect(await emails.passer()).toEqual(BILAN_VIDE);
    expect(base.appels).toHaveLength(0);
  });

  it('clé de liens absente ou invalide : planificateur inactif, aucun appel, liens en 503', async () => {
    for (const cleLiens of [null, 'trop-courte']) {
      const { base, emails } = preparer({ cleLiens });
      scenarioDeBase(base);
      expect(emails.configure).toBe(false);
      expect(await emails.passer()).toEqual(BILAN_VIDE);
      expect(base.appels).toHaveLength(0);
      const serveur = await lancer(emails);
      expect((await lien(serveur, { jeton: 'x.y', action: 'decrire' })).status).toBe(503);
      expect(emails.etat()).toMatchObject({ pret: false, cleLiens: false });
    }
  });

  it('SMTP en échec réessayable : nouveaux essais 5, 30 puis 120 min après, puis echec définitif avec tentatives = 4', async () => {
    const horloge = { t: MAINTENANT };
    const { base, emails, courriel } = preparer({ mode: 'smtp', courriel: faussePoste('smtp', true), horloge });
    scenarioDeBase(base);
    base.tables.destinataires_emails = base.tables.destinataires_emails.filter((d) => d.id === ID.alice);

    expect(await emails.passer()).toMatchObject({ reserves: 1, echecs: 1, envoyes: 0 });
    const ligne = () => base.tables.envois_emails.find((e) => e.destinataire_id === ID.alice && e.etape === 'bienvenue');
    const echeance = new Date(MAINTENANT).toISOString();
    // prevu_le garde l'échéance d'origine ; envoye_le note l'heure de l'essai.
    expect(ligne()).toMatchObject({ statut: 'en_attente', tentatives: 1, reel: true, raison: 'envoi_impossible', prevu_le: echeance, envoye_le: echeance });

    let essai = MAINTENANT;
    for (const [delai, tentatives] of [[5, 2], [30, 3]] as const) {
      horloge.t = essai + (delai - 1) * MINUTE;
      await emails.passer();
      expect(courriel.envoyer, `avant +${delai}`).toHaveBeenCalledTimes(tentatives - 1);
      horloge.t = essai + delai * MINUTE;
      await emails.passer();
      expect(courriel.envoyer, `à +${delai}`).toHaveBeenCalledTimes(tentatives);
      expect(ligne()).toMatchObject({ statut: 'en_attente', tentatives, prevu_le: echeance, envoye_le: new Date(horloge.t).toISOString() });
      essai = horloge.t;
    }
    horloge.t = essai + 119 * MINUTE;
    await emails.passer();
    expect(courriel.envoyer).toHaveBeenCalledTimes(3);
    horloge.t = essai + 120 * MINUTE;
    expect(await emails.passer()).toMatchObject({ echecs: 1 });
    expect(ligne()).toMatchObject({ statut: 'echec', tentatives: 4, raison: 'envoi_impossible', prevu_le: echeance });
    expect(courriel.envoyer).toHaveBeenCalledTimes(4);

    horloge.t += 60 * MINUTE;
    await emails.passer();
    expect(courriel.envoyer).toHaveBeenCalledTimes(4);
    // L'éligibilité est filtrée par PostgREST : une lecture par nombre de tentatives, avec son délai.
    const lectures = base.appels.filter((a) => a.methode === 'GET' && a.chemin === '/rest/v1/envois_emails' && a.params.get('raison') === 'eq.envoi_impossible');
    expect(new Set(lectures.map((a) => `${a.params.get('tentatives')} ${a.params.get('envoye_le')?.slice(0, 4)}`))).toEqual(new Set(['eq.1 lte.', 'eq.2 lte.', 'eq.3 lte.']));
  });

  it('un refus SMTP définitif (5xx pour ce message) passe en echec sans nouvel essai', async () => {
    const horloge = { t: MAINTENANT };
    const courriel = { mode: 'smtp' as const, pret: true, envoyer: vi.fn(async () => ({ mode: 'smtp', envoye: false, echec: true, definitif: true })) };
    const { base, emails } = preparer({ mode: 'smtp', courriel, horloge });
    scenarioDeBase(base);
    base.tables.destinataires_emails = base.tables.destinataires_emails.filter((d) => d.id === ID.alice);
    expect(await emails.passer()).toMatchObject({ echecs: 1 });
    expect(base.tables.envois_emails.find((e) => e.etape === 'bienvenue' && e.destinataire_id === ID.alice))
      .toMatchObject({ statut: 'echec', raison: 'refus_definitif', tentatives: 1 });
    horloge.t += 200 * MINUTE;
    await emails.passer();
    expect(courriel.envoyer).toHaveBeenCalledTimes(1);
  });

  it('mode smtp : List-Unsubscribe un clic seulement (sans mailto), adresse nue, statut envoye', async () => {
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
    const entete = /^<(http:\/\/127\.0\.0\.1:4173\/api\/emails\/desinscription\?j=([^>]+))>$/.exec(message.headers['List-Unsubscribe']);
    expect(entete).not.toBeNull();
    expect(message.headers['List-Unsubscribe']).not.toContain('mailto');
    expect(verifierLien(CLE, entete?.[2], MAINTENANT, 'desinscription')).toMatchObject({ d: ID.alice });
    expect(base.tables.envois_emails.find((e) => e.etape === 'bienvenue' && e.destinataire_id === ID.alice)).toMatchObject({ statut: 'envoye', reel: true, raison: null });
  });

  it('prevu_le garde l’échéance d’origine : une bienvenue de 05:55 n’occupe pas le jour suivant, le jour J part', async () => {
    const horloge = { t: Date.parse('2027-07-29T03:55:00Z') }; // 05:55 à Paris, encore la nuit du 28
    const { base, emails, courriel } = preparer({ mode: 'smtp', horloge });
    base.tables.modeles_emails = modeles();
    base.tables.calendrier = [date(ID.aujourdhui, '2027-07-29')];
    base.tables.destinataires_emails = [destinataire(ID.alice, 'alice@exemple.fr', { confirme_le: '2027-07-29T03:50:00Z', inscrit_le: '2027-07-29T03:50:00Z' })];
    base.tables.rattachements_emails = [{ destinataire_id: ID.alice, calendrier_id: ID.aujourdhui, origine: 'inscription', cree_le: '2027-07-29T03:50:00Z' }];

    expect(await emails.passer()).toMatchObject({ envoyes: 1 });
    expect(base.tables.envois_emails.find((e) => e.etape === 'bienvenue')).toMatchObject({ statut: 'envoye', prevu_le: '2027-07-29T03:55:00.000Z' });

    horloge.t = Date.parse('2027-07-29T08:05:00Z'); // 10:05
    expect(await emails.passer()).toMatchObject({ reserves: 1, envoyes: 1 });
    expect(base.tables.envois_emails.find((e) => e.etape === 'jour_j')).toMatchObject({ statut: 'envoye' });
    expect(courriel.envoyer).toHaveBeenCalledTimes(2);
  });

  it('au plus une fois : un statut non écrit après un envoi réussi ne renvoie jamais, la ligne finit « interrompu »', async () => {
    const horloge = { t: MAINTENANT };
    const { base, emails, courriel, journal } = preparer({ mode: 'smtp', horloge });
    scenarioDeBase(base);
    base.tables.destinataires_emails = base.tables.destinataires_emails.filter((d) => d.id === ID.alice);
    base.intercepter = (appel) => (appel.methode === 'PATCH' && appel.chemin === '/rest/v1/envois_emails'
      && (appel.corps as Ligne | undefined)?.statut === 'envoye')
      ? new Response(JSON.stringify({ code: '57014' }), { status: 500 })
      : null;
    await emails.passer();
    expect(courriel.envoyer).toHaveBeenCalledTimes(1);
    const ligne = () => base.tables.envois_emails.find((e) => e.etape === 'bienvenue' && e.destinataire_id === ID.alice);
    expect(ligne()).toMatchObject({ statut: 'en_attente', raison: 'en_cours' });

    horloge.t += 60_000;
    await emails.passer();
    expect(courriel.envoyer).toHaveBeenCalledTimes(1);

    horloge.t = MAINTENANT + 11 * 60_000;
    expect(await emails.passer()).toMatchObject({ echecs: 1 });
    expect(ligne()).toMatchObject({ statut: 'echec', raison: 'interrompu' });
    expect(courriel.envoyer).toHaveBeenCalledTimes(1);
    expect(journal.some((l) => (l as { message?: string }).message === 'envois interrompus, non renvoyés')).toBe(true);

    horloge.t += 60 * 60_000;
    await emails.passer();
    expect(courriel.envoyer).toHaveBeenCalledTimes(1);
  });

  it('deux passages concurrents (deux instances) sur le même lot : un seul envoi', async () => {
    const horloge = { t: MAINTENANT };
    const base = new FauxSupabase(() => horloge.t);
    scenarioDeBase(base);
    base.tables.destinataires_emails = base.tables.destinataires_emails.filter((d) => d.id === ID.alice);
    const courriel = faussePoste('smtp');
    const instance = () => creerEmails({
      supabaseUrl: SUPABASE, publishableKey: 'cle-publique', serviceRoleKey: 'cle-service', origine: ORIGINE, cleLiens: CLE,
      courriel: courriel as never, fetchFn: base.fetch, maintenant: () => horloge.t, timers: false, journal: () => {},
    });
    const [a, b] = [instance(), instance()];
    await Promise.all([a.passer(), b.passer()]);
    await Promise.all([a.passer(), b.passer()]);
    expect(courriel.envoyer).toHaveBeenCalledTimes(1);
    const bienvenues = base.tables.envois_emails.filter((e) => e.etape === 'bienvenue' && e.destinataire_id === ID.alice);
    expect(bienvenues).toHaveLength(1);
    expect(bienvenues[0]).toMatchObject({ statut: 'envoye' });
  });

  it('{{prochaines_dates}} n’annonce d’autres dates qu’aux consentants', async () => {
    const { base, emails, courriel } = preparer({ mode: 'smtp' });
    base.tables.modeles_emails = modeles().map((m) => (m.cle === 'lendemain' ? { ...m, corps: `${m.corps}\n\n{{prochaines_dates}}` } : m));
    base.tables.calendrier = [date(ID.demain, '2027-07-28'), date(ID.aout, '2027-08-06')];
    base.tables.destinataires_emails = [
      destinataire(ID.alice, 'alice@exemple.fr', { annonces: false }),
      destinataire(ID.bruno, 'bruno@exemple.fr', { annonces: true, annonces_le: 'x', annonces_texte: 'x', annonces_version: 'x' }),
    ];
    const attente = { reel: true, statut: 'en_attente', envoye_le: null, prevu_le: '2027-07-29T08:00:00Z', cree_le: '2027-07-29T08:00:00Z' };
    base.tables.envois_emails = [envoi(ID.alice, 'lendemain', ID.demain, attente), envoi(ID.bruno, 'lendemain', ID.demain, attente)];
    await emails.passer();
    expect(courriel.envoyer).toHaveBeenCalledTimes(2);
    const pour = (adresse: string) => courriel.envoyer.mock.calls.map((c) => c[0] as { to: string; text: string; html: string }).find((m) => m.to === adresse);
    expect(pour('alice@exemple.fr')?.text).not.toContain(`Ville ${ID.aout}`);
    expect(pour('alice@exemple.fr')?.html).not.toContain('/emails/je-viens');
    expect(pour('bruno@exemple.fr')?.text).toContain(`Ville ${ID.aout}`);
    expect(pour('bruno@exemple.fr')?.html).toContain('/emails/je-viens#j=');
  });

  it('relit le destinataire après la réclamation : une désinscription survenue entre-temps l’emporte', async () => {
    const { base, emails, courriel } = preparer({ mode: 'smtp' });
    scenarioDeBase(base);
    base.tables.destinataires_emails = base.tables.destinataires_emails.filter((d) => d.id === ID.bruno);
    base.tables.envois_emails.push(envoi(ID.bruno, 'jour_j', ID.aujourdhui, {
      reel: true, statut: 'en_attente', envoye_le: null, prevu_le: '2027-07-29T08:00:00Z', cree_le: '2027-07-29T08:00:00Z',
    }));
    base.intercepter = (appel) => {
      if (appel.methode === 'PATCH' && (appel.corps as Ligne | undefined)?.raison === 'en_cours') {
        base.tables.destinataires_emails[0].desinscrit_le = '2027-07-29T08:04:59Z';
      }
      return null;
    };
    await emails.passer();
    expect(courriel.envoyer).not.toHaveBeenCalled();
    expect(base.tables.envois_emails.find((e) => e.etape === 'jour_j')).toMatchObject({ statut: 'saute', raison: 'desinscrit' });
    const relecture = base.appels.find((a) => a.methode === 'GET' && a.chemin === '/rest/v1/destinataires_emails');
    expect(relecture?.params.get('id')).toBe(`in.(${ID.bruno})`);
  });

  it('message n° 8 réclamé plus de 24 h après sa création : sauté, pas envoyé', async () => {
    const { base, emails, courriel } = preparer({ mode: 'smtp' });
    scenarioDeBase(base);
    base.tables.destinataires_emails = base.tables.destinataires_emails.filter((d) => d.id === ID.bruno);
    const messageId = randomUUID();
    base.tables.messages_inscrits = [{ id: messageId, calendrier_id: ID.aujourdhui, sujet: 'Info', corps: 'Un message.', cree_le: '2027-07-28T07:00:00Z' }];
    base.tables.envois_emails.push(envoi(ID.bruno, 'message', ID.aujourdhui, {
      message_id: messageId, reel: true, statut: 'en_attente', envoye_le: null, prevu_le: '2027-07-28T07:00:00Z', cree_le: '2027-07-28T07:00:00Z',
    }));
    await emails.passer();
    // Le jour J de Bruno part normalement ; le message, lui, est sauté.
    expect(courriel.envoyer.mock.calls.map((c) => (c[0] as { subject: string }).subject)).not.toContain('Info');
    expect(base.tables.envois_emails.find((e) => e.etape === 'message')).toMatchObject({ statut: 'saute', raison: 'fenetre_depassee' });
  });

  it('barrière d’accès active : le mode smtp n’envoie rien, avertissement journalisé, état exposé', async () => {
    const { base, emails, courriel, journal } = preparer({ mode: 'smtp', plus: { barriereActive: true } });
    scenarioDeBase(base);
    expect(emails.actif).toBe(false);
    expect(emails.confirmationActive).toBe(false);
    await emails.demarrer();
    const appelsAvant = base.appels.length;
    expect(await emails.passer()).toEqual(BILAN_VIDE);
    expect(base.appels).toHaveLength(appelsAvant);
    expect(courriel.envoyer).not.toHaveBeenCalled();
    expect(journal.some((l) => (l as { level?: string; message?: string }).level === 'warn'
      && /barrière d’accès active/.test(String((l as { message?: string }).message)))).toBe(true);
    expect(emails.etat()).toMatchObject({ mode: 'smtp', pret: false, barriereActive: true });

    // Le mode log reste possible derrière la barrière (aucun envoi réel).
    const log = preparer({ mode: 'log', plus: { barriereActive: true } });
    expect(log.emails.actif).toBe(true);
  });

  it('sur Railway sans confiance dans X-Real-IP : avertissement au démarrage', async () => {
    const { emails, journal } = preparer({ mode: 'log', plus: { railway: true } });
    await emails.demarrer();
    expect(journal.some((l) => /EMAILS_TRUST_RAILWAY_PROXY/.test(String((l as { message?: string }).message)))).toBe(true);
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
    expect((message.html.match(/\/emails\/je-viens#j=/g) ?? []).length).toBeGreaterThanOrEqual(2);
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
    // Les demandes jamais confirmées : une RPC, en POST, sans adresse dans aucune URL (sécurité I2, juridique C5).
    const rpc = base.appels.filter((a) => a.chemin === '/rest/v1/rpc/purger_demandes_non_confirmees');
    expect(rpc.map((a) => a.corps)).toEqual([{ p_maintenant: '2027-07-29T01:30:00.000Z', p_limite: 500 }]);
    expect(base.appels.some((a) => /exemple\.fr/.test(a.params.toString()))).toBe(false);
    expect(base.tables.abonnements_actualites).toEqual([{ email: 'denis@exemple.fr' }]);
    expect(base.tables.destinataires_emails.map((d) => d.email)).toEqual(['denis@exemple.fr']);

    const avant = base.appels.length;
    horloge.t += 60 * 60_000;
    await emails.passer();
    expect(base.appels.slice(avant).filter((a) => a.methode === 'DELETE' || a.chemin.includes('purger'))).toHaveLength(0);
  });

  it('purge en mode log : le journal seulement ; les demandes attendent le passage en smtp', async () => {
    const horloge = { t: Date.parse('2027-07-29T01:30:00Z') };
    const { base, emails } = preparer({ mode: 'log', horloge });
    base.tables.modeles_emails = modeles();
    await emails.passer();
    expect(base.appels.filter((a) => a.chemin === '/rest/v1/rpc/purger_demandes_non_confirmees')).toHaveLength(0);
    expect(base.appels.filter((a) => a.methode === 'DELETE' && a.chemin === '/rest/v1/envois_emails')).toHaveLength(1);
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

  it('GET (scanner de liens) : 405 sur les pages, 303 vers la page de désinscription pour le lien en un clic, aucune écriture', async () => {
    const { base, emails } = preparer();
    scenarioDeBase(base);
    const serveur = await lancer(emails);
    const j = jeton({ t: 'desinscription', d: ID.alice });
    const page = await fetch(`${serveur}/api/emails/lien`);
    expect(page.status).toBe(405);
    expect(page.headers.get('allow')).toBe('POST');
    // Sécurité M2 : ouvert dans un navigateur, le lien en un clic mène à la page, jeton en fragment, sans écriture.
    for (const methode of ['GET', 'HEAD']) {
      const unClic = await fetch(`${serveur}/api/emails/desinscription?j=${j}`, { method: methode, redirect: 'manual' });
      expect(unClic.status, methode).toBe(303);
      expect(unClic.headers.get('location'), methode).toBe(`/emails/desinscription#j=${j}`);
      expect(unClic.headers.get('referrer-policy'), methode).toBe('no-referrer');
      expect(unClic.headers.get('cache-control'), methode).toBe('no-store');
    }
    // Un jeton qui n'en a pas la forme n'est pas recopié dans la redirection.
    const piege = await fetch(`${serveur}/api/emails/desinscription?j=${encodeURIComponent('x"><script>')}`, { redirect: 'manual' });
    expect(piege.headers.get('location')).toBe('/emails/desinscription');
    expect((await fetch(`${serveur}/api/emails/desinscription?j=${j}`, { method: 'PUT' })).status).toBe(405);
    expect(base.appels.filter((a) => a.methode === 'PATCH' || a.methode === 'DELETE' || a.methode === 'POST')).toHaveLength(0);
  });

  it('decrire : ne modifie rien et renvoie l’état attendu par les pages', async () => {
    const { base, emails } = preparer();
    scenarioDeBase(base);
    base.tables.destinataires_emails[0].abonne = true;
    base.tables.destinataires_emails[0].annonces = true;
    const serveur = await lancer(emails);

    const confirmation = await lien(serveur, { jeton: jeton({ t: 'confirmation', d: ID.alice, n: randomUUID(), e: MAINTENANT + 60_000 }), action: 'decrire' });
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
    const expire = jeton({ t: 'confirmation', d: ID.alice, n: randomUUID(), e: MAINTENANT - 1 });
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

  it('Origin tierce : 403 sans consommer la limite ; 30 liens refusés par IP, puis 429', async () => {
    const { base, emails } = preparer();
    scenarioDeBase(base);
    const serveur = await lancer(emails);
    const valide = jeton({ t: 'desinscription', d: ID.alice });
    for (let i = 0; i < 35; i++) expect((await lien(serveur, { jeton: valide, action: 'decrire' }, { Origin: 'https://tiers.example' })).status).toBe(403);
    expect((await lien(serveur, { jeton: valide, action: 'decrire' }, { 'Content-Type': 'text/plain' })).status).toBe(415);
    for (let i = 0; i < 30; i++) expect((await lien(serveur, { jeton: `${i}.invalide`, action: 'decrire' })).status).toBe(400);
    const refus = await lien(serveur, { jeton: 'x.y', action: 'decrire' });
    expect(refus.status).toBe(429);
    expect(refus.headers.get('retry-after')).toBe('600');
    // Un jeton valable n'est pas limité par IP.
    expect((await lien(serveur, { jeton: valide, action: 'decrire' })).status).toBe(200);
  });

  it('40 jetons valables depuis une même IP : aucun 429 (pages et un clic) ; 21 requêtes d’un même destinataire : 429', async () => {
    const { base, emails } = preparer();
    scenarioDeBase(base);
    const serveur = await lancer(emails);
    const autre = (i: number) => `66666666-6666-4666-8666-${String(i).padStart(12, '0')}`;
    for (let i = 0; i < 40; i++) {
      expect((await lien(serveur, { jeton: jeton({ t: 'desinscription', d: autre(i) }), action: 'decrire' })).status).toBe(200);
    }
    for (let i = 40; i < 80; i++) {
      const reponse = await fetch(`${serveur}/api/emails/desinscription?j=${jeton({ t: 'desinscription', d: autre(i) })}`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click',
      });
      expect(reponse.status).toBe(200);
    }
    const meme = jeton({ t: 'desinscription', d: ID.alice });
    for (let i = 0; i < 20; i++) expect((await lien(serveur, { jeton: meme, action: 'decrire' })).status).toBe(200);
    expect((await lien(serveur, { jeton: meme, action: 'decrire' })).status).toBe(429);
  });

  it('X-Real-IP : EMAILS_TRUST_RAILWAY_PROXY, ou à défaut ACTUALITES_TRUST_RAILWAY_PROXY', async () => {
    const variables = { VITE_SUPABASE_URL: SUPABASE, SUPABASE_SERVICE_ROLE_KEY: 'cle-service', CONTACT_ORIGIN: ORIGINE, EMAILS_CLE_LIENS: CLE };
    const cas: Array<[Record<string, string>, boolean]> = [
      [{ ACTUALITES_TRUST_RAILWAY_PROXY: 'true' }, true],
      [{ EMAILS_TRUST_RAILWAY_PROXY: 'true' }, true],
      [{ EMAILS_TRUST_RAILWAY_PROXY: 'false', ACTUALITES_TRUST_RAILWAY_PROXY: 'true' }, false],
      [{}, false],
    ];
    for (const [plus, separees] of cas) {
      const serveur = await lancer(emailsDepuisEnvironnement({ ...variables, ...plus }));
      for (let i = 0; i < 30; i++) expect((await lien(serveur, { jeton: 'x.y', action: 'decrire' }, { 'X-Real-IP': '203.0.113.1' })).status).toBe(400);
      expect((await lien(serveur, { jeton: 'x.y', action: 'decrire' }, { 'X-Real-IP': '203.0.113.1' })).status).toBe(429);
      expect((await lien(serveur, { jeton: 'x.y', action: 'decrire' }, { 'X-Real-IP': '203.0.113.2' })).status).toBe(separees ? 400 : 429);
    }
  });

  it('confirmer : la demande du lien doit exister encore (M1), puis un seul PATCH du clic, idempotent', async () => {
    const { base, emails } = preparer();
    scenarioDeBase(base);
    Object.assign(base.tables.destinataires_emails[0], { abonne: true, abonnement_a_confirmer: true, confirme_le: null });
    base.tables.abonnements_actualites = [{ email: 'alice@exemple.fr' }];
    const demande = envoi(ID.alice, 'confirmation', null, { reel: true, statut: 'envoye' });
    base.tables.envois_emails.push(demande);
    const serveur = await lancer(emails);
    const j = jeton({ t: 'confirmation', d: ID.alice, n: String(demande.id), e: MAINTENANT + 60_000 });

    // Lien d'une demande remplacée (nouveau dépôt, renvoi, purge) : 410, rien n'est écrit.
    const ancien = jeton({ t: 'confirmation', d: ID.alice, n: randomUUID(), e: MAINTENANT + 60_000 });
    for (const action of ['decrire', 'confirmer']) expect((await lien(serveur, { jeton: ancien, action })).status, action).toBe(410);
    expect(base.ecritures()).toHaveLength(0);
    // Le lien d'une autre personne ne vaut rien non plus pour cette ligne.
    const intrus = jeton({ t: 'confirmation', d: ID.bruno, n: String(demande.id), e: MAINTENANT + 60_000 });
    Object.assign(base.tables.destinataires_emails[1], { abonnement_a_confirmer: true });
    expect((await lien(serveur, { jeton: intrus, action: 'confirmer' })).status).toBe(410);
    Object.assign(base.tables.destinataires_emails[1], { abonnement_a_confirmer: false });

    expect(await (await lien(serveur, { jeton: j, action: 'confirmer' })).json()).toEqual({ ok: true, etat: 'fait' });
    const patchs = base.appels.filter((a) => a.methode === 'PATCH');
    expect(patchs).toHaveLength(1);
    expect(patchs[0].chemin).toBe('/rest/v1/destinataires_emails');
    expect(patchs[0].params.get('id')).toBe(`eq.${ID.alice}`);
    expect(patchs[0].params.get('abonnement_a_confirmer')).toBe('is.true');
    expect(patchs[0].corps).toEqual({ abonnement_confirme_le: new Date(MAINTENANT).toISOString() });
    expect(base.tables.destinataires_emails[0]).toMatchObject({ abonnement_a_confirmer: false, annonces: true });
    const lecture = [...base.appels].reverse().find((a) => a.chemin === '/rest/v1/envois_emails' && a.methode === 'GET');
    expect(lecture?.params.get('id')).toBe(`eq.${demande.id}`);
    expect(lecture?.params.get('destinataire_id')).toBe(`eq.${ID.alice}`);
    expect(lecture?.params.get('etape')).toBe('eq.confirmation');

    // Déjà confirmée : succès neutre, même si la demande a disparu depuis.
    base.tables.envois_emails = base.tables.envois_emails.filter((e) => e !== demande);
    expect(await (await lien(serveur, { jeton: j, action: 'confirmer' })).json()).toEqual({ ok: true, etat: 'deja_fait' });
    expect((await lien(serveur, { jeton: j, action: 'decrire' })).status).toBe(200);
  });

  it('desinscrire : PATCH desinscrit_le et annonces, PUIS retrait de l’abonnement par RPC (identifiant dans le corps)', async () => {
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
      'POST /rest/v1/rpc/retirer_abonnement_destinataire',
    ]);
    expect(ecritures[0].corps).toEqual({ desinscrit_le: new Date(MAINTENANT).toISOString(), annonces: false });
    expect(ecritures[1].corps).toEqual({ p_destinataire: ID.alice });
    expect(base.appels.some((a) => a.params.toString().includes('exemple.fr'))).toBe(false);
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

  it('/etat : mode, prêt, raisons, clé, barrière, dernier passage, bilan et dernière erreur (C-0.3)', async () => {
    const horloge = { t: MAINTENANT };
    const { base, emails } = preparer({ mode: 'log', horloge });
    scenarioDeBase(base);
    const serveur = await lancer(emails);
    const { jeton } = admin(base);
    const lire = async () => (await fetch(`${serveur}/api/admin/emails/etat`, { headers: { Authorization: `Bearer ${jeton}` } })).json();
    expect(await lire()).toEqual({
      mode: 'log', pret: true, raisonsInactif: [], cleLiens: true, barriereActive: false, dernierPassage: null, dernierBilan: null, derniereErreur: null,
    });
    await emails.passer();
    expect(await lire()).toEqual({
      mode: 'log', pret: true, raisonsInactif: [], cleLiens: true, barriereActive: false, dernierPassage: new Date(MAINTENANT).toISOString(),
      dernierBilan: expect.objectContaining({ reserves: 2, simules: 2 }), derniereErreur: null,
    });
    // Un passage en échec pose la dernière erreur, courte, sans adresse ni détail PostgREST ; le suivant l'efface.
    base.intercepter = (appel) => (appel.chemin === '/rest/v1/envois_emails' && appel.methode === 'PATCH'
      ? new Response(JSON.stringify({ code: '57014', message: 'alice@exemple.fr', details: 'secret' }), { status: 503 })
      : null);
    horloge.t += 6 * MINUTE;
    await emails.passer();
    const enPanne = await lire();
    expect(enPanne.derniereErreur).toEqual({ instant: expect.any(String), message: 'passage du planificateur impossible (HTTP 503)' });
    expect(JSON.stringify(enPanne)).not.toMatch(/alice|secret|57014/);
    base.intercepter = null;
    horloge.t += MINUTE;
    await emails.passer();
    expect((await lire()).derniereErreur).toBeNull();
    expect((await fetch(`${serveur}/api/admin/emails/etat`, { method: 'POST', headers: { Authorization: `Bearer ${jeton}` } })).status).toBe(405);
  });

  it('/etat : chaque raison d’inactivité a son code', async () => {
    const env = { VITE_SUPABASE_URL: SUPABASE, SUPABASE_SERVICE_ROLE_KEY: 'cle-service', CONTACT_ORIGIN: ORIGINE, EMAILS_CLE_LIENS: CLE };
    const smtp = { SMTP_HOST: 'smtp.exemple.fr', SMTP_USER: 'u', SMTP_PASS: 'p', EMAILS_FROM: EXPEDITEUR };
    const raisons = (variables: Record<string, string>, plus: { barriereActive?: boolean } = {}) => emailsDepuisEnvironnement(variables, plus).etat().raisonsInactif;
    expect(raisons({})).toEqual(['mode_off', 'cle_liens', 'origine', 'supabase']);
    expect(raisons({ ...env, EMAILS_MODE: 'log' })).toEqual([]);
    expect(raisons({ ...env, EMAILS_MODE: 'off' })).toEqual(['mode_off']);
    expect(raisons({ ...env, EMAILS_MODE: 'smtp', SMTP_HOST: 'h' })).toEqual(['smtp_incomplet', 'expediteur', 'identite']);
    expect(raisons({ ...env, ...smtp, EMAILS_MODE: 'smtp', EMAILS_FROM: '' })).toEqual(['expediteur', 'identite']);
    expect(raisons({ ...env, ...smtp, EMAILS_MODE: 'smtp' }, { barriereActive: true })).toEqual(['barriere', 'identite']);
    expect(raisons({ ...env, EMAILS_CLE_LIENS: 'courte', EMAILS_MODE: 'log' })).toEqual(['cle_liens']);
    // En smtp, l'identité de l'organisateur se lit au premier passage : « identite » tant qu'elle n'est pas connue.
    expect(raisons({ ...env, ...smtp, EMAILS_MODE: 'smtp' })).toEqual(['identite']);
  });
});

describe('configuration et textes figés', () => {
  it('emailsDepuisEnvironnement : sans Supabase, clé ni SMTP, le module se crée sans planter et reste inactif', async () => {
    const emails = emailsDepuisEnvironnement({});
    expect(emails.configure).toBe(false);
    expect(emails.mode).toBe('off');
    expect(await emails.passer()).toEqual(BILAN_VIDE);
    await emails.demarrer();
    emails.arreter();
    const actif = emailsDepuisEnvironnement({
      VITE_SUPABASE_URL: SUPABASE, SUPABASE_SERVICE_ROLE_KEY: 'cle-service', CONTACT_ORIGIN: ORIGINE,
      EMAILS_CLE_LIENS: CLE, SMTP_MODE: 'log', EMAILS_DEBIT_PAR_SECONDE: '50',
    });
    expect(actif.configure).toBe(true);
    expect(actif.mode).toBe('log');
    expect(actif.confirmationActive).toBe(false);
    // En smtp, « vérifiez votre boîte mail » seulement quand la confirmation part vraiment : identité connue.
    const { emails: reel, base } = preparer({ mode: 'smtp' });
    expect(reel.confirmationActive).toBe(false);
    await reel.passer();
    expect(reel.confirmationActive).toBe(true);
    base.tables.identite_legale = [];
    const { emails: sansIdentite, base: base2 } = preparer({ mode: 'smtp' });
    base2.tables.identite_legale = [];
    await sansIdentite.passer();
    expect(sansIdentite.confirmationActive).toBe(false);
  });

  it('la migration contient CONSENTEMENT_ANNONCES_TEXTE à l’identique', () => {
    const migration = readFileSync(new URL('../../supabase/migrations/20261017160000_sequence_emails.sql', import.meta.url), 'utf8');
    expect(migration).toContain(`'${CONSENTEMENT_ANNONCES_TEXTE}'`);
  });
});

// ——— Propositions QA (couture calculerEnvois ↔ examiner) ———

describe('QA : coutures du planificateur', () => {
  it('should send the confirmation when a désinscrit address re-subscribes', async () => {
    const { base, emails, courriel } = preparer({ mode: 'smtp' });
    base.tables.modeles_emails = modeles();
    base.tables.calendrier = [date(ID.aout, '2027-08-06')];
    base.tables.destinataires_emails = [destinataire(ID.chloe, 'chloe@exemple.fr', {
      abonne: true, abonnement_a_confirmer: true, desinscrit_le: '2027-07-01T10:00:00Z', annonces: false,
    })];
    base.tables.abonnements_actualites = [{ email: 'chloe@exemple.fr' }];

    expect(await emails.passer()).toMatchObject({ reserves: 1, envoyes: 1 });
    const message = courriel.envoyer.mock.calls[0][0] as { to: string; html: string };
    expect(message.to).toBe('chloe@exemple.fr');
    expect(message.html).toContain('/emails/confirmation#j=');
    expect(base.tables.envois_emails).toEqual([expect.objectContaining({ etape: 'confirmation', statut: 'envoye', reel: true })]);
    // Le lien porte la ligne de cette demande (sécurité M1).
    const lien = /href="([^"]*\/emails\/confirmation#j=[^"]+)"/.exec(message.html)?.[1] ?? '';
    expect(verifierLien(CLE, jetonDe(lien.replaceAll('&amp;', '&')) ?? '', MAINTENANT, 'confirmation'))
      .toMatchObject({ d: ID.chloe, n: base.tables.envois_emails[0].id });
  });

  it('should skip a reserved veille when its date is moved before the send', async () => {
    const horloge = { t: Date.parse('2027-07-29T16:05:00Z') }; // 18:05 à Paris, veille du 30/07
    const { base, emails, courriel } = preparer({ mode: 'smtp', horloge });
    base.tables.modeles_emails = modeles();
    base.tables.calendrier = [date(ID.demain, '2027-08-02')]; // déplacée du 30/07 au 02/08 après la réservation
    base.tables.destinataires_emails = [destinataire(ID.bruno, 'bruno@exemple.fr')];
    base.tables.rattachements_emails = [{ destinataire_id: ID.bruno, calendrier_id: ID.demain, origine: 'inscription', cree_le: '2027-06-01T10:00:00Z' }];
    base.tables.envois_emails = [
      envoi(ID.bruno, 'bienvenue', null, { reel: true, statut: 'envoye' }),
      envoi(ID.bruno, 'veille', ID.demain, { reel: true, statut: 'en_attente', envoye_le: null, prevu_le: '2027-07-29T16:00:00Z', cree_le: '2027-07-29T16:00:00Z' }),
    ];
    expect(await emails.passer()).toMatchObject({ liberes: 1, envoyes: 0 });
    expect(courriel.envoyer).not.toHaveBeenCalled();
    // La ligne est libérée (supprimée), la nouvelle veille se réserve à sa propre échéance : le 01/08 à 18:00.
    expect(base.tables.envois_emails.filter((e) => e.etape === 'veille')).toEqual([]);
    horloge.t = Date.parse('2027-08-01T16:00:00Z');
    expect(await emails.passer()).toMatchObject({ reserves: 1, envoyes: 1 });
    expect(base.tables.envois_emails.find((e) => e.etape === 'veille')).toMatchObject({ statut: 'envoye', prevu_le: '2027-08-01T16:00:00.000Z' });
  });
});

describe('vague finale : planificateur', () => {
  it('relit les dates du lot après la réclamation (sécurité I1) : une date annulée pendant le passage ne part pas', async () => {
    for (const [changement, raison] of [
      [{ statut: 'annulee' }, 'date_annulee'],
      [{ soiree: { slug: 's', statut: 'reportee' } }, 'soiree_suspendue'],
      [null, 'date_absente'],
    ] as const) {
      const { base, emails, courriel } = preparer({ mode: 'smtp' });
      scenarioDeBase(base);
      base.tables.destinataires_emails = base.tables.destinataires_emails.filter((d) => d.id === ID.bruno);
      base.tables.envois_emails.push(envoi(ID.bruno, 'jour_j', ID.aujourdhui, {
        reel: true, statut: 'en_attente', envoye_le: null, prevu_le: '2027-07-29T08:00:00Z', cree_le: '2027-07-29T08:00:00Z',
      }));
      // La date change APRÈS la RPC du calcul et la lecture des dus, au moment de la réclamation.
      base.intercepter = (appel) => {
        if (appel.methode === 'PATCH' && (appel.corps as Ligne | undefined)?.raison === 'en_cours') {
          if (changement) Object.assign(base.tables.calendrier[1], changement);
          else base.tables.calendrier = base.tables.calendrier.filter((c) => c.id !== ID.aujourdhui);
        }
        return null;
      };
      await emails.passer();
      expect(courriel.envoyer, raison).not.toHaveBeenCalled();
      expect(base.tables.envois_emails.find((e) => e.etape === 'jour_j'), raison).toMatchObject({ statut: 'saute', raison });
    }
  });

  it('relecture impossible après la réclamation (F5) : les lignes sont rendues, rien ne part, le passage suivant les envoie', async () => {
    const horloge = { t: MAINTENANT };
    const { base, emails, courriel } = preparer({ mode: 'smtp', horloge });
    scenarioDeBase(base);
    base.tables.destinataires_emails = base.tables.destinataires_emails.filter((d) => d.id === ID.alice);
    let panne = true;
    base.intercepter = (appel) => (panne && appel.methode === 'GET' && appel.chemin === '/rest/v1/destinataires_emails'
      ? new Response(JSON.stringify({ code: '57014' }), { status: 503 })
      : null);
    await emails.passer();
    expect(courriel.envoyer).not.toHaveBeenCalled();
    const ligne = () => base.tables.envois_emails.find((e) => e.etape === 'bienvenue' && e.destinataire_id === ID.alice);
    expect(ligne()).toMatchObject({ statut: 'en_attente', raison: null, envoye_le: null });
    const rendue = base.appels.find((a) => a.methode === 'PATCH' && a.params.get('raison') === 'eq.en_cours' && a.params.has('id'));
    expect(rendue?.params.get('id')).toBe(`in.(${ligne()?.id})`);
    expect(rendue?.corps).toEqual({ raison: null, envoye_le: null });
    expect(emails.etat().derniereErreur).toMatchObject({ message: 'passage du planificateur impossible (HTTP 503)' });
    panne = false;
    horloge.t += MINUTE;
    await emails.passer();
    expect(courriel.envoyer).toHaveBeenCalledTimes(1);
    expect(ligne()).toMatchObject({ statut: 'envoye' });
  });

  it('une erreur avant la tentative d’envoi rend le groupe ; après, la ligne reste « en_cours » (au plus une fois)', async () => {
    const { base, emails, courriel } = preparer({ mode: 'smtp' });
    scenarioDeBase(base);
    base.tables.destinataires_emails = base.tables.destinataires_emails.filter((d) => d.id === ID.bruno);
    base.tables.envois_emails.push(
      envoi(ID.bruno, 'jour_j', ID.aujourdhui, { reel: true, statut: 'en_attente', envoye_le: null, prevu_le: '2027-07-29T08:00:00Z', cree_le: '2027-07-29T08:00:00Z' }),
      envoi(ID.bruno, 'lendemain', ID.demain, { reel: true, statut: 'en_attente', envoye_le: null, prevu_le: '2027-07-29T08:00:00Z', cree_le: '2027-07-29T08:00:00Z' }),
    );
    // Le saut du lendemain (date prévisionnelle… ici : échéance qui ne correspond pas) ne peut pas s'écrire.
    base.intercepter = (appel) => (appel.methode === 'DELETE' && appel.chemin === '/rest/v1/envois_emails' && appel.params.get('raison') === 'eq.en_cours'
      ? new Response(JSON.stringify({ code: '57014' }), { status: 503 })
      : null);
    await emails.passer();
    expect(courriel.envoyer).toHaveBeenCalledTimes(1);
    expect(base.tables.envois_emails.find((e) => e.etape === 'lendemain')).toMatchObject({ statut: 'en_attente', raison: null });
    expect(base.tables.envois_emails.find((e) => e.etape === 'jour_j')).toMatchObject({ statut: 'envoye' });
  });

  it('arreter() (SIGTERM) : le groupe en cours finit, les autres lignes réclamées sont rendues, plus rien n’est réclamé', async () => {
    const { base, emails, courriel } = preparer({ mode: 'smtp' });
    base.tables.modeles_emails = modeles();
    base.tables.calendrier = [date(ID.aujourdhui, '2027-07-29')];
    for (let i = 0; i < 15; i++) {
      const id = `77777777-7777-4777-8777-0000000000${String(i).padStart(2, '0')}`;
      base.tables.destinataires_emails.push(destinataire(id, `p${i}@exemple.fr`));
      base.tables.envois_emails.push(envoi(id, 'jour_j', ID.aujourdhui, {
        reel: true, statut: 'en_attente', envoye_le: null, prevu_le: '2027-07-29T08:00:00Z', cree_le: '2027-07-29T08:00:00Z',
      }));
    }
    /** @type {Promise<void> | null} */
    let arret: Promise<void> | null = null;
    courriel.envoyer.mockImplementation(async () => {
      if (!arret) arret = emails.arreter();
      return { mode: 'smtp', envoye: true, echec: false };
    });
    const passage = emails.passer();
    await passage;
    await arret;
    expect(courriel.envoyer).toHaveBeenCalledTimes(1);
    const parStatut = (statut: string, raison: string | null) => base.tables.envois_emails.filter((e) => e.statut === statut && e.raison === raison).length;
    // Lot de 10 réclamé : 1 envoyé, 9 rendus ; le lot suivant (5) n'a jamais été réclamé.
    expect(parStatut('envoye', null)).toBe(1);
    expect(parStatut('en_attente', null)).toBe(14);
    expect(base.tables.envois_emails.some((e) => e.raison === 'en_cours')).toBe(false);
    // Plus aucun passage après l'arrêt.
    const avant = base.appels.length;
    expect(await emails.passer()).toEqual(BILAN_VIDE);
    expect(base.appels).toHaveLength(avant);
  });

  it('premier passage en smtp : les envois simulés encore en attente passent en saute « mode_change »', async () => {
    const { base, emails, courriel } = preparer({ mode: 'smtp' });
    scenarioDeBase(base);
    base.tables.envois_emails.push(
      envoi(ID.bruno, 'jour_j', ID.aujourdhui, { reel: false, statut: 'en_attente', envoye_le: null, prevu_le: '2027-07-29T08:00:00Z' }),
      envoi(ID.alice, 'confirmation', null, { reel: false, statut: 'en_attente', envoye_le: null }),
    );
    await emails.passer();
    expect(base.tables.envois_emails.filter((e) => !e.reel && e.statut === 'saute').map((e) => e.raison)).toEqual(['mode_change', 'mode_change']);
    expect(courriel.envoyer.mock.calls.length).toBeGreaterThan(0);
    const avant = base.appels.filter((a) => a.params.get('reel') === 'is.false' && a.methode === 'PATCH').length;
    await emails.passer();
    expect(base.appels.filter((a) => a.params.get('reel') === 'is.false' && a.methode === 'PATCH')).toHaveLength(avant);
    // En mode log, rien de tel.
    const log = preparer({ mode: 'log' });
    scenarioDeBase(log.base);
    log.base.tables.envois_emails.push(envoi(ID.bruno, 'veille', ID.demain, { reel: false, statut: 'en_attente', envoye_le: null, prevu_le: '2027-07-29T08:00:00Z' }));
    await log.emails.passer();
    expect(log.base.tables.envois_emails.some((e) => e.raison === 'mode_change')).toBe(false);
  });

  it('identité de l’organisateur (B4) : ligne du pied ; absente, rien ne part en smtp, le log continue sans elle', async () => {
    const smtp = preparer({ mode: 'smtp' });
    scenarioDeBase(smtp.base);
    await smtp.emails.passer();
    const message = smtp.courriel.envoyer.mock.calls[0][0] as { html: string; text: string };
    expect(message.html).toContain(LIGNE_IDENTITE);
    expect(message.text).toContain(LIGNE_IDENTITE);

    for (const absente of [[], null] as const) {
      const sans = preparer({ mode: 'smtp' });
      scenarioDeBase(sans.base);
      if (absente === null) {
        // Table absente de la base (pas encore déployée) : PostgREST répond 404 PGRST205.
        sans.base.intercepter = (appel) => (appel.chemin === '/rest/v1/identite_legale' ? new Response(JSON.stringify({ code: 'PGRST205' }), { status: 404 }) : null);
      } else sans.base.tables.identite_legale = [...absente];
      expect(await sans.emails.passer()).toEqual(BILAN_VIDE);
      expect(sans.courriel.envoyer).not.toHaveBeenCalled();
      expect(sans.base.appels.some((a) => a.chemin === '/rest/v1/rpc/emails_a_traiter')).toBe(false);
      expect(sans.emails.etat()).toMatchObject({ pret: false, raisonsInactif: ['identite'] });
    }
    // Sans nom (raison sociale), pas d'identité : on n'invente rien.
    const sansNom = preparer({ mode: 'smtp' });
    scenarioDeBase(sansNom.base);
    sansNom.base.tables.identite_legale = [{ raison_sociale: null, forme_juridique: 'SAS', adresse: 'Nîmes' }];
    await sansNom.emails.passer();
    expect(sansNom.courriel.envoyer).not.toHaveBeenCalled();

    const log = preparer({ mode: 'log' });
    scenarioDeBase(log.base);
    log.base.tables.identite_legale = [];
    expect(await log.emails.passer()).toMatchObject({ simules: 2 });
    expect((log.courriel.envoyer.mock.calls[0][0] as { html: string }).html).not.toContain('organisée par');
    expect(log.emails.etat()).toMatchObject({ pret: true, raisonsInactif: [] });
  });

  it('cadence : le calcul (RPC) toutes les 5 min, les dus chaque minute ; la RPC est journalisée sans donnée personnelle', async () => {
    const horloge = { t: MAINTENANT };
    const { base, emails, journal } = preparer({ mode: 'log', horloge });
    scenarioDeBase(base);
    for (let minute = 0; minute < 11; minute++) {
      await emails.passer();
      horloge.t += MINUTE;
    }
    expect(base.rpcAppels).toBe(3); // à 0, 5 et 10 min
    const lecturesDus = base.appels.filter((a) => a.methode === 'GET' && a.chemin === '/rest/v1/envois_emails' && a.params.get('raison') === 'is.null');
    expect(lecturesDus).toHaveLength(11);
    const calculs = journal.filter((l) => (l as { message?: string }).message === 'calcul des envois') as Record<string, unknown>[];
    expect(calculs).toHaveLength(3);
    expect(calculs[0]).toEqual({
      level: 'info', timestamp: expect.any(String), message: 'calcul des envois', octets: expect.any(Number), dureeMs: expect.any(Number),
      destinataires: 2, envois: expect.any(Number),
    });
    expect(Number(calculs[0].octets)).toBeGreaterThan(100);
    expect(JSON.stringify(calculs)).not.toMatch(/@|Camille/);
  });

  it('M8 : « Je viens » refuse une date dont la soirée liée est annulée ou reportée', async () => {
    const { base, emails } = preparer();
    scenarioDeBase(base);
    const serveur = await lancer(emails);
    const j = signerLien(CLE, { t: 'je_viens', d: ID.bruno, c: ID.demain, e: finDeJourParis('2027-07-30') });
    for (const statut of ['annulee', 'reportee']) {
      base.tables.calendrier[0].soiree = { slug: 's', statut };
      expect((await lien(serveur, { jeton: j, action: 'decrire' })).status, statut).toBe(410);
      expect((await lien(serveur, { jeton: j, action: 'je_viens' })).status, statut).toBe(410);
    }
    base.tables.calendrier[0].soiree = { slug: 's', statut: 'publiee' };
    expect(await (await lien(serveur, { jeton: j, action: 'je_viens' })).json()).toEqual({ ok: true, etat: 'fait' });
  });
});

describe('vague finale : endpoints admin', () => {
  it('M4 : 60 requêtes admin par IP et par 10 min, refusées avant tout appel à Supabase', async () => {
    const { base, emails } = preparer({ mode: 'log' });
    scenarioDeBase(base);
    const serveur = await lancer(emails);
    const { jeton } = admin(base);
    const lire = () => fetch(`${serveur}/api/admin/emails/etat`, { headers: { Authorization: `Bearer ${jeton}` } });
    for (let i = 0; i < 60; i++) expect((await lire()).status).toBe(200);
    const avant = base.appels.filter((a) => a.chemin === '/auth/v1/user').length;
    const refus = await lire();
    expect(refus.status).toBe(429);
    expect(refus.headers.get('retry-after')).toBe('600');
    expect((await fetch(`${serveur}/api/admin/emails/test`, { method: 'POST', headers: { Authorization: 'Bearer forge' } })).status).toBe(429);
    expect(base.appels.filter((a) => a.chemin === '/auth/v1/user')).toHaveLength(avant);
  });

  it('M3 : la clé d’idempotence du message n° 8, unique en base, vaut pour toutes les répliques', async () => {
    const base = new FauxSupabase(() => MAINTENANT);
    scenarioDeBase(base);
    base.tables.rattachements_emails.push({ destinataire_id: ID.bruno, calendrier_id: ID.demain, origine: 'je_viens', cree_le: '2027-07-01T00:00:00Z' });
    const replique = () => creerEmails({
      supabaseUrl: SUPABASE, publishableKey: 'cle-publique', serviceRoleKey: 'cle-service', origine: ORIGINE, cleLiens: CLE,
      courriel: faussePoste('smtp') as never, fetchFn: base.fetch, maintenant: () => MAINTENANT, timers: false, journal: () => {},
    });
    const [a, b] = [await lancer(replique()), await lancer(replique())];
    const { jeton } = admin(base);
    const cle = randomUUID();
    const corps = { calendrierId: ID.demain, sujet: 'Changement d’horaire', corps: 'La soirée commence à 22 h.', cle };
    const poster = (serveur: string, contenu: unknown) => fetch(`${serveur}/api/admin/emails/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` }, body: JSON.stringify(contenu),
    });
    expect(await (await poster(a, corps)).json()).toEqual({ ok: true, destinataires: 2 });
    expect(await (await poster(b, corps)).json()).toEqual({ ok: true, destinataires: 2 });
    expect(base.tables.messages_inscrits).toEqual([expect.objectContaining({ cle, destinataires: 2 })]);
    expect(base.tables.envois_emails.filter((e) => e.etape === 'message')).toHaveLength(2);
    // Même clé, autre contenu : refusé.
    expect((await poster(b, { ...corps, corps: 'Autre texte.' })).status).toBe(409);
    // Clé malformée : 400.
    expect((await poster(a, { ...corps, cle: 'pas-un-uuid' })).status).toBe(400);
    expect(base.tables.messages_inscrits).toHaveLength(1);
  });

  it('mail de test : mêmes règles que l’envoi réel (« Je viens » et dates annoncées dans l’annonce seulement), identité au pied', async () => {
    const { base, emails, courriel } = preparer({ mode: 'log' });
    scenarioDeBase(base);
    base.tables.calendrier.push(date(ID.aout, '2027-08-06'));
    const serveur = await lancer(emails);
    const { jeton } = admin(base);
    const tester = (cle: string, corps: string) => fetch(`${serveur}/api/admin/emails/test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ cle, brouillon: { sujet: 'Essai', preheader: '', corps, encart: null }, calendrierId: ID.demain }),
    });
    const corps = 'Rappel.\n\n[[Je viens|{{lien_je_viens}}]]\n\n{{dates_annoncees}}\n\n{{prochaines_dates}}';
    expect((await tester('veille', corps)).status).toBe(200);
    expect((await tester('annonce', corps)).status).toBe(200);
    const [veille, annonce] = courriel.envoyer.mock.calls.map((c) => c[0] as { html: string; text: string; etape: string });
    expect(veille.html).not.toContain('/emails/je-viens">Je viens');
    expect(veille.text).not.toContain(`Ville ${ID.demain}, Arènes`);
    expect(veille.text).toContain(`Ville ${ID.aout}`); // prochaines dates : la personne de test a consenti
    expect(annonce.text).toContain(`Je viens : ${ORIGINE}/emails/je-viens`);
    expect(annonce.text).toContain(`Ville ${ID.demain}, Arènes`);
    expect(veille.html).toContain(LIGNE_IDENTITE);
    expect(veille.etape).toBe('test:veille');
    // Pied de la confirmation : sa propre raison, et aucune liste d'autres dates.
    expect((await tester('confirmation', 'Confirmez.\n\n{{prochaines_dates}}')).status).toBe(200);
    const confirmation = courriel.envoyer.mock.calls[2][0] as { text: string };
    expect(confirmation.text).toContain('formulaire d’actualités');
    expect(confirmation.text).not.toContain(`Ville ${ID.aout}`);
  });
});
