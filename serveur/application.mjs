// @ts-check
// Serveur de production du front (Railway) : sert build/client, sans dépendance.
//
// - Pages pré-rendues : build/client/<chemin>/index.html.
// - Routes non pré-rendues de l'application : repli monopage __spa-fallback.html (statut 200).
// - Adresse inconnue : même repli, statut 404 ; l'application y affiche sa page « introuvable ».
// - Fichier inconnu (chemin avec extension, ou sous /assets/) : 404 en texte brut.
//
// L'index des fichiers est construit une fois, à la création du serveur : une requête ne lit
// jamais le disque et ne peut atteindre qu'un fichier présent dans le build.
//
// Ce module ne lit pas l'environnement et n'écoute aucun port : serveur/statique.mjs s'en charge.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, relative, sep } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { appliquerBarriere, masquerUrl } from './acces.mjs';

export { accesDepuis, journaliserAbsence, masquerUrl } from './acces.mjs';

export const PORT_PAR_DEFAUT = 8080;
/** Projet Supabase actuel, si VITE_SUPABASE_URL manque à l'exécution. */
export const SUPABASE_PAR_DEFAUT = 'khwlwpzydlrfocfpvywv.supabase.co';

const REPLI = '/__spa-fallback.html';

// Routes de l'application sans pré-rendu : elles s'hydratent depuis le repli.
const ROUTES_MONOPAGE = new Set(['/noter', '/inscription', '/inscription/code', '/admin', '/admin/statistiques']);

// L'edge de Railway garde ses connexions ouvertes 60 s : le serveur doit les garder plus longtemps,
// sinon il ferme une connexion au moment où l'edge l'utilise (erreurs 502 intermittentes).
const DELAI_CONNEXION_MS = 65_000;
const DELAI_EN_TETES_MS = 66_000;

const HSTS = 'max-age=31536000';

const TYPES = /** @type {Record<string, string>} */ ({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.data': 'text/x-script; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
});
const COMPRESSIBLES = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.data', '.txt', '.xml', '.svg']);

const EN_TETES_COMMUNS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': [
    'accelerometer=()',
    'autoplay=()',
    'browsing-topics=()',
    'camera=()',
    'display-capture=()',
    'encrypted-media=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    'payment=()',
    'usb=()',
    'xr-spatial-tracking=()',
  ].join(', '),
};

// Réponses autres que les pages (scripts, styles, images, erreurs en texte) : rien à exécuter.
const CSP_RESSOURCE = "default-src 'none'; frame-ancestors 'none'";

// Saisie du code (bibliothèque input-otp, page /inscription/code) : elle ajoute une balise <style>
// VIDE, puis y insère ses règles par le CSSOM, que la CSP ne filtre pas. Seule l'empreinte de la
// chaîne vide est autorisée : aucun style en ligne qui aurait un contenu ne passe.
const EMPREINTE_STYLE_VIDE = `'sha256-${createHash('sha256').update('', 'utf8').digest('base64')}'`;

/**
 * Port d'écoute : PORT, ou 8080 s'il est absent ou vide. Une valeur invalide arrête le démarrage :
 * Number('') vaut 0, et le serveur écouterait alors sur un port pris au hasard.
 * @param {string | undefined} valeur
 * @returns {number}
 */
export function portDepuis(valeur) {
  if (valeur === undefined || valeur.trim() === '') return PORT_PAR_DEFAUT;
  const port = Number(valeur);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`PORT invalide : « ${valeur} »`);
  return port;
}

/**
 * Hôte Supabase autorisé par la CSP : celui de VITE_SUPABASE_URL (variable du service, lue à
 * l'exécution), sinon le projet actuel. Seule une adresse https est retenue.
 * @param {string | undefined} valeur
 * @returns {string}
 */
export function hoteSupabase(valeur) {
  if (!valeur) return SUPABASE_PAR_DEFAUT;
  try {
    const url = new URL(valeur);
    return url.protocol === 'https:' && url.host ? url.host : SUPABASE_PAR_DEFAUT;
  } catch {
    return SUPABASE_PAR_DEFAUT;
  }
}

