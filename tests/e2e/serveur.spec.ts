import { expect, test } from '../outils/test-e2e';

// Garde : ces tests ouvrent les pages d'inscription, aucun appel Auth réel ne doit partir.
test.beforeEach(async ({ page }) => {
  await page.route('**/auth/v1/**', (route) => route.abort());
});

test('le serveur de production sert les pages pré-rendues, le repli et les en-têtes', async ({ request }) => {
  const accueil = await request.get('/');
  expect(accueil.status()).toBe(200);
  expect(accueil.headers()['cache-control']).toContain('no-cache');
  expect(accueil.headers()['x-content-type-options']).toBe('nosniff');
  expect(accueil.headers()['content-security-policy']).toContain('khwlwpzydlrfocfpvywv.supabase.co');
  // Task 6 : seule la balise <style> vide d'input-otp est autorisée (empreinte de la chaîne vide).
  expect(accueil.headers()['content-security-policy']).toContain(
    "style-src 'self' 'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='",
  );
  expect(accueil.headers()['content-security-policy']).not.toContain('unsafe-inline');

  expect(accueil.headers()['x-robots-tag']).toBeUndefined();
  for (const chemin of ['/noter', '/inscription', '/inscription/code', '/admin', '/admin/statistiques']) {
    const page = await request.get(chemin);
    expect(page.status(), chemin).toBe(200);
    expect(await page.text()).toContain('<div');
    // Task 8 : routes monopage hors des moteurs de recherche, dès l'en-tête HTTP.
    expect(page.headers()['x-robots-tag'], chemin).toBe('noindex');
  }

  const inconnue = await request.get('/page-qui-n-existe-pas');
  expect(inconnue.status()).toBe(404);

  // Task 8 : derrière l'edge HTTPS de Railway, HSTS aussi sur les réponses en texte brut.
  const fichierInconnu = await request.get('/assets/inconnu', { headers: { 'x-forwarded-proto': 'https' } });
  expect(fichierInconnu.status()).toBe(404);
  expect(fichierInconnu.headers()['content-type']).toContain('text/plain');
  expect(fichierInconnu.headers()['strict-transport-security']).toBe('max-age=31536000');
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
  // Task 6 : une demande de code en cours, pour que /inscription/code affiche la saisie du code
  // (la bibliothèque input-otp y ajoute une feuille de style).
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'olympiade-inscription',
      JSON.stringify({ prenom: 'Léa', email: 'lea@exemple.fr', envoyeeLe: Date.now() }),
    ),
  );
  for (const chemin of [
    '/',
    '/classements',
    '/dates',
    '/contact',
    '/mentions-legales',
    '/confidentialite',
    '/noter',
    '/inscription',
    '/inscription/code',
    '/adresse-inconnue',
  ]) {
    await page.goto(chemin, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (chemin === '/inscription/code') await expect(page.getByLabel(/Code/).first()).toBeVisible();
  }
  // Même saisie, atteinte cette fois par une navigation dans l'application : la page garde alors
  // la politique de l'accueil.
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    history.pushState(null, '', '/inscription/code');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByLabel(/Code/).first()).toBeVisible();
  // Les règles d'input-otp (sélection et remplissage automatique invisibles) sont bien appliquées.
  const regles = await page.evaluate(
    () => (document.getElementById('input-otp-style') as HTMLStyleElement | null)?.sheet?.cssRules.length ?? 0,
  );
  expect(regles).toBeGreaterThan(0);
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
