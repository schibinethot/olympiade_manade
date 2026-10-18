import { defineConfig } from 'vitest/config';

// Banc PostgREST réel (revue QA) : `pnpm test:postgrest`, à part de `pnpm test` car il exige le binaire
// postgrest (brew install postgrest) en plus du Postgres local des tests db. Il échoue si le binaire manque.
export default defineConfig({
  test: {
    name: 'postgrest',
    include: ['tests/postgrest/**/*.test.ts'],
    globalSetup: ['tests/postgrest/preparation.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
