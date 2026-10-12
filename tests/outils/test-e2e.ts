import { test as base } from '@playwright/test';
import { simulerTurnstile } from './turnstile';

export * from '@playwright/test';

// Toute page de la vitrine peut contenir le contact : aucun test ne doit charger un vrai widget.
export const test = base.extend({
  page: async ({ page }, use) => {
    await simulerTurnstile(page);
    await use(page);
  },
});
