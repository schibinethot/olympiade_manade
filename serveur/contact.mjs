// @ts-check
// Dépôt des messages de contact. La clé service_role ne quitte jamais ce processus : le navigateur
// passe uniquement par /api/contact, après validation Turnstile côté serveur.

import { courrielDepuisEnvironnement } from './courriel.mjs';
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

export { ipClient } from './protections-formulaire.mjs';

const CHEMIN = '/api/contact';
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Noms historiques conservés pour les tests et les éventuels imports du serveur.
export const creerLimiteurContact = creerLimiteurFormulaire;
const creerLimiteurGlobalContact = creerLimiteurGlobalFormulaire;

/** @param {unknown} corps */
export function validerCorpsContact(corps) {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) return { valide: false, erreur: 'Format de demande invalide.' };
  const valeurs = /** @type {Record<string, unknown>} */ (corps);
  const attendus = ['prenom', 'email', 'message', 'site_web', 'turnstileToken'];
  if (Object.keys(valeurs).length !== attendus.length || Object.keys(valeurs).some((cle) => !attendus.includes(cle))) {
    return { valide: false, erreur: 'Format de demande invalide.' };
  }
  if (attendus.some((cle) => typeof valeurs[cle] !== 'string')) return { valide: false, erreur: 'Format de demande invalide.' };

  const prenom = rogner(/** @type {string} */ (valeurs.prenom));
  const email = rogner(/** @type {string} */ (valeurs.email));
  const message = rogner(/** @type {string} */ (valeurs.message));
  const siteWeb = /** @type {string} */ (valeurs.site_web);
  const turnstileToken = /** @type {string} */ (valeurs.turnstileToken);
  if (!prenom || longueur(prenom) > 60 || !email || longueur(email) > 254 || !EMAIL.test(email) || longueur(message) < 10 || longueur(message) > 2000) {
    return { valide: false, erreur: 'Les informations du formulaire sont invalides.' };
  }
  if (longueur(siteWeb) > 200 || longueur(turnstileToken) > LIMITE_JETON) return { valide: false, erreur: 'Format de demande invalide.' };
  return { valide: true, champs: { prenom, email, message }, siteWeb, turnstileToken };
}

/**
 * @typedef {{ supabaseUrl?: string | null, serviceRoleKey?: string | null, turnstileSecret?: string | null, publicOrigin?: string | null,
 *   trustProxy?: boolean, ipLimit?: number, globalLimit?: number, maxIpEntries?: number, fetchFn?: typeof fetch,
 *   now?: () => number,
 *   envoyer?: (contact: { prenom: string, email: string, message: string }) => Promise<{ echec?: boolean }> }} OptionsContact
 */

/** @param {OptionsContact} [options] */
export function creerContact(options = {}) {
  const supabaseUrl = origineSupabase(options.supabaseUrl);
  const publicOrigin = originePublique(options.publicOrigin);
  const serviceRoleKey = typeof options.serviceRoleKey === 'string' && options.serviceRoleKey.trim() ? options.serviceRoleKey : null;
  const turnstileSecret = typeof options.turnstileSecret === 'string' && options.turnstileSecret.trim() ? options.turnstileSecret : null;
  const trustProxy = options.trustProxy === true;
  const demander = options.fetchFn ?? fetch;
  const envoyer = options.envoyer ?? null;
  // Les tentatives sont limitées avant Siteverify par IP seulement. Le plafond global ne compte
  // qu'après une preuve humaine valide : des jetons vides venant de multiples IP ne le vident pas.
  const limiterTentatives = creerLimiteurContact({
    maintenant: options.now,
    parIp: entierBorne(options.ipLimit, IP_MAX_DEFAUT, 1, 100),
    global: 1_000_000,
    maxAdresses: entierBorne(options.maxIpEntries, ADRESSES_MAX_DEFAUT, 100, 100_000),
  });
  const limiterDepots = creerLimiteurGlobalContact({ maintenant: options.now, limite: entierBorne(options.globalLimit, GLOBAL_MAX_DEFAUT, 1, 1_000) });
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
    const valide = validerCorpsContact(brut);
    if (!valide.valide) return repondreJson(req, res, 400, { error: valide.erreur });
    const ip = ipClient(req, trustProxy);
    if (!limiterTentatives.accepter(ip)) {
      return repondreJson(req, res, 429, { error: 'Trop de demandes. Réessayez plus tard.' }, { 'Retry-After': String(Math.ceil(FENETRE_MS / 1000)) });
    }
    // Le piège conserve une réponse positive, sans consulter Turnstile ni la base, pour ne pas aider
    // un robot à distinguer la protection. Il compte néanmoins dans la limite anti-abus.
    if (valide.siteWeb) return repondreJson(req, res, 200, { ok: true });
    if (!valide.turnstileToken) return repondreJson(req, res, 400, { error: 'La vérification humaine est requise.' });

    try {
      const { reponse: verification, corps: resultat } = await demanderJsonBorne(demander, 'https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: /** @type {string} */ (turnstileSecret), response: valide.turnstileToken, remoteip: ip }),
      });
      if (!verification.ok || !resultat || resultat.success !== true || resultat.action !== 'contact' || resultat.hostname !== new URL(publicOrigin).hostname) {
        return repondreJson(req, res, 400, { error: 'La vérification humaine a échoué. Réessayez.' });
      }
      if (!limiterDepots.accepter()) return repondreJson(req, res, 429, { error: 'Trop de demandes. Réessayez plus tard.' }, { 'Retry-After': String(Math.ceil(FENETRE_MS / 1000)) });
      const insertion = await avecDelai(demander, `${supabaseUrl}/rest/v1/messages_contact`, {
        method: 'POST',
        headers: {
          apikey: /** @type {string} */ (serviceRoleKey), Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify(valide.champs),
      });
      if (!insertion.ok) {
        const statut = insertion.status === 429 ? 429 : 502;
        return repondreJson(req, res, statut, { error: statut === 429 ? 'Trop de demandes. Réessayez plus tard.' : 'Le formulaire est momentanément indisponible.' });
      }
      if (envoyer) {
        try {
          const courriel = await envoyer(valide.champs);
          if (courriel?.echec) {
            return repondreJson(req, res, 502, { error: 'Le message est enregistré, mais l’email n’a pas pu être envoyé. Réessayez plus tard.' });
          }
        } catch {
          return repondreJson(req, res, 502, { error: 'Le message est enregistré, mais l’email n’a pas pu être envoyé. Réessayez plus tard.' });
        }
      }
      return repondreJson(req, res, 200, { ok: true });
    } catch {
      // Échec réseau, timeout ou réponse illisible : fermeture prudente, sans détail de l'amont.
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
export function contactDepuisEnvironnement(env) {
  const courriel = courrielDepuisEnvironnement(env);
  return creerContact({
    supabaseUrl: env.VITE_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    turnstileSecret: env.TURNSTILE_SECRET_KEY,
    publicOrigin: env.CONTACT_ORIGIN,
    trustProxy: env.CONTACT_TRUST_PROXY === 'true',
    ipLimit: Number(env.CONTACT_RATE_IP_LIMIT),
    globalLimit: Number(env.CONTACT_RATE_GLOBAL_LIMIT),
    maxIpEntries: Number(env.CONTACT_RATE_MAX_IPS),
    envoyer: courriel.mode === 'off' ? undefined : (contact) => courriel.envoyer(contact),
  });
}
