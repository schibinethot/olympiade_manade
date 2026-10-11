// Données des pages vitrine qui portent le calendrier et le palmarès (accueil, Classements, Dates).
import type { AvecCalendrier } from './accueil';
import { lireCalendrier, lireOuRepli, lirePalmares, type Palmares } from './donnees';
import { dernieresDonnees, marquerDonneesRelues, marquerLectureTentee, retenirDonnees } from './relecture';

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
 * redéploiement. Chaque table que Supabase ne rend pas dans le délai est reprise, dans l'ordre, des
 * données du pré-rendu (fichier .data servi par le site), puis des dernières données affichées dans
 * l'onglet : hors ligne, la page garde ce qu'elle affiche. Si rien n'existe nulle part, null : la
 * page affiche son message de repli.
 *
 * La relecture n'est comptée comme faite que si les deux tables sont fraîches : sinon, la prochaine
 * interaction la retente.
 */
export async function lireDonneesVitrineNavigateur(serverLoader: () => Promise<DonneesVitrine>): Promise<DonneesVitrine> {
  marquerLectureTentee();
  const frais = await lireDonneesVitrine(AbortSignal.timeout(DELAI_LECTURE_NAVIGATEUR_MS));
  if (frais.calendrier && frais.palmares) {
    marquerDonneesRelues();
    retenirDonnees(frais);
    return frais;
  }
  const archive = await serverLoader().catch(() => null);
  const dernieres = dernieresDonnees();
  const donnees: DonneesVitrine = {
    calendrier: frais.calendrier ?? archive?.calendrier ?? dernieres.calendrier ?? null,
    palmares: frais.palmares ?? archive?.palmares ?? dernieres.palmares ?? null,
    lueLe: frais.lueLe,
  };
  retenirDonnees(donnees);
  return donnees;
}
