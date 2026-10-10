import type { Config } from '@react-router/dev/config';

// Application monopage (pas de serveur à l'exécution) dont les pages vitrine
// sont pré-rendues au build. Les autres routes (/noter, puis /inscription)
// s'hydratent depuis build/client/__spa-fallback.html.
export default {
  ssr: false,
  prerender: ['/', '/classements', '/dates', '/contact', '/mentions-legales', '/confidentialite'],
} satisfies Config;
