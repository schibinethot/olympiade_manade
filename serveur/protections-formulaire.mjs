// @ts-check
// Protections communes aux formulaires publics servis par ce processus.

import { isIP } from 'node:net';

export const LIMITE_CORPS_OCTETS = 16_384;
export const DELAI_AMONT_MS = 5_000;
export const FENETRE_MS = 10 * 60_000;
export const IP_MAX_DEFAUT = 3;
export const GLOBAL_MAX_DEFAUT = 10;
export const ADRESSES_MAX_DEFAUT = 10_000;
export const LIMITE_JETON = 2_048;

/** @param {unknown} valeur @param {number} repli @param {number} min @param {number} max */
export function entierBorne(valeur, repli, min, max) {
  const n = Number(valeur);
  return Number.isInteger(n) && n >= min && n <= max ? n : repli;
}

/** @param {string | null | undefined} valeur */
export function origineSupabase(valeur) {
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

/** URL publique canonique : protège l'endpoint des origines tierces et lie le hostname Turnstile. @param {string | null | undefined} valeur */
export function originePublique(valeur) {
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
export function longueur(texte) {
  return Array.from(texte).length;
}

/** btrim(texte, E' \\t\\r\\n') : même règle que les contraintes PostgreSQL. @param {string} texte */
export function rogner(texte) {
  return texte.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
}

/** @param {string | undefined} valeur */
function ipValide(valeur) {
  if (!valeur) return null;
  const ip = valeur.trim().replace(/^\[(.*)\]$/, '$1');
  return isIP(ip) ? ip.toLowerCase() : null;
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {boolean} proxyDeConfiance
 */
export function ipClient(req, proxyDeConfiance) {
  if (proxyDeConfiance) {
    const xff = req.headers['x-forwarded-for'];
    const derniere = typeof xff === 'string' ? xff.split(',').at(-1) : undefined;
    const transmise = ipValide(derniere);
    if (transmise) return transmise;
  }
  return ipValide(req.socket.remoteAddress) ?? 'inconnue';
}

/** @typedef {{ debut: number, n: number }} Compteur */
/** @typedef {{ maintenant?: () => number, parIp?: number, global?: number, maxAdresses?: number }} OptionsLimiteur */

/** Limiteur à fenêtre fixe : stockage borné, sans journalisation ni persistance des IP. @param {OptionsLimiteur} [options] */
export function creerLimiteurFormulaire({ maintenant = Date.now, parIp = IP_MAX_DEFAUT, global = GLOBAL_MAX_DEFAUT, maxAdresses = ADRESSES_MAX_DEFAUT } = {}) {
  /** @type {Map<string, Compteur>} */
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

/** Plafond global de dépôts Turnstile validés : aucune adresse IP n'y est conservée. @param {{ maintenant?: () => number, limite?: number }} [options] */
export function creerLimiteurGlobalFormulaire({ maintenant = Date.now, limite = GLOBAL_MAX_DEFAUT } = {}) {
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
export function lireJson(req) {
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
    let taille = 0;
    const minuterie = setTimeout(() => finir(new Error('délai de lecture dépassé')), 5_000);
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
    /** @param {Buffer} morceau */
    function donnees(morceau) {
      taille += morceau.length;
      if (taille > LIMITE_CORPS_OCTETS) {
        req.resume();
        finir(Object.assign(new Error('corps trop volumineux'), { statut: 413 }));
      } else morceaux.push(morceau);
    }
    function terminer() {
      try { finir(null, JSON.parse(Buffer.concat(morceaux).toString('utf8'))); }
      catch { finir(Object.assign(new Error('JSON invalide'), { statut: 400 })); }
    }
    req.on('data', donnees).once('end', terminer).once('error', finir).once('aborted', abandon);
  });
}

/** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res @param {number} statut @param {Record<string, unknown>} corps @param {Record<string, string>} [plus] */
export function repondreJson(req, res, statut, corps, plus = {}) {
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
export async function avecDelai(demander, adresse, options) {
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), DELAI_AMONT_MS);
  minuterie.unref?.();
  try { return await demander(adresse, { ...options, signal: controleur.signal }); }
  finally { clearTimeout(minuterie); }
}

/** @param {typeof fetch} demander @param {string} adresse @param {RequestInit} options */
export async function demanderJsonBorne(demander, adresse, options) {
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
