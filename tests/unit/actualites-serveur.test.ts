import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONSENTEMENT_ACTUALITES_TEXTE,
  CONSENTEMENT_ACTUALITES_VERSION,
  actualitesDepuisEnvironnement,
  creerActualites,
  ipClientActualites,
  validerCorpsActualites,
} from '../../serveur/actualites.mjs';

const ORIGINE = 'http://127.0.0.1:4173';
const CHAMPS = { email: 'Lea@Exemple.fr', consentement: true, site_web: '', turnstileToken: 'jeton-test' };
const fetchReel = fetch;

type ServeurTest = { base: string; fermer: () => Promise<void> };
const serveurs: ServeurTest[] = [];

async function lancer(actualites: ReturnType<typeof creerActualites>): Promise<ServeurTest> {
  const serveur = createServer((req, res) => actualites.repondre(req, res));
  await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  const resultat = { base, fermer: () => new Promise<void>((ok) => serveur.close(() => ok())) };
  serveurs.push(resultat);
  return resultat;
}

afterEach(async () => {
  await Promise.all(serveurs.splice(0).map((serveur) => serveur.fermer()));
});

function configuration(fetchFn: typeof fetch, plus: Partial<Parameters<typeof creerActualites>[0]> = {}) {
  return creerActualites({
    supabaseUrl: 'http://127.0.0.1:54321',
    serviceRoleKey: 'service-secret',
    turnstileSecret: 'turnstile-secret',
    publicOrigin: ORIGINE,
    fetchFn,
    ...plus,
  });
}

function deposer(base: string, champs: Record<string, unknown> = CHAMPS) {
  return fetchReel(`${base}/api/actualites`, {
    method: 'POST',
    headers: { Origin: ORIGINE, 'Content-Type': 'application/json' },
    body: JSON.stringify(champs),
  });
}

function environnement(plus: Record<string, string> = {}) {
  return actualitesDepuisEnvironnement({
    VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
    SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
    TURNSTILE_SECRET_KEY: 'turnstile-secret',
    CONTACT_ORIGIN: ORIGINE,
    ...plus,
  });
}

