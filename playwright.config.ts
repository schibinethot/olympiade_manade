import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'ordinateur', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  // Les tests tournent sur le build pré-rendu, servi par le vrai serveur de production
  // (serveur/statique.mjs : pages pré-rendues, repli monopage, 404, en-têtes de sécurité).
  // Sans réutilisation d'un serveur existant, Playwright refuse de démarrer si le port est
  // déjà occupé.
  webServer: {
    command: 'pnpm build && pnpm start',
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
