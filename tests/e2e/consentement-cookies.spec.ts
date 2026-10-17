/**
 * Tests e2e du module de consentement cookies.
 *
 * Contexte délibérément vierge (pas de cc_cookie pré-positionné) pour tester
 * l'affichage et le comportement du bandeau. Ce spec utilise @playwright/test
 * directement et non le fixture test-e2e.ts (qui pré-consent les autres tests).
 *
 * Les appels à /api/cookie-consent/* sont interceptés avec page.route()
 * car l'API back n'existe pas encore dans ce worktree.
 */

import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { simulerTurnstile } from '../outils/turnstile';

// ---------------------------------------------------------------------------
// Paramètres de l'API simulée
// ---------------------------------------------------------------------------

const REPONSE_SETTINGS = {
  titre: "Confidentialité",
  description: "Nous mesurons l’audience du site pour améliorer nos pages. Aucun cookie de publicité n’est déposé sans votre accord.",
  texteToutAccepter: "Tout accepter",
  texteRefuser: "Tout refuser",
  textePersonnaliser: "Personnaliser",
  texteEnregistrer: "Enregistrer mes choix",
  urlConfidentialite: "/confidentialite",
  mesureActive: true,
  mesureTitre: "Mesure d’audience",
  mesureDescription: "Ces cookies nous permettent de mesurer l’audience du site.",
  publiciteActive: true,
  publiciteTitre: "Publicité et réseaux sociaux",
  publiciteDescription: "Ces cookies servent à vous proposer des publicités pertinentes.",
  dureeConsentementJours: 365,
};

/** Intercepte les appels API cookies et Turnstile avant chaque test. */
async function intercepterApiCookies(page: Page) {
  await simulerTurnstile(page);
  await page.route('**/api/cookie-consent/settings', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(REPONSE_SETTINGS) }),
  );
  await page.route('**/api/cookie-consent/log', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
  );
  // Éviter les appels d'auth réels
  await page.route('**/auth/v1/**', (route) => route.abort());
}

// ---------------------------------------------------------------------------
// Fenêtre bloquante sur /
// ---------------------------------------------------------------------------

