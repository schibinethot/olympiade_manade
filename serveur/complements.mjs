// @ts-check
// Routes du reste du CDC : import (brouillon seulement), notifications, compte, purge, coque.

import { niveauAal } from './supervision.mjs';
import { extrairePlanning } from './extraire-planning.mjs';
import { creerPoussoir, creerRegroupement } from './notifications.mjs';

const LIMITE_CORPS = 28 * 1024 * 1024;

/** @param {string | null | undefined} valeur */
function origine(valeur) {
  if (!valeur) return null;
  try {
    const url = new URL(valeur);
    if (url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) return url.origin;
  } catch { /* ignore */ }
  return null;
}

/** @param {import('node:http').IncomingMessage} req */
function bearer(req) {
  const valeur = req.headers.authorization;
  return typeof valeur === 'string' ? /^Bearer ([A-Za-z0-9._~-]+)$/.exec(valeur)?.[1] ?? null : null;
}

/** @param {import('node:http').IncomingMessage} req */
function lireCorps(req) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const morceaux = [];
    let taille = 0;
    req.on('data', (morceau) => {
      taille += morceau.length;
      if (taille > LIMITE_CORPS) {
        reject(Object.assign(new Error('trop gros'), { statut: 413 }));
        req.destroy();
        return;
      }
      morceaux.push(morceau);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(morceaux).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('json'), { statut: 400 })); }
    });
    req.on('error', reject);
  });
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {number} statut
 * @param {unknown} corps
 */
function repondreJson(req, res, statut, corps) {
  const texte = JSON.stringify(corps);
  res.writeHead(statut, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(texte)),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  });
  res.end(req.method === 'HEAD' ? undefined : texte);
}

/**
 * @param {{
 *   supabaseUrl?: string | null,
 *   publishableKey?: string | null,
 *   serviceRoleKey?: string | null,
 *   cleAnthropic?: string | null,
 *   modeleAnthropic?: string | null,
 *   vapidPublic?: string | null,
 *   vapidPrivate?: string | null,
 *   vapidSujet?: string | null,
 *   fetchFn?: typeof fetch,
 * }} [options]
 */
