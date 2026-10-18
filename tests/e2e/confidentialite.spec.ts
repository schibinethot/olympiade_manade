import { expect, test, type Page } from '../outils/test-e2e';

// Page Confidentialité : textes de la revue juridique de la séquence d'emails (B1, B4, C2 à C11, S5, S9).

const IDENTITE = {
  raison_sociale: 'Association des Manades', forme_juridique: 'Association loi 1901', adresse: '1 place des Arènes, 30250 Sommières',
  telephone: null, email: 'contact@exemple.fr', immatriculation: 'RNA W301234567', capital: null, tva: null,
  directeur_publication: 'Camille Martin',
};

async function ouvrir(page: Page, identite: unknown[]) {
  await page.route('**/rest/v1/identite_legale*', (route) => route.fulfill({ json: identite }));
  await page.goto('/confidentialite');
}

const section = (page: Page, titre: string) => page.getByRole('region', { name: titre });

test('sans identité renseignée, le responsable du traitement reste à compléter, sans rien inventer', async ({ page }) => {
  await ouvrir(page, []);
  const responsable = section(page, 'Responsable du traitement');
  await expect(responsable.getByRole('group', { name: 'À compléter par l’organisateur' })).toContainText(
    'L’identité et les coordonnées du responsable du traitement seront fournies par l’organisateur.',
  );
  await expect(responsable.getByRole('link', { name: 'formulaire de contact' })).toHaveAttribute('href', '/contact');
});

test('avec l’identité, le responsable et ses coordonnées sont affichés', async ({ page }) => {
  await ouvrir(page, [IDENTITE]);
  const responsable = section(page, 'Responsable du traitement');
  await expect(responsable).toContainText('Le responsable du traitement de vos données est l’organisateur de l’Olympiade des Manades :');
  await expect(responsable.getByRole('listitem')).toHaveText([
    'Association des Manades', 'Association loi 1901', '1 place des Arènes, 30250 Sommières', 'Email : contact@exemple.fr', 'RNA W301234567',
  ]);
  // Le directeur de la publication relève des mentions légales, pas du responsable du traitement.
  await expect(responsable).not.toContainText('Camille Martin');
});

test('sans nom ni raison sociale, le responsable reste à compléter même si un email est renseigné (R4)', async ({ page }) => {
  await ouvrir(page, [{ ...IDENTITE, raison_sociale: '  ' }]);
  const responsable = section(page, 'Responsable du traitement');
  await expect(responsable.getByRole('group', { name: 'À compléter par l’organisateur' })).toBeVisible();
  await expect(responsable).not.toContainText('contact@exemple.fr');
  // Les mentions légales gardent leur règle : l'email suffit à afficher l'éditeur.
  await page.goto('/mentions-legales');
  await expect(page.getByRole('region', { name: 'Éditeur du site' })).toContainText('contact@exemple.fr');
});

test('les transferts hors UE nomment leurs garanties, sans citer de mécanisme non vérifié (R1, R2)', async ({ page }) => {
  await ouvrir(page, []);
  const transferts = section(page, 'Sous-traitants et transferts');
  await expect(transferts).toContainText(
    'Railway Corp., Cloudflare, Inc. (Turnstile) et, si une clé est configurée, Anthropic sont établies aux États-Unis.',
  );
  await expect(transferts).toContainText(
    'Ces transferts reposent sur la décision d’adéquation de la Commission européenne du 10 juillet 2023, pour les entreprises '
    + 'américaines qui y adhèrent, ou à défaut sur les clauses contractuelles types de la Commission (art. 45 et 46 RGPD). '
    + 'Une copie des garanties peut être demandée via le formulaire de contact.',
  );
  await expect(page.getByText(/Data Privacy Framework/)).toHaveCount(0);
});