/**
 * Politique d'une page : le site lui-même et le projet Supabase. Les scripts en ligne émis
 * par React Router (contexte, import des modules, restauration du défilement) sont autorisés
 * un par un par leur empreinte SHA-256, calculée sur le fichier servi. Aucun style en ligne,
 * sauf la balise <style> vide d'input-otp. La politique vaut pour toutes les pages : on arrive
 * aussi sur /inscription/code par une navigation dans l'application, depuis l'accueil.
 * @param {string[]} empreintes
 * @param {string} supabase
 */
function cspPage(empreintes, supabase) {
  return [
    "default-src 'self'",
    `script-src 'self' https://challenges.cloudflare.com ${empreintes.join(' ')}`.trim(),
    `style-src 'self' ${EMPREINTE_STYLE_VIDE}`,
    "font-src 'self'",
    `img-src 'self' data: https://${supabase}`,
    `connect-src 'self' https://${supabase} wss://${supabase} https://challenges.cloudflare.com`,
    'frame-src https://challenges.cloudflare.com',
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** @param {string} html */
function empreintesScriptsEnLigne(html) {
  const empreintes = [];
  for (const [, attributs, contenu] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/i.test(attributs)) continue;
    empreintes.push(`'sha256-${createHash('sha256').update(contenu, 'utf8').digest('base64')}'`);
  }
  return empreintes;
}

/** @param {string} chemin */
function cacheControl(chemin) {
  if (chemin.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  if (chemin.endsWith('.html') || chemin.endsWith('.data')) return 'no-cache';
  // Polices, logos, favicon : noms fixes, donc revalidés au bout d'un jour.
  return 'public, max-age=86400';
}

/**
 * @typedef {{ corps: Buffer, encodage: string | null, etag: string }} Variante
 * @typedef {{ type: string, enTetes: Record<string, string>, variantes: Variante[] }} Fichier
 */

// Fichiers et dossiers cachés exclus, sauf .well-known. Garde-fou : React Router supprime
// aujourd'hui .vite/manifest.json du build, mais un réglage de Vite pourrait le conserver.
/** @param {string} dossier @returns {string[]} */
function lister(dossier) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    if (entree.name.startsWith('.') && entree.name !== '.well-known') return [];
    const chemin = join(dossier, entree.name);
    return entree.isDirectory() ? lister(chemin) : entree.isFile() ? [chemin] : [];
  });
}

/**
 * @param {string} racine
 * @param {string} supabase
 * @returns {Map<string, Fichier>}
 */
function indexer(racine, supabase) {
  /** @type {Map<string, Fichier>} */
  const fichiers = new Map();
  for (const absolu of lister(racine)) {
    const chemin = '/' + relative(racine, absolu).split(sep).join('/');
    const extension = extname(chemin).toLowerCase();
    const corps = readFileSync(absolu);
    const empreinte = createHash('sha256').update(corps).digest('base64url').slice(0, 27);

    // Ordre de préférence : brotli, gzip, puis le fichier brut, toujours en dernier.
    /** @type {Variante[]} */
    const variantes = [];
    if (COMPRESSIBLES.has(extension) && corps.length > 1024) {
      const br = brotliCompressSync(corps, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } });
      const gz = gzipSync(corps, { level: 9 });
      if (br.length < corps.length) variantes.push({ corps: br, encodage: 'br', etag: `"${empreinte}-br"` });
      if (gz.length < corps.length) variantes.push({ corps: gz, encodage: 'gzip', etag: `"${empreinte}-gz"` });
    }
    variantes.push({ corps, encodage: null, etag: `"${empreinte}"` });

    const html = extension === '.html';
    fichiers.set(chemin, {
      type: TYPES[extension] ?? 'application/octet-stream',
      variantes,
      enTetes: {
        'Cache-Control': cacheControl(chemin),
        'Content-Security-Policy': html ? cspPage(empreintesScriptsEnLigne(corps.toString('utf8')), supabase) : CSP_RESSOURCE,
        ...(COMPRESSIBLES.has(extension) ? { Vary: 'Accept-Encoding' } : {}),
      },
    });
  }
  for (const requis of ['/index.html', REPLI]) {
    if (!fichiers.has(requis)) throw new Error(`build incomplet : ${requis} absent de ${racine}`);
  }
  return fichiers;
}

