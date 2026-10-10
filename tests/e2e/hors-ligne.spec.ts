import { expect, test, type Locator, type Page } from '@playwright/test';
import { estDonneesPreRendu, relectureTerminee } from '../outils/relecture';

// Hors ligne, la relecture déclenchée par la première interaction échoue (Supabase et fichier .data
// du pré-rendu injoignables) : la page garde les données déjà affichées, et la relecture est
// retentée à l'interaction suivante, une fois le réseau revenu.

test.beforeEach(async ({ page }) => {
  await page.route('**/auth/v1/**', (route) => route.abort());
});

const PAGES: { chemin: string; contenu: (page: Page) => Locator }[] = [
  { chemin: '/', contenu: (page) => page.getByRole('heading', { name: /Dernier vainqueur connu\s+Manade\s+Arlatenco/ }) },
  { chemin: '/dates', contenu: (page) => page.locator('#archives-2026').getByRole('article').filter({ hasText: 'Arlatenco' }) },
  { chemin: '/classements', contenu: (page) => page.getByRole('article').filter({ hasText: 'Arlatenco' }).first() },
];

for (const { chemin, contenu } of PAGES) {
  test(`${chemin} : hors ligne, la relecture garde les données affichées, puis réessaie en ligne`, async ({ page, context }) => {
    await page.goto(chemin, { waitUntil: 'networkidle' });
    await expect(contenu(page)).toBeVisible();

    await context.setOffline(true);
    const archiveEchouee = page.waitForEvent('requestfailed', (requete) => estDonneesPreRendu(requete.url()));
    await page.mouse.wheel(0, 400);
    await archiveEchouee;
    await relectureTerminee(page);
    await expect(contenu(page)).toBeVisible();
    await expect(page.getByText(/momentanément indisponibles/)).toHaveCount(0);

    // Réseau revenu : l'interaction suivante relit Supabase.
    await context.setOffline(false);
    const lecture = page.waitForRequest(/\/rest\/v1\/(calendrier|palmares)/);
    await page.mouse.wheel(0, 200);
    await lecture;
    await relectureTerminee(page);
    await expect(contenu(page)).toBeVisible();
  });
}
