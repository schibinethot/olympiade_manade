import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Année de publication, figée au build : la même valeur est inscrite dans le pré-rendu et
// dans le bundle client, donc pas d'écart d'hydratation si la visite a lieu une autre année.
const ANNEE_PUBLICATION = new Date().getFullYear();

// Découpage du JavaScript du navigateur (Task 8). Par défaut, le premier chargement d'une page
// vitrine demandait 24 petits fichiers : sur une connexion HTTP/1.1 (6 connexions), chacun coûte un
// aller-retour. Deux groupes les réunissent :
// - « react » : React, React DOM et React Router, communs à toutes les pages ;
// - « app » : le code partagé du site (lib, données, composants), quelques kilo-octets en tout.
// Restent à part, chargés à la demande : supabase-js (import() de app/lib/supabase.ts), et les
// composants de l'inscription avec input-otp, propres aux pages /inscription.
const BIBLIOTHEQUES_REACT = /node_modules\/(react|react-dom|scheduler|react-router|cookie|set-cookie-parser)\//;
const CODE_PARTAGE = /\/app\/(lib|donnees|composants)\//;
const PROPRES_A_L_INSCRIPTION =
  /\/app\/(composants\/(CadreInscription|FormulaireCode|FormulaireInscription|SaisieCode)\.tsx|lib\/useOtpCooldown\.ts)$/;
// Les composants de l'administration (dont l'éditeur des emails et le rendu des gabarits qu'il
// importe) restent hors du groupe « app » : une page vitrine ne les charge pas.
const PROPRES_A_L_ADMIN = /\/app\/composants\/admin\//;

export default defineConfig(({ isSsrBuild }) => ({
  define: {
    __ANNEE_PUBLICATION__: JSON.stringify(ANNEE_PUBLICATION),
  },
  plugins: [tailwindcss(), reactRouter()],
  build: isSsrBuild
    ? {}
    : {
        rolldownOptions: {
          output: {
            codeSplitting: {
              groups: [
                { name: 'react', test: BIBLIOTHEQUES_REACT },
                {
                  name: 'app',
                  test: (id: string) => CODE_PARTAGE.test(id) && !PROPRES_A_L_INSCRIPTION.test(id) && !PROPRES_A_L_ADMIN.test(id),
                },
              ],
            },
          },
        },
      },
}));
