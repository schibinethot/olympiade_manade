import { expect, test } from '../outils/test-e2e';
import { simulerTurnstile } from '../outils/turnstile';

test.beforeEach(async ({ page }) => {
  await simulerTurnstile(page);
});

test('le formulaire de contact envoie une seule fois et confirme', async ({ page }) => {
  let appels = 0;
  let corps: unknown = null;
  let prefer: string | undefined;
  await page.route('**/api/contact', async (route) => {
    appels += 1;
    corps = route.request().postDataJSON();
    prefer = route.request().headers()['prefer'];
    await new Promise((r) => setTimeout(r, 300));
    await route.fulfill({ status: 201, body: '' });
  });
  await page.goto('/contact');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email').fill('lea@exemple.fr');
  await page.getByLabel('Message').fill('Bonjour, quelle sera la date à Nîmes en 2027 ?');
  // Deux soumissions dans le même tour : seul le verrou du composant les départage
  // (le bouton désactivé ne protège pas d'un requestSubmit).
  await page.evaluate(() => {
    const form = document.querySelector('form') as HTMLFormElement;
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.getByText(/votre message est enregistré/i)).toBeVisible();
  expect(appels).toBe(1);
  expect(Object.keys(corps as object).sort()).toEqual(['email', 'message', 'prenom', 'site_web', 'turnstileToken']);
  expect(corps).toMatchObject({ site_web: '', turnstileToken: 'jeton-turnstile' });
  expect(prefer).toBeUndefined();
});

test('le formulaire signale un échec d’envoi', async ({ page }) => {
  await page.route('**/api/contact', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Le formulaire est momentanément indisponible."}' }));
  await page.goto('/contact');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email').fill('lea@exemple.fr');
  await page.getByLabel('Message').fill('Bonjour, quelle sera la date à Nîmes en 2027 ?');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText('Le formulaire est momentanément indisponible.')).toBeVisible();
});

test('sans JavaScript, le bouton est inactif et rien ne part dans l’URL', async ({ browser }) => {
  const contexte = await browser.newContext({ javaScriptEnabled: false });
  const page = await contexte.newPage();
  // Adresse relative : le contexte reprend la base d'URL de playwright.config.ts.
  await page.goto('/contact');
  await expect(page.getByRole('button', { name: 'Envoyer' })).toBeDisabled();
  await expect(page.locator('form')).toHaveAttribute('method', 'post');
  // Playwright ignore le texte des <noscript> dans ses sélecteurs : lecture directe du HTML.
  expect(await page.locator('noscript').innerHTML()).toContain('Ce formulaire nécessite JavaScript.');
  expect(page.url()).not.toContain('prenom=');
  await contexte.close();
});

test('le lien de confidentialité figure sous le formulaire', async ({ page }) => {
  await page.goto('/contact');
  await expect(page.getByRole('link', { name: 'politique de confidentialité' })).toHaveAttribute('href', '/confidentialite');
});

test('le formulaire refuse un message trop court sans appeler le serveur', async ({ page }) => {
  let appels = 0;
  await page.route('**/api/contact', (route) => {
    appels += 1;
    return route.fulfill({ status: 201, body: '' });
  });
  await page.goto('/contact');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email').fill('lea@exemple.fr');
  await page.getByLabel('Message').fill('Court');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText(/au moins 10 caractères/)).toBeVisible();
  expect(appels).toBe(0);
});

test('la page contact a un seul titre de niveau 1 et le formulaire', async ({ page }) => {
  await page.goto('/contact');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Contact/);
});

test('les mentions légales signalent les informations éditeur à compléter', async ({ page }) => {
  await page.goto('/mentions-legales');
  await expect(page.getByText('À compléter par l’organisateur')).toBeVisible();
  await expect(page.getByRole('link', { name: /TPMGE/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /TPMGE/ }).first()).toHaveAttribute('href', 'https://tpmge.com/#olympiade-des-manades');
  for (const nom of ['Railway', 'Supabase', 'Atch Élevage']) {
    await expect(page.getByText(nom).first()).toBeVisible();
  }
  await expect(page.getByText('Vercel')).toHaveCount(0);
});

