// @ts-check
// Point d'entrée du serveur de production (pnpm start, Railway) : lit l'environnement, crée le
// serveur de serveur/application.mjs sur build/client et écoute.

import { fileURLToPath } from 'node:url';
import { creerServeur, hoteSupabase, journaliserErreur, portDepuis } from './application.mjs';
import { supervisionDepuisEnvironnement } from './supervision.mjs';

const RACINE = fileURLToPath(new URL('../build/client/', import.meta.url));

/** @type {ReturnType<typeof creerServeur>} */
let serveur;
/** @type {number} */
let port;
try {
  port = portDepuis(process.env.PORT);
  serveur = creerServeur({
    racine: RACINE,
    supabase: hoteSupabase(process.env.VITE_SUPABASE_URL),
    supervision: supervisionDepuisEnvironnement(process.env),
  });
} catch (erreur) {
  journaliserErreur(`démarrage impossible (lancer pnpm build avant pnpm start) : ${RACINE}`, erreur);
  process.exit(1);
}

serveur.listen(port, () => {
  console.log(
    JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), message: 'serveur prêt', port, fichiers: serveur.fichiers }),
  );
});

// Arrêt propre au redéploiement (Railway envoie SIGTERM).
for (const signal of /** @type {const} */ (['SIGTERM', 'SIGINT'])) {
  process.on(signal, () => {
    serveur.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
