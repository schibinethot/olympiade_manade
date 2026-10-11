// Règles du formulaire de contact : copie exacte des contraintes de public.messages_contact
// (supabase/migrations/20261011090000_vitrine.sql), pour refuser côté navigateur tout ce que la
// base refuserait :
//   prenom  : length(prenom) <= 60 et length(btrim(prenom, E' \t\r\n')) >= 1
//   email   : length(email) <= 254 et email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
//   message : length(message) <= 2000 et length(btrim(message, E' \t\r\n')) >= 10
// length() de Postgres compte des caractères (points de code), pas des unités UTF-16.

export type ChampsContact = { prenom: string; email: string; message: string };
export type ErreursContact = Partial<Record<keyof ChampsContact, string>>;

export const LIMITES_CONTACT = { prenom: 60, email: 254, messageMin: 10, messageMax: 2000 } as const;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** btrim(texte, E' \t\r\n') */
function rogner(texte: string): string {
  return texte.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
}

/** length() de Postgres : nombre de points de code. */
export function longueur(texte: string): number {
  return Array.from(texte).length;
}

/** Valeurs envoyées à la base : rognées des blancs que la base ignore de toute façon. */
export function normaliserContact(champs: ChampsContact): ChampsContact {
  return { prenom: rogner(champs.prenom), email: rogner(champs.email), message: rogner(champs.message) };
}

export function validerContact(champs: ChampsContact): ErreursContact {
  const { prenom, email, message } = normaliserContact(champs);
  const erreurs: ErreursContact = {};

  if (longueur(prenom) === 0) erreurs.prenom = 'Indiquez votre prénom.';
  else if (longueur(prenom) > LIMITES_CONTACT.prenom) erreurs.prenom = 'Le prénom ne doit pas dépasser 60 caractères.';

  if (longueur(email) === 0) erreurs.email = 'Indiquez votre adresse email.';
  else if (longueur(email) > LIMITES_CONTACT.email) erreurs.email = 'L’adresse email ne doit pas dépasser 254 caractères.';
  else if (!EMAIL.test(email)) erreurs.email = 'Cette adresse email n’est pas valide.';

  if (longueur(message) < LIMITES_CONTACT.messageMin) erreurs.message = 'Le message doit contenir au moins 10 caractères.';
  else if (longueur(message) > LIMITES_CONTACT.messageMax) erreurs.message = 'Le message ne doit pas dépasser 2 000 caractères.';

  return erreurs;
}
