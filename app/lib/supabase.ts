import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const cle = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Clé de la session dans localStorage (supabase-js y ajoute « -code-verifier » pendant une demande). */
export const CLE_SESSION = 'olympiade-auth';

let client: SupabaseClient | null = null;

/**
 * Client Supabase (clé publishable), créé au premier appel. Sans variables d'environnement, l'appel
 * lève une erreur au lieu de casser l'import du module : les lectures de données la transforment en
 * ErreurDonnees, et le pré-rendu affiche alors le repli au lieu d'échouer.
 */
export function supabase(): SupabaseClient {
  if (client) return client;
  if (!url || !cle) {
    throw new Error('VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY doivent être définies dans .env.local');
  }
  // Session du spectateur conservée dans le stockage local du navigateur, sous une clé propre au site
  // (strictement nécessaire à la connexion, aucun traceur). PKCE : le lien de secours de l'email
  // revient avec un « code » échangé ici, dans le navigateur qui a demandé le code.
  client = createClient(url, cle, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: CLE_SESSION,
    },
  });
  return client;
}
