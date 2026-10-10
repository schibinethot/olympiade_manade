import { expect, test } from '@playwright/test';

// Tests de la fiche complétée par task-3-addendum.md (état « hors soirée »).

test('sur mobile, « Notez les Olympiades », le bouton grisé et la raison sont visibles sans défiler', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'critère mobile');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Notez les Olympiades' })).toBeInViewport();
  const bouton = page.getByRole('button', { name: /Je note les manades/ });
  await expect(bouton).toBeInViewport();
  await expect(bouton).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText(/Les votes ouvriront le soir de l’Olympiade/)).toBeInViewport();
  await bouton.click({ force: true });
  await expect(page).toHaveURL(/\/$/);
});

// Mise en place adaptée (consigne du contrôleur) : la fiche fixait l'horloge au 15/08/2027, mais le
// calendrier réel contient des soirées le 16/08/2027 (Beauvoisin, Le Crès), qui seraient alors la
// prochaine soirée. Au 18/08/2027, la prochaine soirée est Mouriès, le jeudi 19/08/2027, quelles que
// soient les dates ajoutées au calendrier. Les assertions sont inchangées.
test('l’accueil présente l’affiche, la prochaine soirée, le compte à rebours, les 4 épreuves et le dernier vainqueur', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-08-18T12:00:00+02:00'));
  await page.goto('/');
  await expect(page.getByText(/ARÈNES DE/i).first()).toBeVisible();
  await expect(page.getByText('Mouriès').first()).toBeVisible();
  await expect(page.getByText(/jeudi 19 août 2027/).first()).toBeVisible();
  await expect(page.getByText(/prévisionnelle/i).first()).toBeVisible();
  for (const epreuve of ['Ferrade en piste', 'Saut de cheval à cheval', 'Saut de cheval à taureau', 'Attente au fer']) {
    await expect(page.getByRole('heading', { name: epreuve })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: /Dernier vainqueur connu/ })).toBeVisible();
  for (const manade of ['Vinuesa', 'Gillet', 'Robert Michel', 'Lafon', 'Arlatenco']) {
    await expect(page.getByText(manade, { exact: false }).first()).toBeVisible();
  }
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
  await page.clock.setFixedTime(new Date('2027-08-19T12:00:00+02:00'));
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
  await expect(page.getByRole('heading', { name: /Dernier vainqueur connu\s+Manade\s+\S+/ })).toBeVisible();
  await expect(page.getByText('Informations momentanément indisponibles')).toHaveCount(0);
});

// Formulaire de contact de l'accueil (règles de la Task 5, testées dès cette tâche).

test('le formulaire de contact de l’accueil envoie une seule fois et confirme', async ({ page }) => {
  let appels = 0;
  let corps: unknown = null;
  let url = '';
  await page.route('**/rest/v1/messages_contact*', async (route) => {
    appels += 1;
    corps = route.request().postDataJSON();
    url = route.request().url();
    await new Promise((r) => setTimeout(r, 300));
    await route.fulfill({ status: 201, body: '' });
  });
  await page.goto('/');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email').fill('lea@exemple.fr');
  await page.getByLabel('Message').fill('Bonjour, quelle sera la date à Nîmes en 2027 ?');
  const bouton = page.getByRole('button', { name: 'Envoyer' });
  await bouton.click();
  await bouton.click({ force: true }).catch(() => {});
  await expect(page.getByText('Merci, votre message est bien parti.')).toBeVisible();
  expect(appels).toBe(1);
  expect(corps).toEqual({ prenom: 'Léa', email: 'lea@exemple.fr', message: 'Bonjour, quelle sera la date à Nîmes en 2027 ?' });
  // Insertion sans .select() : aucune colonne relue.
  expect(url).not.toContain('select=');
  await expect(page.getByLabel('Message')).toHaveValue('');
});

test('le formulaire de contact refuse un message trop court sans appeler le serveur', async ({ page }) => {
  let appels = 0;
  await page.route('**/rest/v1/messages_contact*', (route) => {
    appels += 1;
    return route.fulfill({ status: 201, body: '' });
  });
  await page.goto('/');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email').fill('lea@exemple.fr');
  await page.getByLabel('Message').fill('Court');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText(/au moins 10 caractères/)).toBeVisible();
  await expect(page.getByLabel('Message')).toHaveAttribute('aria-invalid', 'true');
  expect(appels).toBe(0);
});

test('le formulaire de contact signale un échec d’envoi', async ({ page }) => {
  await page.route('**/rest/v1/messages_contact*', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"erreur"}' }),
  );
  await page.goto('/');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email').fill('lea@exemple.fr');
  await page.getByLabel('Message').fill('Bonjour, quelle sera la date à Nîmes en 2027 ?');
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText('L’envoi a échoué, réessayez dans un instant.')).toBeVisible();
  await expect(page.getByLabel('Message')).toHaveValue('Bonjour, quelle sera la date à Nîmes en 2027 ?');
});

test('le champ piège rempli n’envoie rien mais affiche le succès', async ({ page }) => {
  let appels = 0;
  await page.route('**/rest/v1/messages_contact*', (route) => {
    appels += 1;
    return route.fulfill({ status: 201, body: '' });
  });
  await page.goto('/');
  await page.getByLabel('Prénom').fill('Robot');
  await page.getByLabel('Email').fill('robot@exemple.fr');
  await page.getByLabel('Message').fill('Message automatique de plus de dix caractères.');
  await page.locator('input[name="site_web"]').fill('https://spam.example', { force: true });
  await page.getByRole('button', { name: 'Envoyer' }).click();
  await expect(page.getByText('Merci, votre message est bien parti.')).toBeVisible();
  expect(appels).toBe(0);
});
