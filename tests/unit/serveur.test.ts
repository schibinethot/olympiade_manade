import { createHmac } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accesDepuis, creerServeur, hoteSupabase, portDepuis, SUPABASE_PAR_DEFAUT } from '../../serveur/application.mjs';

// Serveur de production (serveur/application.mjs), servi sur un build factice : réglages de
// connexion pour l'edge Railway, en-têtes et réponses d'erreur.

const PAGE = '<!doctype html><html><head><script>window.a=1</script></head><body><div>page</div></body></html>';

function build(): string {
  const racine = mkdtempSync(join(tmpdir(), 'olympiade-serveur-'));
  const fichiers: Record<string, string> = {
    'index.html': PAGE,
    '__spa-fallback.html': PAGE.replace('page', 'repli'),
    'classements/index.html': PAGE.replace('page', 'classements'),
    'assets/app-abc123.js': 'console.log(1);'.repeat(200),
  };
  for (const [chemin, contenu] of Object.entries(fichiers)) {
    mkdirSync(dirname(join(racine, chemin)), { recursive: true });
    writeFileSync(join(racine, chemin), contenu);
  }
  return racine;
}

describe('portDepuis', () => {
  it('prend 8080 sans valeur ou pour une valeur vide', () => {
    expect(portDepuis(undefined)).toBe(8080);
    expect(portDepuis('')).toBe(8080);
    expect(portDepuis('  ')).toBe(8080);
  });

  it('prend le port donné', () => {
    expect(portDepuis('4173')).toBe(4173);
    expect(portDepuis('0')).toBe(0);
  });

  it('refuse un port invalide au lieu d’écouter au hasard', () => {
    for (const valeur of ['abc', '-1', '65536', '80.5']) {
      expect(() => portDepuis(valeur), valeur).toThrow(/PORT/);
    }
  });
});

describe('hoteSupabase', () => {
  it('prend l’hôte de VITE_SUPABASE_URL', () => {
    expect(hoteSupabase('https://abcdefgh.supabase.co')).toBe('abcdefgh.supabase.co');
    expect(hoteSupabase('https://abcdefgh.supabase.co/')).toBe('abcdefgh.supabase.co');
  });

  it('revient au projet actuel sans valeur exploitable', () => {
    expect(SUPABASE_PAR_DEFAUT).toBe('khwlwpzydlrfocfpvywv.supabase.co');
    for (const valeur of [undefined, '', 'pas une adresse', 'http://abcdefgh.supabase.co', 'https://']) {
      expect(hoteSupabase(valeur), String(valeur)).toBe(SUPABASE_PAR_DEFAUT);
    }
  });
});

