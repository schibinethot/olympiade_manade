import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Année de publication, figée au build : la même valeur est inscrite dans le pré-rendu et
// dans le bundle client, donc pas d'écart d'hydratation si la visite a lieu une autre année.
const ANNEE_PUBLICATION = new Date().getFullYear();

export default defineConfig({
  define: {
    __ANNEE_PUBLICATION__: JSON.stringify(ANNEE_PUBLICATION),
  },
  plugins: [tailwindcss(), reactRouter()],
});
