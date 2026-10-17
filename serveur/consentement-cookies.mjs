// @ts-check
// Consentement cookies (CNIL / RGPD) : expose les paramètres éditables en lecture publique et
// journalise les choix du visiteur. La clé service_role ne sort pas de ce processus ; l'IP et le
// user-agent sont normalisés (HMAC puis troncature) avant toute écriture dans Supabase.

import { createHmac } from 'node:crypto';
import {
  FENETRE_MS,
  avecDelai,
  creerLimiteurFormulaire,
  creerLimiteurGlobalFormulaire,
  entierBorne,
  ipClient,
  lireJson,
  longueur,
  originePublique,
  origineSupabase,
  repondreJson,
} from './protections-formulaire.mjs';

const CHEMIN_PARAMETRES = '/api/cookie-consent/settings';
const CHEMIN_LOG = '/api/cookie-consent/log';
const CACHE_PARAMETRES_MS = 60_000;
const IP_LIMITE_DEFAUT = 30;
const GLOBAL_LIMITE_DEFAUT = 10_000;
const ADRESSES_MAX_DEFAUT = 10_000;
const LONGUEUR_MAX_URL = 500;
const LONGUEUR_MAX_AGENT = 500;
const LONGUEUR_MAX_VISITEUR = 100;
const ACTIONS_CONNUES = new Set(['accept_all', 'reject_all', 'custom']);

// Valeurs par défaut identiques à la migration : le front reste utilisable même si la lecture
// PostgREST échoue ou si le service est démarré sans clé service_role.
export const PARAMETRES_PAR_DEFAUT = Object.freeze({
  titre: 'Confidentialité',
  description:
    'Nous mesurons l’audience du site pour améliorer nos pages. Aucun cookie de publicité n’est déposé sans votre accord.',
  texteToutAccepter: 'Tout accepter',
  texteRefuser: 'Tout refuser',
  textePersonnaliser: 'Personnaliser',
  texteEnregistrer: 'Enregistrer mes choix',
  urlConfidentialite: '/confidentialite',
  mesureActive: true,
  mesureTitre: 'Mesure d’audience',
  mesureDescription:
    'Ces cookies nous permettent de mesurer l’audience du site et d’analyser ses performances afin d’améliorer le service.',
  publiciteActive: true,
  publiciteTitre: 'Publicité et réseaux sociaux',
  publiciteDescription:
    'Ces cookies servent à vous proposer des publicités pertinentes et à mesurer l’efficacité de nos campagnes.',
  dureeConsentementJours: 365,
});

/**
 * @typedef {{
 *   titre: string, description: string,
 *   texteToutAccepter: string, texteRefuser: string, textePersonnaliser: string, texteEnregistrer: string,
 *   urlConfidentialite: string,
 *   mesureActive: boolean, mesureTitre: string, mesureDescription: string,
 *   publiciteActive: boolean, publiciteTitre: string, publiciteDescription: string,
 *   dureeConsentementJours: number
 * }} ParametresPublics
 */

