import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import type pg from 'pg';
import { connecter } from '../db/aide';
import { creerActualites } from '../../serveur/actualites.mjs';
import { creerEmails } from '../../serveur/emails.mjs';
import { instantParis, jourCalendaireParis } from '../../serveur/fuseau-paris.mjs';

// Banc PostgREST réel (revue QA) : creerEmails et creerActualites parlent, avec un vrai fetch, à un vrai PostgREST
// branché sur la base de test migrée. Il valide la syntaxe des URL (filtres, embarquements, on_conflict, Prefer),
// les RPC et les droits de service_role, que le faux PostgREST des tests unitaires ne fait que simuler.
// Parcours : dépôt → passage en log → confirmer → passage → bienvenue → désinscription en un clic → nouveau dépôt
// et renvoi → passage en smtp (changement de mode, refus définitif) → purge.

/** Adresse de la passerelle Supabase vue par le serveur (fictive : chaque appel est réécrit vers PostgREST). */
const SUPABASE = 'http://127.0.0.1:54321';
const ORIGINE = 'http://127.0.0.1:4173';
const CLE = 'c3'.repeat(32);
const MINUTE = 60_000;

type Email = { to: string; subject: string; text: string; html: string; etape?: string };
type Appel = { methode: string; chemin: string; requete: string };

let db: pg.Client;
const appels: Appel[] = [];
const serveurs: Array<() => Promise<void>> = [];

/** Vrai fetch vers PostgREST ; seul le préfixe /rest/v1 de la passerelle Supabase est retiré. */
function versPostgrest(): typeof fetch {
  const url = inject('postgrestUrl');
  return (async (entree: URL | RequestInfo, init?: RequestInit) => {
    const adresse = new URL(String(entree));
    if (adresse.hostname === 'challenges.cloudflare.com') {
      return new Response(JSON.stringify({ success: true, action: 'actualites', hostname: '127.0.0.1' }));
    }
    if (adresse.origin !== SUPABASE || !adresse.pathname.startsWith('/rest/v1/')) throw new Error(`appel inattendu : ${adresse.pathname}`);
    const chemin = adresse.pathname.slice('/rest/v1'.length);
    appels.push({ methode: (init?.method ?? 'GET').toUpperCase(), chemin, requete: decodeURIComponent(adresse.search) });
    return fetch(`${url}${chemin}${adresse.search}`, init);
  }) as typeof fetch;
}

function poste(mode: 'log' | 'smtp', refuser: (email: Email) => boolean = () => false) {
  const envoyes: Email[] = [];
  return {
    envoyes,
    poste: {
      mode, pret: true, manques: [],
      envoyer: async (email: Email) => {
        envoyes.push(email);
        if (refuser(email)) return { mode, envoye: false, echec: true, definitif: true };
        return { mode, envoye: mode === 'smtp', echec: false, definitif: false };
      },
    },
  };
}

async function lancer(repondre: (req: IncomingMessage, res: ServerResponse) => unknown) {
  const serveur = createServer((req, res) => { void repondre(req, res); });
  await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
  serveurs.push(() => new Promise<void>((ok) => serveur.close(() => ok())));
  return `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
}

function emails(mode: 'log' | 'smtp', horloge: { t: number }, refuser?: (email: Email) => boolean) {
  const boite = poste(mode, refuser);
  const journal: Record<string, unknown>[] = [];
  const instance = creerEmails({
    supabaseUrl: SUPABASE, publishableKey: 'cle-publique', serviceRoleKey: inject('jetonService'), origine: ORIGINE, cleLiens: CLE,
    courriel: boite.poste as never, fetchFn: versPostgrest(), maintenant: () => horloge.t, timers: false,
    journal: (ligne) => journal.push(ligne),
  });
  return { instance, envoyes: boite.envoyes, journal };
}

async function deposer(serveur: string, email: string) {
  return fetch(`${serveur}/api/actualites`, {
    method: 'POST',
    headers: { Origin: ORIGINE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, consentement: true, site_web: '', turnstileToken: 'jeton' }),
  });
}

const jetonDe = (html: string, chemin: string) => {
  const lien = new RegExp(`href="${ORIGINE}${chemin}#j=([^"]+)"`).exec(html)?.[1];
  if (!lien) throw new Error(`lien ${chemin} absent`);
  return lien;
};

beforeAll(async () => {
  db = await connecter(inject('baseDonnees'));
  await db.query('delete from public.calendrier');
  await db.query(
    `insert into public.calendrier (annee, nom, ville, arenes, date_soiree, heure, statut, lien_billetterie)
     select extract(year from j)::smallint, 'Rencontre des manades', 'Sommières', 'Arènes Gilles Arnaud', j, '21:30',
            'confirmee', 'https://billetterie.exemple.fr'
     from (select (now() at time zone 'Europe/Paris')::date + 5 as j) s`,
  );
  await db.query(
    `insert into public.identite_legale (raison_sociale, forme_juridique, adresse)
     values ('Association des Manades', 'association loi 1901', '1 place des Arènes, 30250 Sommières')`,
  );
});

