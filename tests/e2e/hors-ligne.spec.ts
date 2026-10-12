import { expect, test, type Locator, type Page } from '../outils/test-e2e';
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

    // Pas de nouvel essai immédiat : un défilement continu ne relance pas la relecture en boucle.
    let nouvelEssai = false;
    const surRequete = (requete: { url: () => string }) => {
      if (estDonneesPreRendu(requete.url()) || /\/rest\/v1\//.test(requete.url())) nouvelEssai = true;
    };
    page.on('request', surRequete);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(1000);
    page.off('request', surRequete);
    expect(nouvelEssai).toBe(false);

    // Réseau revenu : passé le délai de nouvel essai, une interaction relit Supabase.
    await context.setOffline(false);
    let lue = false;
    const lecture = page.waitForRequest(/\/rest\/v1\/(calendrier|palmares)/);
    void lecture.then(() => {
      lue = true;
    });
    await expect(async () => {
      await page.mouse.wheel(0, 200);
      expect(lue).toBe(true);
    }).toPass({ intervals: [500], timeout: 10_000 });
    await relectureTerminee(page);
    await expect(contenu(page)).toBeVisible();
  });
}
