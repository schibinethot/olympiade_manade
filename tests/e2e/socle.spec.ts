import { expect, test } from '@playwright/test';

test('la navigation mène aux pages vitrine et le pied de page porte la signature', async ({ page }) => {
  await page.goto('/');
  for (const [lien, titre] of [
    ['Classements', /Classements/],
    ['Dates', /Dates/],
    ['Contact', /Contact/],
  ] as const) {
    // Mise en place adaptée : sur téléphone, la navigation est repliée derrière le bouton « Menu ».
    const menu = page.getByRole('button', { name: 'Menu' });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole('navigation').getByRole('link', { name: lien }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(titre);
    await page.goto('/');
  }
  const signature = page.getByRole('link', { name: 'Site conçu et développé par TPMGE' });
  await expect(signature).toHaveAttribute('href', 'https://tpmge.com/#olympiade-des-manades');
  await expect(signature).toHaveAttribute('target', '_blank');
});

test('les pages vitrine sont pré-rendues (contenu présent sans JavaScript)', async ({ browser }) => {
  const contexte = await browser.newContext({ javaScriptEnabled: false });
  const page = await contexte.newPage();
  for (const chemin of ['/', '/classements', '/dates', '/contact', '/mentions-legales', '/confidentialite']) {
    await page.goto(chemin);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  await contexte.close();
});

// Garde ajoutée : chaque adresse reçoit son propre HTML pré-rendu, et non celui de l'accueil
// (cas d'un serveur qui renvoie index.html pour /classements).
test('chaque page vitrine reçoit son propre HTML pré-rendu', async ({ browser }) => {
  const contexte = await browser.newContext({ javaScriptEnabled: false });
  const page = await contexte.newPage();
  for (const [chemin, titre] of [
    ['/classements', /Classements/],
    ['/dates', /Dates/],
    ['/contact', /Contact/],
    ['/mentions-legales', /Mentions légales/],
    ['/confidentialite', /Confidentialité/],
  ] as const) {
    await page.goto(chemin);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(titre);
  }
  await contexte.close();
});

// Garde ajoutée : aucune erreur JavaScript au chargement, hydratation comprise
// (pages pré-rendues, route servie par __spa-fallback.html, adresse inconnue).
test('aucune erreur JavaScript au chargement des pages', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (erreur) => erreurs.push(`${page.url()} : ${erreur.message}`));
  for (const chemin of ['/', '/classements', '/dates', '/contact', '/mentions-legales', '/confidentialite', '/noter', '/adresse-inconnue']) {
    await page.goto(chemin, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
  expect(erreurs).toEqual([]);
});