export function creerComplements(options = {}) {
  const supabaseUrl = origine(options.supabaseUrl);
  const publishableKey = options.publishableKey?.trim() || null;
  const serviceRoleKey = options.serviceRoleKey?.trim() || null;
  const demander = options.fetchFn ?? fetch;
  const poussoir = creerPoussoir({
    publicKey: options.vapidPublic ?? '',
    privateKey: options.vapidPrivate ?? '',
    sujet: options.vapidSujet ?? '',
  });
  const regroupement = creerRegroupement();
  const chemins = new Set([
    '/api/admin/import-planning',
    '/api/notifications/diffuser',
    '/api/compte',
    '/api/admin/purge-comptes',
    '/api/application',
  ]);

  /** @param {string} chemin @param {RequestInit} [init] @param {string} [cle] */
  async function appeler(chemin, init = {}, cle = serviceRoleKey ?? '') {
    const reponse = await demander(`${supabaseUrl}${chemin}`, {
      ...init,
      headers: { ...(init.headers ?? {}), apikey: cle, Authorization: `Bearer ${cle}` },
    });
    const texte = await reponse.text();
    /** @type {unknown} */
    let corps = null;
    if (texte) {
      try { corps = JSON.parse(texte); } catch { corps = null; }
    }
    return { ok: reponse.ok, status: reponse.status, corps };
  }

  /** @param {string} jeton */
  async function utilisateur(jeton) {
    if (!supabaseUrl || !publishableKey) return null;
    const session = await demander(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${jeton}` },
    });
    if (!session.ok) return null;
    const corps = await session.json().catch(() => null);
    return corps && typeof corps.id === 'string' ? corps : null;
  }

  return {
    /** @param {string | undefined} url */
    estRoute(url) {
      try { return chemins.has(new URL(url ?? '/', 'http://serveur').pathname); }
      catch { return false; }
    },
    /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
    async repondre(req, res) {
      const chemin = new URL(req.url ?? '/', 'http://serveur').pathname;
      if (chemin === '/api/application' && req.method === 'GET') {
        if (!supabaseUrl || !publishableKey) return repondreJson(req, res, 200, { ouverteAuPublic: false });
        const lecture = await appeler('/rest/v1/parametres?select=app_ouverte_au_public&limit=1', {}, publishableKey);
        const ligne = Array.isArray(lecture.corps) ? lecture.corps[0] : null;
        return repondreJson(req, res, 200, { ouverteAuPublic: Boolean(ligne?.app_ouverte_au_public) });
      }
      if (!supabaseUrl || !publishableKey || !serviceRoleKey) return repondreJson(req, res, 503, { error: 'service_indisponible' });
      const jeton = bearer(req);
      if (!jeton) return repondreJson(req, res, 401, { error: 'authentication_required' });
      const compte = await utilisateur(jeton);
      if (!compte) return repondreJson(req, res, 401, { error: 'invalid_token' });

      if (chemin === '/api/compte' && req.method === 'DELETE') {
        const profil = await appeler(`/rest/v1/profils?select=role&id=eq.${encodeURIComponent(compte.id)}&limit=1`, {}, publishableKey);
        const role = Array.isArray(profil.corps) ? profil.corps[0]?.role : null;
        if (role !== 'spectateur') return repondreJson(req, res, 403, { error: 'reserve_spectateur' });
        const suppression = await appeler(`/auth/v1/admin/users/${encodeURIComponent(compte.id)}`, { method: 'DELETE' });
        if (!suppression.ok) return repondreJson(req, res, 502, { error: 'suppression_impossible' });
        return repondreJson(req, res, 200, { ok: true });
      }

      if (niveauAal(jeton) !== 'aal2') return repondreJson(req, res, 403, { error: 'mfa_required' });
      const admin = await appeler(`/rest/v1/profils?select=role&id=eq.${encodeURIComponent(compte.id)}&limit=1`, {}, jeton);
      const roleAdmin = Array.isArray(admin.corps) ? admin.corps[0]?.role : null;
      if (roleAdmin !== 'admin') return repondreJson(req, res, 403, { error: 'interdit' });

      if (chemin === '/api/admin/purge-comptes' && req.method === 'POST') {
        const purge = await appeler('/rest/v1/rpc/purger_spectateurs_inactifs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (!purge.ok) return repondreJson(req, res, 502, { error: 'purge_impossible' });
        return repondreJson(req, res, 200, { supprimes: purge.corps ?? 0 });
      }

      if (chemin === '/api/notifications/diffuser' && req.method === 'POST') {
        const corps = /** @type {{ cle?: string, texte?: string, url?: string }} */ (await lireCorps(req));
        const texte = typeof corps.texte === 'string' ? corps.texte.slice(0, 180) : '';
        const cle = typeof corps.cle === 'string' ? corps.cle.slice(0, 80) : 'soiree';
        if (!texte) return repondreJson(req, res, 400, { error: 'texte_absent' });
        const decision = regroupement.proposer(cle, texte);
        if (!decision.envoyer) return repondreJson(req, res, 200, { regroupe: true, envoye: 0 });
        const abonnements = await appeler('/rest/v1/abonnements_push?select=endpoint,p256dh,auth_secret&actif=eq.true&limit=5000');
        const liste = Array.isArray(abonnements.corps) ? abonnements.corps : [];
        const resultat = await poussoir.diffuser(liste, { titre: decision.titre, corps: decision.corps, url: typeof corps.url === 'string' ? corps.url : '/noter' });
        return repondreJson(req, res, 200, resultat);
      }

      if (chemin === '/api/admin/import-planning' && req.method === 'POST') {
        const corps = /** @type {{ soireeId?: string, nom?: string, type?: string, contenuBase64?: string }} */ (await lireCorps(req));
        if (!corps.soireeId || !corps.nom || !corps.contenuBase64) return repondreJson(req, res, 400, { error: 'champs_absents' });
        const octets = Buffer.from(corps.contenuBase64, 'base64');
        const extraction = await extrairePlanning({
          nom: corps.nom,
          type: corps.type ?? '',
          octets,
          cleAnthropic: options.cleAnthropic ?? '',
          modele: options.modeleAnthropic ?? '',
          demander,
        });
        await appeler('/rest/v1/imports_planning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({
            soiree_id: corps.soireeId,
            nom_fichier: String(corps.nom).slice(0, 180),
            type_fichier: typeFichier(corps.nom, corps.type ?? ''),
            empreinte: extraction.empreinte || '0'.repeat(64),
            statut: extraction.erreur ? 'erreur' : 'brouillon',
            resultat: extraction.brouillon,
            erreur: extraction.erreur,
            auteur_id: compte.id,
          }),
        });
        return repondreJson(req, res, 200, { applique: false, brouillon: extraction.brouillon });
      }

      return repondreJson(req, res, 405, { error: 'methode_non_autorisee' });
    },
  };
}

/** @param {string} nom @param {string} type */
function typeFichier(nom, type) {
  const bas = nom.toLowerCase();
  if (bas.endsWith('.pdf') || type.includes('pdf')) return 'pdf';
  if (bas.endsWith('.docx') || type.includes('word')) return 'docx';
  if (bas.endsWith('.csv') || type.includes('csv')) return 'csv';
  if (bas.endsWith('.xlsx') || bas.endsWith('.xls') || type.includes('sheet') || type.includes('excel')) return 'tableur';
  return 'photo';
}

/** @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env */
export function complementsDepuisEnvironnement(env) {
  return creerComplements({
    supabaseUrl: env.VITE_SUPABASE_URL,
    publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    cleAnthropic: env.ANTHROPIC_API_KEY,
    modeleAnthropic: env.ANTHROPIC_MODEL,
    vapidPublic: env.VAPID_PUBLIC_KEY || env.VITE_VAPID_PUBLIC_KEY,
    vapidPrivate: env.VAPID_PRIVATE_KEY,
    vapidSujet: env.VAPID_SUBJECT,
  });
}
