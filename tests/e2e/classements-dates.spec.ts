import { expect, test, type Page } from '@playwright/test';

/** Lien « Dates » de la navigation, derrière le bouton « Menu » sur téléphone. */
async function ouvrirDates(page: Page) {
  const menu = page.getByRole('button', { name: /Menu/ });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation').getByRole('link', { name: 'Dates' }).click();
}

// Tests du complément du 10/10 (task-4-addendum.md), qui remplacent ceux de la fiche.

test('les onglets d’années affichent le palmarès et gardent l’année dans l’URL', async ({ page }) => {
  await page.goto('/classements');
  await expect(page.getByRole('tab', { name: '2026' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('article').filter({ hasText: 'Nîmes' }).first()).toContainText('Arlatenco');
  await expect(page.getByText('À confirmer').first()).toBeVisible();
  await page.getByRole('tab', { name: '2025' }).click();
  await expect(page).toHaveURL(/annee=2025/);
  await expect(page.getByRole('article').filter({ hasText: 'Nîmes' }).first()).toContainText('Vinuesa');
  await page.getByRole('tab', { name: '2027' }).click();
  await expect(page.getByText(/en direct pendant les soirées/)).toBeVisible();
});

test('la page Dates montre toutes les dates de toutes les années', async ({ page }) => {
  await page.goto('/dates');
  for (const titre of ['Saison 2027', 'Archives 2026', 'Archives 2025']) {
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(titre) })).toBeVisible();
  }
  const saison = page.locator('#saison-2027');
  await expect(saison.getByRole('article').filter({ hasText: 'Nîmes' })).toContainText('vendredi 20 août 2027');
  // Mise en place adaptée (assertions inchangées) : « Arles » se trouve aussi dans
  // « Raphèle-lès-Arles » (27/08/2027). Le filtre par texte trouvait deux cartes et
  // Playwright refusait l'assertion (strict mode violation). La carte est désignée par son titre.
  const arles = saison.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Arles', exact: true }) });
  await expect(arles).toContainText('samedi 1er mai 2027');
  await expect(arles).toContainText('Confirmée');
  const archives2026 = page.locator('#archives-2026');
  await expect(archives2026.getByRole('article').filter({ hasText: 'Beauvoisin' })).toContainText('lundi 17 août 2026');
  await expect(archives2026.getByRole('article').filter({ hasText: 'Nîmes' })).toContainText('Arlatenco');
  const nb2027 = await saison.getByRole('article').count();
  expect(nb2027).toBeGreaterThanOrEqual(18);
});

test('si Supabase est injoignable en navigation, les pages restent lisibles avec un message de repli', async ({ page }) => {
  // Mise en place adaptée (assertions inchangées) :
  // - en navigation, le clientLoader relit Supabase puis, en cas d'échec, les données du
  //   pré-rendu (fichier /dates.data, servi par le site), puis les dernières données affichées
  //   dans l'onglet. Ces données-là s'affichent sans message (test suivant). Pour voir le message
  //   de repli, l'archive est coupée aussi, et la visite commence sur /contact, page sans données :
  //   plus aucune donnée n'est disponible ;
  // - sur téléphone, la navigation est repliée derrière le bouton « Menu » (comme socle.spec.ts) :
  //   un clic direct attendrait jusqu'au délai du test au lieu d'échouer, et le .catch ne
  //   prendrait jamais la main.
  await page.goto('/contact');
  await page.route('**/rest/v1/**', (route) => route.abort());
  await page.route(/\.data(\?|$)/, (route) => route.abort());
  await ouvrirDates(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Délai allongé : la lecture coupée peut attendre la borne de 3 s du navigateur, et le délai par
  // défaut de 5 s ne suffisait pas toujours avec les tests en parallèle.
  await expect(page.getByText(/momentanément indisponibles/)).toBeVisible({ timeout: 10_000 });
});

test('si Supabase et le pré-rendu sont injoignables en navigation, la page reprend les données déjà affichées', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.route('**/rest/v1/**', (route) => route.abort());
  await page.route(/\.data(\?|$)/, (route) => route.abort());
  await ouvrirDates(page);
  // Calendrier et palmarès de l'accueil : la carte de Nîmes 2026 et son vainqueur.
  await expect(page.locator('#archives-2026').getByRole('article').filter({ hasText: 'Arlatenco' })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText(/momentanément indisponibles/)).toHaveCount(0);
});

// Garde ajoutée : la page pré-rendue ne connaît pas `?annee=`. Un lien direct doit ouvrir l'onglet
// demandé après l'hydratation, sans écart d'hydratation (erreur React n° 418).
test('un lien direct vers une année ouvre son onglet, sans erreur JavaScript', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (erreur) => erreurs.push(erreur.message));
  await page.goto('/classements?annee=2025', { waitUntil: 'networkidle' });
  await expect(page.getByRole('tab', { name: '2025' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/2025/);
  expect(erreurs).toEqual([]);
});

test('les flèches du clavier passent d’un onglet d’année à l’autre', async ({ page }) => {
  await page.goto('/classements', { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: '2026' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: '2025' })).toBeFocused();
  await expect(page.getByRole('tab', { name: '2025' })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/annee=2025/);
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: '2027' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toContainText(/en direct pendant les soirées/);
});

test('la soirée du jour remonte en tête de sa section, avec la billetterie', async ({ page }) => {
  await page.clock.install({ time: new Date('2027-08-20T18:00:00+02:00') });
  await page.goto('/dates', { waitUntil: 'networkidle' });
  const premiere = page.locator('#saison-2027').getByRole('article').first();
  await expect(premiere).toContainText('Nîmes');
  await expect(premiere).toContainText('Ce soir');
  await expect(premiere.getByRole('link', { name: /Billetterie/ })).toHaveAttribute('target', '_blank');
});

test('la note sur la saison suit le nombre de dates confirmées', async ({ page }) => {
  await page.goto('/dates');
  const saison = page.locator('#saison-2027');
  // Les comptes viennent de la page elle-même : rien n'est codé en dur.
  const confirmees = await saison.getByRole('article').filter({ hasText: 'Confirmée' }).count();
  const previsionnelles = await saison.getByRole('article').filter({ hasText: 'Date prévisionnelle' }).count();
  test.skip(confirmees > previsionnelles || previsionnelles === 0, 'Phrase différente quand la plupart des dates sont confirmées (testée en unitaire).');
  await expect(saison).toContainText('Les dates 2027 sont des projections, à confirmer par chaque organisateur.');
  const suite = confirmees === 0 ? 'Aucune n’est encore confirmée.' : confirmees === 1 ? 'Une seule est déjà confirmée.' : `${confirmees} sont déjà confirmées.`;
  await expect(saison).toContainText(suite);
});
