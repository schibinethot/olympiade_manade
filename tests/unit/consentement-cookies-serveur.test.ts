import { readFileSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  PARAMETRES_PAR_DEFAUT,
  consentementCookiesDepuisEnvironnement,
  creerConsentementCookies,
  hacherIp,
  normaliserUrl,
  validerCorpsLog,
} from '../../serveur/consentement-cookies.mjs';
import { creerServeur } from '../../serveur/application.mjs';

const ORIGINE = 'http://127.0.0.1:4173';
const CORPS_VALIDE = {
  visiteurId: 'v_test_1',
  consentementDonne: true,
  mesureAcceptee: true,
  publiciteAcceptee: false,
  action: 'custom',
  urlPage: 'https://olympiadedesmanades.fr/noter?utm_source=mail',
  provenance: null,
};
const fetchReel = fetch;

type ServeurTest = { base: string; fermer: () => Promise<void> };
const serveurs: ServeurTest[] = [];

async function lancer(module: ReturnType<typeof creerConsentementCookies>): Promise<ServeurTest> {
  const serveur = createServer((req, res) => module.repondre(req, res));
  await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  const resultat = { base, fermer: () => new Promise<void>((ok) => serveur.close(() => ok())) };
  serveurs.push(resultat);
  return resultat;
}

afterEach(async () => {
  await Promise.all(serveurs.splice(0).map((s) => s.fermer()));
});

function configuration(fetchFn: typeof fetch, plus: Partial<Parameters<typeof creerConsentementCookies>[0]> = {}) {
  return creerConsentementCookies({
    supabaseUrl: 'http://127.0.0.1:54321',
    serviceRoleKey: 'service-secret',
    publicOrigin: ORIGINE,
    fetchFn,
    ...plus,
  });
}

function deposer(base: string, corps: unknown = CORPS_VALIDE, entetes: Record<string, string> = {}) {
  return fetchReel(`${base}/api/cookie-consent/log`, {
    method: 'POST',
    headers: { Origin: ORIGINE, 'Content-Type': 'application/json', ...entetes },
    body: JSON.stringify(corps),
  });
}

describe('validation du corps du journal', () => {
  it('refuse une clé en trop, une clé manquante ou un type faux', () => {
    expect(validerCorpsLog({ ...CORPS_VALIDE, intrus: true }).valide).toBe(false);
    const { urlPage: _url, ...sansUrl } = CORPS_VALIDE;
    expect(validerCorpsLog(sansUrl).valide).toBe(false);
    expect(validerCorpsLog({ ...CORPS_VALIDE, action: 'autre' }).valide).toBe(false);
    expect(validerCorpsLog({ ...CORPS_VALIDE, consentementDonne: 'oui' }).valide).toBe(false);
    expect(validerCorpsLog({ ...CORPS_VALIDE, visiteurId: '' }).valide).toBe(false);
  });

  it('normalise les URL en retirant query et hash et bornant la longueur', () => {
    expect(normaliserUrl('https://olympiadedesmanades.fr/noter?x=1#top')).toBe('https://olympiadedesmanades.fr/noter');
    expect(normaliserUrl(' ')).toBeNull();
    expect(normaliserUrl(null)).toBeNull();
    expect(normaliserUrl('/' + 'a'.repeat(600))?.length).toBe(500);
    const valide = validerCorpsLog({ ...CORPS_VALIDE, urlPage: 'https://exemple.fr/x?y=1#z' });
    expect(valide.valide && valide.urlPage).toBe('https://exemple.fr/x');
  });
});