test('les mentions légales listent les crédits photos issus des données', async ({ page }) => {
  await page.goto('/mentions-legales');
  const epreuves = page.getByRole('list', { name: 'Photos des épreuves' });
  const ambiance = page.getByRole('list', { name: 'Photos d’ambiance' });
  await expect(epreuves.getByRole('listitem')).toHaveCount(4);
  await expect(ambiance.getByRole('listitem')).toHaveCount(2);
  await expect(epreuves.getByText('Éric Blanc / Salluvii').first()).toBeVisible();
  await expect(epreuves.getByText('Voir Plus').first()).toBeVisible();
  await expect(epreuves.getByText('Tous droits réservés').first()).toBeVisible();
  await expect(ambiance.getByText('afroboof')).toBeVisible();
  await expect(ambiance.getByText('CC BY-SA 2.0')).toBeVisible();
  await expect(ambiance.getByText('Krzysztof Golik')).toBeVisible();
  await expect(ambiance.getByText(/retouchée/).first()).toBeVisible();
  // La photo de l'affiche est recadrée sur téléphone (fichier hero-telephone) : le crédit le dit.
  // La photo d'ambiance des arènes garde le cadre de l'original.
  const affiche = ambiance.getByRole('listitem').filter({ hasText: 'Affiche de l’accueil' });
  await expect(affiche).toContainText('recadrée et retouchée (niveaux de gris, duotone).');
  await expect(ambiance.getByRole('listitem').filter({ hasText: 'recadrée' })).toHaveCount(1);
  await expect(ambiance.getByRole('listitem').filter({ hasText: 'retouchée (niveaux de gris, duotone).' })).toHaveCount(2);
});

test('le crédit sous l’affiche de l’accueil annonce le recadrage', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/^Photo de l’affiche/)).toContainText(
    'via Wikimedia Commons, recadrée et retouchée (niveaux de gris, duotone).',
  );
});

test('la confidentialité annonce les droits, la durée et les sous-traitants', async ({ page }) => {
  await page.goto('/confidentialite');
  await expect(page.getByText('À compléter par l’organisateur')).toBeVisible();
  await expect(page.getByText(/24 mois/).first()).toBeVisible();
  await expect(page.getByText(/CNIL/).first()).toBeVisible();
  for (const nom of ['Supabase', 'Railway', 'Brevo']) {
    await expect(page.getByText(nom).first()).toBeVisible();
  }
  await expect(page.getByText(/aucun cookie/i).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /formulaire de contact/i }).first()).toHaveAttribute('href', '/contact');
});

test('les hébergeurs sont identifiés et la licence des retouches est précisée', async ({ page }) => {
  await page.goto('/mentions-legales');
  await expect(page.getByText(/548 Market St/)).toBeVisible();
  await expect(page.getByText(/65 Chulia Street/)).toBeVisible();
  await expect(page.getByText(/même licence que l’original/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Propriété intellectuelle' })).toBeVisible();
});

test('l’accueil renvoie vers les crédits photos', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Crédits photos' })).toHaveAttribute('href', '/mentions-legales#credits');
});

test('la confidentialité mentionne les transferts, la CNIL et la session', async ({ page }) => {
  await page.goto('/confidentialite');
  // Deux paragraphes : les prestataires (Railway, Cloudflare, Anthropic, Supabase), puis Google et Meta (R1, R2).
  await expect(page.getByText(/clauses contractuelles types/)).toHaveCount(2);
  await expect(page.getByText(/clauses contractuelles types/).first()).toBeVisible();
  await expect(page.getByText(/3 place de Fontenoy/)).toBeVisible();
  await expect(page.getByText(/donnée de session/)).toBeVisible();
  await expect(page.getByText(/Data Privacy Framework/)).toHaveCount(0);
});