describe('creerServeur', () => {
  let racine: string;
  let serveur: ReturnType<typeof creerServeur>;
  let base: string;

  beforeAll(async () => {
    racine = build();
    serveur = creerServeur({ racine, supabase: 'abcdefgh.supabase.co' });
    await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
    base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((ok) => serveur.close(ok));
    rmSync(racine, { recursive: true, force: true });
  });

  it('garde les connexions plus longtemps que l’edge Railway (60 s)', () => {
    expect(serveur.keepAliveTimeout).toBe(65_000);
    expect(serveur.headersTimeout).toBe(66_000);
  });

  it('exclut des moteurs de recherche les routes monopage et les adresses inconnues', async () => {
    for (const chemin of ['/noter', '/inscription', '/inscription/code', '/admin', '/admin/statistiques']) {
      const reponse = await fetch(base + chemin);
      expect(reponse.status, chemin).toBe(200);
      expect(reponse.headers.get('x-robots-tag'), chemin).toBe('noindex');
    }
    const inconnue = await fetch(`${base}/adresse-inconnue`);
    expect(inconnue.status).toBe(404);
    expect(inconnue.headers.get('x-robots-tag')).toBe('noindex');
    for (const chemin of ['/', '/classements']) {
      expect((await fetch(base + chemin)).headers.get('x-robots-tag'), chemin).toBeNull();
    }
  });

  it('envoie HSTS derrière HTTPS, réponses en texte brut comprises', async () => {
    const https = { 'x-forwarded-proto': 'https' };
    for (const [chemin, statut] of [
      ['/', 200],
      ['/assets/inconnu.js', 404],
      ['/classements/', 301],
    ] as const) {
      const reponse = await fetch(base + chemin, { headers: https, redirect: 'manual' });
      expect(reponse.status, chemin).toBe(statut);
      expect(reponse.headers.get('strict-transport-security'), chemin).toBe('max-age=31536000');
    }
    const envoi = await fetch(base, { method: 'POST', headers: https });
    expect(envoi.status).toBe(405);
    expect(envoi.headers.get('strict-transport-security')).toBe('max-age=31536000');
    // En HTTP simple (tests locaux), pas de HSTS.
    expect((await fetch(`${base}/assets/inconnu.js`)).headers.get('strict-transport-security')).toBeNull();
  });

  it('répond 404 en texte brut pour un fichier inconnu de /assets/, même sans extension', async () => {
    for (const chemin of ['/assets/inconnu', '/assets/sous/dossier', '/assets']) {
      const reponse = await fetch(base + chemin);
      expect(reponse.status, chemin).toBe(404);
      expect(reponse.headers.get('content-type'), chemin).toContain('text/plain');
    }
    expect((await fetch(`${base}/assets/app-abc123.js`)).status).toBe(200);
  });

  it('autorise dans la CSP l’hôte Supabase donné', async () => {
    const csp = (await fetch(base)).headers.get('content-security-policy') ?? '';
    expect(csp).toContain('connect-src \'self\' https://abcdefgh.supabase.co wss://abcdefgh.supabase.co');
    expect(csp).toContain('img-src \'self\' data: https://abcdefgh.supabase.co');
    expect(csp).not.toContain(SUPABASE_PAR_DEFAUT);
  });

  it('sert /sante même sans barrière, en no-store', async () => {
    const reponse = await fetch(`${base}/sante`);
    expect(reponse.status).toBe(200);
    expect(await reponse.text()).toBe('ok');
    expect(reponse.headers.get('cache-control')).toBe('no-store');
    expect(reponse.headers.get('content-type')).toContain('text/plain');
  });
});

describe('accesDepuis', () => {
  it('retourne null sans valeur ou pour une valeur vide', () => {
    expect(accesDepuis(undefined)).toBeNull();
    expect(accesDepuis('')).toBeNull();
  });

  it('refuse un token de moins de 32 caractères', () => {
    for (const valeur of ['x', 'a'.repeat(16), 'a'.repeat(31)]) {
      expect(() => accesDepuis(valeur), valeur).toThrow(/ACCES_TOKEN/);
    }
  });

  it('accepte un token conforme et calcule un cookie attendu stable', () => {
    const token = 'a'.repeat(48);
    const config = accesDepuis(token);
    expect(config).not.toBeNull();
    const attendu = createHmac('sha256', token).update('olympiade-acces-v1', 'utf8').digest('hex');
    expect(config!.cookieAttendu).toBe(attendu);
    expect(config!.cookieAttendu).not.toContain(token);
  });
});