/** @param {string | undefined} entete @returns {Set<string>} */
function encodagesAcceptes(entete) {
  const acceptes = new Set();
  for (const partie of (entete ?? '').split(',')) {
    const [nom, ...parametres] = partie.trim().toLowerCase().split(';');
    const q = parametres.map((p) => p.trim()).find((p) => p.startsWith('q='));
    if (nom && !(q && Number(q.slice(2)) === 0)) acceptes.add(nom);
  }
  if (acceptes.has('*')) acceptes.add('br').add('gzip');
  return acceptes;
}

/** @param {string | undefined} entete @param {string} etag */
function correspond(entete, etag) {
  if (!entete) return false;
  return entete.split(',').some((valeur) => {
    const v = valeur.trim();
    return v === '*' || v.replace(/^W\//, '') === etag;
  });
}

/** @param {string} message @param {unknown} [erreur] */
export function journaliserErreur(message, erreur) {
  console.error(JSON.stringify({ level: 'error', timestamp: new Date().toISOString(), message, erreur: String(erreur ?? '') }));
}

/**
 * @param {Map<string, Fichier>} fichiers
 * @param {string} chemin
 * @returns {{ fichier: Fichier, statut: number, monopage: boolean } | { redirection: string } | null}
 */
function resoudre(fichiers, chemin) {
  // Barre oblique finale : redirection vers l'adresse canonique. Les segments vides sont
  // retirés, ce qui empêche une cible « //autre-site » (redirection ouverte).
  if (chemin !== '/' && chemin.endsWith('/')) return { redirection: '/' + chemin.split('/').filter(Boolean).join('/') };

  const fichier = fichiers.get(chemin) ?? fichiers.get(chemin === '/' ? '/index.html' : `${chemin}/index.html`);
  if (fichier) return { fichier, statut: 200, monopage: false };

  const repli = /** @type {Fichier} */ (fichiers.get(REPLI));
  if (ROUTES_MONOPAGE.has(chemin)) return { fichier: repli, statut: 200, monopage: true };
  // Fichier attendu (extension, ou dossier des fichiers du build) : jamais la page du repli.
  if (extname(chemin) || chemin === '/assets' || chemin.startsWith('/assets/')) return null;
  return { fichier: repli, statut: 404, monopage: true };
}

/** @param {import('node:http').IncomingMessage} req */
function enTetesHttps(req) {
  return req.headers['x-forwarded-proto'] === 'https' ? { 'Strict-Transport-Security': HSTS } : {};
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {number} statut
 * @param {string} texte
 * @param {Record<string, string>} [enTetes]
 */
function texteBrut(req, res, statut, texte, enTetes = {}) {
  res.writeHead(statut, {
    ...EN_TETES_COMMUNS,
    ...enTetesHttps(req),
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(texte)),
    'Content-Security-Policy': CSP_RESSOURCE,
    'Cache-Control': 'no-cache',
    ...enTetes,
  });
  res.end(req.method === 'HEAD' ? undefined : texte);
}

/**
 * @param {Map<string, Fichier>} fichiers
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
function repondre(fichiers, req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return texteBrut(req, res, 405, 'Méthode non autorisée\n', { Allow: 'GET, HEAD' });
  }

  let url, chemin;
  try {
    url = new URL(req.url ?? '/', 'http://serveur');
    chemin = decodeURIComponent(url.pathname);
  } catch {
    return texteBrut(req, res, 400, 'Requête invalide\n');
  }

  const resultat = resoudre(fichiers, chemin);
  if (!resultat) return texteBrut(req, res, 404, 'Introuvable\n');
  if ('redirection' in resultat) {
    return texteBrut(req, res, 301, '', { Location: encodeURI(resultat.redirection) + url.search });
  }

  const { fichier, statut, monopage } = resultat;
  const acceptes = encodagesAcceptes(req.headers['accept-encoding']);
  // Le fichier brut, en dernière position, est toujours acceptable.
  const variante = /** @type {Variante} */ (fichier.variantes.find((v) => v.encodage === null || acceptes.has(v.encodage)));

  const enTetes = {
    ...EN_TETES_COMMUNS,
    ...fichier.enTetes,
    'Content-Type': fichier.type,
    ETag: variante.etag,
    ...(variante.encodage ? { 'Content-Encoding': variante.encodage } : {}),
    ...enTetesHttps(req),
    // Pages servies par le repli (inscription, notation, adresse inconnue) : hors des moteurs de
    // recherche, même si la balise robots de la page n'est lue qu'après le JavaScript.
    ...(monopage ? { 'X-Robots-Tag': 'noindex' } : {}),
  };

  if (statut === 200 && correspond(req.headers['if-none-match'], variante.etag)) {
    res.writeHead(304, enTetes);
    return res.end();
  }

  res.writeHead(statut, { ...enTetes, 'Content-Length': String(variante.corps.length) });
  res.end(req.method === 'HEAD' ? undefined : variante.corps);
}

