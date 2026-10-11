import type { Config } from '@react-router/dev/config';

// Application monopage (pas de serveur à l'exécution) dont les pages vitrine
// sont pré-rendues au build. Les autres routes (/noter, puis /inscription)
// s'hydratent depuis build/client/__spa-fallback.html.
export default {
  ssr: false,
  // Un seul fichier par route : le clientLoader ne tourne plus à l'hydratation des pages vitrine
  // (app/lib/relecture.ts), le séparer du composant ne faisait qu'ajouter une requête.
  splitRouteModules: false,
  prerender: ['/', '/classements', '/dates', '/contact', '/mentions-legales', '/confidentialite'],
} satisfies Config;
