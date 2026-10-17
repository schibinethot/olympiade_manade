import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../outils/test-e2e';

const MANADES = [
  ['vinuesa', 'Vinuesa'],
  ['gillet', 'Gillet'],
  ['robert-michel', 'Robert Michel'],
  ['lafon', 'Lafon'],
  ['arlatenco', 'Arlatenco'],
] as const;

test('l’annuaire mène aux cinq fiches documentées', async ({ page }) => {
  await page.goto('/manades');
  await expect(page.getByRole('heading', { level: 1, name: /Les manades/ })).toBeVisible();
  for (const [slug, nom] of MANADES) {
    await expect(page.getByRole('link', { name: new RegExp(`Manade ${nom}|${nom}`) }).first()).toHaveAttribute('href', `/manades/${slug}`);
  }
});

test('une fiche relie présentation sourcée, résultats et autres manades', async ({ page }) => {
  await page.goto('/manades/arlatenco');
  await expect(page.getByRole('heading', { level: 1, name: /Manade Arlatenco/ })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Ce qu’ils font' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Résultats par événement' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Sources' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vinuesa', exact: true }).last()).toHaveAttribute('href', '/manades/vinuesa');
});

test('les libellés des fiches gardent un contraste lisible', async ({ page }) => {
  await page.goto('/manades/vinuesa');
  await page.evaluate(() => document.fonts.ready);
  const { violations } = await new AxeBuilder({ page }).include('#contenu').withRules(['color-contrast']).analyze();
  expect(violations).toEqual([]);
});

test('les cartes de l’annuaire gardent un contraste lisible au survol', async ({ page }) => {
  await page.goto('/manades');
  await page.locator('section[aria-label="Fiches des manades"] a').first().hover();
  await page.evaluate(() => document.fonts.ready);
  const { violations } = await new AxeBuilder({ page }).include('#contenu').withRules(['color-contrast']).analyze();
  expect(violations).toEqual([]);
});

test('les fiches pré-rendues restent lisibles sans JavaScript et un slug inconnu est une 404', async ({ browser, request }) => {
  const contexte = await browser.newContext({ javaScriptEnabled: false });
  const page = await contexte.newPage();
  for (const [slug, nom] of MANADES) {
    await page.goto(`/manades/${slug}`);
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(`Manade ${nom}`) })).toBeVisible();
  }
  await contexte.close();

  const inconnue = await request.get('/manades/inconnue');
  expect(inconnue.status()).toBe(404);
  expect(inconnue.headers()['x-robots-tag']).toBe('noindex');
});
