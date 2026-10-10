import { expect, test } from '@playwright/test';
import { contraste, rvbDepuisCss } from '../outils/contraste';

test('la navigation mène aux pages vitrine et le pied de page porte la signature', async ({ page }) => {
  await page.goto('/');
  // Mise en place adaptée (Task 3) : la navigation suit la maquette (Accueil, Classements, Dates,
  // Noter en direct) et Contact n'est plus que dans le pied de page. L'intention reste la même :
  // chaque page vitrine est joignable depuis l'accueil.
  for (const [zone, lien, titre] of [
    ['navigation', 'Classements', /Classements/],
    ['navigation', 'Dates', /Dates/],
    ['navigation', 'Noter en direct', /Les votes ouvriront/],
    ['pied', 'Contact', /Contact/],
  ] as const) {
    if (zone === 'navigation') {
      // Sur téléphone, la navigation est repliée derrière le bouton « Menu ».
      const menu = page.getByRole('button', { name: 'Menu' });
      if (await menu.isVisible()) await menu.click();
      await page.getByRole('navigation').getByRole('link', { name: lien }).click();
    } else {
      await page.getByRole('contentinfo').getByRole('link', { name: lien }).click();
    }
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
  }
  expect(erreurs).toEqual([]);
});

test('le pied de page affiche l’année de publication', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('contentinfo')).toContainText(`© ${new Date().getFullYear()} Olympiade des Manades`);
});

test('le focus clavier est un contour ambre doublé d’un anneau encre, à 3:1 au moins sur sable', async ({ page }) => {
  await page.goto('/');
  // Le bouton « Noter » porte sa propre ombre (utilitaire Tailwind) : l'anneau doit l'emporter.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    if ((await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Noter') break;
  }
  const focus = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement;
    const style = getComputedStyle(element);
    return {
      texte: element.textContent?.trim(),
      contour: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
      ombre: style.boxShadow,
      fond: getComputedStyle(document.body).backgroundColor,
    };
  });
  expect(focus.texte).toBe('Noter');
  expect(focus.contour).toBe('solid 3px rgb(245, 177, 77)');
  expect(focus.ombre).toBe('rgb(28, 25, 18) 0px 0px 0px 2px');
  expect(contraste(rvbDepuisCss(focus.ombre), rvbDepuisCss(focus.fond))).toBeGreaterThanOrEqual(3);
});
