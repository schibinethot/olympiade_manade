import { expect, test, type Page } from '../outils/test-e2e';
import { simulerTurnstile } from '../outils/turnstile';

// Tous les appels Auth et profils sont simulés : aucun email réel n'est envoyé, aucun compte n'est
// créé (quota du SMTP intégré de Supabase : 2 emails par heure).

const SESSION = {
  access_token: 'jeton-factice',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'rafraichissement-factice',
  user: {
    id: '00000000-0000-4000-8000-0000000000aa',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'lea@exemple.fr',
    email_confirmed_at: new Date().toISOString(),
    user_metadata: { prenom: 'Léa' },
    app_metadata: {},
    created_at: new Date().toISOString(),
  },
};

// Clés de stockage du site (app/lib/supabase.ts et app/lib/auth.ts).
const CLE_SESSION = 'olympiade-auth';
const CLE_DEMANDE = 'olympiade-inscription';
const LIEN_INSCRIPTION = 'Inscrivez-vous dès maintenant, vous serez prêt le soir venu';
const INSCRIPTIONS_FERMEES = 'Inscriptions bientôt ouvertes';
const CODE_REFUSE = 'Code incorrect ou expiré. Vérifiez vos emails ou demandez un nouveau code.';

// Garde : tout appel Auth qu'un test ne simule pas est coupé, aucun vrai email ne peut partir. Les
// routes posées ensuite par chaque test passent avant celle-ci (Playwright essaie la dernière
// route enregistrée en premier).
test.beforeEach(async ({ page }) => {
  await simulerTurnstile(page);
  await page.route('**/auth/v1/**', (route) => route.abort());
});

async function attendreTurnstile(page: Page) {
  await expect(page.locator('input[name="cf-turnstile-response"]').last()).toHaveValue('jeton-turnstile');
}

test('inscription complète : prénom, email, consentement, code collé, arrivée sur /noter', async ({ page }) => {
  let demandeOtp: Record<string, unknown> | null = null;
  let verification: Record<string, unknown> | null = null;
  await page.route('**/auth/v1/otp*', async (route) => {
    demandeOtp = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/auth/v1/verify*', async (route) => {
    verification = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSION) });
  });
  await page.route('**/rest/v1/profils*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ prenom: 'Léa' }]) }),
  );

  await page.goto('/inscription');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email').fill('  Lea@Exemple.FR ');
  await attendreTurnstile(page);
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await expect(page.getByText(/accepter la politique de confidentialité/)).toBeVisible();
  expect(demandeOtp).toBeNull();
  await page.getByLabel(/J’accepte la politique de confidentialité/).check();
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();

  await expect(page).toHaveURL(/\/inscription\/code$/);
  await expect(page.getByText('lea@exemple.fr')).toBeVisible();
  // PKCE : supabase-js ajoute code_challenge et code_challenge_method, tolérés par toMatchObject.
  expect(demandeOtp).toMatchObject({ email: 'lea@exemple.fr', data: { prenom: 'Léa', consentement: true } });
  expect(demandeOtp).toMatchObject({ create_user: true });
  expect(demandeOtp).toMatchObject({ gotrue_meta_security: { captcha_token: 'jeton-turnstile' } });

  await page.getByLabel(/Code/).first().focus();
  await page.keyboard.insertText('123 456');
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page).toHaveURL(/\/noter$/);
  // Adaptation : l'en-tête affiche aussi le prénom (consigne du 10/10), d'où la recherche dans le
  // contenu principal, pour ne viser qu'un seul élément.
  await expect(page.getByRole('main').getByText('Léa')).toBeVisible();
  expect(verification).toMatchObject({ email: 'lea@exemple.fr', token: '123456', type: 'email' });
});

test('un code refusé affiche un message clair et laisse réessayer', async ({ page }) => {
  await page.route('**/auth/v1/otp*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/auth/v1/verify*', (route) =>
    route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' }),
    }),
  );
  await page.goto('/inscription');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email').fill('lea@exemple.fr');
  await page.getByLabel(/J’accepte la politique de confidentialité/).check();
  await attendreTurnstile(page);
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await page.getByLabel(/Code/).first().focus();
  await page.keyboard.insertText('000000');
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByText('Code incorrect ou expiré. Vérifiez vos emails ou demandez un nouveau code.')).toBeVisible();
  await expect(page).toHaveURL(/\/inscription\/code$/);
});

