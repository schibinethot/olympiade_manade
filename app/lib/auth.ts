// Inscription et connexion du public par code à 6 chiffres reçu par email (Supabase Auth, OTP).
//
// Les appels partent du navigateur (pas de serveur) :
// - signInWithOtp crée le compte au besoin. Supabase envoie l'email « confirmation » à un nouvel
//   inscrit et l'email « lien magique » à un compte existant ; les deux portent le code
//   ({{ .Token }}) et un lien de secours ({{ .ConfirmationURL }}).
// - verifyOtp avec le type « email » valide le code dans les deux cas (les types « signup » et
//   « magiclink » sont dépréciés dans supabase-js).
//
// Les fonctions pures (normalisation, validation, traduction des erreurs) n'ouvrent pas le client :
// il n'est chargé et créé qu'au premier appel de supabase(), les tests unitaires s'en passent.
import { longueur } from './contact';
import { supabase } from './supabase';

export type EtapeAuth = 'demande' | 'verification';

export const MESSAGES_AUTH = {
  codeRefuse: 'Code incorrect ou expiré. Vérifiez vos emails ou demandez un nouveau code.',
  tropDeDemandes: 'Trop de demandes de code. Réessayez dans quelques minutes.',
  reseau: 'Connexion impossible. Vérifiez votre réseau et réessayez.',
  emailInvalide: 'Cette adresse email n’est pas valide.',
  inscriptionsFermees: 'Les inscriptions sont momentanément fermées. Réessayez plus tard.',
  envoiRefuse: 'Le code n’a pas pu être envoyé à cette adresse. Réessayez plus tard.',
  inconnue: 'Une erreur est survenue. Réessayez dans un instant.',
} as const;

/** Erreur d'inscription ou de connexion, au message français prêt à afficher. */
export class ErreurAuth extends Error {
  readonly code: string | undefined;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ErreurAuth';
    this.code = code;
  }
}

/** Les 6 chiffres d'une saisie ou d'un collage (« 123 456 », « Votre code : 123456 »), sinon null. */
export function normaliserCode(saisie: string): string | null {
  const chiffres = saisie.replace(/[^0-9]/g, '');
  return chiffres.length === 6 ? chiffres : null;
}

/** Adresse sans espaces (une adresse n'en contient jamais), en minuscules. */
export function normaliserEmail(saisie: string): string {
  return saisie.replace(/\s+/g, '').toLowerCase();
}

// Mêmes bornes que la base : profils.prenom fait 1 à 60 caractères une fois rogné ; l'adresse suit
// la règle du formulaire de contact.
const PRENOM_MAX = 60;
const EMAIL_MAX = 254;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type ChampsInscription = { prenom: string; email: string; consentement: boolean };
export type ErreursInscription = Partial<Record<keyof ChampsInscription, string>>;

export function validerInscription({ prenom, email, consentement }: ChampsInscription): ErreursInscription {
  const erreurs: ErreursInscription = {};
  const nom = prenom.trim();
  const adresse = normaliserEmail(email);

  if (longueur(nom) === 0) erreurs.prenom = 'Indiquez votre prénom.';
  else if (longueur(nom) > PRENOM_MAX) erreurs.prenom = 'Le prénom ne doit pas dépasser 60 caractères.';

  if (adresse.length === 0) erreurs.email = 'Indiquez votre adresse email.';
  else if (longueur(adresse) > EMAIL_MAX) erreurs.email = 'L’adresse email ne doit pas dépasser 254 caractères.';
  else if (!EMAIL.test(adresse)) erreurs.email = MESSAGES_AUTH.emailInvalide;

  if (!consentement) {
    erreurs.consentement = 'Vous devez accepter la politique de confidentialité pour recevoir un code.';
  }
  return erreurs;
}

const CODES_TROP_DE_DEMANDES = new Set(['over_email_send_rate_limit', 'over_request_rate_limit']);
const CODES_FERMETURE = new Set(['signup_disabled', 'otp_disabled', 'email_provider_disabled']);

/**
 * Message français d'une erreur de supabase-js (AuthApiError, AuthRetryableFetchError) ou du
 * navigateur. Le texte anglais de Supabase n'est jamais affiché.
 */
