// @ts-check
// Worker borné de la file PostgreSQL des notes. Ce module ne lit pas l'environnement et ne
// démarre rien à l'import : l'application doit l'activer explicitement.

import { randomUUID } from 'node:crypto';

const INTERVALLE_DEFAUT_MS = 250;
const DELAI_MAX_MS = 10_000;
// Limite pratique de setTimeout (entier signé 32 bits). Retry-After reste une borne basse jusqu'à
// cette limite de plateforme; le backoff calculé localement reste, lui, borné à dix secondes.
const RETRY_AFTER_MAX_MS = 2_147_000_000;
const TIMEOUT_DEFAUT_MS = 5_000;
const LOT_DEFAUT = 100;

/** @param {unknown} valeur @param {number} repli @param {number} min @param {number} max */
function entierBorne(valeur, repli, min, max) {
  const n = Number(valeur);
  return Number.isInteger(n) && n >= min && n <= max ? n : repli;
}

/** @param {string | null | undefined} valeur */
function origineSupabase(valeur) {
  if (!valeur) return null;
  try {
    const url = new URL(valeur);
    if (url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) {
      return url.origin;
    }
  } catch {
    // L'appelant recevra une erreur de configuration sans reprise de la valeur sensible.
  }
  return null;
}

/** @param {Headers} entetes @param {number} repli */
function delaiRetryAfter(entetes, repli) {
  const valeur = entetes.get('retry-after');
  if (valeur === null) return repli;
  const secondes = Number(valeur);
  if (Number.isFinite(secondes) && secondes >= 0) return Math.min(RETRY_AFTER_MAX_MS, Math.ceil(secondes * 1000));
  const date = Date.parse(valeur);
  if (Number.isFinite(date)) return Math.min(RETRY_AFTER_MAX_MS, Math.max(0, date - Date.now()));
  return repli;
}

/**
 * @typedef {{ prises: number, confirmees: number }} ResultatTraitement
 * @typedef {{
 *   enabled?: boolean,
 *   supabaseUrl?: string | null,
 *   serviceRoleKey?: string | null,
 *   batchSize?: number,
 *   intervalMs?: number,
 *   timeoutMs?: number,
 *   instanceId?: string,
 *   fetchFn?: typeof fetch,
 *   randomFn?: () => number,
 *   onError?: (erreur: unknown) => void,
 * }} OptionsWorker
 */

/**
 * Crée un worker inactif. `demarrer()` est idempotent; `arreter()` annule le minuteur et l'appel
 * HTTP courant. Avec `enabled: false` (valeur par défaut), aucun appel réseau n'est possible.
 *
 * @param {OptionsWorker} [options]
 */