describe('creerServeur avec barrière d’accès', () => {
  const TOKEN_BON = 'z'.repeat(48);
  const TOKEN_MAUVAIS = 'y'.repeat(48);
  const COOKIE_ATTENDU = createHmac('sha256', TOKEN_BON).update('olympiade-acces-v1', 'utf8').digest('hex');

  let racine: string;
  let serveur: ReturnType<typeof creerServeur>;
  let base: string;

  beforeAll(async () => {
    racine = build();
    serveur = creerServeur({
      racine,
      supabase: 'abcdefgh.supabase.co',
      acces: accesDepuis(TOKEN_BON),
    });
    await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
    base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((ok) => serveur.close(ok));
    rmSync(racine, { recursive: true, force: true });
  });

  it('refuse la page d’accueil sans cookie en 401 « Accès réservé »', async () => {
    const reponse = await fetch(base, { redirect: 'manual' });
    expect(reponse.status).toBe(401);
    expect(reponse.headers.get('x-robots-tag')).toBe('noindex');
    expect(reponse.headers.get('cache-control')).toBe('no-store');
    expect(reponse.headers.get('content-type')).toContain('text/html');
    const corps = await reponse.text();
    expect(corps).toContain('Accès réservé');
    expect(corps).toContain('Ce site est en préparation.');
  });

  it('refuse /api/* sans cookie en 401 JSON', async () => {
    const reponse = await fetch(`${base}/api/contact`, { method: 'GET' });
    expect(reponse.status).toBe(401);
    expect(reponse.headers.get('content-type')).toContain('application/json');
    expect(reponse.headers.get('cache-control')).toBe('no-store');
    expect(await reponse.json()).toEqual({ error: 'Accès réservé.' });
  });

  it('refuse un asset sans cookie en 401', async () => {
    const reponse = await fetch(`${base}/assets/app-abc123.js`);
    expect(reponse.status).toBe(401);
    expect(reponse.headers.get('x-robots-tag')).toBe('noindex');
  });

  it('échange le lien `?acces=<bon>` contre un cookie et redirige en 303 vers l’URL propre', async () => {
    const reponse = await fetch(`${base}/?acces=${TOKEN_BON}&x=1`, { redirect: 'manual' });
    expect(reponse.status).toBe(303);
    expect(reponse.headers.get('location')).toBe('/?x=1');
    expect(reponse.headers.get('cache-control')).toBe('no-store');

    const setCookie = reponse.headers.get('set-cookie');
    expect(setCookie).not.toBeNull();
    expect(setCookie!).toContain(`olympiade_acces=${COOKIE_ATTENDU}`);
    expect(setCookie!).toContain('HttpOnly');
    expect(setCookie!).toContain('SameSite=Lax');
    expect(setCookie!).toContain('Path=/');
    expect(setCookie!).toContain('Max-Age=31536000');
    // Le token en clair ne doit JAMAIS être posé comme valeur de cookie.
    expect(setCookie!).not.toContain(TOKEN_BON);
    // En HTTP simple, pas de Secure.
    expect(setCookie!).not.toMatch(/;\s*Secure/i);
  });

  it('ajoute Secure derrière HTTPS (x-forwarded-proto: https)', async () => {
    const reponse = await fetch(`${base}/?acces=${TOKEN_BON}`, {
      redirect: 'manual',
      headers: { 'x-forwarded-proto': 'https' },
    });
    expect(reponse.status).toBe(303);
    const setCookie = reponse.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/;\s*Secure/);
    expect(reponse.headers.get('strict-transport-security')).toBe('max-age=31536000');
  });

  it('refuse `?acces=<mauvais>` en 401 sans Set-Cookie', async () => {
    const reponse = await fetch(`${base}/?acces=${TOKEN_MAUVAIS}`, { redirect: 'manual' });
    expect(reponse.status).toBe(401);
    expect(reponse.headers.get('set-cookie')).toBeNull();
  });

  it('avec le cookie valide, sert normalement la page et un asset', async () => {
    const entetes = { cookie: `olympiade_acces=${COOKIE_ATTENDU}` };
    const page = await fetch(base, { headers: entetes });
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    const asset = await fetch(`${base}/assets/app-abc123.js`, { headers: entetes });
    expect(asset.status).toBe(200);
    expect(asset.headers.get('content-type')).toContain('text/javascript');
  });

  it('refuse un cookie à valeur bidon (longueur ou contenu)', async () => {
    for (const valeur of ['', 'pasHex', '0'.repeat(64), 'a'.repeat(10)]) {
      const reponse = await fetch(base, { headers: { cookie: `olympiade_acces=${valeur}` } });
      expect(reponse.status, valeur).toBe(401);
    }
  });

  it('garde /sante toujours ouvert, même avec la barrière active', async () => {
    const reponse = await fetch(`${base}/sante`);
    expect(reponse.status).toBe(200);
    expect(await reponse.text()).toBe('ok');
    expect(reponse.headers.get('cache-control')).toBe('no-store');
  });
});