test('les bases légales des emails, la désinscription et les sous-traitants suivent la revue juridique', async ({ page }) => {
  await ouvrir(page, []);
  const finalites = section(page, 'Finalités et bases légales');
  await expect(finalites.getByRole('listitem').filter({ hasText: 'Emails liés à votre date' }))
    .toContainText('l’intérêt légitime de l’organisateur à informer le public de la soirée qu’il suit (art. 6(1)(f) RGPD)');
  await expect(finalites.getByRole('listitem').filter({ hasText: 'Annonces des prochaines dates' })).toContainText('art. L34-5');
  await expect(finalites.getByRole('listitem').filter({ hasText: 'Email de confirmation de l’adresse' })).toContainText('Il ne contient aucune publicité.');
  await expect(finalites.getByRole('listitem').filter({ hasText: 'Journal des envois et liste d’opposition' })).toContainText('art. 6(1)(c) et 21(3) RGPD');
  await expect(finalites).toContainText('Donner accès au vote : exécution du service que vous demandez en vous inscrivant (art. 6(1)(b) RGPD).');
  await expect(finalites).toContainText('Si votre messagerie affiche un bouton « Se désabonner », il arrête tous les emails en un clic.');
  await expect(page.getByText(/un clic suffit/)).toHaveCount(0);

  await expect(section(page, 'Données collectées')).toContainText('Emails liés à vos dates');
  await expect(page.getByText('Emails de la séquence')).toHaveCount(0);
  await expect(section(page, 'Données collectées')).toContainText('Vous devez avoir au moins 15 ans, ou l’accord d’un titulaire de l’autorité parentale.');
  await expect(section(page, 'Destinataires')).toContainText('Google (Google Analytics, Google Ads) et Meta (Meta Pixel)');
  await expect(section(page, 'Durée de conservation')).toContainText('au plus 3 ans après votre dernière action');
  // Purge des demandes jamais confirmées (règle B) : 30 jours après la demande ou après la dernière tentative.
  await expect(section(page, 'Durée de conservation')).toContainText(
    'ou, si cet email n’a pas pu partir, 30 jours après la demande ou après la dernière tentative d’envoi.',
  );
  await expect(section(page, 'Données collectées')).toContainText(
    'Sans confirmation, l’adresse est supprimée 30 jours après l’envoi de cet email, ou, si cet email n’a pas pu partir, '
      + '30 jours après la demande ou après la dernière tentative d’envoi.',
  );
  await expect(page.getByText(/30 jours après la demande si cet email/)).toHaveCount(0);
  await expect(section(page, 'Traceurs et stockage local')).toContainText('Nos emails ne contiennent aucun pixel de suivi');
  const soustraitants = section(page, 'Sous-traitants et transferts');
  await expect(soustraitants.getByRole('listitem').filter({ hasText: 'TPMGE' })).toContainText('pour le compte de l’organisateur');
  await expect(soustraitants.getByRole('listitem').filter({ hasText: 'Brevo' })).toContainText('Brevo reçoit votre adresse, votre prénom et le contenu de chaque email.');
  await expect(soustraitants.getByRole('listitem').filter({ hasText: 'Cloudflare Turnstile' })).toContainText('formulaires de connexion, de contact et d’abonnement aux actualités');
  await expect(section(page, 'Vos droits')).toContainText('aux rappels de votre date et aux annonces (art. 21 RGPD) : le lien de désinscription présent dans chaque email suffit.');
});

test('les insécables sont en place avant les ponctuations doubles des nouveaux textes', async ({ page }) => {
  await ouvrir(page, []);
  const texte = (await page.getByRole('main').textContent()) ?? '';
  for (const extrait of [
    'Base légale\u00a0: pour les spectatrices',
    'qu’il suit (art. 6(1)(f) RGPD)\u00a0; vous pouvez',
    '«\u00a0Se désabonner\u00a0»',
    'Donner accès au vote\u00a0: exécution',
    'aucun pixel de suivi\u00a0: nous ne savons pas',
    '(art. 21 RGPD)\u00a0: le lien',
  ]) expect(texte, extrait).toContain(extrait);
  // Aucune espace ordinaire devant « : », « ; », « ! » ou « ? » dans la page.
  expect(texte).not.toMatch(/ [:;!?]/);
});
