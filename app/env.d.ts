// Variables d'environnement du front, lues par Vite dans .env.local (ignoré par git).
// Seule la clé publishable de Supabase va dans le front.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Clé publique du widget Cloudflare Turnstile. Le secret reste exclusivement dans Supabase Auth. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** Ouverture publique de l'inscription : seule la chaîne « true » l'active (app/lib/inscription-ouverte.ts). */
  readonly VITE_INSCRIPTION_OUVERTE?: string;
  /** Clé publique VAPID. La clé privée reste exclusivement dans VAPID_PRIVATE_KEY, côté serveur. */
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

// Année de publication, injectée au build par `define` (vite.config.ts).
declare const __ANNEE_PUBLICATION__: number;