test.describe('fenêtre bloquante sur /', () => {
  test('affiche la fenêtre avec les 3 boutons attendus', async ({ page }) => {
    await intercepterApiCookies(page);
    await page.goto('/');

    // La fenêtre doit être visible
    const modal = page.locator('#cc-main .cm');
    await expect(modal).toBeVisible({ timeout: 8000 });

    // 3 boutons : Personnaliser, Tout refuser, Tout accepter
    await expect(page.locator('#cc-main .cm__btn[data-role="show"]')).toBeVisible();
    await expect(page.locator('#cc-main .cm__btn[data-role="necessary"]')).toBeVisible();
    await expect(page.locator('#cc-main .cm__btn[data-role="all"]')).toBeVisible();
  });

  test('la fenêtre bloque l’interaction avec la page (classe show--consent)', async ({ page }) => {
    await intercepterApiCookies(page);
    await page.goto('/');
    await expect(page.locator('#cc-main .cm')).toBeVisible({ timeout: 8000 });
    // vanilla-cookieconsent ajoute show--consent sur html quand disablePageInteraction=true
    await expect(page.locator('html')).toHaveClass(/show--consent/, { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Barre non bloquante sur /noter
// ---------------------------------------------------------------------------

test.describe('barre non bloquante sur /noter', () => {
  test('affiche la barre et la page reste cliquable (pas de show--consent)', async ({ page }) => {
    await intercepterApiCookies(page);
    await page.goto('/noter');

    // La barre doit être visible
    const modal = page.locator('#cc-main .cm');
    await expect(modal).toBeVisible({ timeout: 8000 });

    // La page ne doit pas être bloquée (show--consent = modal visible, pas interdit ;
    // disable--interaction = page réellement bloquée — seul bandeau n'a pas ça)
    const htmlEl = page.locator('html');
    await expect(htmlEl).not.toHaveClass(/disable--interaction/);
  });
});

// ---------------------------------------------------------------------------
// Aucun bandeau sur /ecran/:slug
// ---------------------------------------------------------------------------

test.describe('mode aucun sur /ecran/*', () => {
  test('aucun bandeau sur /ecran/test-slug', async ({ page }) => {
    await intercepterApiCookies(page);
    await page.goto('/ecran/test-slug');

    // Le composant cookie doit être inerte
    const modal = page.locator('#cc-main .cm');
    // Attendre que la page soit chargée, puis vérifier l'absence du modal
    await page.waitForLoadState('networkidle');
    await expect(modal).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Flux "Tout accepter"
// ---------------------------------------------------------------------------

test.describe('flux Tout accepter', () => {
  test('clic sur Tout accepter envoie POST /api/cookie-consent/log avec le bon corps', async ({ page }) => {
    await intercepterApiCookies(page);

    // Intercepter le POST pour vérifier le corps
    let corpsLog: Record<string, unknown> | null = null;
    await page.route('**/api/cookie-consent/log', async (route) => {
      const corps = route.request().postDataJSON() as Record<string, unknown>;
      corpsLog = corps;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/');
    const boutonAccepter = page.locator('#cc-main .cm__btn[data-role="all"]');
    await expect(boutonAccepter).toBeVisible({ timeout: 8000 });
    await boutonAccepter.click();

    // Attendre que le cookie soit posé
    await page.waitForFunction(() => document.cookie.includes('cc_cookie'), { timeout: 5000 });

    // Vérifier le corps du POST
    // TS7 narrowe le let à never dans une closure async — double cast pour contourner
    if (!corpsLog) throw new Error('POST /api/cookie-consent/log non intercepté');
    const log = (corpsLog as unknown) as Record<string, unknown>;
    expect(log.action).toBe('accept_all');
    expect(log.consentementDonne).toBe(true);
    expect(log.mesureAcceptee).toBe(true);
    expect(log.publiciteAcceptee).toBe(true);
    const visiteurId = log.visiteurId as string;
    expect(typeof visiteurId).toBe('string');
    expect(visiteurId.startsWith('v_')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Flux Personnaliser puis Tout refuser
// ---------------------------------------------------------------------------

test.describe('flux Personnaliser puis Tout refuser', () => {
  test('ouvre les préférences et enregistre le refus complet', async ({ page }) => {
    await intercepterApiCookies(page);

    let corpsLog: Record<string, unknown> | null = null;
    await page.route('**/api/cookie-consent/log', async (route) => {
      corpsLog = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/');
    const boutonPersonnaliser = page.locator('#cc-main .cm__btn[data-role="show"]');
    await expect(boutonPersonnaliser).toBeVisible({ timeout: 8000 });
    await boutonPersonnaliser.click();

    // Le panneau préférences doit s'ouvrir
    const prefsModal = page.locator('#cc-main .pm');
    await expect(prefsModal).toBeVisible({ timeout: 5000 });

    // Clic sur Tout refuser dans les préférences
    const boutonRefuser = page.locator('#cc-main .pm__btn[data-role="necessary"]');
    await expect(boutonRefuser).toBeVisible();
    await boutonRefuser.click();

    // Vérifier que le consentement est enregistré comme reject_all
    await page.waitForFunction(() => document.cookie.includes('cc_cookie'), { timeout: 5000 });
    if (!corpsLog) throw new Error('POST /api/cookie-consent/log non intercepté');
    const log = (corpsLog as unknown) as Record<string, unknown>;
    expect(log.action).toBe('reject_all');
    expect(log.consentementDonne).toBe(false);
    expect(log.mesureAcceptee).toBe(false);
    expect(log.publiciteAcceptee).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Persistance du choix au rechargement
// ---------------------------------------------------------------------------

test.describe('persistance du choix', () => {
  test('le choix est conservé au rechargement', async ({ page }) => {
    await intercepterApiCookies(page);

    await page.goto('/');
    const boutonAccepter = page.locator('#cc-main .cm__btn[data-role="all"]');
    await expect(boutonAccepter).toBeVisible({ timeout: 8000 });
    await boutonAccepter.click();

    // Attendre la disparition du modal
    await expect(page.locator('#cc-main .cm')).not.toBeVisible({ timeout: 5000 });

    // Recharger la page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Le modal ne doit pas réapparaître
    await expect(page.locator('#cc-main .cm')).not.toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Bouton "Gérer les cookies" dans le pied de page
// ---------------------------------------------------------------------------

test.describe('bouton Gérer les cookies', () => {
  test('rouvre les préférences depuis le pied de page', async ({ page }) => {
    await intercepterApiCookies(page);

    await page.goto('/');

    // D'abord accepter pour fermer le modal initial
    const boutonAccepter = page.locator('#cc-main .cm__btn[data-role="all"]');
    await expect(boutonAccepter).toBeVisible({ timeout: 8000 });
    await boutonAccepter.click();
    await expect(page.locator('#cc-main .cm')).not.toBeVisible({ timeout: 5000 });

    // Cliquer sur "Gérer les cookies" dans le pied de page
    const boutonGerer = page.getByRole('button', { name: 'Gérer les cookies' });
    await boutonGerer.scrollIntoViewIfNeeded();
    await boutonGerer.click();

    // Le panneau préférences doit s'ouvrir
    await expect(page.locator('#cc-main .pm')).toBeVisible({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Accessibilité (axe)
// ---------------------------------------------------------------------------

test.describe('accessibilité axe', () => {
  const NORMES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

  test('aucune violation grave sur la fenêtre de consentement (/)', async ({ page }) => {
    await intercepterApiCookies(page);
    await page.goto('/');
    await expect(page.locator('#cc-main .cm')).toBeVisible({ timeout: 8000 });

    const { violations } = await new AxeBuilder({ page })
      .include('#cc-main')
      .withTags(NORMES)
      .analyze();

    const graves = violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact})`);
    expect(graves).toEqual([]);
  });

  test('aucune violation grave sur le panneau préférences', async ({ page }) => {
    await intercepterApiCookies(page);
    await page.goto('/');

    const boutonPersonnaliser = page.locator('#cc-main .cm__btn[data-role="show"]');
    await expect(boutonPersonnaliser).toBeVisible({ timeout: 8000 });
    await boutonPersonnaliser.click();
    await expect(page.locator('#cc-main .pm')).toBeVisible({ timeout: 5000 });

    const { violations } = await new AxeBuilder({ page })
      .include('#cc-main')
      .withTags(NORMES)
      .analyze();

    const graves = violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact})`);
    expect(graves).toEqual([]);
  });
});