describe('validation serveur des abonnements aux actualités', () => {
  it('exige un consentement explicite, refuse les champs inattendus et normalise l’email', () => {
    expect(validerCorpsActualites({ ...CHAMPS, intrus: true }).valide).toBe(false);
    expect(validerCorpsActualites({ ...CHAMPS, consentement: false }).valide).toBe(false);
    expect(validerCorpsActualites({ ...CHAMPS, email: ' adresse invalide ' }).valide).toBe(false);
    expect(validerCorpsActualites({ ...CHAMPS, email: ' Lea@Exemple.FR\t' })).toMatchObject({
      valide: true,
      email: 'lea@exemple.fr',
    });
  });

  it('est fermé sans secrets et refuse une origine tierce', async () => {
    const ferme = await lancer(creerActualites());
    expect((await fetch(`${ferme.base}/api/actualites`, { method: 'POST' })).status).toBe(503);

    const ouvert = await lancer(configuration(async () => new Response('{}')));
    const reponse = await fetch(`${ouvert.base}/api/actualites`, {
      method: 'POST',
      headers: { Origin: 'https://tiers.example', 'Content-Type': 'application/json' },
      body: JSON.stringify(CHAMPS),
    });
    expect(reponse.status).toBe(403);
  });

  it('ne fait confiance qu’au X-Real-IP Railway explicitement activé', () => {
    const req = {
      headers: {
        'x-real-ip': '203.0.113.8',
        'x-forwarded-for': '198.51.100.1',
      },
      socket: { remoteAddress: '192.0.2.1' },
    } as never;
    expect(ipClientActualites(req, false)).toBe('192.0.2.1');
    expect(ipClientActualites(req, true)).toBe('203.0.113.8');

    const invalide = {
      headers: { 'x-real-ip': '203.0.113.8, 198.51.100.1' },
      socket: { remoteAddress: '192.0.2.1' },
    } as never;
    expect(ipClientActualites(invalide, true)).toBe('192.0.2.1');
  });

  it('applique par défaut 3 tentatives par IP et 1 000 dépôts humains par fenêtre', () => {
    const actualites = configuration(async () => new Response('{}'));
    expect(actualites.limiter.accepter('203.0.113.1')).toBe(true);
    expect(actualites.limiter.accepter('203.0.113.1')).toBe(true);
    expect(actualites.limiter.accepter('203.0.113.1')).toBe(true);
    expect(actualites.limiter.accepter('203.0.113.1')).toBe(false);
    for (let i = 0; i < 1_000; i++) expect(actualites.limiterDepots.accepter()).toBe(true);
    expect(actualites.limiterDepots.accepter()).toBe(false);
  });

  it('lit les limites et la confiance Railway depuis les variables ACTUALITES dédiées', async () => {
    const appels: Array<{ url: string; init?: RequestInit }> = [];
    const demander = async (url: URL | RequestInfo, init?: RequestInit) => {
      appels.push({ url: String(url), init });
      if (String(url).includes('siteverify')) {
        return new Response(JSON.stringify({ success: true, action: 'actualites', hostname: '127.0.0.1' }));
      }
      return new Response('', { status: 201 });
    };
    const precedent = globalThis.fetch;
    globalThis.fetch = demander as typeof fetch;
    try {
      const variables = {
        ACTUALITES_TRUST_RAILWAY_PROXY: 'true',
        ACTUALITES_RATE_IP_LIMIT: '2',
        ACTUALITES_RATE_GLOBAL_LIMIT: '1',
        ACTUALITES_RATE_MAX_IPS: '100',
      };
      const limites = environnement(variables);
      expect(limites.limiter.accepter('198.51.100.1')).toBe(true);
      expect(limites.limiter.accepter('198.51.100.1')).toBe(true);
      expect(limites.limiter.accepter('198.51.100.1')).toBe(false);
      for (let i = 0; i < 120; i++) expect(limites.limiter.accepter(`2001:db8::${i.toString(16)}`)).toBe(true);
      expect(limites.limiter.taille()).toBeLessThanOrEqual(100);
      expect(limites.limiterDepots.accepter()).toBe(true);
      expect(limites.limiterDepots.accepter()).toBe(false);

      const serveur = await lancer(environnement(variables));
      const entetes = { Origin: ORIGINE, 'Content-Type': 'application/json', 'X-Real-IP': '203.0.113.9' };
      const envoyer = () => fetchReel(`${serveur.base}/api/actualites`, {
        method: 'POST', headers: entetes, body: JSON.stringify(CHAMPS),
      });
      expect((await envoyer()).status).toBe(200);
      expect((await envoyer()).status).toBe(429);
      expect(String(appels[0].init?.body)).toContain('remoteip=203.0.113.9');
    } finally {
      globalThis.fetch = precedent;
    }
  });

  it('valide l’action Turnstile puis persiste la preuve de consentement avec service_role', async () => {
    const appels: Array<{ url: string; init?: RequestInit }> = [];
    const actualites = configuration(async (url, init) => {
      appels.push({ url: String(url), init });
      if (String(url).includes('siteverify')) {
        return new Response(JSON.stringify({ success: true, action: 'actualites', hostname: '127.0.0.1' }));
      }
      return new Response('', { status: 201 });
    });
    const serveur = await lancer(actualites);
    const reponse = await deposer(serveur.base);
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ ok: true, confirmation: false });
    expect(appels).toHaveLength(2);
    expect(String(appels[0].init?.body)).toContain('secret=turnstile-secret');
    expect(String(appels[0].init?.body)).toContain('response=jeton-test');
    expect(appels[1].url).toBe('http://127.0.0.1:54321/rest/v1/abonnements_actualites');
    expect(appels[1].init?.headers).toMatchObject({
      apikey: 'service-secret',
      Authorization: 'Bearer service-secret',
      Prefer: 'return=minimal',
    });
    expect(JSON.parse(String(appels[1].init?.body))).toEqual({
      email: 'lea@exemple.fr',
      consentement_texte: CONSENTEMENT_ACTUALITES_TEXTE,
      consentement_version: CONSENTEMENT_ACTUALITES_VERSION,
      source: 'accueil',
    });
  });

  it('reste idempotent pour un doublon sans demander ni révéler si l’adresse existait', async () => {
    let insertions = 0;
    const serveur = await lancer(configuration(async (url) => {
      if (String(url).includes('siteverify')) {
        return new Response(JSON.stringify({ success: true, action: 'actualites', hostname: '127.0.0.1' }));
      }
      insertions += 1;
      return new Response('', { status: insertions === 1 ? 201 : 409 });
    }));
    for (let i = 0; i < 2; i++) {
      const reponse = await deposer(serveur.base);
      expect(reponse.status).toBe(200);
      expect(await reponse.json()).toEqual({ ok: true, confirmation: false });
    }
  });

  it('ne renvoie jamais ok pour le honeypot et n’appelle alors ni Turnstile ni la base', async () => {
    let appels = 0;
    const serveur = await lancer(configuration(async () => { appels += 1; return new Response('{}'); }));
    const reponse = await deposer(serveur.base, { ...CHAMPS, site_web: 'robot' });
    expect(reponse.status).toBe(400);
    expect(await reponse.json()).toEqual({ error: 'Format de demande invalide.' });
    expect(appels).toBe(0);
  });

  it('refuse un jeton absent, une action erronée et un hostname inattendu avant insertion', async () => {
    let appels = 0;
    const sansJeton = await lancer(configuration(async () => { appels += 1; return new Response('{}'); }));
    expect((await deposer(sansJeton.base, { ...CHAMPS, turnstileToken: '' })).status).toBe(400);
    expect(appels).toBe(0);

    for (const resultat of [
      { success: true, action: 'contact', hostname: '127.0.0.1' },
      { success: true, action: 'actualites', hostname: 'tiers.example' },
    ]) {
      let insertions = 0;
      const serveur = await lancer(configuration(async (url) => {
        if (String(url).includes('siteverify')) return new Response(JSON.stringify(resultat));
        insertions += 1;
        return new Response('', { status: 201 });
      }));
      expect((await deposer(serveur.base)).status).toBe(400);
      expect(insertions).toBe(0);
    }
  });

  it('borne le corps, les tentatives par IP et les dépôts humains globaux', async () => {
    let verifications = 0;
    const serveur = await lancer(configuration(async (url) => {
      if (String(url).includes('siteverify')) {
        verifications += 1;
        return new Response(JSON.stringify({ success: verifications > 1, action: 'actualites', hostname: '127.0.0.1' }));
      }
      return new Response('', { status: 201 });
    }, { ipLimit: 3, globalLimit: 1 }));
    expect((await deposer(serveur.base)).status).toBe(400);
    expect((await deposer(serveur.base)).status).toBe(200);
    expect((await deposer(serveur.base)).status).toBe(429);

    const tropGrand = await fetch(`${serveur.base}/api/actualites`, {
      method: 'POST',
      headers: { Origin: ORIGINE, 'Content-Type': 'application/json' },
      body: 'x'.repeat(16_385),
    });
    expect(tropGrand.status).toBe(413);
  });
});

