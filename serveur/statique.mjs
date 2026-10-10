// @ts-check
// Serveur de production du front (Railway) : sert build/client, sans dépendance.
//
// - Pages pré-rendues : build/client/<chemin>/index.html.
// - Routes non pré-rendues de l'application : repli monopage __spa-fallback.html (statut 200).
// - Adresse inconnue : même repli, statut 404 ; l'application y affiche sa page « introuvable ».
// - Fichier inconnu (chemin avec extension) : 404 en texte brut.
//
// L'index des fichiers est construit une fois au démarrage : une requête ne lit jamais le
// disque et ne peut atteindre qu'un fichier présent dans build/client.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const RACINE = fileURLToPath(new URL('../build/client/', import.meta.url));
const REPLI = '/__spa-fallback.html';
const PORT = Number(process.env.PORT ?? 8080);

// Routes de l'application sans pré-rendu : elles s'hydratent depuis le repli.
const ROUTES_MONOPAGE = new Set(['/noter', '/inscription', '/inscription/code']);

const SUPABASE = 'khwlwpzydlrfocfpvywv.supabase.co';

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
 * Politique d'une page : le site lui-même et le projet Supabase. Les scripts en ligne émis
 * par React Router (contexte, import des modules, restauration du défilement) sont autorisés
 * un par un par leur empreinte SHA-256, calculée sur le fichier servi. Aucun style en ligne,
 * sauf la balise <style> vide d'input-otp. La politique vaut pour toutes les pages : on arrive
 * aussi sur /inscription/code par une navigation dans l'application, depuis l'accueil.
 * @param {string[]} empreintes
 */
function cspPage(empreintes) {
  return [
    "default-src 'self'",
    `script-src 'self' ${empreintes.join(' ')}`.trim(),
    `style-src 'self' ${EMPREINTE_STYLE_VIDE}`,
    "font-src 'self'",
    `img-src 'self' https://${SUPABASE}`,
    `connect-src 'self' https://${SUPABASE} wss://${SUPABASE}`,
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

/** @returns {Map<string, Fichier>} */
function indexer() {
  /** @type {Map<string, Fichier>} */
  const fichiers = new Map();
  for (const absolu of lister(RACINE)) {
    const chemin = '/' + relative(RACINE, absolu).split(sep).join('/');
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
        'Content-Security-Policy': html ? cspPage(empreintesScriptsEnLigne(corps.toString('utf8'))) : CSP_RESSOURCE,
        ...(COMPRESSIBLES.has(extension) ? { Vary: 'Accept-Encoding' } : {}),
      },
    });
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
function journaliserErreur(message, erreur) {
  console.error(JSON.stringify({ level: 'error', timestamp: new Date().toISOString(), message, erreur: String(erreur ?? '') }));
}

/** @type {Map<string, Fichier>} */
let FICHIERS;
try {
  FICHIERS = indexer();
} catch (erreur) {
  journaliserErreur(`lecture de ${RACINE} impossible : lancer pnpm build avant pnpm start`, erreur);
  process.exit(1);
}
for (const requis of ['/index.html', REPLI]) {
  if (!FICHIERS.has(requis)) {
    journaliserErreur(`build incomplet : ${requis} absent de ${RACINE}`);
    process.exit(1);
  }
}

/**
 * @param {string} chemin
 * @returns {{ fichier: Fichier, statut: number } | { redirection: string } | null}
 */
function resoudre(chemin) {
  // Barre oblique finale : redirection vers l'adresse canonique. Les segments vides sont
  // retirés, ce qui empêche une cible « //autre-site » (redirection ouverte).
  if (chemin !== '/' && chemin.endsWith('/')) return { redirection: '/' + chemin.split('/').filter(Boolean).join('/') };

  const fichier = FICHIERS.get(chemin) ?? FICHIERS.get(chemin === '/' ? '/index.html' : `${chemin}/index.html`);
  if (fichier) return { fichier, statut: 200 };

  const repli = /** @type {Fichier} */ (FICHIERS.get(REPLI));
  if (ROUTES_MONOPAGE.has(chemin)) return { fichier: repli, statut: 200 };
  if (extname(chemin)) return null;
  return { fichier: repli, statut: 404 };
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} statut
 * @param {string} texte
 * @param {Record<string, string>} [enTetes]
 */
function texteBrut(res, statut, texte, enTetes = {}) {
  res.writeHead(statut, {
    ...EN_TETES_COMMUNS,
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Security-Policy': CSP_RESSOURCE,
    'Cache-Control': 'no-cache',
    ...enTetes,
  });
  res.end(texte);
}

/** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
function repondre(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return texteBrut(res, 405, 'Méthode non autorisée\n', { Allow: 'GET, HEAD' });
  }

  let url, chemin;
  try {
    url = new URL(req.url ?? '/', 'http://serveur');
    chemin = decodeURIComponent(url.pathname);
  } catch {
    return texteBrut(res, 400, 'Requête invalide\n');
  }

  const resultat = resoudre(chemin);
  if (!resultat) return texteBrut(res, 404, 'Introuvable\n');
  if ('redirection' in resultat) {
    return texteBrut(res, 301, '', { Location: encodeURI(resultat.redirection) + url.search });
  }

  const { fichier, statut } = resultat;
  const acceptes = encodagesAcceptes(req.headers['accept-encoding']);
  // Le fichier brut, en dernière position, est toujours acceptable.
  const variante = /** @type {Variante} */ (fichier.variantes.find((v) => v.encodage === null || acceptes.has(v.encodage)));

  const enTetes = {
    ...EN_TETES_COMMUNS,
    ...fichier.enTetes,
    'Content-Type': fichier.type,
    ETag: variante.etag,
    ...(variante.encodage ? { 'Content-Encoding': variante.encodage } : {}),
    ...(req.headers['x-forwarded-proto'] === 'https' ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
  };

  if (statut === 200 && correspond(req.headers['if-none-match'], variante.etag)) {
    res.writeHead(304, enTetes);
    return res.end();
  }

  res.writeHead(statut, { ...enTetes, 'Content-Length': String(variante.corps.length) });
  res.end(req.method === 'HEAD' ? undefined : variante.corps);
}

const serveur = createServer((req, res) => {
  try {
    repondre(req, res);
  } catch (erreur) {
    journaliserErreur(`échec de la requête ${req.method} ${req.url}`, erreur);
    if (!res.headersSent) texteBrut(res, 500, 'Erreur interne\n');
    else res.destroy();
  }
});

serveur.listen(PORT, () => {
  console.log(JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), message: 'serveur prêt', port: PORT, fichiers: FICHIERS.size }));
});

// Arrêt propre au redéploiement (Railway envoie SIGTERM).
for (const signal of /** @type {const} */ (['SIGTERM', 'SIGINT'])) {
  process.on(signal, () => {
    serveur.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