describe('GET /api/cookie-consent/settings', () => {
  it('renvoie les défauts quand la configuration est absente', async () => {
    const module = creerConsentementCookies();
    const serveur = await lancer(module);
    const reponse = await fetch(`${serveur.base}/api/cookie-consent/settings`);
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get('cache-control')).toBe('no-cache');
    expect(await reponse.json()).toEqual(PARAMETRES_PAR_DEFAUT);
  });

  it('convertit la ligne Supabase en clés camelCase et met en cache 60 s', async () => {
    let appels = 0;
    const ligne = {
      titre: 'Vos préférences',
      description: 'Description personnalisée.',
      texte_tout_accepter: 'Accepter',
      texte_refuser: 'Refuser',
      texte_personnaliser: 'Choisir',
      texte_enregistrer: 'Enregistrer',
      url_confidentialite: '/confidentialite',
      mesure_active: false,
      mesure_titre: 'Mesure',
      mesure_description: 'Description mesure.',
      publicite_active: true,
      publicite_titre: 'Publicité',
      publicite_description: 'Description publicité.',
      duree_consentement_jours: 180,
    };
    let maintenant = 1_000_000;
    const module = configuration(
      async () => {
        appels += 1;
        return new Response(JSON.stringify([ligne]), { status: 200 });
      },
      { now: () => maintenant },
    );
    const serveur = await lancer(module);

    const premier = await (await fetch(`${serveur.base}/api/cookie-consent/settings`)).json();
    expect(premier).toMatchObject({ titre: 'Vos préférences', dureeConsentementJours: 180, mesureActive: false });
    expect(appels).toBe(1);
    // Cache 60 s : pas de deuxième appel réseau
    maintenant += 30_000;
    await fetch(`${serveur.base}/api/cookie-consent/settings`);
    expect(appels).toBe(1);
    // Au-delà de 60 s, lecture rafraîchie
    maintenant += 31_000;
    await fetch(`${serveur.base}/api/cookie-consent/settings`);
    expect(appels).toBe(2);
  });

  it('repli sur la dernière valeur connue puis sur les défauts si Supabase refuse', async () => {
    let appels = 0;
    const module = configuration(async () => {
      appels += 1;
      return new Response('oups', { status: 500 });
    });
    const serveur = await lancer(module);
    const reponse = await fetch(`${serveur.base}/api/cookie-consent/settings`);
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual(PARAMETRES_PAR_DEFAUT);
    expect(appels).toBe(1);
  });

  it('refuse les autres méthodes', async () => {
    const module = creerConsentementCookies();
    const serveur = await lancer(module);
    const reponse = await fetch(`${serveur.base}/api/cookie-consent/settings`, { method: 'POST' });
    expect(reponse.status).toBe(405);
    expect(reponse.headers.get('allow')).toBe('GET');
  });
});

describe('POST /api/cookie-consent/log', () => {
  it('refuse 405 hors POST, 503 non configuré, 403 origine, 415 autre type', async () => {
    const nonConfigure = await lancer(creerConsentementCookies());
    expect((await deposer(nonConfigure.base)).status).toBe(503);

    const configure = await lancer(configuration(async () => new Response('', { status: 201 })));
    expect((await fetch(`${configure.base}/api/cookie-consent/log`, { method: 'GET' })).status).toBe(405);
    const origine = await fetch(`${configure.base}/api/cookie-consent/log`, {
      method: 'POST',
      headers: { Origin: 'https://tiers.example', 'Content-Type': 'application/json' },
      body: JSON.stringify(CORPS_VALIDE),
    });
    expect(origine.status).toBe(403);
    const texte = await fetch(`${configure.base}/api/cookie-consent/log`, {
      method: 'POST',
      headers: { Origin: ORIGINE, 'Content-Type': 'text/plain' },
      body: 'brut',
    });
    expect(texte.status).toBe(415);
  });

  it('refuse 400 un corps invalide, 429 au-delà de la limite par IP', async () => {
    const module = configuration(async () => new Response('', { status: 201 }), { ipLimit: 2 });
    const serveur = await lancer(module);
    expect((await deposer(serveur.base, { ...CORPS_VALIDE, action: 'autre' })).status).toBe(400);
    expect((await deposer(serveur.base)).status).toBe(200);
    expect((await deposer(serveur.base)).status).toBe(200);
    const limite = await deposer(serveur.base);
    expect(limite.status).toBe(429);
    expect(limite.headers.get('retry-after')).toBeTruthy();
  });

  it('refuse 429 au-delà de la limite globale', async () => {
    const module = configuration(async () => new Response('', { status: 201 }), { globalLimit: 1 });
    const serveur = await lancer(module);
    expect((await deposer(serveur.base)).status).toBe(200);
    expect((await deposer(serveur.base)).status).toBe(429);
  });

  it('refuse 413 au-delà de 16 Ko et 400 un JSON invalide', async () => {
    const module = configuration(async () => new Response('', { status: 201 }));
    const serveur = await lancer(module);
    const grand = await fetch(`${serveur.base}/api/cookie-consent/log`, {
      method: 'POST',
      headers: { Origin: ORIGINE, 'Content-Type': 'application/json' },
      body: 'x'.repeat(16_385),
    });
    expect(grand.status).toBe(413);
    const malforme = await fetch(`${serveur.base}/api/cookie-consent/log`, {
      method: 'POST',
      headers: { Origin: ORIGINE, 'Content-Type': 'application/json' },
      body: '{',
    });
    expect(malforme.status).toBe(400);
  });

  it('nettoie l’URL, hache l’IP et tronque le user-agent avant insertion PostgREST', async () => {
    const appels: Array<{ url: string; init?: RequestInit }> = [];
    const module = configuration(async (url, init) => {
      appels.push({ url: String(url), init });
      return new Response('', { status: 201 });
    });
    const serveur = await lancer(module);
    const uaLong = 'x'.repeat(600);
    const reponse = await deposer(
      serveur.base,
      {
        ...CORPS_VALIDE,
        urlPage: 'https://olympiadedesmanades.fr/noter?utm_source=mail#tab',
        provenance: 'https://exemple.fr/accueil?ref=newsletter',
      },
      { 'User-Agent': uaLong },
    );
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ ok: true });
    expect(appels).toHaveLength(1);
    const corps = JSON.parse(String(appels[0].init?.body));
    expect(corps.url_page).toBe('https://olympiadedesmanades.fr/noter');
    expect(corps.provenance).toBe('https://exemple.fr/accueil');
    expect(corps.agent_utilisateur.length).toBe(500);
    // IP de la socket locale est hachée en 16 hex et ne figure jamais en clair.
    expect(corps.ip_hachee).toMatch(/^[0-9a-f]{16}$/);
    const serialise = JSON.stringify(corps);
    expect(serialise).not.toContain('127.0.0.1');
  });

  it('journalise 502 quand Supabase refuse et 429 si Supabase renvoie 429', async () => {
    let statut = 500;
    const module = configuration(async () => new Response('', { status: statut }));
    const serveur = await lancer(module);
    expect((await deposer(serveur.base)).status).toBe(502);
    statut = 429;
    expect((await deposer(serveur.base)).status).toBe(429);
  });

  it('la fabrique d’environnement reprend les variables standard', async () => {
    const module = consentementCookiesDepuisEnvironnement({
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'service-secret',
      CONTACT_ORIGIN: ORIGINE,
      CONTACT_TRUST_PROXY: 'true',
    });
    expect(module.configure).toBe(true);
    const absent = consentementCookiesDepuisEnvironnement({});
    expect(absent.configure).toBe(false);
  });
});