/** @param {unknown} ligne @returns {ParametresPublics} */
function convertirParametres(ligne) {
  if (!ligne || typeof ligne !== 'object' || Array.isArray(ligne)) return { ...PARAMETRES_PAR_DEFAUT };
  const r = /** @type {Record<string, unknown>} */ (ligne);
  const texte = (/** @type {unknown} */ valeur, /** @type {string} */ defaut) =>
    typeof valeur === 'string' && valeur.length > 0 ? valeur : defaut;
  const bool = (/** @type {unknown} */ valeur, /** @type {boolean} */ defaut) =>
    typeof valeur === 'boolean' ? valeur : defaut;
  const entier = (/** @type {unknown} */ valeur, /** @type {number} */ defaut) => {
    const n = Number(valeur);
    return Number.isInteger(n) && n >= 1 && n <= 395 ? n : defaut;
  };
  return {
    titre: texte(r.titre, PARAMETRES_PAR_DEFAUT.titre),
    description: texte(r.description, PARAMETRES_PAR_DEFAUT.description),
    texteToutAccepter: texte(r.texte_tout_accepter, PARAMETRES_PAR_DEFAUT.texteToutAccepter),
    texteRefuser: texte(r.texte_refuser, PARAMETRES_PAR_DEFAUT.texteRefuser),
    textePersonnaliser: texte(r.texte_personnaliser, PARAMETRES_PAR_DEFAUT.textePersonnaliser),
    texteEnregistrer: texte(r.texte_enregistrer, PARAMETRES_PAR_DEFAUT.texteEnregistrer),
    urlConfidentialite: texte(r.url_confidentialite, PARAMETRES_PAR_DEFAUT.urlConfidentialite),
    mesureActive: bool(r.mesure_active, PARAMETRES_PAR_DEFAUT.mesureActive),
    mesureTitre: texte(r.mesure_titre, PARAMETRES_PAR_DEFAUT.mesureTitre),
    mesureDescription: texte(r.mesure_description, PARAMETRES_PAR_DEFAUT.mesureDescription),
    publiciteActive: bool(r.publicite_active, PARAMETRES_PAR_DEFAUT.publiciteActive),
    publiciteTitre: texte(r.publicite_titre, PARAMETRES_PAR_DEFAUT.publiciteTitre),
    publiciteDescription: texte(r.publicite_description, PARAMETRES_PAR_DEFAUT.publiciteDescription),
    dureeConsentementJours: entier(r.duree_consentement_jours, PARAMETRES_PAR_DEFAUT.dureeConsentementJours),
  };
}

/** Retire la query et le fragment, puis borne la longueur. @param {unknown} valeur */
export function normaliserUrl(valeur) {
  if (typeof valeur !== 'string') return null;
  const brut = valeur.trim();
  if (!brut) return null;
  let nettoyee = brut;
  const positionQuery = nettoyee.indexOf('?');
  if (positionQuery !== -1) nettoyee = nettoyee.slice(0, positionQuery);
  const positionHash = nettoyee.indexOf('#');
  if (positionHash !== -1) nettoyee = nettoyee.slice(0, positionHash);
  if (!nettoyee) return null;
  return nettoyee.slice(0, LONGUEUR_MAX_URL);
}

/** @param {unknown} corps */
export function validerCorpsLog(corps) {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) {
    return { valide: /** @type {false} */ (false), erreur: 'Format de demande invalide.' };
  }
  const valeurs = /** @type {Record<string, unknown>} */ (corps);
  const attendus = new Set([
    'visiteurId',
    'consentementDonne',
    'mesureAcceptee',
    'publiciteAcceptee',
    'action',
    'urlPage',
    'provenance',
  ]);
  const presents = Object.keys(valeurs);
  if (presents.length !== attendus.size || presents.some((cle) => !attendus.has(cle))) {
    return { valide: /** @type {false} */ (false), erreur: 'Format de demande invalide.' };
  }
  if (
    typeof valeurs.visiteurId !== 'string' ||
    typeof valeurs.consentementDonne !== 'boolean' ||
    typeof valeurs.mesureAcceptee !== 'boolean' ||
    typeof valeurs.publiciteAcceptee !== 'boolean' ||
    typeof valeurs.action !== 'string'
  ) {
    return { valide: /** @type {false} */ (false), erreur: 'Format de demande invalide.' };
  }
  const visiteurId = valeurs.visiteurId.trim();
  if (!visiteurId || longueur(visiteurId) > LONGUEUR_MAX_VISITEUR) {
    return { valide: /** @type {false} */ (false), erreur: 'Format de demande invalide.' };
  }
  if (!ACTIONS_CONNUES.has(valeurs.action)) {
    return { valide: /** @type {false} */ (false), erreur: 'Format de demande invalide.' };
  }
  if (valeurs.urlPage !== null && typeof valeurs.urlPage !== 'string') {
    return { valide: /** @type {false} */ (false), erreur: 'Format de demande invalide.' };
  }
  if (valeurs.provenance !== null && typeof valeurs.provenance !== 'string') {
    return { valide: /** @type {false} */ (false), erreur: 'Format de demande invalide.' };
  }
  return {
    valide: /** @type {true} */ (true),
    visiteurId,
    consentementDonne: valeurs.consentementDonne,
    mesureAcceptee: valeurs.mesureAcceptee,
    publiciteAcceptee: valeurs.publiciteAcceptee,
    action: /** @type {'accept_all' | 'reject_all' | 'custom'} */ (valeurs.action),
    urlPage: normaliserUrl(valeurs.urlPage),
    provenance: normaliserUrl(valeurs.provenance),
  };
}

