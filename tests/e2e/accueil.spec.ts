import { expect, test } from '../outils/test-e2e';
import { simulerTurnstile } from '../outils/turnstile';
import { estDonneesPreRendu, relectureTerminee } from '../outils/relecture';

test.beforeEach(async ({ page }) => { await simulerTurnstile(page); });

// Tests de la fiche complétée par task-3-addendum.md (état « hors soirée »).

test('sur mobile, le vote reste accessible après l’encart des actualités', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'critère mobile');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Toute l’Olympiade, dans votre boîte mail.' })).toBeInViewport();
  await page.getByRole('region', { name: 'Notez les Olympiades' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: 'Notez les Olympiades' })).toBeVisible();
  const bouton = page.getByRole('button', { name: /Je note les manades/ });
  await expect(bouton).toBeInViewport();
  await expect(bouton).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText(/Les votes ouvriront le soir de l’Olympiade/)).toBeInViewport();
  await bouton.click({ force: true });
  await expect(page).toHaveURL(/\/$/);
});

// Mise en place adaptée (consigne du contrôleur) : horloge au 18/08/2027 au lieu du 15/08.
// La carte vise la prochaine soirée du calendrier : Mouriès, le jeudi 19/08/2027. L'affiche reste
// celle de Nîmes.
test('l’accueil présente l’affiche, la prochaine soirée, le compte à rebours, les 4 épreuves et le dernier vainqueur', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-08-18T12:00:00+02:00'));
  await page.goto('/');
  await expect(page.getByText(/ARÈNES DE/i).first()).toBeVisible();
  await expect(page.getByText('Mouriès').first()).toBeVisible();
  await expect(page.getByText(/jeudi 19 août 2027 à 21h30, aux arènes André Blanc, à Mouriès/).first()).toBeVisible();
  await expect(page.getByText(/prévisionnelle/i).first()).toBeVisible();
  for (const epreuve of ['Ferrade en piste', 'Saut de cheval à cheval', 'Saut de cheval à taureau', 'Attente au fer']) {
    await expect(page.getByRole('heading', { name: epreuve })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: /Dernier vainqueur connu/ })).toBeVisible();
  for (const manade of ['Vinuesa', 'Gillet', 'Robert Michel', 'Lafon', 'Arlatenco']) {
    await expect(page.getByText(manade, { exact: false }).first()).toBeVisible();
  }
});

test('la carte et la pastille visent la prochaine soirée du calendrier, toutes villes confondues', async ({ page }, info) => {
  await page.clock.setFixedTime(new Date('2026-10-10T12:00:00+02:00'));
  await page.goto('/');
  await expect(
    page.getByText(
      'Les votes ouvriront le soir de l’Olympiade, le samedi 1er mai 2027 à 15h30, aux arènes d’Arles (date prévisionnelle). Vous noterez chaque manade de 1 à 10, dès la fin de son passage.',
    ),
  ).toBeVisible();
  await expect(page.getByText('203 jours', { exact: true })).toBeVisible();
  if (info.project.name === 'ordinateur') {
    await expect(page.getByRole('banner').getByText('Prochaine soirée · 1er mai')).toBeVisible();
  }
});

test('une soirée passée, la carte annonce la suivante, avec la mention « date prévisionnelle »', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-05-02T12:00:00+02:00'));
  await page.goto('/');
  await expect(
    page.getByText(
      'Les votes ouvriront le soir de l’Olympiade, le vendredi 7 mai 2027 à 21h30, aux arènes du Tempéras, à Alès (date prévisionnelle).',
      { exact: false },
    ),
  ).toBeVisible();
});

test('sans soirée à venir, l’accueil annonce de prochaines dates', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-12-01T12:00:00+01:00'));
  await page.goto('/');
  await expect(page.getByText('Prochaines dates bientôt annoncées')).toBeVisible();
});

// Gardes ajoutées : contenu des données, compte à rebours, état grisé de l'en-tête.

test('le dernier vainqueur connu vient du palmarès : un nom de manade, ses victoires et ses sources', async ({ page }) => {
  await page.goto('/');
  const bloc = page.getByRole('region', { name: /Dernier vainqueur connu/ });
  await expect(bloc.getByRole('heading', { name: /Dernier vainqueur connu\s+Manade\s+\S+/ })).toBeVisible();
  await expect(bloc.getByRole('listitem').first()).toContainText(/20\d\d/);
  await expect(bloc.getByText(/^Sources?\s:/)).toBeVisible();
});

test('le compte à rebours annonce les jours restants avant la prochaine soirée', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-08-18T12:00:00+02:00'));
  await page.goto('/');
  // Mouriès, jeudi 19/08/2027 à 21h30 : 1 jour et 9h30 plus tard.
  await expect(page.getByText('1 jour', { exact: true })).toBeVisible();
  // Le jour même, à moins d'un jour : heures et minutes.
  await page.clock.setFixedTime(new Date('2027-08-20T11:30:00+02:00'));
  await page.reload();
  await expect(page.getByText('9 h 30 min', { exact: true })).toBeVisible();
});

test('le bouton « Noter » de l’en-tête est grisé hors soirée et ne navigue pas', async ({ page }) => {
  await page.goto('/');
  const noter = page.getByRole('banner').getByRole('button', { name: 'Noter', exact: true });
  await expect(noter).toHaveAttribute('aria-disabled', 'true');
  await noter.click({ force: true });
  await expect(page).toHaveURL(/\/$/);
});

