import { test as base } from '@playwright/test';
import { simulerTurnstile } from './turnstile';

export * from '@playwright/test';

/**
 * Cookie cc_cookie valide pour vanilla-cookieconsent 3.x.
 * Pré-positionner ce cookie dans le contexte du navigateur empêche le bandeau
 * de consentement de s'afficher pendant les tests existants (qui testent d'autres
 * fonctionnalités). Les tests dans consentement-cookies.spec.ts utilisent
 * @playwright/test directement pour démarrer avec un contexte vierge.
 */
const CC_COOKIE_VALIDE = JSON.stringify({
  categories: ['necessary'],
  revision: 0,
  data: null,
  consentId: 'fixture_test_consent',
  consentTimestamp: '2026-01-01T00:00:00.000Z',
  lastConsentTimestamp: '2026-01-01T00:00:00.000Z',
  expirationTime: 9999999999999,
});

// Toute page de la vitrine peut contenir le contact : aucun test ne doit charger un vrai widget.
export const test = base.extend({
  page: async ({ page }, use) => {
    await simulerTurnstile(page);

    // Pré-positionner le consentement cookies pour que le bandeau ne bloque pas les tests.
    // Le cookie est ajouté au contexte avant la première navigation.
    await page.context().addCookies([
      {
        name: 'cc_cookie',
        value: encodeURIComponent(CC_COOKIE_VALIDE),
        domain: 'localhost',
        path: '/',
        expires: 9999999999,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    await use(page);
  },
});
