// @ts-check
// Point d'entrée du serveur de production (pnpm start, Railway) : lit l'environnement, crée le
// serveur de serveur/application.mjs sur build/client et écoute.

import { fileURLToPath } from 'node:url';
import {
  accesDepuis,
  creerServeur,
  hoteSupabase,
  journaliserAbsence,
  journaliserErreur,
  portDepuis,
} from './application.mjs';
import { supervisionDepuisEnvironnement } from './supervision.mjs';
import { planningNotationDepuisEnvironnement } from './planning-notation.mjs';
import { fileNotesDepuisEnvironnement } from './file-notes.mjs';
import { contactDepuisEnvironnement } from './contact.mjs';
import { actualitesDepuisEnvironnement } from './actualites.mjs';
import { creerEtatSoiree, instantaneDepuisEnvironnement } from './instantane.mjs';
import { jugesDepuisEnvironnement } from './juges.mjs';
import { complementsDepuisEnvironnement } from './complements.mjs';
import { courrielDepuisEnvironnement } from './courriel.mjs';

const RACINE = fileURLToPath(new URL('../build/client/', import.meta.url));

/** @type {ReturnType<typeof creerServeur>} */
let serveur;
/** @type {number} */
let port;
/** @type {ReturnType<typeof fileNotesDepuisEnvironnement>} */
let fileNotes;
/** @type {ReturnType<typeof instantaneDepuisEnvironnement>} */
let instantane;
try {
  port = portDepuis(process.env.PORT);
  fileNotes = fileNotesDepuisEnvironnement(process.env);
  instantane = instantaneDepuisEnvironnement(process.env);
  const acces = accesDepuis(process.env.ACCES_TOKEN);
  journaliserAbsence(acces);
  serveur = creerServeur({
    racine: RACINE,
    supabase: hoteSupabase(process.env.VITE_SUPABASE_URL),
    supervision: supervisionDepuisEnvironnement(process.env),
    planningNotation: planningNotationDepuisEnvironnement(process.env),
    contact: contactDepuisEnvironnement(process.env),
    actualites: actualitesDepuisEnvironnement(process.env),
    etatSoiree: creerEtatSoiree({
      reel: process.env.ETAT_SOIREE_REEL === 'true',
      lire: (slug) => (instantane ? instantane.lire(slug) : Promise.resolve(null)),
    }),
    juges: jugesDepuisEnvironnement(process.env),
    complements: complementsDepuisEnvironnement(process.env),
    acces,
  });
} catch (erreur) {
  journaliserErreur(`démarrage impossible (lancer pnpm build avant pnpm start) : ${RACINE}`, erreur);
  process.exit(1);
}

const courriel = courrielDepuisEnvironnement(process.env);

serveur.listen(port, () => {
  fileNotes?.demarrer();
  instantane?.demarrer();
  console.log(
    JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message: 'serveur prêt',
      port,
      fichiers: serveur.fichiers,
      courriel: courriel.mode,
      courrielPret: courriel.pret,
    }),
  );
});

// Arrêt propre au redéploiement (Railway envoie SIGTERM).
for (const signal of /** @type {const} */ (['SIGTERM', 'SIGINT'])) {
  process.on(signal, () => {
    fileNotes?.arreter();
    instantane?.arreter();
    serveur.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
