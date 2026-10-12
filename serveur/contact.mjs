// @ts-check
// Dépôt des messages de contact. La clé service_role ne quitte jamais ce processus : le navigateur
// passe uniquement par /api/contact, après validation Turnstile côté serveur.

import { isIP } from 'node:net';

const CHEMIN = '/api/contact';
const LIMITE_CORPS_OCTETS = 16_384;
const DELAI_CORPS_MS = 5_000;
const DELAI_AMONT_MS = 5_000;
const FENETRE_MS = 10 * 60_000;
const IP_MAX_DEFAUT = 3;
const GLOBAL_MAX_DEFAUT = 10;
const ADRESSES_MAX_DEFAUT = 10_000;
const LIMITE_JETON = 2_048;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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
    // Une configuration invalide ferme le formulaire ; elle n'est jamais exposée au navigateur.
  }
  return null;
}

/** URL publique canonique : elle protège l'endpoint des origines tierces et lie le hostname Turnstile. @param {string | null | undefined} valeur */
function originePublique(valeur) {
  if (!valeur) return null;
  try {
    const url = new URL(valeur);
    if ((url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) &&
        url.pathname === '/' && !url.search && !url.hash) return url.origin;
  } catch {
    // Configuration invalide : fermeture prudente du formulaire.
  }
  return null;
}

/** @param {string} texte */
function longueur(texte) {
  return Array.from(texte).length;
}

/** btrim(texte, E' \\t\\r\\n') : même règle que la contrainte PostgreSQL. @param {string} texte */
function rogner(texte) {
  return texte.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
}

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

/** @param {string | undefined} valeur */
function ipValide(valeur) {
  if (!valeur) return null;
  const ip = valeur.trim().replace(/^\[(.*)\]$/, '$1');
  return isIP(ip) ? ip.toLowerCase() : null;
}

/**
 * L'en-tête X-Forwarded-For n'est utilisé que derrière un proxy explicitement déclaré de confiance,
 * qui remplace cet en-tête. Sans cette option, l'adresse TCP est la seule information fiable.
 * @param {import('node:http').IncomingMessage} req
 * @param {boolean} proxyDeConfiance
 */
export function ipClient(req, proxyDeConfiance) {
  if (proxyDeConfiance) {
    const xff = req.headers['x-forwarded-for'];
    // Le proxy d'entrée de confiance ajoute l'adresse TCP cliente à droite : retenir ce dernier
    // maillon empêche un X-Forwarded-For ajouté par le client de choisir sa propre clé de limite.
    const derniere = typeof xff === 'string' ? xff.split(',').at(-1) : undefined;
    const transmise = ipValide(derniere);
    if (transmise) return transmise;
  }
  return ipValide(req.socket.remoteAddress) ?? 'inconnue';
}

/** @typedef {{ debut: number, n: number }} Compteur */
/** @typedef {{ maintenant?: () => number, parIp?: number, global?: number, maxAdresses?: number }} OptionsLimiteur */

/** Limiteur à fenêtre fixe : son stockage est borné, et aucun IP n'est journalisé ni persisté. @param {OptionsLimiteur} [options] */
export function creerLimiteurContact({ maintenant = Date.now, parIp = IP_MAX_DEFAUT, global = GLOBAL_MAX_DEFAUT, maxAdresses = ADRESSES_MAX_DEFAUT } = {}) {
  /** @type {Map<string, { debut: number, n: number }>} */
  const adresses = new Map();
  let total = { debut: 0, n: 0 };
  /** @param {Compteur} compteur @param {number} temps */
  function nouvelleFenetre(compteur, temps) {
    return temps - compteur.debut >= FENETRE_MS ? { debut: temps, n: 0 } : compteur;
  }
  /** @param {number} temps */
  function purger(temps) {
    for (const [ip, compteur] of adresses) if (temps - compteur.debut >= FENETRE_MS) adresses.delete(ip);
    while (adresses.size >= maxAdresses) {
      const plusAncienne = adresses.keys().next().value;
      if (plusAncienne === undefined) break;
      adresses.delete(plusAncienne);
    }
  }
  return {
    /** @param {string} ip */
    accepter(ip) {
      const temps = maintenant();
      total = nouvelleFenetre(total, temps);
      if (total.n >= global) return false;
      purger(temps);
      let compteur = adresses.get(ip) ?? { debut: temps, n: 0 };
      compteur = nouvelleFenetre(compteur, temps);
      if (compteur.n >= parIp) return false;
      compteur.n += 1;
      total.n += 1;
      adresses.set(ip, compteur);
      return true;
    },
    taille() { return adresses.size; },
  };
}

