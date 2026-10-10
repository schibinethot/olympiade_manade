import { useSyncExternalStore } from 'react';

const sAbonner = () => () => {};

/**
 * false au pré-rendu et pendant l'hydratation, true ensuite (et dès le premier rendu lors d'une
 * navigation côté client). Pour lire l'adresse sans écart d'hydratation : la page pré-rendue ne
 * connaît pas les paramètres (`?annee=2025`), le premier rendu du navigateur doit donc l'ignorer.
 */
export function useHydrate(): boolean {
  return useSyncExternalStore(
    sAbonner,
    () => true,
    () => false,
  );
}
