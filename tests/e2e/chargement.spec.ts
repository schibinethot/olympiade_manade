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

// Photos (Task 7 et 8) : seule l'affiche part au premier affichage ; les épreuves suivent à l'approche.
test('accueil : l’affiche seule au premier affichage, les photos des épreuves à l’approche de la liste', async ({ page }, info) => {
  const photos: string[] = [];
  page.on('request', (requete) => {
    const { pathname } = new URL(requete.url());
    if (pathname.startsWith('/photos/')) photos.push(pathname);
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  const telephone = info.project.name === 'mobile';
  // Téléphone (412 px) : recadrage de l'affiche ; ordinateur : photo entière. AVIF dans les deux cas.
  expect(photos[0]).toBe(telephone ? '/photos/hero-telephone.avif' : '/photos/hero.avif');
  if (telephone) expect(photos).toEqual(['/photos/hero-telephone.avif']);

  const liste = page.getByRole('list', { name: 'Les quatre épreuves' });
  await liste.scrollIntoViewIfNeeded();
  await expect.poll(() => photos.filter((p) => p.endsWith('-640.avif')).length).toBe(4);
  const premiere = liste.locator('img').first();
  await expect(premiere).toHaveJSProperty('complete', true);
  expect(await premiere.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(640);
});

test('accueil sans JavaScript : l’affiche et les photos des épreuves restent affichées', async ({ browser }) => {
  const contexte = await browser.newContext({ javaScriptEnabled: false });
  const page = await contexte.newPage();
  await page.goto('/');
  await expect(page.getByRole('img', { name: /Un gardian à cheval/ })).toBeVisible();
  await expect(page.locator('img[src="/photos/manade-640.webp"]')).toHaveCount(1);
  await contexte.close();
});

/** Session factice enregistrée sur l'appareil, au nom de Léa. */
async function poserSession(page: Page) {
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
}

test('une session enregistrée sur l’appareil charge Supabase dès l’ouverture', async ({ page }) => {
  // Session factice : l'en-tête doit la relire (prénom), donc charger le client tout de suite.
  await poserSession(page);
  await page.route('**/rest/v1/profils*', (route) => route.fulfill({ json: [{ prenom: 'Léa' }] }));
  const scripts = suivreScripts(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.getByText('Vous êtes inscrit, à bientôt dans les arènes, Léa')).toBeVisible();
  expect((await Promise.all(scripts)).some((texte) => texte.includes('supabase-js'))).toBe(true);
});

// supabase-js lent ou bloqué (I1) : la borne de 3 s des lectures du navigateur couvre aussi le
// chargement du module, pas seulement la requête. Au-delà, le repli habituel s'applique.
// Le module de supabase-js est le fragment « dist-*.js » du build (vérifié dans build/client/assets).
const MODULE_SUPABASE = '**/assets/dist-*.js';

/** Retient le module de supabase-js : `attente` en ms, ou indéfiniment. Rend le nombre de requêtes retenues. */
async function retenirModuleSupabase(page: Page, attente?: number): Promise<() => number> {
  let retenues = 0;
  await page.route(MODULE_SUPABASE, async (route) => {
    retenues += 1;
    if (attente === undefined) return;
    await new Promise((fin) => setTimeout(fin, attente));
    await route.continue().catch(() => {});
  });
  return () => retenues;
}

/** Lien « Dates » de la navigation, derrière le bouton « Menu » sur téléphone. */
async function ouvrirDates(page: Page) {
  const menu = page.getByRole('button', { name: /Menu/ });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation').getByRole('link', { name: 'Dates' }).click();
}

test('supabase-js retardé de 8 s : la navigation vers /dates affiche le pré-rendu en moins de 4 s', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const retenues = await retenirModuleSupabase(page, 8000);
  await ouvrirDates(page);
  await expect(page.locator('#saison-2027').getByRole('article').filter({ hasText: 'Nîmes' })).toBeVisible({ timeout: 4000 });
  await expect(page.getByText(/momentanément indisponibles/)).toHaveCount(0);
  expect(retenues(), 'module de supabase-js demandé, puis retenu').toBeGreaterThan(0);
});

test('supabase-js retardé de 8 s : /noter en accès direct quitte « Chargement… » en moins de 4 s', async ({ page }) => {
  const retenues = await retenirModuleSupabase(page, 8000);
  await page.goto('/noter');
  await expect(page.getByRole('heading', { level: 1, name: /Les votes ouvriront/ })).toBeVisible({ timeout: 4000 });
  await expect(page.getByText('Chargement…')).toHaveCount(0);
  await expect(page.getByText('Inscriptions bientôt ouvertes')).toBeVisible();
  expect(retenues()).toBeGreaterThan(0);
});

test('supabase-js bloqué avec une session sur l’appareil : /noter s’affiche en version non connectée', async ({ page }) => {
  await poserSession(page);
  const retenues = await retenirModuleSupabase(page);
  await page.goto('/noter');
  await expect(page.getByRole('heading', { level: 1, name: /Les votes ouvriront/ })).toBeVisible({ timeout: 4000 });
  await expect(page.getByText('Inscriptions bientôt ouvertes')).toBeVisible({ timeout: 4000 });
  expect(retenues()).toBeGreaterThan(0);
});

// Restauration du défilement (M4) : au rechargement, React Router remet la page où elle était, ce
// qui émet un événement « scroll » sans action du visiteur. Il ne déclenche pas la relecture.
test('le défilement restauré au rechargement ne charge pas supabase-js', async ({ page }) => {
  await page.goto('/dates', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForFunction(() => window.scrollY >= 1000);

  const appels: string[] = [];
  page.on('request', (requete) => {
    const url = new URL(requete.url());
    if (url.hostname.endsWith('.supabase.co') || /\/assets\/dist-[^/]*\.js$/.test(url.pathname)) appels.push(url.pathname);
  });
  await page.reload({ waitUntil: 'networkidle' });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(1000);
  // Deux images de plus : un « scroll » émis par la restauration aurait déjà lancé la relecture.
  await page.evaluate(() => new Promise((fin) => requestAnimationFrame(() => requestAnimationFrame(fin))));
  await page.waitForLoadState('networkidle');
  expect(appels).toEqual([]);
});