/** HMAC-SHA256 tronqué à 16 caractères hex : clé = service_role, l'IP n'est jamais stockée en clair.
 * @param {string} ip @param {string} cle */
export function hacherIp(ip, cle) {
  return createHmac('sha256', cle).update(ip).digest('hex').slice(0, 16);
}

/**
 * @typedef {{ supabaseUrl?: string | null, serviceRoleKey?: string | null,
 *   publicOrigin?: string | null, trustProxy?: boolean,
 *   ipLimit?: number, globalLimit?: number, maxIpEntries?: number,
 *   fetchFn?: typeof fetch, now?: () => number, cacheMs?: number }} OptionsConsentementCookies
 */

/** @param {OptionsConsentementCookies} [options] */
export function creerConsentementCookies(options = {}) {
  const supabaseUrl = origineSupabase(options.supabaseUrl);
  const publicOrigin = originePublique(options.publicOrigin);
  const serviceRoleKey =
    typeof options.serviceRoleKey === 'string' && options.serviceRoleKey.trim() ? options.serviceRoleKey : null;
  const trustProxy = options.trustProxy === true;
  const demander = options.fetchFn ?? fetch;
  const maintenant = options.now ?? Date.now;
  const cacheMs = typeof options.cacheMs === 'number' && options.cacheMs >= 0 ? options.cacheMs : CACHE_PARAMETRES_MS;

  const limiterTentatives = creerLimiteurFormulaire({
    maintenant,
    parIp: entierBorne(options.ipLimit, IP_LIMITE_DEFAUT, 1, 1_000),
    global: 1_000_000,
    maxAdresses: entierBorne(options.maxIpEntries, ADRESSES_MAX_DEFAUT, 100, 100_000),
  });
  const limiterGlobal = creerLimiteurGlobalFormulaire({
    maintenant,
    limite: entierBorne(options.globalLimit, GLOBAL_LIMITE_DEFAUT, 1, 1_000_000),
  });

  const configure = !!(supabaseUrl && serviceRoleKey && publicOrigin);

  /** @type {{ ts: number, valeur: ParametresPublics } | null} */
  let cache = null;

  async function chargerParametres() {
    const temps = maintenant();
    if (cache && temps - cache.ts < cacheMs) return cache.valeur;
    if (!configure) {
      const defaut = { ...PARAMETRES_PAR_DEFAUT };
      cache = { ts: temps, valeur: defaut };
      return defaut;
    }
    try {
      const reponse = await avecDelai(
        demander,
        `${supabaseUrl}/rest/v1/parametres_cookies?select=*&id=eq.1&limit=1`,
        {
          method: 'GET',
          headers: {
            apikey: /** @type {string} */ (serviceRoleKey),
            Authorization: `Bearer ${serviceRoleKey}`,
            Accept: 'application/json',
          },
        },
      );
      if (!reponse.ok) throw new Error(`statut ${reponse.status}`);
      const corps = /** @type {unknown} */ (await reponse.json());
      const premier = Array.isArray(corps) ? corps[0] : null;
      const valeur = convertirParametres(premier);
      cache = { ts: temps, valeur };
      return valeur;
    } catch (erreur) {
      console.error(
        JSON.stringify({
          level: 'warn',
          timestamp: new Date().toISOString(),
          message: 'lecture paramètres cookies échouée, repli sur défauts',
          erreur: String(erreur),
        }),
      );
      // Dernière valeur connue, sinon les défauts (mêmes que la migration).
      const repli = cache?.valeur ?? { ...PARAMETRES_PAR_DEFAUT };
      cache = { ts: temps, valeur: repli };
      return repli;
    }
  }

  /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
  async function repondreParametres(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return repondreJson(req, res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'GET' });
    }
    const parametres = await chargerParametres();
    return repondreJson(req, res, 200, /** @type {Record<string, unknown>} */ (parametres), {
      'Cache-Control': 'no-cache',
    });
  }

  /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
  async function repondreLog(req, res) {
    if (req.method !== 'POST') return repondreJson(req, res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'POST' });
    if (!configure) return repondreJson(req, res, 503, { error: 'Le journal des consentements est momentanément indisponible.' });
    if (req.headers.origin !== publicOrigin) return repondreJson(req, res, 403, { error: 'Origine de demande non autorisée.' });
    if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type'] ?? ''))) {
      return repondreJson(req, res, 415, { error: 'Format de demande non pris en charge.' });
    }

    let brut;
    try {
      brut = await lireJson(req);
    } catch (erreur) {
      const statut = /** @type {{ statut?: number }} */ (erreur).statut ?? 400;
      return repondreJson(req, res, statut, {
        error: statut === 413 ? 'La demande est trop volumineuse.' : 'Format de demande invalide.',
      });
    }
    const valide = validerCorpsLog(brut);
    if (!valide.valide) return repondreJson(req, res, 400, { error: valide.erreur });

    const ip = ipClient(req, trustProxy);
    if (!limiterTentatives.accepter(ip)) {
      return repondreJson(
        req,
        res,
        429,
        { error: 'Trop de demandes. Réessayez plus tard.' },
        { 'Retry-After': String(Math.ceil(FENETRE_MS / 1000)) },
      );
    }
    if (!limiterGlobal.accepter()) {
      return repondreJson(
        req,
        res,
        429,
        { error: 'Trop de demandes. Réessayez plus tard.' },
        { 'Retry-After': String(Math.ceil(FENETRE_MS / 1000)) },
      );
    }

    const ipHachee = ip && ip !== 'inconnue' ? hacherIp(ip, /** @type {string} */ (serviceRoleKey)) : null;
    const agentBrut = req.headers['user-agent'];
    const agent = typeof agentBrut === 'string' && agentBrut ? agentBrut.slice(0, LONGUEUR_MAX_AGENT) : null;

    try {
      const insertion = await avecDelai(demander, `${supabaseUrl}/rest/v1/consentements_cookies`, {
        method: 'POST',
        headers: {
          apikey: /** @type {string} */ (serviceRoleKey),
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          visiteur_id: valide.visiteurId,
          ip_hachee: ipHachee,
          agent_utilisateur: agent,
          consentement_donne: valide.consentementDonne,
          mesure_acceptee: valide.mesureAcceptee,
          publicite_acceptee: valide.publiciteAcceptee,
          action: valide.action,
          url_page: valide.urlPage,
          provenance: valide.provenance,
        }),
      });
      if (!insertion.ok) {
        const statut = insertion.status === 429 ? 429 : 502;
        return repondreJson(req, res, statut, {
          error:
            statut === 429
              ? 'Trop de demandes. Réessayez plus tard.'
              : 'Le journal des consentements est momentanément indisponible.',
        });
      }
      return repondreJson(req, res, 200, { ok: true });
    } catch {
      return repondreJson(req, res, 503, { error: 'Le journal des consentements est momentanément indisponible.' });
    }
  }

  /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
  async function repondre(req, res) {
    const chemin = routeDepuis(req.url);
    if (chemin === CHEMIN_PARAMETRES) return repondreParametres(req, res);
    if (chemin === CHEMIN_LOG) return repondreLog(req, res);
    return repondreJson(req, res, 404, { error: 'Introuvable.' });
  }

  return {
    /** @param {string | undefined} url */
    estRoute(url) {
      const chemin = routeDepuis(url);
      return chemin === CHEMIN_PARAMETRES || chemin === CHEMIN_LOG;
    },
    repondre,
    configure,
    chargerParametres,
    limiter: limiterTentatives,
    limiterGlobal,
  };
}

/** @param {string | undefined} url */
function routeDepuis(url) {
  try {
    return new URL(url ?? '/', 'http://serveur').pathname;
  } catch {
    return '/';
  }
}

/** @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env */
export function consentementCookiesDepuisEnvironnement(env) {
  return creerConsentementCookies({
    supabaseUrl: env.VITE_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    publicOrigin: env.CONTACT_ORIGIN,
    trustProxy: env.CONTACT_TRUST_PROXY === 'true',
  });
}
