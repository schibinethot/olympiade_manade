// @ts-check
// Barrière d'accès prélancement : tout le site est réservé aux ordinateurs qui ont ouvert
// une fois le lien secret `?acces=<token>`. Le serveur pose alors un cookie durable, dont
// la valeur est le HMAC-SHA256(clé = token) d'une constante fixe : le token n'apparaît
// jamais dans le cookie, et la connaissance du cookie ne révèle pas le token.
//
// - ACCES_TOKEN absent ou vide : la barrière est désactivée (dev local, tests e2e).
// - ACCES_TOKEN défini mais < 32 caractères : erreur au démarrage.
// - `/sante` est toujours servi (healthcheck Railway, sans cookie).

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NOM = 'olympiade_acces';
// Constante publique signée par HMAC-SHA256(clé = ACCES_TOKEN). Toute modification de cette
// chaîne invalide les cookies existants et oblige à repasser par le lien.
const CONSTANTE_SIGNEE = 'olympiade-acces-v1';
const COOKIE_MAX_AGE = 31_536_000; // 1 an
const LONGUEUR_MINIMALE = 32;

export const CHEMIN_SANTE = '/sante';
export const CORPS_SANTE = 'ok';

/**
 * Remplace la valeur du paramètre `acces` dans une URL (relative ou absolue) par `***`,
 * pour éviter de journaliser le token transmis par le navigateur. Chaque occurrence est
 * masquée (plusieurs `acces=` possibles via une URL mal formée).
 * @param {string | undefined} url
 * @returns {string}
 */