test('l’accueil pré-rendu contient les données sans JavaScript', async ({ browser }) => {
  const contexte = await browser.newContext({ javaScriptEnabled: false });
  const page = await contexte.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notez les Olympiades' })).toBeVisible();
  await expect(page.getByText(/Les votes ouvriront le soir de l’Olympiade/)).toBeVisible();
  await expect(page.getByRole('heading', { name: /Dernier vainqueur connu\s+Manade\s+\S+/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Les \d+ dates/ })).toHaveAttribute('href', '/dates');
  await contexte.close();
});

test('si Supabase ne répond pas, l’accueil garde les données du pré-rendu', async ({ page }) => {
  await page.route('**/rest/v1/**', (route) => route.abort());
  await page.goto('/', { waitUntil: 'networkidle' });
  // La première interaction relit les données (clientLoader) : Supabase coupé, la page reprend
  // celles du pré-rendu (fichier .data).
  const supabaseCoupe = page.waitForEvent('requestfailed', (requete) => requete.url().includes('/rest/v1/'));
  const archive = page.waitForResponse((reponse) => estDonneesPreRendu(reponse.url()) && reponse.ok());
  await page.mouse.wheel(0, 300);
  await supabaseCoupe;
  await archive;
  await relectureTerminee(page);
  await expect(page.getByRole('heading', { name: /Dernier vainqueur connu\s+Manade\s+\S+/ })).toBeVisible();
  await expect(page.getByText('Informations momentanément indisponibles')).toHaveCount(0);
});

// Formulaire de contact (page dédiée ; retiré de l’accueil).

test('le formulaire de contact envoie une seule fois et confirme', async ({ page }) => {
  let appels = 0;
  let corps: unknown = null;
  let url = '';
  await page.route('**/api/contact', async (route) => {
    appels += 1;
    corps = route.request().postDataJSON();
    url = route.request().url();
    await new Promise((r) => setTimeout(r, 300));
    await route.fulfill({ status: 200, json: { ok: true } });
  });
  await page.goto('/contact');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email', { exact: true }).fill('lea@exemple.fr');
  await page.getByLabel('Message').fill('Bonjour, quelle sera la date à Nîmes en 2027 ?');
  const bouton = page.getByRole('button', { name: 'Envoyer' });
  await bouton.click();
  await bouton.click({ force: true }).catch(() => {});
  await expect(page.getByText('Merci, votre message est enregistré. Il n’est pas envoyé par email automatiquement.')).toBeVisible();
  expect(appels).toBe(1);
  expect(corps).toEqual({ prenom: 'Léa', email: 'lea@exemple.fr', message: 'Bonjour, quelle sera la date à Nîmes en 2027 ?', site_web: '', turnstileToken: 'jeton-turnstile' });
  // Seule l’API du site reçoit les champs et le jeton.
  expect(new URL(url).pathname).toBe('/api/contact');
  await expect(page.getByLabel('Message')).toHaveValue('');
});

test('le formulaire de contact refuse un message trop court sans appeler le serveur', async ({ page }) => {
  let appels = 0;
  await page.route('**/api/contact', (route) => {
    appels += 1;
    return route.fulfill({ status: 200, json: { ok: true } });
  });
  await page.goto('/contact');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email', { exact: true }).fill('lea@exemple.fr');
  await page.getByLabel('Message').fill('Court');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText(/au moins 10 caractères/)).toBeVisible();
  await expect(page.getByLabel('Message')).toHaveAttribute('aria-invalid', 'true');
  expect(appels).toBe(0);
});

test('le formulaire de contact signale un échec d’envoi', async ({ page }) => {
  await page.route('**/api/contact', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"erreur"}' }),
  );
  await page.goto('/contact');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email', { exact: true }).fill('lea@exemple.fr');
  await page.getByLabel('Message').fill('Bonjour, quelle sera la date à Nîmes en 2027 ?');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText('Message non enregistré.')).toBeVisible();
  await expect(page.getByLabel('Message')).toHaveValue('Bonjour, quelle sera la date à Nîmes en 2027 ?');
});

// Le serveur traduit le plafond en une réponse 429 française.
test('le formulaire de contact signale le plafond de messages atteint, une seule fois envoyé', async ({ page }) => {
  let appels = 0;
  await page.route('**/api/contact', (route) => {
    appels += 1;
    return route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Trop de demandes. Réessayez plus tard.',
      }),
    });
  });
  await page.goto('/contact');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email', { exact: true }).fill('lea@exemple.fr');
  await page.getByLabel('Message').fill('Bonjour, quelle sera la date à Nîmes en 2027 ?');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText('Trop de demandes. Réessayez plus tard.')).toBeVisible();
  await expect(page.getByText('Merci, votre message est enregistré. Il n’est pas envoyé par email automatiquement.')).toHaveCount(0);
  await expect(page.getByLabel('Message')).toHaveValue('Bonjour, quelle sera la date à Nîmes en 2027 ?');
  expect(appels).toBe(1);
});

test('le champ piège est transmis au serveur qui répond sans déposer le message', async ({ page }) => {
  let appels = 0;
  await page.route('**/api/contact', (route) => {
    appels += 1;
    return route.fulfill({ status: 200, json: { ok: true } });
  });
  await page.goto('/contact');
  await page.getByLabel('Prénom').fill('Robot');
  await page.getByLabel('Email', { exact: true }).fill('robot@exemple.fr');
  await page.getByLabel('Message').fill('Message automatique de plus de dix caractères.');
  await page.locator('input[name="site_web"]').fill('https://spam.example', { force: true });
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText('Merci, votre message est enregistré. Il n’est pas envoyé par email automatiquement.')).toBeVisible();
  expect(appels).toBe(1);
});
