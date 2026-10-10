import { useEffect } from 'react';
import { useRevalidator } from 'react-router';
import type { Calendrier, Palmares } from './donnees';

// Relecture différée des pages vitrine (accueil, Classements, Dates). Leurs données sont dans le
// pré-rendu : la page s'affiche et s'hydrate avec elles, sans charger supabase-js (environ 55 Ko
// gzip). Les données fraîches sont relues à la première interaction du visiteur (toucher, clic,
// clavier, défilement), une fois par visite. Une navigation dans le site les relit déjà
// (clientLoader) : la relecture n'a alors plus lieu d'être.
//
// Une relecture qui échoue (hors ligne, Supabase injoignable) n'est pas comptée comme faite : la
// prochaine interaction la retente. Et la page ne perd jamais ce qu'elle affiche : les dernières
// données affichées servent de repli (app/lib/donnees-vitrine.ts).

const INTERACTIONS = ['pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'] as const;

/** Tables affichées par les pages vitrine. */
export type DonneesAffichees = { calendrier: Calendrier[] | null; palmares: Palmares[] | null };

let relues = false;
const dernieres: DonneesAffichees = { calendrier: null, palmares: null };

/** Appelé quand le navigateur a lu les deux tables dans Supabase. */
export function marquerDonneesRelues(): void {
  relues = true;
}

/** Vrai une fois les données relues dans le navigateur (et non plus seulement celles du pré-rendu). */
export function donneesRelues(): boolean {
  return relues;
}

/**
 * Retient, table par table, les dernières données non nulles affichées dans l'onglet : celles du
 * pré-rendu à l'hydratation, puis chaque lecture du navigateur.
 */
export function retenirDonnees({ calendrier, palmares }: DonneesAffichees): void {
  if (calendrier) dernieres.calendrier = calendrier;
  if (palmares) dernieres.palmares = palmares;
}

/** Dernières données affichées : dernier repli d'une lecture qui échoue. */
export function dernieresDonnees(): Readonly<DonneesAffichees> {
  return dernieres;
}

export function useRelectureApresInteraction(donnees: DonneesAffichees): void {
  const { revalidate } = useRevalidator();
  const { calendrier, palmares } = donnees;

  useEffect(() => {
    retenirDonnees({ calendrier, palmares });
  }, [calendrier, palmares]);

  useEffect(() => {
    if (relues) return;
    let actif = true;
    // Phase de capture : un défilement dans une liste horizontale (épreuves) compte aussi.
    const options = { capture: true, passive: true } as const;
    const armer = () => {
      for (const type of INTERACTIONS) window.addEventListener(type, relire, options);
    };
    const retirer = () => {
      for (const type of INTERACTIONS) window.removeEventListener(type, relire, options);
    };
    // Relecture échouée : la prochaine interaction la retente, une seule relecture à la fois.
    const rearmer = () => {
      if (actif && !relues) armer();
    };
    function relire() {
      retirer();
      if (!relues) void revalidate().then(rearmer, rearmer);
    }
    armer();
    return () => {
      actif = false;
      retirer();
    };
  }, [revalidate]);
}