test('Turnstile indisponible ferme l’envoi OTP avant tout appel Auth', async ({ page }) => {
  let appelsOtp = 0;
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', (route) => route.abort());
  await page.route('**/auth/v1/otp*', (route) => {
    appelsOtp += 1;
    return route.fulfill({ status: 200, body: '{}' });
  });
  await page.goto('/inscription');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email').fill('lea@exemple.fr');
  await page.getByLabel(/J’accepte la politique de confidentialité/).check();
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await expect(page.getByText(/vérification anti-robot/i).first()).toBeVisible();
  expect(appelsOtp).toBe(0);
  await expect(page).toHaveURL(/\/inscription$/);
});

// ---------------------------------------------------------------------------------------------
// Gardes ajoutées (fiche, compléments du 10/10 et reprise d'un projet interne)
// ---------------------------------------------------------------------------------------------

/** Remplit le formulaire d'inscription et demande le code. */
async function demanderUnCode(page: Page, email = 'lea@exemple.fr') {
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/J’accepte la politique de confidentialité/).check();
  await attendreTurnstile(page);
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
}

/** Session déjà ouverte sur l'appareil : posée une seule fois, avant le premier chargement. */
async function ouvrirSession(page: Page) {
  await page.addInitScript(
    ([cle, session]) => {
      if (sessionStorage.getItem('test-session-posee')) return;
      sessionStorage.setItem('test-session-posee', '1');
      localStorage.setItem(cle, JSON.stringify(session));
    },
    [CLE_SESSION, SESSION] as const,
  );
  await page.route('**/rest/v1/profils*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ prenom: 'Léa' }]) }),
  );
  // Le jeton factice serait refusé par la vraie base : les lectures publiques partent avec la clé
  // publishable seule, comme pour un visiteur.
  await page.route(/\/rest\/v1\/(calendrier|palmares)/, async (route) => {
    const entetes = { ...route.request().headers() };
    entetes.authorization = `Bearer ${entetes.apikey}`;
    await route.continue({ headers: entetes });
  });
}

/** Demande de code en cours dans l'onglet, comme après « Recevoir mon code ». */
async function poserDemande(page: Page, envoyeeLe = Date.now()) {
  await page.addInitScript(
    ([cle, demande]) => sessionStorage.setItem(cle, demande),
    [CLE_DEMANDE, JSON.stringify({ prenom: 'Léa', email: 'lea@exemple.fr', envoyeeLe })] as const,
  );
}

test('la saisie du code ouvre le clavier numérique et accepte le remplissage automatique', async ({ page }) => {
  await poserDemande(page);
  await page.goto('/inscription/code');
  const saisie = page.getByLabel(/Code/).first();
  await expect(saisie).toHaveAttribute('inputmode', 'numeric');
  await expect(saisie).toHaveAttribute('autocomplete', 'one-time-code');
  await expect(saisie).toHaveAttribute('maxlength', '6');
  await expect(saisie).toHaveAttribute('pattern', '[0-9]*');
});

test('un code collé avec du texte autour est accepté', async ({ page }) => {
  let verification: Record<string, unknown> | null = null;
  await page.route('**/auth/v1/verify*', async (route) => {
    verification = route.request().postDataJSON();
    await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error_code: 'otp_expired' }) });
  });
  await poserDemande(page);
  await page.goto('/inscription/code');
  const saisie = page.getByLabel(/Code/).first();
  await saisie.focus();
  await saisie.evaluate((champ) => {
    const donnees = new DataTransfer();
    donnees.setData('text/plain', 'Votre code : 123 456');
    champ.dispatchEvent(new ClipboardEvent('paste', { clipboardData: donnees, bubbles: true, cancelable: true }));
  });
  await expect(saisie).toHaveValue('123456');
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByText(CODE_REFUSE)).toBeVisible();
  expect(verification).toMatchObject({ token: '123456' });
  // Code refusé : saisie vidée et remise au focus, pour réessayer tout de suite.
  await expect(saisie).toHaveValue('');
  await expect(saisie).toBeFocused();
});

test('un code incomplet n’est pas envoyé', async ({ page }) => {
  let appels = 0;
  await page.route('**/auth/v1/verify*', (route) => {
    appels += 1;
    return route.fulfill({ status: 403, body: '{}' });
  });
  await poserDemande(page);
  await page.goto('/inscription/code');
  await page.getByLabel(/Code/).first().focus();
  await page.keyboard.insertText('1234');
  await page.getByRole('button', { name: 'Valider' }).click();
  await expect(page.getByText('Saisissez les 6 chiffres du code reçu par email.')).toBeVisible();
  expect(appels).toBe(0);
});

