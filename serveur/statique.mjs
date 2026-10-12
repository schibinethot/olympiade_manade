// @ts-check
// Point d'entrée du serveur de production (pnpm start, Railway) : lit l'environnement, crée le
// serveur de serveur/application.mjs sur build/client et écoute.

import { fileURLToPath } from 'node:url';
import { accesDepuis, creerServeur, hoteSupabase, journaliserErreur, portDepuis } from './application.mjs';
import { supervisionDepuisEnvironnement } from './supervision.mjs';
import { planningNotationDepuisEnvironnement } from './planning-notation.mjs';
import { fileNotesDepuisEnvironnement } from './file-notes.mjs';
import { contactDepuisEnvironnement } from './contact.mjs';

const RACINE = fileURLToPath(new URL('../build/client/', import.meta.url));

/** @type {ReturnType<typeof creerServeur>} */
let serveur;
/** @type {number} */
let port;
/** @type {ReturnType<typeof fileNotesDepuisEnvironnement>} */
let fileNotes;
try {
  port = portDepuis(process.env.PORT);
  fileNotes = fileNotesDepuisEnvironnement(process.env);
  serveur = creerServeur({
    racine: RACINE,
    supabase: hoteSupabase(process.env.VITE_SUPABASE_URL),
    supervision: supervisionDepuisEnvironnement(process.env),
    planningNotation: planningNotationDepuisEnvironnement(process.env),
    contact: contactDepuisEnvironnement(process.env),
    acces: accesDepuis(process.env.ACCES_TOKEN),
  });
} catch (erreur) {
  journaliserErreur(`démarrage impossible (lancer pnpm build avant pnpm start) : ${RACINE}`, erreur);
  process.exit(1);
}

serveur.listen(port, () => {
  fileNotes?.demarrer();
  console.log(
    JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), message: 'serveur prêt', port, fichiers: serveur.fichiers }),
  );
});

// Arrêt propre au redéploiement (Railway envoie SIGTERM).
for (const signal of /** @type {const} */ (['SIGTERM', 'SIGINT'])) {
  process.on(signal, () => {
    fileNotes?.arreter();
    serveur.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