afterAll(async () => {
  await Promise.all(serveurs.splice(0).map((fermer) => fermer()));
  await db?.end();
});

describe('banc PostgREST réel', () => {
  it('parcours complet : dépôt, confirmation, bienvenue, désinscription, renvoi, smtp, purge', async () => {
    const horloge = { t: Date.now() };
    const actualites = creerActualites({
      supabaseUrl: SUPABASE, serviceRoleKey: inject('jetonService'), turnstileSecret: 'secret-turnstile', publicOrigin: ORIGINE,
      fetchFn: versPostgrest(), confirmationActive: () => false, ipLimit: 50,
    });
    const serveurActualites = await lancer((req, res) => actualites.repondre(req, res));

    // 1. Dépôt du formulaire : l'abonnement est inséré, le déclencheur crée la demande.
    expect(await (await deposer(serveurActualites, 'lea@exemple.fr')).json()).toEqual({ ok: true, confirmation: false });

    // 2. Passage en log : semis des modèles, RPC, réservation et simulation de la confirmation.
    const log = emails('log', horloge);
    expect(await log.instance.passer()).toMatchObject({ reserves: 1, simules: 1, echecs: 0 });
    expect(log.envoyes.map((e) => e.etape)).toEqual(['confirmation']);
    const confirmation = log.envoyes[0];
    expect(log.journal.filter((l) => l.level === 'error')).toEqual([]);
    expect(confirmation.html).toContain('formulaire d’actualités');
    expect(confirmation.html).toContain('L’Olympiade des Manades est organisée par Association des Manades');
    const calcul = log.journal.find((l) => l.message === 'calcul des envois');
    expect(calcul).toMatchObject({ destinataires: 1 });
    expect(Number(calcul?.octets)).toBeGreaterThan(100);
    expect((await db.query('select count(*)::int as n from public.modeles_emails')).rows[0].n).toBe(9);

    // 3. La page de confirmation : décrire puis confirmer, avec le jeton du fragment.
    const serveurEmails = await lancer((req, res) => log.instance.repondre(req, res));
    const jeton = jetonDe(confirmation.html, '/emails/confirmation');
    const lien = (action: string, j = jeton) => fetch(`${serveurEmails}/api/emails/lien`, {
      method: 'POST', headers: { Origin: ORIGINE, 'Content-Type': 'application/json' }, body: JSON.stringify({ jeton: j, action }),
    });
    expect(await (await lien('decrire')).json()).toMatchObject({ ok: true, etat: { type: 'confirmation', abonne: true, desinscrit: false } });
    expect(await (await lien('confirmer')).json()).toEqual({ ok: true, etat: 'fait' });
    const { rows: [lea] } = await db.query(
      `select d.id, d.abonnement_a_confirmer, d.annonces, d.confirme_le, (select count(*)::int from public.rattachements_emails r where r.destinataire_id = d.id) as dates
       from public.destinataires_emails d where d.email = 'lea@exemple.fr'`,
    );
    expect(lea).toMatchObject({ abonnement_a_confirmer: false, annonces: true, dates: 1 });

    // 4. Passage suivant (5 min plus tard) : la bienvenue part, avec l'encart de la date proche ; le J-7, déjà passé
    //    à l'inscription, est enregistré sauté.
    horloge.t += 5 * MINUTE;
    expect(await log.instance.passer()).toMatchObject({ reserves: 1, simules: 1, sautes: 1 });
    const bienvenue = log.envoyes[1];
    expect(bienvenue.etape).toBe('bienvenue');
    expect(bienvenue.html).toContain('Sommières');
    expect(bienvenue.html).toContain('réserver mes places');
    const { rows: etapes } = await db.query(
      'select etape, statut, raison from public.envois_emails where destinataire_id = $1 order by etape', [lea.id],
    );
    expect(etapes).toEqual([
      { etape: 'bienvenue', statut: 'simule', raison: null },
      { etape: 'confirmation', statut: 'simule', raison: null },
      { etape: 'j_moins_7', statut: 'saute', raison: 'deja_passe_a_l_inscription' },
    ]);

    // 5. Désinscription en un clic (RFC 8058) : PATCH puis RPC de retrait ; la ligne reste en liste d'opposition.
    const desinscription = new URL(bienvenue.html.match(/href="([^"]*\/emails\/desinscription#j=[^"]+)"/)?.[1] ?? '').hash.slice(3);
    const unClic = await fetch(`${serveurEmails}/api/emails/desinscription?j=${desinscription}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click',
    });
    expect(unClic.status).toBe(200);
    expect((await db.query(`select count(*)::int as n from public.abonnements_actualites`)).rows[0].n).toBe(0);
    expect((await db.query(`select desinscrit_le is not null as d, abonne from public.destinataires_emails where id = $1`, [lea.id])).rows[0])
      .toEqual({ d: true, abonne: false });
    // Le GET du même lien (navigateur, antivirus) : 303 vers la page, sans écriture.
    const avantGet = appels.length;
    const redirection = await fetch(`${serveurEmails}/api/emails/desinscription?j=${desinscription}`, { redirect: 'manual' });
    expect(redirection.status).toBe(303);
    expect(appels.slice(avantGet)).toEqual([]);

    // 6. Nouveau dépôt par un tiers, puis un second (409) : la RPC de renvoi, en POST, répond sans erreur.
    expect((await deposer(serveurActualites, 'lea@exemple.fr')).status).toBe(200);
    const smtpActualites = creerActualites({
      supabaseUrl: SUPABASE, serviceRoleKey: inject('jetonService'), turnstileSecret: 'secret-turnstile', publicOrigin: ORIGINE,
      fetchFn: versPostgrest(), confirmationActive: true, ipLimit: 50,
    });
    const serveurSmtpActualites = await lancer((req, res) => smtpActualites.repondre(req, res));
    const avantRenvoi = appels.length;
    expect(await (await deposer(serveurSmtpActualites, 'lea@exemple.fr')).json()).toEqual({ ok: true, confirmation: true });
    await expect.poll(() => appels.slice(avantRenvoi).some((a) => a.chemin === '/rpc/renvoyer_confirmation_email')).toBe(true);

    // 7. Une demande ancienne (dépôt d'il y a 40 jours) dont la confirmation réelle sera refusée pour de bon.
    expect((await deposer(serveurActualites, 'ancien@exemple.fr')).status).toBe(200);
    await db.query(`update public.abonnements_actualites set cree_le = now() - interval '40 days' where email = 'ancien@exemple.fr'`);

    // 8. Passage en smtp, demain à 04:00 (Paris) : envois simulés en attente sautés, confirmations réelles (celle de
    //    l'ancien refusée en 5xx), puis purge des demandes jamais confirmées par la RPC.
    const demain = instantParis(jourCalendaireParis(Date.now() + 86_400_000), '04:00');
    const smtp = emails('smtp', { t: demain }, (email) => email.to === 'ancien@exemple.fr');
    const bilan = await smtp.instance.passer();
    expect(bilan).toMatchObject({ envoyes: 1, echecs: 1 });
    expect(smtp.envoyes.map((e) => `${e.etape}:${e.to}`).sort()).toEqual(['confirmation:ancien@exemple.fr', 'confirmation:lea@exemple.fr']);
    expect(smtp.journal.find((l) => l.message === 'purge des e-mails')).toMatchObject({ nonConfirmes: 1 });
    expect((await db.query(`select email from public.destinataires_emails order by email`)).rows.map((r: { email: string }) => r.email))
      .toEqual(['lea@exemple.fr']);
    expect(smtp.instance.etat()).toMatchObject({ mode: 'smtp', pret: true, raisonsInactif: [], derniereErreur: null });

    // 9. Les liens de la confirmation réelle : la nouvelle demande de Léa est valable, l'ancienne (log) est morte.
    const serveurSmtp = await lancer((req, res) => smtp.instance.repondre(req, res));
    const nouveau = jetonDe(smtp.envoyes.find((e) => e.to === 'lea@exemple.fr')?.html ?? '', '/emails/confirmation');
    const decrire = (j: string) => fetch(`${serveurSmtp}/api/emails/lien`, {
      method: 'POST', headers: { Origin: ORIGINE, 'Content-Type': 'application/json' }, body: JSON.stringify({ jeton: j, action: 'decrire' }),
    });
    expect((await decrire(nouveau)).status).toBe(200);
    expect((await decrire(jeton)).status).toBe(410);

    // Jamais d'adresse e-mail dans une URL de l'API (sécurité I2).
    expect(appels.filter((a) => /@|%40/.test(a.requete) || /@/.test(a.chemin))).toEqual([]);
    // Toutes les requêtes PostgREST ont abouti (aucune erreur de syntaxe ni de droit journalisée).
    for (const journal of [log.journal, smtp.journal]) {
      expect(journal.filter((l) => l.level === 'error'), JSON.stringify(journal.filter((l) => l.level === 'error'))).toEqual([]);
    }
  });
});
