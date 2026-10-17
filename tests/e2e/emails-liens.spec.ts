import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '../outils/test-e2e';

// L'API /api/emails/lien est simulée : aucune écriture réelle. Les pages ne font que « decrire »
// au chargement ; l'action n'est envoyée qu'au clic (les antivirus et messageries ouvrent les liens).

type Corps = { jeton: string; action: string };
type Etat = { type: 'confirmation' | 'desinscription' | 'je_viens'; date?: { nom: string; ville: string; date: string }; abonne: boolean; annonces: boolean };

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
  const corps = await simuler(page, { type: 'confirmation', abonne: true, annonces: true });
  await page.goto('/emails/confirmation?j=jeton-1');
  await expect(page.getByRole('button', { name: 'Confirmer mon adresse' })).toBeVisible();
  expect(corps).toEqual([{ jeton: 'jeton-1', action: 'decrire' }]);
  await page.getByRole('button', { name: 'Confirmer mon adresse' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Merci, votre adresse est confirmée.' })).toBeVisible();
  expect(corps.at(-1)).toEqual({ jeton: 'jeton-1', action: 'confirmer' });
  await expect(page.getByRole('button', { name: 'Confirmer mon adresse' })).toHaveCount(0);
});

test('confirmation déjà faite : succès neutre', async ({ page }) => {
  await simuler(page, { type: 'confirmation', abonne: true, annonces: true }, { json: { ok: true, etat: 'deja_fait' } });
  await page.goto('/emails/confirmation?j=jeton-1');
  await page.getByRole('button', { name: 'Confirmer mon adresse' }).click();
  await expect(page.getByText('Votre adresse est déjà confirmée.')).toBeVisible();
});

test('désinscription : chaque bouton envoie son action', async ({ page }) => {
  const corps = await simuler(page, { type: 'desinscription', abonne: true, annonces: true });
  await page.goto('/emails/desinscription?j=jeton-2');
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

test('je viens : le bouton porte la date et la ville, l’action part au clic', async ({ page }) => {
  const corps = await simuler(page, { type: 'je_viens', date: DATE, abonne: true, annonces: false });
  await page.goto('/emails/je-viens?j=jeton-3');
  const bouton = page.getByRole('button', { name: /Je viens le samedi 24 juillet 2027 à Saintes-Maries-de-la-Mer/ });
  await expect(bouton).toBeVisible();
  expect(corps).toHaveLength(1);
  await bouton.click();
  await expect(page.getByRole('status').filter({ hasText: 'Merci' })).toBeVisible();
  expect(corps.at(-1)).toEqual({ jeton: 'jeton-3', action: 'je_viens' });
});

test('jeton expiré : message dédié, aucun bouton d’action', async ({ page }) => {
  await page.route('**/api/emails/lien', (route) => route.fulfill({ status: 410, json: { error: 'expire' } }));
  await page.goto('/emails/confirmation?j=vieux');
  await expect(page.getByRole('alert').filter({ hasText: 'Ce lien a expiré' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('button')).toHaveCount(0);
});

test('jeton invalide : message dédié', async ({ page }) => {
  await page.route('**/api/emails/lien', (route) => route.fulfill({ status: 400, json: { error: 'invalide' } }));
  await page.goto('/emails/desinscription?j=faux');
  await expect(page.getByRole('alert').filter({ hasText: 'Ce lien n’est pas valide' })).toBeVisible();
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
  await page.goto('/emails/je-viens?j=jeton-4');
  await expect(page.getByRole('alert').filter({ hasText: 'Service momentanément indisponible, réessayez plus tard' })).toBeVisible();
});

test('échec de l’action : le bouton reste disponible pour réessayer', async ({ page }) => {
  let echec = true;
  await page.route('**/api/emails/lien', async (route) => {
    const { action } = route.request().postDataJSON() as Corps;
    if (action === 'decrire') return route.fulfill({ json: { ok: true, etat: { type: 'confirmation', abonne: true, annonces: true } } });
    if (echec) return route.fulfill({ status: 429, json: { error: 'trop' } });
    return route.fulfill({ json: { ok: true, etat: 'fait' } });
  });
  await page.goto('/emails/confirmation?j=jeton-5');
  await page.getByRole('button', { name: 'Confirmer mon adresse' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Service momentanément indisponible' })).toBeVisible();
  echec = false;
  await page.getByRole('button', { name: 'Confirmer mon adresse' }).click();
  await expect(page.getByText('Merci, votre adresse est confirmée.')).toBeVisible();
});

const PAGES: [string, Etat, string][] = [
  ['/emails/confirmation?j=a', { type: 'confirmation', abonne: true, annonces: true }, 'Confirmer mon adresse'],
  ['/emails/desinscription?j=a', { type: 'desinscription', abonne: true, annonces: true }, 'Ne plus rien recevoir'],
  ['/emails/je-viens?j=a', { type: 'je_viens', date: DATE, abonne: true, annonces: false }, 'Je viens le'],
];

for (const [chemin, etat, bouton] of PAGES) {
  test(`axe : aucune violation grave ni critique sur ${chemin.split('?')[0]}`, async ({ page }) => {
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