describe('confirmation par e-mail des abonnements aux actualités', () => {
  const MAINTENANT = Date.parse('2027-07-29T08:00:00Z');
  const DESTINATAIRE = '11111111-1111-4111-8111-111111111111';

  type Appel = { methode: string; url: URL };

  /** Dépôt en 409 (adresse déjà en base), destinataire et dernier envoi de confirmation paramétrables. */
  function base(destinataire: Record<string, unknown> | null, envois: Array<Record<string, unknown>>) {
    const appels: Appel[] = [];
    const demander = (async (entree: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(entree));
      const methode = init?.method ?? 'GET';
      appels.push({ methode, url });
      if (url.hostname === 'challenges.cloudflare.com') {
        return new Response(JSON.stringify({ success: true, action: 'actualites', hostname: '127.0.0.1' }));
      }
      if (url.pathname === '/rest/v1/abonnements_actualites') return new Response(JSON.stringify({ code: '23505', details: 'lea@exemple.fr' }), { status: 409 });
      if (url.pathname === '/rest/v1/destinataires_emails') return new Response(JSON.stringify(destinataire ? [destinataire] : []));
      if (url.pathname === '/rest/v1/envois_emails' && methode === 'GET') return new Response(JSON.stringify(envois));
      if (url.pathname === '/rest/v1/envois_emails' && methode === 'DELETE') return new Response(null, { status: 204 });
      return new Response('{}', { status: 500 });
    }) as typeof fetch;
    return { appels, demander };
  }

  const suppressions = (appels: Appel[]) => appels.filter((a) => a.methode === 'DELETE');
  const lectureEnvois = (appels: Appel[]) => appels.some((a) => a.methode === 'GET' && a.url.pathname === '/rest/v1/envois_emails');

  it('annonce la confirmation seulement si l’option est vraie', async () => {
    for (const confirmationActive of [undefined, false, true]) {
      const serveur = await lancer(configuration(async (url) => (String(url).includes('siteverify')
        ? new Response(JSON.stringify({ success: true, action: 'actualites', hostname: '127.0.0.1' }))
        : new Response('', { status: 201 })), { confirmationActive }));
      const reponse = await deposer(serveur.base);
      expect(await reponse.json()).toEqual({ ok: true, confirmation: confirmationActive === true });
    }
  });

  it('nouveau dépôt d’une demande en attente : supprime la confirmation de plus de 24 h pour qu’une nouvelle parte', async () => {
    const { appels, demander } = base({ id: DESTINATAIRE, abonnement_a_confirmer: true }, [
      { id: 'envoi-1', statut: 'envoye', cree_le: new Date(MAINTENANT - 25 * 3_600_000).toISOString() },
    ]);
    const serveur = await lancer(configuration(demander, { confirmationActive: true, now: () => MAINTENANT }));
    const reponse = await deposer(serveur.base);
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ ok: true, confirmation: true });
    await vi.waitFor(() => expect(suppressions(appels)).toHaveLength(1));
    const [suppression] = suppressions(appels);
    expect(suppression.url.pathname).toBe('/rest/v1/envois_emails');
    expect(suppression.url.searchParams.get('id')).toBe('eq.envoi-1');
    const lecture = appels.find((a) => a.methode === 'GET' && a.url.pathname === '/rest/v1/envois_emails');
    expect(lecture?.url.searchParams.get('destinataire_id')).toBe(`eq.${DESTINATAIRE}`);
    expect(lecture?.url.searchParams.get('etape')).toBe('eq.confirmation');
    expect(lecture?.url.searchParams.get('reel')).toBe('is.true');
    expect(lecture?.url.searchParams.get('select')?.split(',')).toEqual(expect.arrayContaining(['id', 'statut', 'cree_le', 'envoye_le']));
    const destinataire = appels.find((a) => a.url.pathname === '/rest/v1/destinataires_emails');
    expect(destinataire?.url.searchParams.get('email')).toBe('eq.lea@exemple.fr');
  });

  it('au plus une confirmation par 24 h, sauf échec ou saut ; rien pour une adresse déjà confirmée', async () => {
    const cas: Array<[Record<string, unknown> | null, Array<Record<string, unknown>>, number]> = [
      [{ id: DESTINATAIRE, abonnement_a_confirmer: true }, [{ id: 'e', statut: 'envoye', cree_le: new Date(MAINTENANT - 2 * 3_600_000).toISOString() }], 0],
      [{ id: DESTINATAIRE, abonnement_a_confirmer: true }, [{ id: 'e', statut: 'en_attente', cree_le: new Date(MAINTENANT - 60_000).toISOString() }], 0],
      [{ id: DESTINATAIRE, abonnement_a_confirmer: true }, [{ id: 'e', statut: 'echec', cree_le: new Date(MAINTENANT - 2 * 3_600_000).toISOString() }], 1],
      [{ id: DESTINATAIRE, abonnement_a_confirmer: true }, [{ id: 'e', statut: 'saute', cree_le: new Date(MAINTENANT - 60_000).toISOString() }], 1],
      [{ id: DESTINATAIRE, abonnement_a_confirmer: true }, [], 0],
      // L'âge se compte depuis le départ réel : réservée il y a 30 h, partie il y a 2 h (nouvel essai).
      [{ id: DESTINATAIRE, abonnement_a_confirmer: true }, [{
        id: 'e', statut: 'envoye', cree_le: new Date(MAINTENANT - 30 * 3_600_000).toISOString(), envoye_le: new Date(MAINTENANT - 2 * 3_600_000).toISOString(),
      }], 0],
      [{ id: DESTINATAIRE, abonnement_a_confirmer: true }, [{
        id: 'e', statut: 'envoye', cree_le: new Date(MAINTENANT - 30 * 3_600_000).toISOString(), envoye_le: new Date(MAINTENANT - 25 * 3_600_000).toISOString(),
      }], 1],
    ];
    for (const [destinataire, envois, attendues] of cas) {
      const { appels, demander } = base(destinataire, envois);
      const serveur = await lancer(configuration(demander, { confirmationActive: true, now: () => MAINTENANT }));
      expect(await (await deposer(serveur.base)).json()).toEqual({ ok: true, confirmation: true });
      await vi.waitFor(() => expect(lectureEnvois(appels)).toBe(true));
      await new Promise((ok) => setTimeout(ok, 20));
      expect(suppressions(appels)).toHaveLength(attendues);
    }

    for (const destinataire of [{ id: DESTINATAIRE, abonnement_a_confirmer: false }, null]) {
      const { appels, demander } = base(destinataire, [{ id: 'e', statut: 'echec', cree_le: new Date(MAINTENANT).toISOString() }]);
      const serveur = await lancer(configuration(demander, { confirmationActive: true, now: () => MAINTENANT }));
      await deposer(serveur.base);
      await vi.waitFor(() => expect(appels.some((a) => a.url.pathname === '/rest/v1/destinataires_emails')).toBe(true));
      await new Promise((ok) => setTimeout(ok, 20));
      expect(lectureEnvois(appels)).toBe(false);
      expect(suppressions(appels)).toHaveLength(0);
    }
  });

  it('sans confirmation active, un nouveau dépôt ne touche pas aux envois', async () => {
    const { appels, demander } = base({ id: DESTINATAIRE, abonnement_a_confirmer: true }, [{ id: 'e', statut: 'echec', cree_le: new Date(MAINTENANT).toISOString() }]);
    const serveur = await lancer(configuration(demander, { now: () => MAINTENANT }));
    expect(await (await deposer(serveur.base)).json()).toEqual({ ok: true, confirmation: false });
    await new Promise((ok) => setTimeout(ok, 20));
    expect(appels.filter((a) => a.url.pathname.startsWith('/rest/v1/') && a.url.pathname !== '/rest/v1/abonnements_actualites')).toHaveLength(0);
  });
});
