import { useEffect, useState } from 'react';

/**
 * Heure courante, rafraîchie chaque minute.
 *
 * Premier rendu : l'instant de lecture des données (`reference`), le même au pré-rendu et à
 * l'hydratation, donc aucun écart d'hydratation. Juste après, l'heure réelle du visiteur.
 * Sans référence (page sans données), null jusqu'au premier effet.
 */
export function useMaintenant(reference: string): Date;
export function useMaintenant(reference: string | null): Date | null;
export function useMaintenant(reference: string | null): Date | null {
  const [maintenant, setMaintenant] = useState<Date | null>(() => (reference ? new Date(reference) : null));
  useEffect(() => {
    setMaintenant(new Date());
    const minuteur = setInterval(() => setMaintenant(new Date()), 60_000);
    return () => clearInterval(minuteur);
  }, []);
  return maintenant;
}
