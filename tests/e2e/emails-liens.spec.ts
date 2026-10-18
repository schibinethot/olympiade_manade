import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../outils/test-e2e';

// L'API /api/emails/lien est simulée : aucune écriture réelle. Les pages ne font que « decrire »
// au chargement ; l'action n'est envoyée qu'au clic (les antivirus et messageries ouvrent les liens).

type Corps = { jeton: string; action: string };
type Etat = { type: 'confirmation' | 'desinscription' | 'je_viens'; date?: { nom: string; ville: string; date: string }; abonne: boolean; annonces: boolean; desinscrit: boolean };

const DATE = { nom: 'Soirée des arènes', ville: 'Saintes-Maries-de-la-Mer', date: '2027-07-24' };

async function simuler(page: Page, etat: Etat, actions: { statut?: number; json?: unknown } = {}) {
  const corps: Corps[] = [];
  await page.route('**/api/emails/lien', async (route) => {
    const demande = route.request().postDataJSON() as Corps;
    corps.push(demande);
    if (demande.action === 'decrire') return route.fulfill({ json: { ok: true, etat } });
    return route.fulfill({ status: actions.statut ?? 200, json: actions.json ?? { ok: true, etat: 'fait' } });
  });
  return corps;
}

test('confirmation : aucune écriture avant le clic, puis le succès', async ({ page }) => {
  const corps = await simuler(page, { type: 'confirmation', abonne: true, annonces: true, desinscrit: false });
  await page.goto('/emails/confirmation#j=jeton-1');
  await expect(page.getByRole('button', { name: 'Confirmer mon adresse' })).toBeVisible();
  expect(corps).toEqual([{ jeton: 'jeton-1', action: 'decrire' }]);
  await page.getByRole('button', { name: 'Confirmer mon adresse' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Merci, votre adresse est confirmée.' })).toBeVisible();
  expect(corps.at(-1)).toEqual({ jeton: 'jeton-1', action: 'confirmer' });
  await expect(page.getByRole('button', { name: 'Confirmer mon adresse' })).toHaveCount(0);
});

test('confirmation déjà faite : succès neutre', async ({ page }) => {
  await simuler(page, { type: 'confirmation', abonne: true, annonces: true, desinscrit: false }, { json: { ok: true, etat: 'deja_fait' } });
  await page.goto('/emails/confirmation#j=jeton-1');
  await page.getByRole('button', { name: 'Confirmer mon adresse' }).click();
  await expect(page.getByText('Votre adresse est déjà confirmée.')).toBeVisible();
});

test('désinscription : chaque bouton envoie son action', async ({ page }) => {
  const corps = await simuler(page, { type: 'desinscription', abonne: true, annonces: true, desinscrit: false });
  await page.goto('/emails/desinscription#j=jeton-2');
  await expect(page.getByRole('button', { name: 'Ne plus rien recevoir' })).toBeVisible();
  expect(corps).toEqual([{ jeton: 'jeton-2', action: 'decrire' }]);
  await page.getByRole('button', { name: 'Arrêter seulement les annonces' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'annonces' })).toBeVisible();
  expect(corps.at(-1)).toEqual({ jeton: 'jeton-2', action: 'arreter_annonces' });

  await page.reload();
  await page.getByRole('button', { name: 'Ne plus rien recevoir' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Vous ne recevrez plus aucun email' })).toBeVisible();
  expect(corps.at(-1)).toEqual({ jeton: 'jeton-2', action: 'desinscrire' });
});

test('désinscription d’un spectateur non abonné aux actualités : les deux boutons, chacun envoie son action', async ({ page }) => {
  const corps = await simuler(page, { type: 'desinscription', abonne: false, annonces: true, desinscrit: false });
  await page.goto('/emails/desinscription#j=jeton-2');
  await expect(page.getByRole('button', { name: 'Arrêter seulement les annonces' })).toBeVisible();
  await page.getByRole('button', { name: 'Ne plus rien recevoir' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Vous ne recevrez plus aucun email' })).toBeVisible();
  expect(corps.at(-1)).toEqual({ jeton: 'jeton-2', action: 'desinscrire' });
});

test('désinscription sans annonces : un seul bouton et pas d’intro à deux choix', async ({ page }) => {
  await simuler(page, { type: 'desinscription', abonne: true, annonces: false, desinscrit: false });
  await page.goto('/emails/desinscription#j=jeton-2');
  await expect(page.getByRole('button', { name: 'Ne plus rien recevoir' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Arrêter seulement les annonces' })).toHaveCount(0);
  await expect(page.getByText('Choisissez ce que vous souhaitez continuer à recevoir.')).toHaveCount(0);
});

test('déjà désinscrit : aucun bouton, le message est affiché', async ({ page }) => {
  await simuler(page, { type: 'desinscription', abonne: false, annonces: false, desinscrit: true });
  await page.goto('/emails/desinscription#j=jeton-2');
  await expect(page.getByRole('status').filter({ hasText: 'Vous ne recevez déjà plus d’emails de l’Olympiade des Manades.' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
});

test('le jeton quitte l’adresse mais un rechargement fonctionne, et le résultat reçoit le focus', async ({ page }) => {
  const corps = await simuler(page, { type: 'confirmation', abonne: true, annonces: true, desinscrit: false });
  await page.goto('/emails/confirmation#j=jeton-secret');
  await expect(page.getByRole('button', { name: 'Confirmer mon adresse' })).toBeVisible();
  expect(page.url()).not.toContain('jeton-secret');
  expect(new URL(page.url()).hash).toBe('');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Confirmer mon adresse' })).toBeVisible();
  expect(corps.every((c) => c.jeton === 'jeton-secret')).toBe(true);
  await page.getByRole('button', { name: 'Confirmer mon adresse' }).click();
  const succes = page.getByText('Merci, votre adresse est confirmée.');
  await expect(succes).toBeVisible();
  await expect(page.locator('p:focus')).toContainText('Merci, votre adresse est confirmée.');
});

test('quitter la page de lien dans l’onglet retire le jeton du stockage, un rechargement le garde', async ({ page }) => {
  await simuler(page, { type: 'confirmation', abonne: true, annonces: true, desinscrit: false });
  await page.goto('/emails/confirmation#j=jeton-a-oublier');
  await expect(page.getByRole('button', { name: 'Confirmer mon adresse' })).toBeVisible();
  const garde = () => page.evaluate(() => sessionStorage.getItem('olympiade-lien-email'));
  expect(await garde()).toContain('jeton-a-oublier');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Confirmer mon adresse' })).toBeVisible();
  expect(await garde()).toContain('jeton-a-oublier');
  // Navigation dans le site (même onglet, sans rechargement) : la page de lien est démontée.
  await page.evaluate(() => {
    const lien = document.querySelector<HTMLAnchorElement>('footer a[href="/mentions-legales"]');
    lien?.click();
  });
  await expect(page).toHaveURL(/\/mentions-legales$/);
  expect(await garde()).toBeNull();
});

test('un ancien lien en ?j= fonctionne encore, et son jeton quitte aussi l’adresse', async ({ page }) => {
  const corps = await simuler(page, { type: 'desinscription', abonne: true, annonces: true, desinscrit: false });
  await page.goto('/emails/desinscription?j=jeton-ancien');
  await expect(page.getByRole('button', { name: 'Ne plus rien recevoir' })).toBeVisible();
  expect(corps).toEqual([{ jeton: 'jeton-ancien', action: 'decrire' }]);
  expect(page.url()).not.toContain('jeton-ancien');
  expect(new URL(page.url()).search).toBe('');
});

test('confirmation d’une adresse désinscrite qui se réabonne : le bouton est là et envoie « confirmer »', async ({ page }) => {
  const corps = await simuler(page, { type: 'confirmation', abonne: true, annonces: false, desinscrit: true });
  await page.goto('/emails/confirmation#j=jeton-reabonnement');
  const bouton = page.getByRole('button', { name: 'Confirmer mon adresse' });
  await expect(bouton).toBeVisible();
  await expect(page.getByText('Vous ne recevez déjà plus d’emails de l’Olympiade des Manades.')).toHaveCount(0);
  await bouton.click();
  await expect(page.getByRole('status').filter({ hasText: 'Merci, votre adresse est confirmée.' })).toBeVisible();
  expect(corps.at(-1)).toEqual({ jeton: 'jeton-reabonnement', action: 'confirmer' });
});

test('désinscription : l’intro est là pendant le chargement, sans saut quand l’état arrive', async ({ page }) => {
  let liberer: () => void = () => {};
  const attente = new Promise<void>((resolve) => { liberer = resolve; });
  await page.route('**/api/emails/lien', async (route) => {
    await attente;
    return route.fulfill({ json: { ok: true, etat: { type: 'desinscription', abonne: false, annonces: false, desinscrit: false } } });
  });
  await page.goto('/emails/desinscription#j=jeton-lent');
  await expect(page.getByText('Vérification du lien…')).toBeVisible();
  await expect(page.getByText('Choisissez ce que vous souhaitez continuer à recevoir.')).toBeVisible();
  const carte = page.locator('main div[aria-busy]').first();
  const avant = await carte.boundingBox();
  liberer();
  // Sans annonces : un seul bouton, et une intro qui tient la même place (la carte ne bouge pas).
  await expect(page.getByRole('button', { name: 'Ne plus rien recevoir' })).toBeVisible();
  await expect(page.getByText('Un seul bouton arrête tous les emails de l’Olympiade des Manades.')).toBeVisible();
  const apres = await carte.boundingBox();
  expect(apres?.y).toBe(avant?.y);
});

test('je viens : le bouton porte la date et la ville, l’action part au clic', async ({ page }) => {
  const corps = await simuler(page, { type: 'je_viens', date: DATE, abonne: true, annonces: false, desinscrit: false });
  await page.goto('/emails/je-viens#j=jeton-3');
  const bouton = page.getByRole('button', { name: /Je viens le samedi 24 juillet 2027 à Saintes-Maries-de-la-Mer/ });
  await expect(bouton).toBeVisible();
  expect(corps).toHaveLength(1);
  await bouton.click();
  await expect(page.getByRole('status').filter({ hasText: 'Merci' })).toBeVisible();
  expect(corps.at(-1)).toEqual({ jeton: 'jeton-3', action: 'je_viens' });
});

test('jeton expiré : message dédié, aucun bouton d’action', async ({ page }) => {
  await page.route('**/api/emails/lien', (route) => route.fulfill({ status: 410, json: { error: 'expire' } }));
  await page.goto('/emails/confirmation#j=vieux');
  await expect(page.getByRole('alert').filter({ hasText: 'Ce lien a expiré' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('alert').getByRole('link', { name: 'Retour au formulaire d’inscription' })).toHaveAttribute('href', '/#actualites');
  await expect(page.getByRole('alert').getByText(/Inscrivez-vous à nouveau depuis l’accueil/)).toBeVisible();
});

test('jeton invalide : message dédié', async ({ page }) => {
  await page.route('**/api/emails/lien', (route) => route.fulfill({ status: 400, json: { error: 'invalide' } }));
  await page.goto('/emails/desinscription#j=faux');
  await expect(page.getByRole('alert').filter({ hasText: 'Ce lien n’est pas valide' })).toBeVisible();
  await expect(page.getByRole('alert').getByRole('link', { name: 'Nous contacter' })).toHaveAttribute('href', '/contact');
});

test('jeton absent : message dédié, sans appel au serveur', async ({ page }) => {
  let appels = 0;
  await page.route('**/api/emails/lien', (route) => { appels++; return route.abort(); });
  await page.goto('/emails/desinscription');
  await expect(page.getByRole('alert').filter({ hasText: 'Ce lien n’est pas valide' })).toBeVisible();
  expect(appels).toBe(0);
});

test('service indisponible : message dédié', async ({ page }) => {
  await page.route('**/api/emails/lien', (route) => route.fulfill({ status: 503, json: { error: 'indisponible' } }));
  await page.goto('/emails/je-viens#j=jeton-4');
  await expect(page.getByRole('alert').filter({ hasText: 'Service momentanément indisponible, réessayez plus tard' })).toBeVisible();
});

test('échec de l’action : le bouton reste disponible pour réessayer', async ({ page }) => {
  let echec = true;
  await page.route('**/api/emails/lien', async (route) => {
    const { action } = route.request().postDataJSON() as Corps;
    if (action === 'decrire') return route.fulfill({ json: { ok: true, etat: { type: 'confirmation', abonne: true, annonces: true, desinscrit: false } } });
    if (echec) return route.fulfill({ status: 429, json: { error: 'trop' } });
    return route.fulfill({ json: { ok: true, etat: 'fait' } });
  });
  await page.goto('/emails/confirmation#j=jeton-5');
  await page.getByRole('button', { name: 'Confirmer mon adresse' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Service momentanément indisponible' })).toBeVisible();
  // Le bouton, désactivé pendant l'appel, a perdu le focus : il passe au message d'échec.
  await expect(page.locator('p:focus')).toContainText('Service momentanément indisponible');
  echec = false;
  await page.getByRole('button', { name: 'Confirmer mon adresse' }).click();
  await expect(page.getByText('Merci, votre adresse est confirmée.')).toBeVisible();
});

const PAGES: [string, Etat, string][] = [
  ['/emails/confirmation#j=a', { type: 'confirmation', abonne: true, annonces: true, desinscrit: false }, 'Confirmer mon adresse'],
  ['/emails/desinscription#j=a', { type: 'desinscription', abonne: true, annonces: true, desinscrit: false }, 'Ne plus rien recevoir'],
  ['/emails/je-viens#j=a', { type: 'je_viens', date: DATE, abonne: true, annonces: false, desinscrit: false }, 'Je viens le'],
];

for (const [chemin, etat, bouton] of PAGES) {
  test(`axe : aucune violation grave ni critique sur ${chemin.split(/[?#]/)[0]}`, async ({ page }) => {
    await simuler(page, etat);
    await page.goto(chemin, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: bouton })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    const graves = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
    expect(graves).toEqual([]);
  });
}

test('les pages /emails/* sont servies en noindex', async ({ request }) => {
  for (const chemin of ['/emails/confirmation', '/emails/desinscription', '/emails/je-viens']) {
    const reponse = await request.get(chemin);
    expect(reponse.status(), chemin).toBe(200);
    expect(reponse.headers()['x-robots-tag'], chemin).toBe('noindex');
  }
});