test('les erreurs de Supabase sont traduites : trop de demandes, réseau coupé', async ({ page }) => {
  let reponse: 'limite' | 'reseau' = 'limite';
  await page.route('**/auth/v1/otp*', (route) =>
    reponse === 'limite'
      ? route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ code: 429, error_code: 'over_email_send_rate_limit', msg: 'email rate limit exceeded' }),
        })
      : route.abort('internetdisconnected'),
  );
  await page.goto('/inscription');
  await demanderUnCode(page);
  await expect(page.getByText('Trop de demandes de code. Réessayez dans quelques minutes.')).toBeVisible();
  await expect(page).toHaveURL(/\/inscription$/);
  await expect(page.getByText(/rate limit/i)).toHaveCount(0);

  reponse = 'reseau';
  await attendreTurnstile(page);
  await page.getByRole('button', { name: 'Recevoir mon code' }).click();
  await expect(page.getByText('Connexion impossible. Vérifiez votre réseau et réessayez.')).toBeVisible();
  await expect(page).toHaveURL(/\/inscription$/);
});

test('un double envoi ne demande qu’un code et ne vérifie qu’une fois (verrou anti-double-clic)', async ({ page }) => {
  let demandes = 0;
  let verifications = 0;
  await page.route('**/auth/v1/otp*', async (route) => {
    demandes += 1;
    await new Promise((r) => setTimeout(r, 300));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/auth/v1/verify*', async (route) => {
    verifications += 1;
    await new Promise((r) => setTimeout(r, 300));
    await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error_code: 'otp_expired' }) });
  });
  await page.goto('/inscription');
  await page.getByLabel('Prénom').fill('Léa');
  await page.getByLabel('Email').fill('lea@exemple.fr');
  await page.getByLabel(/J’accepte la politique de confidentialité/).check();
  await attendreTurnstile(page);
  await page.evaluate(() => {
    const form = document.querySelector('main form') as HTMLFormElement;
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page).toHaveURL(/\/inscription\/code$/);
  expect(demandes).toBe(1);

  await page.getByLabel(/Code/).first().focus();
  await page.keyboard.insertText('123456');
  await page.evaluate(() => {
    const form = document.querySelector('main form') as HTMLFormElement;
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(page.getByText(CODE_REFUSE)).toBeVisible();
  expect(verifications).toBe(1);
});

test('« Renvoyer le code » attend 60 s avec un compte à rebours, puis renvoie au même email', async ({ page }) => {
  const demandes: Record<string, unknown>[] = [];
  await page.route('**/auth/v1/otp*', async (route) => {
    demandes.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.clock.install({ time: new Date('2026-10-10T12:00:00+02:00') });
  await page.goto('/inscription');
  await demanderUnCode(page);
  await expect(page).toHaveURL(/\/inscription\/code$/);

  const attente = page.getByRole('button', { name: /^Renvoyer le code dans 0:\d\d$|^Renvoyer le code dans 1:00$/ });
  await expect(attente).toBeDisabled();
  await page.clock.runFor(18_000);
  await expect(page.getByRole('button', { name: /Renvoyer le code dans 0:4[12]/ })).toBeDisabled();

  await page.clock.runFor(43_000);
  const renvoyer = page.getByRole('button', { name: 'Renvoyer le code', exact: true });
  await expect(renvoyer).toBeEnabled();
  await attendreTurnstile(page);
  await renvoyer.click();
  await expect(page.getByText('Un nouveau code a été envoyé à lea@exemple.fr.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Renvoyer le code dans/ })).toBeDisabled();
  expect(demandes).toHaveLength(2);
  expect(demandes[1]).toMatchObject({ email: 'lea@exemple.fr', data: { prenom: 'Léa', consentement: true } });
  await expect(page.getByText('Le lien de connexion du même email marche aussi')).toBeVisible();
});

test('« Changer d’email » ramène au formulaire, déjà rempli', async ({ page }) => {
  await poserDemande(page);
  await page.goto('/inscription/code');
  await page.getByRole('link', { name: 'Changer d’email' }).click();
  await expect(page).toHaveURL(/\/inscription$/);
  await expect(page.getByLabel('Prénom')).toHaveValue('Léa');
  await expect(page.getByLabel('Email')).toHaveValue('lea@exemple.fr');
});

test('ouverture directe de /inscription et /inscription/code par leur adresse (repli monopage)', async ({ page }) => {
  const reponse = await page.goto('/inscription');
  expect(reponse?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByLabel('Prénom')).toBeVisible();

  // Sans demande en cours dans cet onglet : on renvoie vers le formulaire.
  const code = await page.goto('/inscription/code');
  expect(code?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Aucune demande de code en cours sur cet appareil.')).toBeVisible();
  await page.getByRole('link', { name: 'Recevoir un code' }).click();
  await expect(page).toHaveURL(/\/inscription$/);
});

test('ouverture directe de /inscription/code avec une demande en cours', async ({ page }) => {
  await poserDemande(page);
  await page.goto('/inscription/code');
  await expect(page.getByText('lea@exemple.fr')).toBeVisible();
  await expect(page.getByLabel(/Code/).first()).toBeVisible();
});

test('un lien de connexion expiré renvoie vers le code, avec un message clair', async ({ page }) => {
  await page.goto('/inscription/code?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  await expect(page.getByText('Ce lien de connexion n’est plus valable.', { exact: false })).toBeVisible();
  await expect(page.getByText(/Email link is invalid/)).toHaveCount(0);
});

test('déjà connecté, /inscription mène directement à /noter', async ({ page }) => {
  await ouvrirSession(page);
  await page.goto('/inscription');
  await expect(page).toHaveURL(/\/noter$/);
});

// Drapeau d'ouverture : le build des tests laisse VITE_INSCRIPTION_OUVERTE à faux (playwright.config.ts),
// comme le déploiement tant que le SMTP personnalisé n'est pas prêt. Le cas « vrai » est couvert par
// tests/unit/inscription-ouverte.test.ts ; les pages d'inscription restent testées par leur adresse.

test('accueil, inscriptions fermées : « Inscriptions bientôt ouvertes », sans lien vers /inscription', async ({ page }) => {
  await page.goto('/');
  const carte = page.getByRole('region', { name: 'Notez les Olympiades' });
  await expect(carte.getByText(INSCRIPTIONS_FERMEES, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: LIEN_INSCRIPTION })).toHaveCount(0);
  await expect(page.locator('a[href^="/inscription"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Je note les manades/ })).toHaveAttribute('aria-disabled', 'true');
});

test('inscriptions fermées : /inscription reste utilisable par son adresse, hors des moteurs de recherche', async ({ page }) => {
  await page.route('**/auth/v1/otp*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  for (const chemin of ['/inscription', '/inscription/code']) {
    await page.goto(chemin);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  }
  await page.goto('/inscription');
  await demanderUnCode(page);
  await expect(page).toHaveURL(/\/inscription\/code$/);
  await expect(page.getByLabel(/Code/).first()).toBeVisible();
});

test('accueil, spectateur inscrit : « Vous êtes inscrit, à bientôt dans les arènes, Léa »', async ({ page }) => {
  await ouvrirSession(page);
  await page.goto('/');
  await expect(page.getByText('Vous êtes inscrit, à bientôt dans les arènes, Léa')).toBeVisible();
  await expect(page.getByRole('link', { name: LIEN_INSCRIPTION })).toHaveCount(0);
  // Les votes restent fermés : le bouton reste grisé, avec sa raison.
  await expect(page.getByRole('button', { name: /Je note les manades/ })).toHaveAttribute('aria-disabled', 'true');
});

// Calendrier simulé pour /noter : la page n'a pas de pré-rendu de repli, et une lecture de la vraie
// base qui dépasse 3 s (tests en parallèle) la laissait sans date. Mouriès vient avant Nîmes : la page
// annonce Mouriès, la prochaine soirée (soireeDeReference).
const CALENDRIER = [
  {
    id: 'mouries-2027',
    annee: 2027,
    nom: 'Les Grandes Olympiades des Gardians',
    ville: 'Mouriès',
    arenes: 'Arènes André Blanc',
    date_soiree: '2027-05-01',
    heure: '21:00:00',
    statut: 'confirmee',
    lien_billetterie: null,
  },
  {
    id: 'nimes-2027',
    annee: 2027,
    nom: 'Olympiades de Nîmes',
    ville: 'Nîmes',
    arenes: 'Arènes de Nîmes',
    date_soiree: '2027-08-20',
    heure: '21:00:00',
    statut: 'previsionnelle',
    lien_billetterie: null,
  },
];

async function simulerCalendrier(page: Page) {
  await page.route('**/rest/v1/calendrier*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CALENDRIER) }),
  );
}

test('/noter, visiteur, inscriptions fermées : prochaine date et « Inscriptions bientôt ouvertes », sans lien', async ({ page }) => {
  await simulerCalendrier(page);
  await page.clock.setFixedTime(new Date('2026-10-10T12:00:00+02:00'));
  await page.goto('/noter');
  await expect(page.getByText(/Les votes ouvriront le samedi 1er mai 2027 à 21h, aux arènes André Blanc, à Mouriès/)).toBeVisible();
  await expect(page.getByText(/Bonjour/)).toHaveCount(0);
  await expect(page.getByRole('main').getByText(INSCRIPTIONS_FERMEES, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: LIEN_INSCRIPTION })).toHaveCount(0);
  await expect(page.locator('a[href^="/inscription"]')).toHaveCount(0);
});

// La session donne accès au suivi sans faire disparaître la prochaine date d'ouverture.
test('/noter, spectateur inscrit : « Bonjour Léa », prochaine date et suivi des notes, sans lien d’inscription', async ({ page }) => {
  await ouvrirSession(page);
  await simulerCalendrier(page);
  await page.clock.setFixedTime(new Date('2026-10-10T12:00:00+02:00'));
  await page.goto('/noter');
  const texte = page.getByRole('main').getByText(/Bonjour Léa\./);
  await expect(texte).toBeVisible();
  await expect(texte).toContainText('Retrouvez les passages proposés et le suivi de vos notes ci-dessous.');
  await expect(texte).toContainText('Les votes ouvriront le samedi 1er mai 2027 à 21h, aux arènes André Blanc, à Mouriès.');
  await expect(page.getByRole('main').getByRole('link', { name: LIEN_INSCRIPTION })).toHaveCount(0);
  await expect(page.getByText(INSCRIPTIONS_FERMEES)).toHaveCount(0);
});

test('en-tête : prénom et « Se déconnecter », sur ordinateur et dans le menu mobile', async ({ page }, info) => {
  let deconnexion: string | null = null;
  await page.route('**/auth/v1/logout*', async (route) => {
    deconnexion = route.request().url();
    await route.fulfill({ status: 204, body: '' });
  });
  await ouvrirSession(page);
  await page.goto('/');
  const entete = page.getByRole('banner');
  if (info.project.name === 'mobile') await entete.getByRole('button', { name: 'Menu' }).click();
  // Deux emplacements (menu mobile, barre de l'ordinateur), un seul affiché selon la largeur.
  await expect(entete.getByText('Léa').filter({ visible: true })).toBeVisible();
  if (info.project.name === 'mobile') {
    await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByText('Léa')).toBeVisible();
  }
  // Le bouton « Noter » de l'en-tête reste grisé : les votes sont fermés.
  await expect(entete.getByRole('button', { name: 'Noter' })).toHaveAttribute('aria-disabled', 'true');

  await entete.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(entete.getByText('Léa')).toHaveCount(0);
  // Déconnecté, inscriptions fermées : la carte de l'accueil revient au texte d'attente.
  await expect(page.getByText(INSCRIPTIONS_FERMEES, { exact: true })).toBeVisible();
  expect(deconnexion).toContain('scope=local');
  expect(await page.evaluate((cle) => localStorage.getItem(cle), CLE_SESSION)).toBeNull();
});

test('en-tête d’un spectateur connecté : aucun débordement de 1000 à 1300 px', async ({ page }, info) => {
  test.skip(info.project.name !== 'ordinateur', 'largeurs d’ordinateur');
  await ouvrirSession(page);
  await page.goto('/');
  await expect(page.getByText('Vous êtes inscrit, à bientôt dans les arènes, Léa')).toBeVisible();
  for (const largeur of [1000, 1100, 1200, 1300]) {
    await page.setViewportSize({ width: largeur, height: 800 });
    const deborde = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(deborde, `${largeur} px`).toBeLessThanOrEqual(0);
    await expect(page.getByRole('banner').getByRole('button', { name: 'Se déconnecter' })).toBeVisible();
  }
});
