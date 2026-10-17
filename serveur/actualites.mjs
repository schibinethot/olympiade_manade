// @ts-check
// Collecte des consentements aux actualités. La clé service_role reste dans ce processus ; aucun
// compte n'est créé et aucun email n'est envoyé depuis cet endpoint.

import {
  ADRESSES_MAX_DEFAUT,
  FENETRE_MS,
  GLOBAL_MAX_DEFAUT,
  IP_MAX_DEFAUT,
  LIMITE_JETON,
  avecDelai,
  creerLimiteurFormulaire,
  creerLimiteurGlobalFormulaire,
  demanderJsonBorne,
  entierBorne,
  ipClient,
  lireJson,
  longueur,
  originePublique,
  origineSupabase,
  repondreJson,
  rogner,
} from './protections-formulaire.mjs';

const CHEMIN = '/api/actualites';
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const CONSENTEMENT_ACTUALITES_VERSION = '2026-10-17';
export const CONSENTEMENT_ACTUALITES_TEXTE =
  'J’accepte de recevoir par email les actualités, informations pratiques, résultats et notations de l’Olympiade des Manades.';
const SOURCE = 'accueil';

/** @param {unknown} corps */
export function validerCorpsActualites(corps) {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) {
    return { valide: false, erreur: 'Format de demande invalide.' };
  }
  const valeurs = /** @type {Record<string, unknown>} */ (corps);
  const attendus = ['email', 'consentement', 'site_web', 'turnstileToken'];
  if (Object.keys(valeurs).length !== attendus.length || Object.keys(valeurs).some((cle) => !attendus.includes(cle))) {
    return { valide: false, erreur: 'Format de demande invalide.' };
  }
  if (typeof valeurs.email !== 'string' || valeurs.consentement !== true ||
      typeof valeurs.site_web !== 'string' || typeof valeurs.turnstileToken !== 'string') {
    return { valide: false, erreur: 'Le consentement et l’adresse email sont requis.' };
  }

  const email = rogner(valeurs.email).toLowerCase();
  if (!email || longueur(email) > 254 || !EMAIL.test(email)) {
    return { valide: false, erreur: 'L’adresse email est invalide.' };
  }
  if (longueur(valeurs.site_web) > 200 || longueur(valeurs.turnstileToken) > LIMITE_JETON) {
    return { valide: false, erreur: 'Format de demande invalide.' };
  }
  return { valide: true, email, siteWeb: valeurs.site_web, turnstileToken: valeurs.turnstileToken };
}

/**
 * @typedef {{ supabaseUrl?: string | null, serviceRoleKey?: string | null, turnstileSecret?: string | null,
 *   publicOrigin?: string | null, trustProxy?: boolean, ipLimit?: number, globalLimit?: number,
 *   maxIpEntries?: number, fetchFn?: typeof fetch, now?: () => number }} OptionsActualites
 */

