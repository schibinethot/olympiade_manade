import { useEffect } from 'react';
import { useRevalidator } from 'react-router';

// Relecture différée des pages vitrine (accueil, Classements, Dates). Leurs données sont dans le
// pré-rendu : la page s'affiche et s'hydrate avec elles, sans charger supabase-js (environ 55 Ko
// gzip). Les données fraîches sont relues à la première interaction du visiteur (toucher, clic,
// clavier, défilement), une fois par visite. Une navigation dans le site les relit déjà
// (clientLoader) : la relecture n'a alors plus lieu d'être.

const INTERACTIONS = ['pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'] as const;

let relues = false;

/** Appelé à la fin de la lecture du navigateur : les données de Supabase ont été lues. */
export function marquerDonneesRelues(): void {
  relues = true;
}

/** Vrai une fois les données relues dans le navigateur (et non plus seulement celles du pré-rendu). */
export function donneesRelues(): boolean {
  return relues;
}

export function useRelectureApresInteraction(): void {
  const { revalidate } = useRevalidator();
  useEffect(() => {
    if (relues) return;
    // Phase de capture : un défilement dans une liste horizontale (épreuves) compte aussi.
    const options = { capture: true, passive: true } as const;
    const retirer = () => {
      for (const type of INTERACTIONS) window.removeEventListener(type, relire, options);
    };
    function relire() {
      retirer();
      if (!relues) void revalidate();
    }
    for (const type of INTERACTIONS) window.addEventListener(type, relire, options);
    return retirer;
  }, [revalidate]);
}
