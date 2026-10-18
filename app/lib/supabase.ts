import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const cle = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Clé de la session dans localStorage (supabase-js y ajoute « -code-verifier » pendant une demande). */
export const CLE_SESSION = 'olympiade-auth';

let promesse: Promise<SupabaseClient> | null = null;
let cree: SupabaseClient | null = null;
const rappels = new Set<(client: SupabaseClient) => void>();

/**
 * Client Supabase (clé publishable), chargé et créé au premier appel. supabase-js (environ 55 Ko
 * gzip) est un module à part, importé à la demande : les pages vitrine, dont les données sont dans
 * le pré-rendu, s'affichent sans lui. Il arrive à la première lecture fraîche, au premier envoi
 * d'un formulaire, ou dès l'ouverture si l'appareil a une session (useSession).
 *
 * Sans variables d'environnement, la promesse est rejetée au lieu de casser l'import du module :
 * les lectures de données la transforment en ErreurDonnees, et le pré-rendu affiche alors le repli.
 * Un échec du chargement (réseau) n'est pas retenu : l'appel suivant réessaie.
 */
export function supabase(): Promise<SupabaseClient> {
  if (!promesse) {
    promesse = creer();
    promesse.catch(() => {
      promesse = null;
    });
  }
  return promesse;
}

async function creer(): Promise<SupabaseClient> {
  if (!url || !cle) {
    throw new Error('VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY doivent être définies dans .env.local');
  }
  const { createClient } = await import('@supabase/supabase-js');
  // Session du spectateur conservée dans le stockage local du navigateur, sous une clé propre au site
  // (strictement nécessaire à la connexion, aucun traceur). PKCE : le lien de secours de l'email
  // revient avec un « code » échangé ici, dans le navigateur qui a demandé le code.
  cree = createClient(url, cle, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: CLE_SESSION,
    },
  });
  for (const rappel of rappels) rappel(cree);
  return cree;
}

/**
 * Appelle `rappel` avec le client dès qu'il existe : tout de suite s'il est déjà créé, sinon à sa
 * création, quel que soit l'appel qui le crée (lecture, inscription, session). Rend la fonction
 * qui retire le rappel (démontage d'un composant).
 */
export function quandClientCree(rappel: (client: SupabaseClient) => void): () => void {
  rappels.add(rappel);
  if (cree) rappel(cree);
  return () => {
    rappels.delete(rappel);
  };
}

/** Paramètres d'adresse posés par Supabase Auth au retour du lien de l'email (PKCE, erreur, jeton). */
const PARAMETRES_AUTH = /[?#&](code|error|error_code|error_description|access_token)=/;

/**
 * Vrai si l'appareil a peut-être une session à relire : une clé du site dans le stockage local
 * (session, ou demande PKCE en cours), ou le retour du lien de connexion dans l'adresse. Sinon,
 * personne n'est connecté et supabase-js n'a pas à être chargé pour le savoir.
 */
export function sessionPossible(
  stockage: Pick<Storage, 'length' | 'key'> | null,
  adresse: Pick<Location, 'search' | 'hash'>,
): boolean {
  if (PARAMETRES_AUTH.test(adresse.search) || PARAMETRES_AUTH.test(adresse.hash)) return true;
  if (!stockage) return false;
  try {
    for (let i = 0; i < stockage.length; i++) {
      if (stockage.key(i)?.startsWith(CLE_SESSION)) return true;
    }
  } catch {
    // Stockage illisible (navigation privée stricte) : aucune session n'a pu y être enregistrée.
  }
  return false;
}
