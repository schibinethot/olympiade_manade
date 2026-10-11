import { useEffect } from 'react';
import { useRevalidator } from 'react-router';
import type { Calendrier, Palmares } from './donnees';

// Relecture différée des pages vitrine (accueil, Classements, Dates). Leurs données sont dans le
// pré-rendu : la page s'affiche et s'hydrate avec elles, sans charger supabase-js (environ 55 Ko
// gzip). Les données fraîches sont relues à la première interaction du visiteur (toucher, clic,
// clavier, molette), une fois par visite si elle réussit. Une navigation dans le site les relit déjà
// (clientLoader) : la relecture n'a alors plus lieu d'être.
//
// L'événement « scroll » n'en fait pas partie : la restauration du défilement au rechargement
// l'émet sans action du visiteur. Un pré-rendu incomplet (build sans Supabase) est relu dès
// l'hydratation, sans attendre d'interaction.
//
// Une relecture qui échoue (hors ligne, Supabase injoignable) n'est pas comptée comme faite : une
// interaction la retente, au plus tôt DELAI_NOUVEL_ESSAI plus tard, pour qu'un défilement continu
// ne relance pas la relecture en boucle. Et la page ne perd jamais ce qu'elle affiche : les
// dernières données affichées servent de repli (app/lib/donnees-vitrine.ts).

const INTERACTIONS = ['pointerdown', 'touchstart', 'keydown', 'wheel'] as const;
const DELAI_NOUVEL_ESSAI = 5000;

/** Tables affichées par les pages vitrine. */
export type DonneesAffichees = { calendrier: Calendrier[] | null; palmares: Palmares[] | null };

let relues = false;
let tentee = false;
const dernieres: DonneesAffichees = { calendrier: null, palmares: null };

/** Appelé quand le navigateur a lu les deux tables dans Supabase. */
export function marquerDonneesRelues(): void {
  relues = true;
}

/** Vrai une fois les données relues dans le navigateur (et non plus seulement celles du pré-rendu). */
export function donneesRelues(): boolean {
  return relues;
}

/** Appelé au début de chaque lecture du navigateur (relecture ou navigation), réussie ou non. */
export function marquerLectureTentee(): void {
  tentee = true;
}

/**
 * Vrai si les données affichées sont celles du pré-rendu (aucune lecture du navigateur encore
 * tentée) et qu'il leur manque une table : elles sont relues dès l'hydratation.
 */
export function relireDesLHydratation({ calendrier, palmares }: DonneesAffichees): boolean {
  return !relues && !tentee && (calendrier === null || palmares === null);
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
  const immediate = relireDesLHydratation(donnees);

  useEffect(() => {
    retenirDonnees({ calendrier, palmares });
  }, [calendrier, palmares]);

  useEffect(() => {
    if (relues) return;
    let actif = true;
    // Phase de capture : une molette ou un toucher dans une liste horizontale (épreuves) comptent aussi.
    const options = { capture: true, passive: true } as const;
    const armer = () => {
      for (const type of INTERACTIONS) window.addEventListener(type, relire, options);
    };
    const retirer = () => {
      for (const type of INTERACTIONS) window.removeEventListener(type, relire, options);
    };
    // Relecture échouée : une interaction la retente après le délai, une seule relecture à la fois.
    let nouvelEssai: ReturnType<typeof setTimeout> | undefined;
    const rearmer = () => {
      if (!actif || relues) return;
      nouvelEssai = setTimeout(() => {
        if (actif && !relues) armer();
      }, DELAI_NOUVEL_ESSAI);
    };
    function relire() {
      retirer();
      if (!relues) void revalidate().then(rearmer, rearmer);
    }
    if (immediate) relire();
    else armer();
    return () => {
      actif = false;
      clearTimeout(nouvelEssai);
      retirer();
    };
  }, [revalidate, immediate]);
}
