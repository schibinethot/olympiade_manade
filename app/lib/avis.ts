import type { SoireeNotation } from './notation';

/** Miroir d’affichage de prive.avis_ouvert. La base refuse quand même un avis trop tôt. */
export function avisOuvertClient(soiree: SoireeNotation, maintenant = Date.now()): boolean {
  if (soiree.statut !== 'publiee' && soiree.statut !== 'en_cours') return false;
  if (soiree.mode_vote === 'libre') return maintenant >= Date.parse(soiree.vote_fin);
  const passages = soiree.epreuves.filter((epreuve) => epreuve.notee).flatMap((epreuve) => epreuve.passages);
  return passages.length > 0 && passages.every((passage) => passage.statut_public === 'clos');
}