describe('HMAC IP', () => {
  it('produit 16 caractères hex déterministes et change avec la clé', () => {
    const un = hacherIp('203.0.113.1', 'cle-1');
    const deux = hacherIp('203.0.113.1', 'cle-2');
    const trois = hacherIp('203.0.113.1', 'cle-1');
    expect(un).toMatch(/^[0-9a-f]{16}$/);
    expect(un).toBe(trois);
    expect(un).not.toBe(deux);
  });
});

// Construction d'un répertoire minimal de build pour tester la CSP.
function creerBuildMinimal() {
  const racine = mkdtempSync(join(tmpdir(), 'olympiade-build-'));
  mkdirSync(racine, { recursive: true });
  writeFileSync(join(racine, 'index.html'), '<!doctype html><html><body><script>var x=1;</script></body></html>');
  writeFileSync(join(racine, '__spa-fallback.html'), '<!doctype html><html><body>spa</body></html>');
  return racine;
}

describe('CSP page avec option gtm', () => {
  it('sans gtm : pas d’hôtes Google ni Facebook dans la CSP', async () => {
    const racine = creerBuildMinimal();
    const serveur = creerServeur({ racine, supabase: 'ex.supabase.co' });
    await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
    try {
      const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
      const reponse = await fetchReel(`${base}/`);
      const csp = reponse.headers.get('content-security-policy') ?? '';
      expect(csp).not.toContain('googletagmanager.com');
      expect(csp).not.toContain('google-analytics.com');
      expect(csp).not.toContain('facebook.com');
    } finally {
      await new Promise<void>((ok) => serveur.close(() => ok()));
    }
  });

  it('avec gtm : script-src, connect-src et img-src ajoutent GTM/GA/Facebook', async () => {
    const racine = creerBuildMinimal();
    const serveur = creerServeur({ racine, supabase: 'ex.supabase.co', gtm: true });
    await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
    try {
      const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
      const reponse = await fetchReel(`${base}/`);
      const csp = reponse.headers.get('content-security-policy') ?? '';
      expect(csp).toContain('https://www.googletagmanager.com');
      expect(csp).toContain('https://connect.facebook.net');
      expect(csp).toContain('https://*.google-analytics.com');
      expect(csp).toContain('https://*.analytics.google.com');
      expect(csp).toContain('https://www.facebook.com');
    } finally {
      await new Promise<void>((ok) => serveur.close(() => ok()));
    }
  });
});

// Évite un warning du linter sur l'import readFileSync inutilisé si un refactor l'enlève.
void readFileSync;
