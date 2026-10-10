import { defineConfig } from 'vitest/config';

// Deux projets :
// - unit : logique pure du front (tests/unit), sans base de données ;
// - db : schéma, RLS et données (tests/db), avec recréation de la base Postgres locale.
// `pnpm test` lance les deux, `pnpm test:unit` et `pnpm test:db` un seul.
export default defineConfig({
  test: {
    projects: [
      {
        extends: false,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        extends: false,
        test: {
          name: 'db',
          include: ['tests/db/**/*.test.ts'],
          globalSetup: ['tests/db/preparation-globale.ts'],
          fileParallelism: false,
        },
      },
    ],
  },
});
