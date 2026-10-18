import { CONSENTEMENT_ACTUALITES_TEXTE } from '../../serveur/consentements.mjs';
import { expect, test } from '../outils/test-e2e';

const TITRE = 'Toute l’Olympiade, dans votre boîte mail.';

test('le libellé de la case est le texte de consentement enregistré, et la désinscription passe par chaque email', async ({ page }) => {
  // Identité absente : la désignation neutre, rien d'inventé.
  await page.route('**/rest/v1/identite_legale*', (route) => route.fulfill({ json: [] }));
  await page.goto('/');
  const carte = page.getByRole('region', { name: TITRE });
  await expect(carte.getByRole('checkbox', { name: CONSENTEMENT_ACTUALITES_TEXTE, exact: true })).toBeVisible();
  await expect(carte.getByText(
    'Désinscription à tout moment par le lien présent dans chaque email. Données traitées par l’organisateur de l’Olympiade des Manades : voir la page Confidentialité.',
  )).toBeVisible();
  await expect(carte.getByRole('link', { name: 'contact' })).toHaveCount(0);
});

test('le nom de l’organisateur apparaît dès que le client Supabase existe', async ({ page }) => {
  let lectures = 0;
  await page.route('**/rest/v1/identite_legale*', (route) => {
    lectures++;
    return route.fulfill({ json: [{ raison_sociale: 'Association des Manades', forme_juridique: 'Association loi 1901', adresse: null, telephone: null, email: null, immatriculation: null, capital: null, tva: null, directeur_publication: null }] });
  });
  // Relecture de la vitrine à la première interaction : elle crée le client (données simulées).
  await page.route('**/rest/v1/calendrier*', (route) => route.fulfill({ json: [] }));
  await page.route('**/rest/v1/palmares*', (route) => route.fulfill({ json: [] }));
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const carte = page.getByRole('region', { name: TITRE });
  // \s : l'espace avant le deux-points est insécable.
  await expect(carte.getByText(/Données traitées par Association des Manades\s:\svoir la page/)).toBeVisible();
  // Une seule lecture : le formulaire ne relit pas l'identité à chaque rendu.
  expect(lectures).toBe(1);
});

test('l’inscription aux actualités est dans le premier écran, avec un consentement décoché', async ({ page }) => {
  await page.goto('/');
  const carte = page.getByRole('region', { name: TITRE });
  await expect(carte.getByRole('heading')).toBeInViewport();
  await expect(carte.getByRole('textbox')).toBeInViewport();
  await expect(carte.getByRole('button', { name: 'Je m’inscris' })).toBeInViewport();
  await expect(carte.getByRole('checkbox')).not.toBeChecked();
  await expect(carte.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute('href', '/confidentialite');
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', 'https://olympiadedesmanades.fr/');
});

test('une adresse et un accord sont requis avant tout appel', async ({ page }) => {
  let appels = 0;
  await page.route('**/api/actualites', (route) => { appels++; return route.fulfill({ json: { ok: true } }); });
  await page.goto('/');
  const carte = page.getByRole('region', { name: TITRE });
  await carte.getByRole('button', { name: 'Je m’inscris' }).click();
  await expect(carte.getByRole('alert').filter({ hasText: 'Indiquez une adresse email valide.' })).toBeVisible();
  await carte.getByRole('textbox').fill('lea@example.test');
  await carte.getByRole('button', { name: 'Je m’inscris' }).click();
  await expect(carte.getByText(/Cochez la case/)).toBeVisible();
  expect(appels).toBe(0);
});

test('une seule inscription est envoyée et le succès attend la confirmation du serveur', async ({ page }) => {
  const demandes: unknown[] = [];
  await page.route('**/api/actualites', async (route) => {
    demandes.push(route.request().postDataJSON());
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto('/');
  const carte = page.getByRole('region', { name: TITRE });
  await carte.getByRole('textbox').fill('Lea@Example.test');
  await carte.getByRole('checkbox').check();
  await expect(carte.locator('input[name="cf-turnstile-response"]')).toHaveCount(1);
  await carte.locator('form').evaluate((form: HTMLFormElement) => { form.requestSubmit(); form.requestSubmit(); });
  await expect(carte.getByText(/Merci, votre inscription est enregistrée/)).toBeVisible();
  expect(demandes).toEqual([{ email: 'lea@example.test', consentement: true, site_web: '', turnstileToken: 'jeton-turnstile' }]);
  await expect(carte.getByRole('textbox')).toHaveCount(0);
});

test('un échec conserve l’adresse et permet de réessayer', async ({ page }) => {
  await page.route('**/api/actualites', (route) => route.fulfill({ status: 503, json: { error: 'Indisponible' } }));
  await page.goto('/');
  const carte = page.getByRole('region', { name: TITRE });
  await carte.getByRole('textbox').fill('lea@example.test');
  await carte.getByRole('checkbox').check();
  await carte.getByRole('button', { name: 'Je m’inscris' }).click();
  await expect(carte.getByText(/L’inscription est momentanément indisponible/)).toBeVisible();
  await expect(carte.getByRole('textbox')).toHaveValue('lea@example.test');
  await page.route('**/api/actualites', (route) => route.fulfill({ json: { ok: true } }));
  await carte.getByRole('button', { name: 'Je m’inscris' }).click();
  await expect(carte.getByText(/Merci, votre inscription est enregistrée/)).toBeVisible();
});

test('une adresse à confirmer reçoit le message de confirmation', async ({ page }) => {
  await page.route('**/api/actualites', (route) => route.fulfill({ json: { ok: true, confirmation: true } }));
  await page.goto('/');
  const carte = page.getByRole('region', { name: TITRE });
  await carte.getByRole('textbox').fill('lea@example.test');
  await carte.getByRole('checkbox').check();
  await carte.getByRole('button', { name: 'Je m’inscris' }).click();
  await expect(carte.getByText('Merci ! Un email de confirmation vient de partir : cliquez sur le bouton qu’il contient pour valider votre inscription.')).toBeVisible();
  await expect(carte.getByText(/votre inscription est enregistrée/)).toHaveCount(0);
});

test('sans JavaScript, l’adresse ne peut pas partir dans l’URL', async ({ browser }) => {
  const contexte = await browser.newContext({ javaScriptEnabled: false });
  const page = await contexte.newPage();
  await page.goto('/');
  const carte = page.getByRole('region', { name: TITRE });
  await expect(carte.getByRole('button', { name: 'Je m’inscris' })).toBeDisabled();
  await expect(carte.locator('form')).toHaveAttribute('method', 'post');
  expect(await carte.locator('noscript').innerHTML()).toContain('Activez JavaScript');
  await contexte.close();
});

test('un visiteur ne peut pas consulter les abonnés', async ({ page }) => {
  const lectures: string[] = [];
  page.on('request', (req) => { if (req.url().includes('/rest/v1/abonnements_actualites')) lectures.push(req.url()); });
  await page.goto('/admin/abonnes');
  await expect(page.getByText('Connectez-vous pour consulter cette page.')).toBeVisible();
  expect(lectures).toEqual([]);
});
