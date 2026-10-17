/**
 * Tests e2e de l'onglet « Comment ça marche » de /admin/cookies.
 *
 * Vérifie : navigation clavier entre onglets, bascule par ?onglet=,
 * chargement des médias (vidéo + affiche + captures WebP), interaction
 * du sélecteur Fenêtre/Barre/Rien, et absence de violation axe grave.
 */

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const SESSION = (() => {
  const encoder = (valeur: unknown) => Buffer.from(JSON.stringify(valeur)).toString('base64url');
  const jeton = `${encoder({ alg: 'HS256', typ: 'JWT' })}.${encoder({
    sub: '00000000-0000-4000-8000-00000000000a',
    aal: 'aal2',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.c2lnbmF0dXJl`;
  return {
    access_token: jeton,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'refresh-factice',
    user: {
      id: '00000000-0000-4000-8000-00000000000a',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'admin@example.test',
      factors: [
        { id: 'totp-admin', factor_type: 'totp', status: 'verified', friendly_name: 'Administration' },
      ],
      app_metadata: {},
      user_metadata: { prenom: 'Camille', role: 'admin' },
      created_at: new Date().toISOString(),
    },
  };
})();

async function ouvrirAdmin(page: Page) {
  await page.addInitScript((valeur) => {
    try {
      localStorage.setItem('olympiade-auth', JSON.stringify(valeur));
    } catch {}
  }, SESSION);
  await page.route('**/auth/v1/**', (route) =>
    route.request().url().includes('/user')
      ? route.fulfill({ json: SESSION.user })
      : route.abort(),
  );
  await page.route('**/rest/v1/profils*', (route) =>
    route.fulfill({ json: [{ id: SESSION.user.id, prenom: 'Camille', role: 'admin' }] }),
  );
  await page.route('**/rest/v1/parametres_cookies*', (route) =>
    route.fulfill({
      json: {
        id: 1,
        titre: 'Confidentialité',
        description: 'Description de test.',
        texte_tout_accepter: 'Tout accepter',
        texte_refuser: 'Tout refuser',
        texte_personnaliser: 'Personnaliser',
        texte_enregistrer: 'Enregistrer mes choix',
        url_confidentialite: '/confidentialite',
        mesure_active: true,
        mesure_titre: 'Mesure d’audience',
        mesure_description: '.',
        publicite_active: true,
        publicite_titre: 'Publicité et réseaux sociaux',
        publicite_description: '.',
        duree_consentement_jours: 365,
      },
    }),
  );
  await page.route('**/rest/v1/consentements_cookies*', (route) =>
    route.fulfill({
      headers: { 'content-range': '0-0/0', 'access-control-expose-headers': 'content-range' },
      json: [],
    }),
  );
}

test.describe('onglet Comment ça marche', () => {
  test('ouvre l’aide par défaut et expose les 4 onglets ARIA', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/cookies');
    const tablist = page.getByRole('tablist', { name: /Onglets cookies/i });
    await expect(tablist).toBeVisible({ timeout: 8000 });
    const onglets = tablist.getByRole('tab');
    await expect(onglets).toHaveCount(4);
    await expect(onglets.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(onglets.nth(0)).toHaveText(/Comment ça marche/);
    await expect(page.getByRole('heading', { name: /Tout le parcours cookies/i })).toBeVisible();
  });

  test('?onglet=journal ouvre le panneau Journal au chargement', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/cookies?onglet=journal');
    const selectionne = page.getByRole('tab', { name: 'Journal' });
    await expect(selectionne).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: /Comment ça marche/i })).toHaveAttribute('aria-selected', 'false');
  });

  test('flèches droite / gauche naviguent entre onglets et déplacent le focus', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/cookies');
    const premier = page.getByRole('tab', { name: /Comment ça marche/i });
    await premier.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Réglages' })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'Réglages' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Journal' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(premier).toBeFocused();
  });

  test('vidéo, affiche et captures répondent 200', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/cookies');
    for (const chemin of [
      '/aide/cookies/parcours.mp4',
      '/aide/cookies/parcours-affiche.webp',
      '/aide/cookies/ordinateur-fenetre.webp',
      '/aide/cookies/ordinateur-fenetre.avif',
      '/aide/cookies/mobile-bandeau.webp',
      '/aide/cookies/ordinateur-aucun.webp',
      '/aide/cookies/mobile-preferences.webp',
    ]) {
      const reponse = await page.request.get(chemin);
      expect(reponse.status(), chemin).toBe(200);
    }
    // L'img visible rend bien (naturalWidth > 0)
    const naturel = await page
      .locator('figure img')
      .first()
      .evaluate((img) => (img as HTMLImageElement).naturalWidth);
    expect(naturel).toBeGreaterThan(0);
  });

  test('le sélecteur Fenêtre / Barre / Rien change la capture affichée', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/cookies');
    const image = page.locator('figure img').first();
    await expect(image).toHaveAttribute('src', /ordinateur-fenetre\.webp/);
    await page.getByRole('radio', { name: 'Barre', exact: true }).click();
    await expect(image).toHaveAttribute('src', /ordinateur-bandeau\.webp/);
    await page.getByRole('radio', { name: 'Rien', exact: true }).click();
    await expect(image).toHaveAttribute('src', /ordinateur-aucun\.webp/);
    await page.getByRole('radio', { name: 'Mobile', exact: true }).click();
    await expect(image).toHaveAttribute('src', /mobile-aucun\.webp/);
  });

  test('cliquer sur « Ouvrir cet onglet » dans la carte Réglages ouvre bien Réglages', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/cookies');
    // La 1re carte-raccourci est Réglages
    await page.getByRole('button', { name: /Réglages[\s\S]*Textes du bandeau/i }).click();
    await expect(page.getByRole('tab', { name: 'Réglages' })).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/\?onglet=reglages/);
  });

  test('aucune violation axe grave sur l’onglet Aide', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/cookies');
    await expect(page.getByRole('tablist', { name: /Onglets cookies/i })).toBeVisible({ timeout: 8000 });
    const { violations } = await new AxeBuilder({ page })
      .include('[role="tabpanel"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();
    const graves = violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact})`);
    expect(graves).toEqual([]);
  });
});
