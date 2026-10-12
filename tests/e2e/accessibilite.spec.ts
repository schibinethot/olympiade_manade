import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '../outils/test-e2e';

// Contrôle axe des 9 pages du lot Vitrine (Task 8) : aucune violation « serious » ni « critical »,
// sur mobile et sur ordinateur (les deux projets de playwright.config.ts).

const PAGES = [
  '/',
  '/classements',
  '/dates',
  '/contact',
  '/mentions-legales',
  '/confidentialite',
  '/noter',
  '/inscription',
  '/inscription/code',
] as const;

const NORMES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

test.beforeEach(async ({ page }) => {
  // Garde : aucun appel Auth réel ne part de ces tests.
  await page.route('**/auth/v1/**', (route) => route.abort());
  // Demande de code en cours : /inscription/code affiche alors sa saisie, la version la plus riche.
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'olympiade-inscription',
      JSON.stringify({ prenom: 'Léa', email: 'lea@exemple.fr', envoyeeLe: Date.now() }),
    ),
  );
});

for (const chemin of PAGES) {
  test(`axe : aucune violation grave ni critique sur ${chemin}`, async ({ page }) => {
    await page.goto(chemin, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(NORMES).analyze();
    const graves = violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
    expect(graves).toEqual([]);
  });
}
