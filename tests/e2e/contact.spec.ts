import { expect, test } from '@playwright/test';

test('le formulaire de contact envoie une seule fois et confirme', async ({ page }) => {
  let appels = 0;
  await page.route('**/rest/v1/messages_contact*', async (route) => {
    appels += 1;
    await new Promise((r) => setTimeout(r, 300));
    await route.fulfill({ status: 201, body: '' });
  });
  await page.goto('/contact');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email').fill('lea@exemple.fr');
  await page.getByLabel('Message').fill('Bonjour, quelle sera la date à Nîmes en 2027 ?');
  const bouton = page.getByRole('button', { name: 'Envoyer' });
  await bouton.click();
  await bouton.click({ force: true }).catch(() => {});
  await expect(page.getByText('Merci, votre message est bien parti.')).toBeVisible();
  expect(appels).toBe(1);
});

test('le formulaire refuse un message trop court sans appeler le serveur', async ({ page }) => {
  let appels = 0;
  await page.route('**/rest/v1/messages_contact*', (route) => {
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
  const credits = page.getByRole('list', { name: 'Crédits photos' });
  await expect(credits.getByRole('listitem')).toHaveCount(4);
  await expect(credits.getByText('afroboof')).toBeVisible();
  await expect(credits.getByText('CC BY-SA 2.0')).toBeVisible();
  await expect(credits.getByText('Christian Ferrer')).toBeVisible();
  await expect(credits.getByText('Krzysztof Golik')).toBeVisible();
  await expect(credits.getByText('Benjamin Smith')).toBeVisible();
  await expect(credits.getByText(/retouchée/).first()).toBeVisible();
});

test('la confidentialité annonce les droits, la durée et les sous-traitants', async ({ page }) => {
  await page.goto('/confidentialite');
  await expect(page.getByText('À compléter par l’organisateur')).toBeVisible();
  await expect(page.getByText(/24 mois/).first()).toBeVisible();
  await expect(page.getByText(/CNIL/).first()).toBeVisible();
  for (const nom of ['Supabase', 'Railway', 'Brevo']) {
    await expect(page.getByText(nom).first()).toBeVisible();
  }
  await expect(page.getByText(/aucun traceur/i).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /formulaire de contact/i }).first()).toHaveAttribute('href', '/contact');
});
