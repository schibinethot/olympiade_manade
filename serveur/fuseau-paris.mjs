// @ts-check
// Heure et jours de Paris, changements d'heure compris : source unique du serveur (échéances, rendu, liens,
// planificateur) et du front. Isomorphe : aucun import node:*, aucune dépendance.
//
// Deux sortes de jours :
// - le jour calendaire de Paris (minuit à minuit) ;
// - le « jour des soirées » : une soirée finit après minuit, un instant compte donc encore pour la veille
//   jusqu'à 06:00 (comme prive.jour_des_soirees en base). Une inscription le 01/08 à 00:30 suit la soirée du 31/07.

export const FUSEAU = 'Europe/Paris';
const HEURE_MS = 3_600_000;
const JOUR_MS = 24 * HEURE_MS;
/** Jusqu'à cette heure, la nuit compte encore pour la veille (prive.jour_des_soirees). */
export const FIN_DES_SOIREES_MS = 6 * HEURE_MS;

const PARTIES_PARIS = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSEAU, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** @param {number} ms */
function verifierInstant(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) throw new RangeError(`Instant invalide : ${String(ms)}`);
}

/**
 * Heure murale de Paris à l'instant `ms`, exprimée comme si elle était en UTC (à la seconde).
 * @param {number} ms
 */
export function murParis(ms) {
  verifierInstant(ms);
  /** @type {Record<string, number>} */
  const parties = {};
  for (const { type, value } of PARTIES_PARIS.formatToParts(ms)) if (type !== 'literal') parties[type] = Number(value);
  return Date.UTC(parties.year, parties.month - 1, parties.day, parties.hour, parties.minute, parties.second);
}

/** Écart entre l'heure de Paris et UTC à l'instant `ms` (+1 h ou +2 h). @param {number} ms */
function decalageParis(ms) {
  const seconde = Math.floor(ms / 1000) * 1000;
  return murParis(seconde) - seconde;
}

const jourUtc = (/** @type {number} */ ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * Jour calendaire strict (le 31/02 est refusé), à minuit UTC.
 * @param {string} dateIso « AAAA-MM-JJ »
 */
export function lireJour(dateIso) {
  const morceaux = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateIso));
  const utc = morceaux ? new Date(Date.UTC(Number(morceaux[1]), Number(morceaux[2]) - 1, Number(morceaux[3]))) : null;
  if (!morceaux || !utc || utc.getUTCMonth() !== Number(morceaux[2]) - 1 || utc.getUTCDate() !== Number(morceaux[3])) {
    throw new RangeError(`Date invalide : ${dateIso}`);
  }
  return { annee: morceaux[1], mois: morceaux[2], jour: morceaux[3], utc };
}

/** Jour calendaire de Paris de l'instant `ms` : « AAAA-MM-JJ ». @param {number} ms */
export const jourCalendaireParis = (ms) => jourUtc(murParis(ms));

/** Jour « des soirées » de l'instant `ms` : avant 06:00 (Paris), il compte encore pour la veille. @param {number} ms */
export const jourDesSoirees = (ms) => jourUtc(murParis(ms) - FIN_DES_SOIREES_MS);

/** Jour calendaire de Paris et heure (0 à 23) de l'instant `ms`. @param {number} ms */
export function heureParis(ms) {
  const mur = murParis(ms);
  return { jour: jourUtc(mur), heure: new Date(mur).getUTCHours() };
}

/** « AAAA-MM-JJ » décalé de `jours` jours. @param {string} jour @param {number} jours */
export const decalerJour = (jour, jours) => jourUtc(lireJour(jour).utc.getTime() + jours * JOUR_MS);

/** Nombre de jours de `de` à `a` (« AAAA-MM-JJ »). @param {string} de @param {string} a */
export const ecartJours = (de, a) => Math.round((lireJour(a).utc.getTime() - lireJour(de).utc.getTime()) / JOUR_MS);

/**
 * Instant (ms) du jour `jour` à l'heure `heure` de Paris.
 * @param {string} jour « AAAA-MM-JJ »
 * @param {string} heure « HH:MM » ou « HH:MM:SS »
 */
export function instantParis(jour, heure) {
  const morceaux = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(heure);
  const [heures, minutes, secondes] = morceaux ? [morceaux[1], morceaux[2], morceaux[3] ?? '0'].map(Number) : [];
  if (!morceaux || heures > 23 || minutes > 59 || secondes > 59) throw new RangeError(`Heure invalide : ${heure}`);
  const mur = lireJour(jour).utc.getTime() + ((heures * 60 + minutes) * 60 + secondes) * 1000;
  // Le décalage lu à l'heure murale prise pour UTC peut être faux d'une heure près d'un changement
  // d'heure : on le relit à l'instant obtenu.
  return mur - decalageParis(mur - decalageParis(mur));
}

/** Dernière milliseconde du jour (heure de Paris) de « AAAA-MM-JJ ». @param {string} dateIso */
export function finDeJourParis(dateIso) {
  return instantParis(decalerJour(dateIso, 1), '00:00') - 1;
}
