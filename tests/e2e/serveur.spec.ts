import { expect, test } from '@playwright/test';

test('le serveur de production sert les pages pré-rendues, le repli et les en-têtes', async ({ request }) => {
  const accueil = await request.get('/');
  expect(accueil.status()).toBe(200);
  expect(accueil.headers()['cache-control']).toContain('no-cache');
  expect(accueil.headers()['x-content-type-options']).toBe('nosniff');
  expect(accueil.headers()['content-security-policy']).toContain('khwlwpzydlrfocfpvywv.supabase.co');

  const noter = await request.get('/noter');
  expect(noter.status()).toBe(200);
  expect(await noter.text()).toContain('<div');

  const inconnue = await request.get('/page-qui-n-existe-pas');
  expect(inconnue.status()).toBe(404);
});

test('une page non pré-rendue s’ouvre directement par son URL', async ({ page }) => {
  await page.goto('/noter');
  await expect(page.getByText('Les votes ouvriront le soir de l’Olympiade')).toBeVisible();
});

// Garde ajoutée : un script en ligne refusé par la CSP ne lève aucune erreur de page,
// il bloque seulement l'hydratation. Sans ce test, une empreinte fausse passerait inaperçue.
test('la politique de sécurité du contenu ne bloque rien au chargement', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) {
      violations.push(`${page.url()} : ${message.text()}`);
    }
  });
  for (const chemin of ['/', '/classements', '/dates', '/contact', '/mentions-legales', '/confidentialite', '/noter', '/adresse-inconnue']) {
    await page.goto(chemin, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  expect(violations).toEqual([]);
});

// Garde ajoutée : cache, revalidation, compression et réponses d'erreur du serveur.
test('le serveur met en cache les fichiers fingerprintés et revalide le HTML', async ({ request }) => {
  const accueil = await request.get('/');
  const script = (await accueil.text()).match(/\/assets\/[\w.-]+\.js/)?.[0];
  expect(script).toBeTruthy();

  const fichier = await request.get(script!, { headers: { 'accept-encoding': 'br, gzip' } });
  expect(fichier.status()).toBe(200);
  expect(fichier.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
  expect(fichier.headers()['content-type']).toContain('text/javascript');
  expect(fichier.headers()['content-encoding']).toBe('br');

  const etag = accueil.headers()['etag'];
  expect(etag).toBeTruthy();
  const revalidation = await request.get('/', { headers: { 'if-none-match': etag } });
  expect(revalidation.status()).toBe(304);

  const barreFinale = await request.get('/classements/', { maxRedirects: 0 });
  expect(barreFinale.status()).toBe(301);
  expect(barreFinale.headers()['location']).toBe('/classements');

  const fichierInconnu = await request.get('/assets/inconnu.js');
  expect(fichierInconnu.status()).toBe(404);
  expect(fichierInconnu.headers()['content-type']).toContain('text/plain');

  // Fichiers cachés jamais servis (React Router supprime aujourd'hui .vite/ après le build).
  expect((await request.get('/.vite/manifest.json')).status()).toBe(404);

  const envoi = await request.post('/');
  expect(envoi.status()).toBe(405);
  expect(envoi.headers()['allow']).toBe('GET, HEAD');
});
