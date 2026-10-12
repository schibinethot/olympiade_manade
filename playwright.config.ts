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
  // VITE_INSCRIPTION_OUVERTE est figé à faux pour le build des tests : c'est la valeur par défaut du
  // déploiement, et une valeur posée dans .env.local ne doit pas changer ce qui est testé (une
  // variable déjà présente dans l'environnement l'emporte sur les fichiers .env de Vite).
  webServer: {
    command: 'pnpm build && pnpm start',
    // Le script Turnstile est toujours intercepté localement par tests/outils/turnstile.ts. Les
    // secrets vides garantissent que le vrai endpoint /api/contact reste fermé durant les E2E.
    env: {
      PORT: String(PORT), VITE_INSCRIPTION_OUVERTE: 'false', FILE_NOTES_ACTIVE: 'false',
      VITE_TURNSTILE_SITE_KEY: 'test-site-key', TURNSTILE_SECRET_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '',
    },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
