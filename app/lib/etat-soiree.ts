/**
 * État de la soirée pour le public :
 * - « hors-soiree » : aucune soirée en cours, les votes sont fermés (bouton de notation grisé) ;
 * - « ouvert » : une soirée est en cours et les votes sont ouverts.
 */
export type EtatSoiree = 'hors-soiree' | 'ouvert';

/** Lot vitrine : les votes ne sont jamais ouverts. Le lot 2 branchera l'état réel de la soirée. */
export const ETAT_SOIREE: EtatSoiree = 'hors-soiree';