export function traduireErreurAuth(erreur: unknown, etape: EtapeAuth): string {
  if (erreur instanceof ErreurAuth) return erreur.message;
  if (erreur instanceof TypeError) return MESSAGES_AUTH.reseau;
  if (typeof erreur !== 'object' || erreur === null) return MESSAGES_AUTH.inconnue;

  const { name, code, status } = erreur as { name?: unknown; code?: unknown; status?: unknown };
  const statut = typeof status === 'number' ? status : undefined;
  const codeErreur = typeof code === 'string' ? code : undefined;

  // supabase-js : requête qui n'a pas abouti (réseau, CORS, abandon), statut 0.
  if (name === 'AuthRetryableFetchError' && !statut) return MESSAGES_AUTH.reseau;
  if ((codeErreur && CODES_TROP_DE_DEMANDES.has(codeErreur)) || statut === 429) return MESSAGES_AUTH.tropDeDemandes;
  // Code faux ou expiré : Supabase répond 403 otp_expired (« Token has expired or is invalid »).
  if (etape === 'verification' && statut !== undefined && statut >= 400 && statut < 500) return MESSAGES_AUTH.codeRefuse;
  if (codeErreur === 'email_address_invalid' || codeErreur === 'validation_failed') return MESSAGES_AUTH.emailInvalide;
  if (codeErreur && CODES_FERMETURE.has(codeErreur)) return MESSAGES_AUTH.inscriptionsFermees;
  // SMTP intégré de Supabase : il refuse toute adresse hors de l'équipe du projet.
  if (codeErreur === 'email_address_not_authorized') return MESSAGES_AUTH.envoiRefuse;
  return MESSAGES_AUTH.inconnue;
}

function enErreurAuth(erreur: unknown, etape: EtapeAuth): ErreurAuth {
  const code = typeof erreur === 'object' && erreur !== null && 'code' in erreur ? erreur.code : undefined;
  return new ErreurAuth(traduireErreurAuth(erreur, etape), typeof code === 'string' ? code : undefined);
}

/**
 * Envoie un code à 6 chiffres. Même réponse que l'adresse soit nouvelle ou déjà inscrite : rien ne
 * révèle qu'un compte existe. Pour un compte existant, Supabase ignore `data` (le prénom ne change pas).
 * Le lien de secours de l'email ramène sur /inscription/code (adresse autorisée dans la
 * configuration Auth, additional_redirect_urls).
 */
export async function demanderCode(prenom: string, email: string): Promise<void> {
  try {
    const { error } = await (await supabase()).auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: { prenom, consentement: true },
        emailRedirectTo: typeof window === 'undefined' ? undefined : `${window.location.origin}/inscription/code`,
      },
    });
    if (error) throw error;
  } catch (erreur) {
    throw enErreurAuth(erreur, 'demande');
  }
}

/** Valide le code : la session est alors enregistrée dans le navigateur (clé « olympiade-auth »). */
export async function verifierCode(email: string, code: string): Promise<void> {
  try {
    const { data, error } = await (await supabase()).auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw error;
    if (!data.session) throw new ErreurAuth(MESSAGES_AUTH.codeRefuse);
  } catch (erreur) {
    throw enErreurAuth(erreur, 'verification');
  }
}

/** Ferme la session de cet appareil seulement (les autres appareils du spectateur restent connectés). */
export async function seDeconnecter(): Promise<void> {
  try {
    const { error } = await (await supabase()).auth.signOut({ scope: 'local' });
    if (error) throw error;
  } catch (erreur) {
    throw enErreurAuth(erreur, 'demande');
  }
}

/** « 0:42 » : temps restant avant de pouvoir renvoyer le code. */
export function formaterDecompte(secondes: number): string {
  const reste = Math.max(0, Math.ceil(secondes));
  return `${Math.floor(reste / 60)}:${String(reste % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------------------------
// Demande en cours : prénom, email et heure d'envoi, gardés dans l'onglet (sessionStorage) entre
// /inscription et /inscription/code. Rien n'est conservé une fois l'onglet fermé.
// ---------------------------------------------------------------------------------------------

export type DemandeCode = { prenom: string; email: string; envoyeeLe: number };

const CLE_DEMANDE = 'olympiade-inscription';

/** Demande lue dans le stockage ou dans l'état de navigation ; null si la forme ne convient pas. */
export function demandeValide(valeur: unknown): DemandeCode | null {
  if (typeof valeur !== 'object' || valeur === null) return null;
  const { prenom, email, envoyeeLe } = valeur as Record<string, unknown>;
  if (typeof prenom !== 'string' || typeof email !== 'string' || typeof envoyeeLe !== 'number') return null;
  return { prenom, email, envoyeeLe };
}

/** Relit une demande enregistrée ; null si elle est absente ou abîmée. */
export function lireDemande(texte: string | null): DemandeCode | null {
  if (!texte) return null;
  try {
    return demandeValide(JSON.parse(texte));
  } catch {
    return null;
  }
}

/** Stockage de l'onglet, ou null s'il est indisponible (navigation privée stricte, stockage bloqué). */
function stockageOnglet(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function demandeEnCours(): DemandeCode | null {
  try {
    return lireDemande(stockageOnglet()?.getItem(CLE_DEMANDE) ?? null);
  } catch {
    return null;
  }
}

export function memoriserDemande(demande: DemandeCode): void {
  try {
    stockageOnglet()?.setItem(CLE_DEMANDE, JSON.stringify(demande));
  } catch {
    // Stockage plein ou refusé : la page du code le signale (aucune demande en cours).
  }
}

export function oublierDemande(): void {
  try {
    stockageOnglet()?.removeItem(CLE_DEMANDE);
  } catch {
    // Rien à faire.
  }
}
