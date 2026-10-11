import type { Page } from '@playwright/test';

// Fin d'une relecture des données (revalidation de React Router), lue dans l'état du routeur que
// React Router expose dans `window` (__reactRouterDataRouter). Deux images sont ensuite attendues :
// React a alors appliqué les données rendues par le clientLoader.

type FenetreRouteur = { __reactRouterDataRouter?: { state: { revalidation: string } } };

export async function relectureTerminee(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as FenetreRouteur).__reactRouterDataRouter?.state.revalidation === 'idle');
  await page.evaluate(() => new Promise((fin) => requestAnimationFrame(() => requestAnimationFrame(fin))));
}

/** Vrai pour une requête du fichier de données d'une page pré-rendue (/dates.data, /_root.data…). */
export const estDonneesPreRendu = (url: string): boolean => /\.data$/.test(new URL(url).pathname);