export function masquerUrl(url) {
  if (url === undefined) return '';
  // Capture `?acces=` ou `&acces=` et remplace la valeur jusqu'au prochain `&` ou `#`.
  // La clé elle-même ($2) est préservée pour conserver la casse du log d'origine.
  return url.replace(/([?&])(acces)=[^&#]*/gi, '$1$2=***');
}

/**
 * Journalise au démarrage l'absence d'ACCES_TOKEN (barrière désactivée). Appelé une fois
 * depuis le point d'entrée, avant l'écoute. Niveau `warn`, même format JSON que les
 * autres logs du serveur. Si la configuration existe, rien n'est journalisé.
 * @param {ReturnType<typeof accesDepuis>} config
 */
export function journaliserAbsence(config) {
  if (config) return;
  console.warn(
    JSON.stringify({
      level: 'warn',
      timestamp: new Date().toISOString(),
      message: "barrière d'accès désactivée : ACCES_TOKEN absent, site ouvert à tous",
    }),
  );
}

const EN_TETES_COMMUNS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

// Page de refus autonome : aucun script, un seul bloc <style> dont l'empreinte SHA-256
// est autorisée explicitement par la CSP ci-dessous.
const STYLE_REFUS = 'body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f8fafc;color:#0f172a;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;line-height:1.5}main{max-width:32rem;background:#ffffff;padding:2.5rem;border-radius:1rem;box-shadow:0 10px 30px rgba(15,23,42,0.08);text-align:center}h1{margin:0 0 1rem;font-size:1.5rem}p{margin:0}';

const EMPREINTE_STYLE_REFUS = createHash('sha256').update(STYLE_REFUS, 'utf8').digest('base64');

const PAGE_REFUS = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Accès réservé</title>
<style>${STYLE_REFUS}</style>
</head>
<body>
<main>
<h1>Accès réservé</h1>
<p>Ce site est en préparation. Ouvrez le lien d'accès qui vous a été transmis.</p>
</main>
</body>
</html>
`;

const CSP_REFUS = `default-src 'none'; style-src 'sha256-${EMPREINTE_STYLE_REFUS}'; base-uri 'none'; frame-ancestors 'none'`;

/**
 * Lit ACCES_TOKEN et prépare la barrière.
 * - Vide / absent : aucune barrière (retourne `null`).
 * - Trop court : lève une erreur, le serveur ne démarre pas.
 * @param {string | undefined} valeur
 * @returns {{ cookieAttendu: string, cookieAttenduBuf: Buffer, tokenBuf: Buffer } | null}
 */
export function accesDepuis(valeur) {
  if (valeur === undefined || valeur === '') return null;
  if (valeur.length < LONGUEUR_MINIMALE) {
    throw new Error(`ACCES_TOKEN trop court : ${valeur.length} caractères (minimum ${LONGUEUR_MINIMALE}).`);
  }
  const cookieAttendu = createHmac('sha256', valeur).update(CONSTANTE_SIGNEE, 'utf8').digest('hex');
  return {
    cookieAttendu,
    cookieAttenduBuf: Buffer.from(cookieAttendu, 'hex'),
    tokenBuf: Buffer.from(valeur, 'utf8'),
  };
}

/** @param {string | undefined} entete @returns {string | null} */
function lireCookie(entete) {
  if (!entete) return null;
  for (const partie of entete.split(';')) {
    const trim = partie.trim();
    const egal = trim.indexOf('=');
    if (egal <= 0) continue;
    if (trim.slice(0, egal) === COOKIE_NOM) return trim.slice(egal + 1);
  }
  return null;
}

/** Comparaison en temps constant, avec contrôle de longueur préalable. @param {Buffer} a @param {Buffer} b */
function egauxConstant(a, b) {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * @param {NonNullable<ReturnType<typeof accesDepuis>>} config
 * @param {string} candidat
 */
function tokenValide(config, candidat) {
  const buf = Buffer.from(candidat, 'utf8');
  return egauxConstant(buf, config.tokenBuf);
}

/**
 * @param {NonNullable<ReturnType<typeof accesDepuis>>} config
 * @param {string | null} candidat
 */
function cookieValide(config, candidat) {
  if (!candidat) return false;
  // Hex uniquement : évite d'alimenter timingSafeEqual avec un contenu de longueur disparate.
  if (!/^[0-9a-f]+$/.test(candidat)) return false;
  const buf = Buffer.from(candidat, 'hex');
  return egauxConstant(buf, config.cookieAttenduBuf);
}

/** @param {import('node:http').IncomingMessage} req */
function enTetesHttps(req) {
  return req.headers['x-forwarded-proto'] === 'https'
    ? { 'Strict-Transport-Security': 'max-age=31536000' }
    : {};
}

/** @param {import('node:http').IncomingMessage} req */
function estHttps(req) {
  return req.headers['x-forwarded-proto'] === 'https';
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
function repondreSante(req, res) {
  const corps = CORPS_SANTE;
  res.writeHead(200, {
    ...EN_TETES_COMMUNS,
    ...enTetesHttps(req),
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(corps)),
    'Cache-Control': 'no-store',
  });
  res.end(req.method === 'HEAD' ? undefined : corps);
}

/**
 * @param {NonNullable<ReturnType<typeof accesDepuis>>} config
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {URL} url
 */
function echangerLien(config, req, res, url) {
  // Nouvelle URL privée du paramètre `acces`, en préservant les autres.
  const propre = new URL(url.toString());
  propre.searchParams.delete('acces');
  const cibleRelative = propre.pathname + (propre.search || '') + (propre.hash || '');

  const attributs = [
    `${COOKIE_NOM}=${config.cookieAttendu}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (estHttps(req)) attributs.push('Secure');

  res.writeHead(303, {
    ...EN_TETES_COMMUNS,
    ...enTetesHttps(req),
    Location: cibleRelative,
    'Set-Cookie': attributs.join('; '),
    'Cache-Control': 'no-store',
    'Content-Length': '0',
  });
  res.end();
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
function refuserApi(req, res) {
  const corps = JSON.stringify({ error: 'Accès réservé.' });
  res.writeHead(401, {
    ...EN_TETES_COMMUNS,
    ...enTetesHttps(req),
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(corps)),
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex',
  });
  res.end(req.method === 'HEAD' ? undefined : corps);
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
function refuserPage(req, res) {
  res.writeHead(401, {
    ...EN_TETES_COMMUNS,
    ...enTetesHttps(req),
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(PAGE_REFUS)),
    'Content-Security-Policy': CSP_REFUS,
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex',
  });
  res.end(req.method === 'HEAD' ? undefined : PAGE_REFUS);
}

/**
 * Applique la barrière d'accès. Retourne `true` quand la requête peut poursuivre son
 * traitement normal, `false` quand la barrière a déjà écrit la réponse (healthcheck,
 * échange de lien, refus).
 *
 * @param {NonNullable<ReturnType<typeof accesDepuis>> | null} config
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
export function appliquerBarriere(config, req, res) {
  // Analyse d'URL : nécessaire pour /sante (toujours ouvert) et pour /api/* (format de refus).
  let url;
  try {
    url = new URL(req.url ?? '/', 'http://serveur');
  } catch {
    // URL cassée : laisser le pipeline normal répondre 400.
    return true;
  }
  const chemin = url.pathname;

  // Healthcheck toujours servi, même sans ACCES_TOKEN configuré.
  if (chemin === CHEMIN_SANTE) {
    repondreSante(req, res);
    return false;
  }

  if (!config) return true;

  // Échange du lien : param `?acces=` présent, qu'il soit valide ou non.
  const parametre = url.searchParams.get('acces');
  if (parametre !== null) {
    if (tokenValide(config, parametre)) {
      echangerLien(config, req, res, url);
      return false;
    }
    // Valeur invalide : mêmes réponses que « sans cookie », aucun indice.
    if (chemin.startsWith('/api/')) refuserApi(req, res);
    else refuserPage(req, res);
    return false;
  }

  // Vérification du cookie.
  if (cookieValide(config, lireCookie(req.headers.cookie))) return true;

  if (chemin.startsWith('/api/')) refuserApi(req, res);
  else refuserPage(req, res);
  return false;
}
