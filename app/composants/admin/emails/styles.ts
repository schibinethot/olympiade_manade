/** Classes partagées par les vues de l'admin des e-mails. */

/** Bandeau d'avertissement (mode d'envoi, soirée suspendue, confirmations). */
export const ALERTE = 'rounded-[18px] border border-alerte bg-ambre/15 px-4 py-3';

/** Cible tactile d'au moins 44 px (règle maison), texte d'au moins 14 px. */
export const CIBLE = 'min-h-11 text-sm';

/**
 * Apparence désactivée d'un bouton marqué aria-disabled : contrairement à disabled, il garde le focus
 * pendant l'action (le gestionnaire ignore alors les clics).
 */
export const INACTIF = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50';
