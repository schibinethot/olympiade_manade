import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { creerServeur, hoteSupabase, portDepuis, SUPABASE_PAR_DEFAUT } from '../../serveur/application.mjs';

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
});
