// Drapeau de build VITE_INSCRIPTION_OUVERTE : ouverture publique de l'inscription.
//
// Faux par défaut. Tant que l'envoi des codes au public n'est pas prêt (le SMTP intégré de
// Supabase n'écrit qu'aux membres de l'équipe), l'accueil et /noter affichent « Inscriptions
// bientôt ouvertes » sans lien, et /inscription n'est atteignable que par son adresse (tests de
// l'équipe), hors des moteurs de recherche. Une session déjà ouverte reste affichée.
//
// La valeur est figée au build : pré-rendu et navigateur affichent la même chose.

/** Variables lues par le drapeau (sous-ensemble de import.meta.env). */
export type EnvInscription = { readonly VITE_INSCRIPTION_OUVERTE?: string };

/** Vrai seulement pour la chaîne exacte « true ». */
export function inscriptionOuverte(env: EnvInscription): boolean {
  return env.VITE_INSCRIPTION_OUVERTE === 'true';
}

export const INSCRIPTION_OUVERTE = inscriptionOuverte(import.meta.env);

/** Texte affiché à la place des liens d'inscription tant que le drapeau est faux. */
export const TEXTE_INSCRIPTIONS_FERMEES = 'Inscriptions bientôt ouvertes';
