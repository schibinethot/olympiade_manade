import type { EtatDate } from '../lib/calendrier';
import type { Calendrier } from '../lib/donnees';

/** Pastille d'état de la maquette (.chip). */
export const CLASSE_PUCE =
  'inline-flex items-center rounded-full px-2.5 py-1.5 text-[10px] leading-none font-bold tracking-[0.12em] whitespace-nowrap uppercase';

/** Couleurs d'état de la charte (ok, alerte), assombries pour tenir 4,5:1 sur leur fond teinté. */
export const PUCE_OK = `${CLASSE_PUCE} bg-[rgba(47,122,79,.12)] text-[#286b44]`;
export const PUCE_ALERTE = `${CLASSE_PUCE} bg-[rgba(217,130,43,.14)] text-[#985512]`;

/**
 * Badge d'une soirée : « Terminée », « Annulée », « Ce soir », sinon le statut de la date.
 * #286b44 sur vert pâle 5,3:1, #985512 sur orangé pâle 4,87:1.
 */
export function BadgeSoiree({ soiree, etat }: { soiree: Pick<Calendrier, 'statut'>; etat: EtatDate }) {
  if (etat === 'terminee') return <span className={`${CLASSE_PUCE} bg-lin text-encre-2`}>Terminée</span>;
  if (etat === 'annulee') return <span className={`${CLASSE_PUCE} bg-[rgba(194,59,29,.1)] text-rouge`}>Annulée</span>;
  if (etat === 'ce-soir') return <span className={`${CLASSE_PUCE} bg-[#fffaf2] text-[#9a2c12]`}>Ce soir</span>;
  return soiree.statut === 'confirmee' ? (
    <span className={PUCE_OK}>Confirmée</span>
  ) : (
    <span className={PUCE_ALERTE}>Date prévisionnelle</span>
  );
}