export function creerWorkerFileNotes(options = {}) {
  const enabled = options.enabled === true;
  const supabaseUrl = origineSupabase(options.supabaseUrl);
  const serviceRoleKey = typeof options.serviceRoleKey === 'string' && options.serviceRoleKey.length > 0
    ? options.serviceRoleKey
    : null;
  const batchSize = entierBorne(options.batchSize, LOT_DEFAUT, 1, 100);
  const intervalMs = entierBorne(options.intervalMs, INTERVALLE_DEFAUT_MS, 25, 60_000);
  const timeoutMs = entierBorne(options.timeoutMs, TIMEOUT_DEFAUT_MS, 100, 30_000);
  const instanceId = typeof options.instanceId === 'string' && /^file-[a-f0-9]{24}$/.test(options.instanceId)
    ? options.instanceId
    : `file-${randomUUID().replaceAll('-', '').slice(0, 24)}`;
  const fetchFn = options.fetchFn ?? fetch;
  const randomFn = options.randomFn ?? Math.random;

  if (enabled && (!supabaseUrl || !serviceRoleKey)) {
    throw new Error('Worker de notes activé sans URL Supabase HTTPS ni clé service_role');
  }

  /** @type {ReturnType<typeof setTimeout> | null} */
  let minuteur = null;
  /** @type {AbortController | null} */
  let controleur = null;
  /** @type {Promise<ResultatTraitement & { active: boolean }> | null} */
  let enCours = null;
  let demarre = false;
  let echecs = 0;

  /** Appelle une seule transaction distante; pratique aussi pour les tests et la supervision.
   * @returns {Promise<ResultatTraitement & { active: boolean }>}
   */
  function traiterUneFois() {
    if (!enabled) return Promise.resolve({ active: false, prises: 0, confirmees: 0 });
    if (enCours) return enCours;

    enCours = appeler().finally(() => {
      enCours = null;
    });
    return enCours;
  }

  async function appeler() {
    const appelControleur = new AbortController();
    controleur = appelControleur;
    const timeout = setTimeout(() => appelControleur.abort(new Error('délai du worker dépassé')), timeoutMs);
    timeout.unref?.();
    try {
      const reponse = await fetchFn(`${supabaseUrl}/rest/v1/rpc/traiter_file_notes`, {
        method: 'POST',
        headers: {
          apikey: /** @type {string} */ (serviceRoleKey),
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_limite: batchSize, p_instance_id: instanceId }),
        signal: appelControleur.signal,
      });
      if (!reponse.ok) {
        const erreur = new Error(`Le traitement de la file a répondu HTTP ${reponse.status}`);
        // Le délai est attaché sans exposer le corps Supabase, qui peut contenir des détails SQL.
        Object.assign(erreur, { retryAfterMs: delaiRetryAfter(reponse.headers, 0), status: reponse.status });
        throw erreur;
      }
      const valeur = await reponse.json();
      const prises = entierBorne(valeur?.prises, 0, 0, batchSize);
      const confirmees = entierBorne(valeur?.confirmees, 0, 0, prises);
      return { active: true, prises, confirmees };
    } finally {
      clearTimeout(timeout);
      if (controleur === appelControleur) controleur = null;
    }
  }

  /** @param {number} delai */
  function planifier(delai) {
    if (!demarre || !enabled) return;
    minuteur = setTimeout(boucle, delai);
    minuteur.unref?.();
  }

  async function boucle() {
    minuteur = null;
    try {
      const resultat = await traiterUneFois();
      echecs = 0;
      // Même avec un backlog, conserver l'intervalle borne la pression exercée par une instance.
      planifier(intervalMs);
    } catch (erreur) {
      options.onError?.(erreur);
      echecs = Math.min(echecs + 1, 6);
      const exponentiel = Math.min(DELAI_MAX_MS, intervalMs * 2 ** echecs);
      const indique = Number(/** @type {{ retryAfterMs?: unknown }} */ (erreur)?.retryAfterMs);
      const retryAfter = Number.isFinite(indique) && indique > 0;
      const base = retryAfter ? Math.min(RETRY_AFTER_MAX_MS, indique) : exponentiel;
      // Le jitter est uniquement positif : un Retry-After n'est jamais raccourci.
      const plafond = retryAfter ? RETRY_AFTER_MAX_MS : DELAI_MAX_MS;
      planifier(Math.min(plafond, Math.round(base * (1 + randomFn() * 0.2))));
    }
  }

  function demarrer() {
    if (demarre || !enabled) return false;
    demarre = true;
    planifier(0);
    return true;
  }

  function arreter() {
    demarre = false;
    if (minuteur) clearTimeout(minuteur);
    minuteur = null;
    controleur?.abort(new Error('arrêt du worker'));
    controleur = null;
  }

  return { enabled, batchSize, instanceId, demarrer, arreter, traiterUneFois };
}

/**
 * Adaptateur d'environnement pour serveur/statique.mjs. L'activation est strictement opt-in :
 * toute valeur autre que la chaîne `true` retourne null et ne valide ni URL ni secret.
 *
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 */
export function fileNotesDepuisEnvironnement(env) {
  if (env.FILE_NOTES_ACTIVE !== 'true') return null;
  return creerWorkerFileNotes({
    enabled: true,
    supabaseUrl: env.VITE_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    batchSize: Number(env.FILE_NOTES_BATCH_SIZE),
    intervalMs: Number(env.FILE_NOTES_INTERVAL_MS),
    timeoutMs: Number(env.FILE_NOTES_TIMEOUT_MS),
  });
}
