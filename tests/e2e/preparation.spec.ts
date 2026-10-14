import { expect, test, type Page } from '../outils/test-e2e';

function jeton(aal: 'aal1' | 'aal2') {
  const encoder = (valeur: unknown) => Buffer.from(JSON.stringify(valeur)).toString('base64url');
  return `${encoder({ alg: 'HS256', typ: 'JWT' })}.${encoder({ sub: '00000000-0000-4000-8000-00000000000a', aal, exp: Math.floor(Date.now() / 1000) + 3600 })}.c2lnbmF0dXJl`;
}

const SESSION = {
  access_token: jeton('aal2'), token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh-factice',
  user: {
    id: '00000000-0000-4000-8000-00000000000a', aud: 'authenticated', role: 'authenticated',
    email: 'admin@example.test',
    factors: [{ id: 'totp-admin', factor_type: 'totp', status: 'verified', friendly_name: 'Administration' }],
    app_metadata: {}, user_metadata: { prenom: 'Camille', role: 'admin' }, created_at: new Date().toISOString(),
  },
};

test.beforeEach(async ({ page }) => {
  await page.route('**/auth/v1/**', (route) => route.abort());
  await page.route('**/rest/v1/**', (route) => route.fulfill({ json: [] }));
});

async function ouvrirSession(page: Page) {
  await page.addInitScript((valeur) => localStorage.setItem('olympiade-auth', JSON.stringify(valeur)), SESSION);
  await page.route('**/auth/v1/user', (route) => route.fulfill({ json: SESSION.user }));
  await page.route('**/rest/v1/profils*', (route) => route.fulfill({ json: [{ id: SESSION.user.id, prenom: 'Camille', role: 'admin' }] }));
}

test('un visiteur voit la préparation sans données', async ({ page }) => {
  await page.goto('/admin/participants');
  await expect(page.getByText('Connectez-vous pour consulter cette page.')).toBeVisible();
  await page.goto('/admin/soirees');
  await expect(page.getByText('Connectez-vous pour consulter cette page.')).toBeVisible();
  await page.goto('/ecran/nimes-2027');
  await expect(page.getByRole('heading', { name: 'L’affichage public n’est pas activé.' })).toBeVisible();
});

test('un administrateur AAL2 consulte les listes vides', async ({ page }) => {
  await ouvrirSession(page);
  await page.goto('/admin/soirees');
  await expect(page.getByRole('heading', { name: 'Mes soirées' })).toBeVisible();
  await expect(page.getByText('Aucune soirée. Le public reste hors soirée.')).toBeVisible();
  await page.goto('/admin/participants');
  await expect(page.getByText('Aucun compte pour le moment.')).toBeVisible();
});
