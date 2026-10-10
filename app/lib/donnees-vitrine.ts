// Données des pages vitrine qui portent le calendrier et le palmarès (accueil, Classements, Dates).
import type { AvecCalendrier } from './accueil';
import { lireCalendrier, lireOuRepli, lirePalmares, type Palmares } from './donnees';
import { marquerDonneesRelues } from './relecture';

export type DonneesVitrine = AvecCalendrier & { palmares: Palmares[] | null };

/**
 * Attente maximale de Supabase dans le navigateur. Au-delà, la page prend les données du pré-rendu :
 * sans cette borne, les nouveaux essais de postgrest-js figeaient la navigation environ 7 s.
 */
export const DELAI_LECTURE_NAVIGATEUR_MS = 3000;

/** Lecture qui ne lève jamais : null pour une table illisible, et l'instant de lecture. */
export async function lireDonneesVitrine(signal?: AbortSignal): Promise<DonneesVitrine> {
  const [calendrier, palmares] = await Promise.all([
    lireOuRepli(() => lireCalendrier(signal)),
    lireOuRepli(() => lirePalmares(signal)),
  ]);
  return { calendrier, palmares, lueLe: new Date().toISOString() };
}

/**
 * Lecture dans le navigateur (à la première interaction, app/lib/relecture.ts, puis à chaque
 * navigation vers la page) : données fraîches, pour qu'un palmarès complété apparaisse sans
 * redéploiement. Une table que Supabase ne rend pas dans le délai est reprise des données du
 * pré-rendu (fichier .data servi par le site).
 * Si elles manquent aussi, null : la page affiche son message de repli.
 */
export async function lireDonneesVitrineNavigateur(serverLoader: () => Promise<DonneesVitrine>): Promise<DonneesVitrine> {
  const frais = await lireDonneesVitrine(AbortSignal.timeout(DELAI_LECTURE_NAVIGATEUR_MS));
  marquerDonneesRelues();
  if (frais.calendrier && frais.palmares) return frais;
  const archive = await serverLoader().catch(() => null);
  return {
    calendrier: frais.calendrier ?? archive?.calendrier ?? null,
    palmares: frais.palmares ?? archive?.palmares ?? null,
    lueLe: frais.lueLe,
  };
}