/** Plafond global de dépôts Turnstile validés : aucune adresse IP n'y est conservée. */
/** @param {{ maintenant?: () => number, limite?: number }} [options] */
export function creerLimiteurGlobalContact({ maintenant = Date.now, limite = GLOBAL_MAX_DEFAUT } = {}) {
  let compteur = { debut: 0, n: 0 };
  return {
    accepter() {
      const temps = maintenant();
      if (temps - compteur.debut >= FENETRE_MS) compteur = { debut: temps, n: 0 };
      if (compteur.n >= limite) return false;
      compteur.n += 1;
      return true;
    },
  };
}

/** @param {import('node:http').IncomingMessage} req */
function lireJson(req) {
  const enteteLongueur = req.headers['content-length'];
  const longueurAnnoncee = enteteLongueur === undefined ? null : Number(enteteLongueur);
  if (longueurAnnoncee !== null &&
      (typeof enteteLongueur !== 'string' || !/^\d+$/.test(enteteLongueur) || !Number.isSafeInteger(longueurAnnoncee) || longueurAnnoncee > LIMITE_CORPS_OCTETS)) {
    req.resume();
    return Promise.reject(Object.assign(new Error('corps trop volumineux'), { statut: 413 }));
  }
  return new Promise((resoudre, rejeter) => {
    /** @type {Buffer[]} */
    const morceaux = [];
    let longueur = 0;
    const minuterie = setTimeout(() => finir(new Error('délai de lecture dépassé')), DELAI_CORPS_MS);
    minuterie.unref?.();
    /** @param {Error | null} erreur @param {unknown} [valeur] */
    function finir(erreur, valeur) {
      clearTimeout(minuterie);
      req.off('data', donnees).off('end', terminer).off('error', finir).off('aborted', abandon);
      if (erreur) {
        req.resume();
        rejeter(erreur);
      } else resoudre(valeur);
    }
    function abandon() { finir(new Error('demande interrompue')); }
    /** @param {Buffer} donnees */
    function donnees(donnees) {
      longueur += donnees.length;
      if (longueur > LIMITE_CORPS_OCTETS) {
        req.resume();
        finir(Object.assign(new Error('corps trop volumineux'), { statut: 413 }));
      } else morceaux.push(donnees);
    }
    function terminer() {
      try { finir(null, JSON.parse(Buffer.concat(morceaux).toString('utf8'))); }
      catch { finir(Object.assign(new Error('JSON invalide'), { statut: 400 })); }
    }
    req.on('data', donnees).once('end', terminer).once('error', finir).once('aborted', abandon);
  });
}

/** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res @param {number} statut @param {Record<string, unknown>} corps @param {Record<string, string>} [plus] */
function repondreJson(req, res, statut, corps, plus = {}) {
  const texte = JSON.stringify(corps);
  res.writeHead(statut, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(texte)),
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    ...(req.headers['x-forwarded-proto'] === 'https' ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
    ...plus,
  });
  res.end(texte);
}

/** @param {typeof fetch} demander @param {string} adresse @param {RequestInit} options */
async function avecDelai(demander, adresse, options) {
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), DELAI_AMONT_MS);
  minuterie.unref?.();
  try { return await demander(adresse, { ...options, signal: controleur.signal }); }
  finally { clearTimeout(minuterie); }
}

/** La temporisation couvre aussi le corps JSON de Siteverify, qui n'est jamais supposé fiable.
 * @param {typeof fetch} demander @param {string} adresse @param {RequestInit} options */
async function demanderJsonBorne(demander, adresse, options) {
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), DELAI_AMONT_MS);
  minuterie.unref?.();
  try {
    const reponse = await demander(adresse, { ...options, signal: controleur.signal });
    const annonce = Number(reponse.headers.get('content-length'));
    if (Number.isFinite(annonce) && annonce > LIMITE_CORPS_OCTETS) throw new Error('réponse trop volumineuse');
    const texte = await reponse.text();
    if (Buffer.byteLength(texte) > LIMITE_CORPS_OCTETS) throw new Error('réponse trop volumineuse');
    return { reponse, corps: JSON.parse(texte) };
  } finally {
    clearTimeout(minuterie);
  }
}

/**
 * @typedef {{ supabaseUrl?: string | null, serviceRoleKey?: string | null, turnstileSecret?: string | null, publicOrigin?: string | null,
 *   trustProxy?: boolean, ipLimit?: number, globalLimit?: number, maxIpEntries?: number, fetchFn?: typeof fetch,
 *   now?: () => number }} OptionsContact
 */

/** @param {OptionsContact} [options] */
export function creerContact(options = {}) {
  const supabaseUrl = origineSupabase(options.supabaseUrl);
  const publicOrigin = originePublique(options.publicOrigin);
  const serviceRoleKey = typeof options.serviceRoleKey === 'string' && options.serviceRoleKey.trim() ? options.serviceRoleKey : null;
  const turnstileSecret = typeof options.turnstileSecret === 'string' && options.turnstileSecret.trim() ? options.turnstileSecret : null;
  const trustProxy = options.trustProxy === true;
  const demander = options.fetchFn ?? fetch;
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
  return creerContact({
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
