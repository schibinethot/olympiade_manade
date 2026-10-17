export type LigneOrdre = { id: string; ordre: number };

/** Nouvel ordre 1..n après un glisser-déposer. Tableau vide si le dépôt ne change rien. */
export function ordresApresGlisser(liste: LigneOrdre[], depuis: number, vers: number): LigneOrdre[] {
  if (depuis === vers || depuis < 0 || vers < 0 || depuis >= liste.length || vers >= liste.length) return [];
  const copie = liste.slice();
  const [deplace] = copie.splice(depuis, 1);
  if (!deplace) return [];
  copie.splice(vers, 0, deplace);
  return copie.map((ligne, index) => ({ id: ligne.id, ordre: index + 1 }));
}

/**
 * Étapes d’écriture : d’abord des ordres temporaires (contrainte d’unicité),
 * puis l’ordre définitif. Les notes et les statuts ne sont pas concernés.
 */
export function etapesReordre(liste: LigneOrdre[], depuis: number, vers: number): LigneOrdre[] {
  const finaux = ordresApresGlisser(liste, depuis, vers);
  if (!finaux.length) return [];
  const temporaires = finaux.map((ligne, index) => ({ id: ligne.id, ordre: 30_000 + index }));
  return [...temporaires, ...finaux];
}
