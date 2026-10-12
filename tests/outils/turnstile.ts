import type { Page } from '@playwright/test';

/**
 * Double local du script Cloudflare : aucun challenge ni appel externe ne quitte les E2E. Le
 * callback est différé comme celui du widget réel, afin que React ait fini de monter le conteneur.
 */
export async function simulerTurnstile(page: Page, jeton = 'jeton-turnstile'): Promise<void> {
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', async (route) => {
    await route.fulfill({
      contentType: 'text/javascript',
      body: `
        window.turnstile = {
          render(conteneur, options) {
            const widget = 'turnstile-test-' + Math.random().toString(36).slice(2);
            const champ = document.createElement('input');
            champ.type = 'hidden';
            champ.name = 'cf-turnstile-response';
            champ.value = ${JSON.stringify(jeton)};
            conteneur.appendChild(champ);
            queueMicrotask(() => options.callback(${JSON.stringify(jeton)}));
            return widget;
          },
          remove() {},
        };
      `,
    });
  });
}