/**
 * Serveur HTTP du build, sans écoute. Lève une erreur si le build est illisible ou incomplet.
 * @param {{
 *   racine: string,
 *   supabase: string,
 *   supervision?: ReturnType<typeof import('./supervision.mjs').creerSupervision>
 *   planningNotation?: ReturnType<typeof import('./planning-notation.mjs').creerPlanningNotation>
 *   contact?: ReturnType<typeof import('./contact.mjs').creerContact>
 *   acces?: ReturnType<typeof import('./acces.mjs').accesDepuis>
 * }} options
 */
export function creerServeur({ racine, supabase, supervision, planningNotation, contact, acces }) {
  const fichiers = indexer(racine, supabase);
  const barriere = acces ?? null;
  const serveur = createServer((req, res) => {
    // Barrière d'accès avant toute autre logique : /sante toujours ouvert, lien `?acces=`
    // échangé contre un cookie durable, le reste refusé en 401 sans cookie valide.
    if (!appliquerBarriere(barriere, req, res)) return;
    supervision?.observerRequete(req, res);
    if (contact?.estRoute(req.url)) {
      contact.repondre(req, res).catch((erreur) => {
        journaliserErreur('échec du dépôt de contact', erreur);
        if (!res.headersSent) texteBrut(req, res, 503, 'Formulaire indisponible\n');
        else res.destroy();
      });
      return;
    }
    if (planningNotation?.estRoute(req.url)) {
      planningNotation.repondre(req, res).catch(() => {
        if (!res.headersSent) texteBrut(req, res, 503, 'Planning indisponible\n', { 'Retry-After': '5' });
        else res.destroy();
      });
      return;
    }
    if (supervision?.estRoute(req.url)) {
      supervision.repondre(req, res).catch((erreur) => {
        journaliserErreur('échec de la supervision administrateur', erreur);
        if (!res.headersSent) texteBrut(req, res, 500, 'Erreur interne\n');
        else res.destroy();
      });
      return;
    }
    try {
      repondre(fichiers, req, res);
    } catch (erreur) {
      journaliserErreur(`échec de la requête ${req.method} ${masquerUrl(req.url)}`, erreur);
      if (!res.headersSent) texteBrut(req, res, 500, 'Erreur interne\n');
      else res.destroy();
    }
  });
  serveur.keepAliveTimeout = DELAI_CONNEXION_MS;
  serveur.headersTimeout = DELAI_EN_TETES_MS;
  supervision?.attacherServeur(serveur);
  return Object.assign(serveur, { fichiers: fichiers.size });
}
