// Variables d'environnement du front, lues par Vite dans .env.local (ignoré par git).
// Seule la clé publishable de Supabase va dans le front.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

// Année de publication, injectée au build par `define` (vite.config.ts).
declare const __ANNEE_PUBLICATION__: number;