/** @param {OptionsActualites} [options] */
export function creerActualites(options = {}) {
  const supabaseUrl = origineSupabase(options.supabaseUrl);
  const publicOrigin = originePublique(options.publicOrigin);
  const serviceRoleKey = typeof options.serviceRoleKey === 'string' && options.serviceRoleKey.trim() ? options.serviceRoleKey : null;
  const turnstileSecret = typeof options.turnstileSecret === 'string' && options.turnstileSecret.trim() ? options.turnstileSecret : null;
  const trustProxy = options.trustProxy === true;
  const demander = options.fetchFn ?? fetch;
  const limiterTentatives = creerLimiteurFormulaire({
    maintenant: options.now,
    parIp: entierBorne(options.ipLimit, IP_MAX_DEFAUT, 1, 100),
    global: 1_000_000,
    maxAdresses: entierBorne(options.maxIpEntries, ADRESSES_MAX_DEFAUT, 100, 100_000),
  });
  const limiterDepots = creerLimiteurGlobalFormulaire({
    maintenant: options.now,
    limite: entierBorne(options.globalLimit, GLOBAL_MAX_DEFAUT, 1, 1_000),
  });
  const configure = !!(supabaseUrl && serviceRoleKey && turnstileSecret && publicOrigin);

  /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
  async function repondre(req, res) {
    if (req.method !== 'POST') return repondreJson(req, res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'POST' });
    if (!configure) return repondreJson(req, res, 503, { error: 'Le formulaire est momentanément indisponible. Réessayez plus tard.' });
    if (req.headers.origin !== publicOrigin) return repondreJson(req, res, 403, { error: 'Origine de demande non autorisée.' });
    if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type'] ?? ''))) {
      return repondreJson(req, res, 415, { error: 'Format de demande non pris en charge.' });
    }

    let brut;
    try { brut = await lireJson(req); }
    catch (erreur) {
      const statut = /** @type {{statut?: number}} */ (erreur).statut ?? 400;
      return repondreJson(req, res, statut, { error: statut === 413 ? 'La demande est trop volumineuse.' : 'Format de demande invalide.' });
    }
    const valide = validerCorpsActualites(brut);
    if (!valide.valide) return repondreJson(req, res, 400, { error: valide.erreur });

    const ip = ipClient(req, trustProxy);
    if (!limiterTentatives.accepter(ip)) {
      return repondreJson(req, res, 429, { error: 'Trop de demandes. Réessayez plus tard.' }, { 'Retry-After': String(Math.ceil(FENETRE_MS / 1000)) });
    }
    // Une réponse `ok` prouve une persistance. Le honeypot s'arrête donc ici sans simuler un succès.
    if (valide.siteWeb) return repondreJson(req, res, 400, { error: 'Format de demande invalide.' });
    if (!valide.turnstileToken) return repondreJson(req, res, 400, { error: 'La vérification humaine est requise.' });

    try {
      const { reponse: verification, corps: resultat } = await demanderJsonBorne(
        demander,
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ secret: /** @type {string} */ (turnstileSecret), response: valide.turnstileToken, remoteip: ip }),
        },
      );
      if (!verification.ok || !resultat || resultat.success !== true || resultat.action !== 'actualites' ||
          resultat.hostname !== new URL(publicOrigin).hostname) {
        return repondreJson(req, res, 400, { error: 'La vérification humaine a échoué. Réessayez.' });
      }
      if (!limiterDepots.accepter()) {
        return repondreJson(req, res, 429, { error: 'Trop de demandes. Réessayez plus tard.' }, { 'Retry-After': String(Math.ceil(FENETRE_MS / 1000)) });
      }

      const insertion = await avecDelai(demander, `${supabaseUrl}/rest/v1/abonnements_actualites`, {
        method: 'POST',
        headers: {
          apikey: /** @type {string} */ (serviceRoleKey),
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          email: valide.email,
          consentement_texte: CONSENTEMENT_ACTUALITES_TEXTE,
          consentement_version: CONSENTEMENT_ACTUALITES_VERSION,
          source: SOURCE,
        }),
      });
      // L'email est la seule valeur unique fournie par cette requête : un 409 correspond à une
      // adresse déjà persistée. Le client reçoit la même réponse que lors de la première inscription.
      if (!insertion.ok && insertion.status !== 409) {
        const statut = insertion.status === 429 ? 429 : 502;
        return repondreJson(req, res, statut, {
          error: statut === 429 ? 'Trop de demandes. Réessayez plus tard.' : 'Le formulaire est momentanément indisponible.',
        });
      }
      return repondreJson(req, res, 200, { ok: true });
    } catch {
      return repondreJson(req, res, 503, { error: 'Le formulaire est momentanément indisponible.' });
    }
  }

  return {
    /** @param {string | undefined} url */
    estRoute(url) {
      try { return new URL(url ?? '/', 'http://serveur').pathname === CHEMIN; }
      catch { return false; }
    },
    repondre,
    configure,
    limiter: limiterTentatives,
    limiterDepots,
  };
}

/** @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env */
export function actualitesDepuisEnvironnement(env) {
  return creerActualites({
    supabaseUrl: env.VITE_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    turnstileSecret: env.TURNSTILE_SECRET_KEY,
    publicOrigin: env.CONTACT_ORIGIN,
    trustProxy: env.CONTACT_TRUST_PROXY === 'true',
    ipLimit: Number(env.CONTACT_RATE_IP_LIMIT),
    globalLimit: Number(env.CONTACT_RATE_GLOBAL_LIMIT),
    maxIpEntries: Number(env.CONTACT_RATE_MAX_IPS),
  });
}
