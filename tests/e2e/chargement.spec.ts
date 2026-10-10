import { expect, test, type Page, type Response } from '@playwright/test';

// Premier chargement des pages vitrine (Task 8) : leurs données sont dans le pré-rendu, Supabase
// (environ 55 Ko gzip) n'est donc ni chargé ni appelé au premier affichage. La relecture des
// données fraîches attend la première interaction du visiteur.

test.beforeEach(async ({ page }) => {
  await page.route('**/auth/v1/**', (route) => route.abort());
});

/** Scripts reçus par la page, lus au fil de l'eau. */
function suivreScripts(page: Page): Promise<string>[] {
  const contenus: Promise<string>[] = [];
  page.on('response', (reponse: Response) => {
    if (reponse.request().resourceType() === 'script') contenus.push(reponse.text().catch(() => ''));
  });
  return contenus;
}

for (const chemin of ['/', '/classements', '/dates', '/contact']) {
  test(`${chemin} : ni le code de Supabase ni ses appels au premier affichage`, async ({ page }) => {
    const appels: string[] = [];
    page.on('request', (requete) => {
      if (new URL(requete.url()).hostname.endsWith('.supabase.co')) appels.push(requete.url());
    });
    const scripts = suivreScripts(page);
    await page.goto(chemin, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Le bouton du formulaire de contact s'active une fois la page hydratée.
    if (chemin === '/contact') await expect(page.getByRole('button', { name: 'Envoyer' })).toBeEnabled();
    const textes = await Promise.all(scripts);
    expect(textes.length).toBeGreaterThan(0);
    expect(textes.filter((texte) => texte.includes('supabase-js')).length, 'scripts contenant supabase-js').toBe(0);
    expect(appels).toEqual([]);
  });
}

test('après la première interaction, l’accueil relit Supabase et affiche les données fraîches', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-10T12:00:00+02:00'));
  const lectures: string[] = [];
  // Calendrier « frais » : la soirée de Nîmes avancée d'une semaine par rapport au pré-rendu.
  await page.route('**/rest/v1/calendrier*', (route) => {
    lectures.push('calendrier');
    return route.fulfill({
      json: [
        {
          id: 'nimes-2027',
          annee: 2027,
          nom: 'Olympiades de Nîmes',
          ville: 'Nîmes',
          arenes: 'Arènes de Nîmes',
          date_soiree: '2027-08-27',
          heure: '21:00:00',
          statut: 'previsionnelle',
          lien_billetterie: null,
        },
      ],
    });
  });
  await page.route('**/rest/v1/palmares*', (route) => {
    lectures.push('palmares');
    return route.continue();
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  const carte = page.getByRole('region', { name: 'Notez les Olympiades' });
  await expect(carte).toContainText('vendredi 20 août 2027');
  expect(lectures).toEqual([]);

  await page.keyboard.press('Tab');
  await expect(carte).toContainText('vendredi 27 août 2027');
  expect(lectures).toEqual(expect.arrayContaining(['calendrier', 'palmares']));
});

// Le clic sur un onglet change l'adresse (?annee=) pendant la relecture : il doit relire lui aussi.
test('/classements : un premier clic sur un onglet affiche le palmarès relu', async ({ page }) => {
  await page.route('**/rest/v1/palmares*', async (route) => {
    const reponse = await route.fetch();
    const palmares = (await reponse.json()) as { annee: number; ville: string; vainqueur: string }[];
    await route.fulfill({
      response: reponse,
      json: palmares.map((p) => (p.annee === 2025 && p.ville === 'Nîmes' ? { ...p, vainqueur: 'Relue' } : p)),
    });
  });
  await page.goto('/classements', { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: '2025' }).click();
  await expect(page).toHaveURL(/annee=2025/);
  await expect(page.getByRole('article').filter({ hasText: 'Nîmes' }).first()).toContainText('Relue');
});

test('une session enregistrée sur l’appareil charge Supabase dès l’ouverture', async ({ page }) => {
  // Session factice : l'en-tête doit la relire (prénom), donc charger le client tout de suite.
  await page.addInitScript(() =>
    localStorage.setItem(
      'olympiade-auth',
      JSON.stringify({
        access_token: 'jeton-factice',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'rafraichissement-factice',
        user: { id: '00000000-0000-4000-8000-0000000000aa', aud: 'authenticated', role: 'authenticated', email: 'lea@exemple.fr', user_metadata: { prenom: 'Léa' }, app_metadata: {}, created_at: new Date().toISOString() },
      }),
    ),
  );
  await page.route('**/rest/v1/profils*', (route) => route.fulfill({ json: [{ prenom: 'Léa' }] }));
  const scripts = suivreScripts(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByText('Vous êtes inscrit, à bientôt dans les arènes, Léa')).toBeVisible();
  expect((await Promise.all(scripts)).some((texte) => texte.includes('supabase-js'))).toBe(true);
});
