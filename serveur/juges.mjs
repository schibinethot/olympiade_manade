// @ts-check
// Création d'un juge et lien personnel (CDC §4.5). Réservé à un admin AAL2.
// Le rôle ne se change pas depuis le navigateur : seule la clé service_role l'écrit.
// Sans SMTP, le lien magique est renvoyé à l'admin pour qu'il le transmette.

import { niveauAal } from './supervision.mjs';

/** @param {import('node:http').IncomingMessage} req */
function bearer(req) {
  const valeur = req.headers.authorization;
  if (typeof valeur !== 'string') return null;
  return /^Bearer ([A-Za-z0-9._~-]+)$/.exec(valeur)?.[1] ?? null;
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
  });
  res.end(req.method === 'HEAD' ? undefined : texte);
}

/** @param {string | null | undefined} valeur */
function origine(valeur) {
  if (!valeur) return null;
  try {
    const url = new URL(valeur);
    if (url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) return url.origin;
  } catch { /* ignore */ }
  return null;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * @param {{
 *   supabaseUrl?: string | null,
 *   publishableKey?: string | null,
 *   serviceRoleKey?: string | null,
 *   redirectTo?: string | null,
 *   fetchFn?: typeof fetch,
 * }} [options]
 */
export function creerJuges(options = {}) {
  const supabaseUrl = origine(options.supabaseUrl);
  const publishableKey = options.publishableKey?.trim() || null;
  const serviceRoleKey = options.serviceRoleKey?.trim() || null;
  const redirectTo = options.redirectTo ?? null;
  const demander = options.fetchFn ?? fetch;
  const configure = Boolean(supabaseUrl && publishableKey && serviceRoleKey);

  /** @param {string} chemin @param {RequestInit} init @param {string} cle */
  async function appeler(chemin, init, cle) {
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

  return {
    configure,
    /** @param {string | undefined} url */
    estRoute(url) {
      try { return new URL(url ?? '/', 'http://serveur').pathname === '/api/admin/juges'; }
      catch { return false; }
    },
    /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
    async repondre(req, res) {
      if (req.method !== 'POST') return repondreJson(req, res, 405, { error: 'methode_non_autorisee' });
      if (!configure || !supabaseUrl || !publishableKey || !serviceRoleKey) {
        return repondreJson(req, res, 503, { error: 'service_indisponible' });
      }
      const jeton = bearer(req);
      if (!jeton) return repondreJson(req, res, 401, { error: 'authentication_required' });
      const session = await demander(`${supabaseUrl}/auth/v1/user`, {
        headers: { apikey: publishableKey, Authorization: `Bearer ${jeton}` },
      });
      if (session.status === 401 || session.status === 403) return repondreJson(req, res, 401, { error: 'invalid_token' });
      if (!session.ok) return repondreJson(req, res, 503, { error: 'service_unavailable' });
      const utilisateur = await session.json().catch(() => null);
      if (!utilisateur || typeof utilisateur.id !== 'string') return repondreJson(req, res, 401, { error: 'invalid_token' });
      if (niveauAal(jeton) !== 'aal2') return repondreJson(req, res, 403, { error: 'mfa_required' });
      const profil = await demander(`${supabaseUrl}/rest/v1/profils?select=id,role&id=eq.${encodeURIComponent(utilisateur.id)}&limit=1`, {
        headers: { apikey: publishableKey, Authorization: `Bearer ${jeton}` },
      });
      if (!profil.ok) return repondreJson(req, res, 503, { error: 'service_unavailable' });
      const lignes = await profil.json().catch(() => null);
      const admin = Array.isArray(lignes) && lignes[0]?.role === 'admin' && lignes[0]?.id === utilisateur.id;
      if (!admin) return repondreJson(req, res, 403, { error: 'forbidden' });

      const brut = await new Promise((resolve, reject) => {
        /** @type {Buffer[]} */
        const morceaux = [];
        let taille = 0;
        req.on('data', (morceau) => {
          taille += morceau.length;
          if (taille > 8_192) reject(Object.assign(new Error('trop volumineux'), { statut: 413 }));
          else morceaux.push(morceau);
        });
        req.on('end', () => resolve(Buffer.concat(morceaux).toString('utf8')));
        req.on('error', reject);
      }).catch((/** @type {{statut?: number}} */ erreur) => {
        repondreJson(req, res, erreur.statut ?? 400, { error: 'format_invalide' });
        return null;
      });
      if (brut === null || res.headersSent) return;
      /** @type {unknown} */
      let corps;
      try { corps = JSON.parse(String(brut)); }
      catch { return repondreJson(req, res, 400, { error: 'format_invalide' }); }
      if (!corps || typeof corps !== 'object') return repondreJson(req, res, 400, { error: 'format_invalide' });
      const saisie = /** @type {Record<string, unknown>} */ (corps);
      const prenom = typeof saisie.prenom === 'string' ? saisie.prenom.trim() : '';
      const email = typeof saisie.email === 'string' ? saisie.email.trim().toLowerCase() : '';
      const soireeId = typeof saisie.soireeId === 'string' ? saisie.soireeId : '';
      if (!prenom || prenom.length > 60 || !EMAIL.test(email) || !/^[0-9a-f-]{36}$/i.test(soireeId)) {
        return repondreJson(req, res, 400, { error: 'champs_invalides' });
      }

      const creation = await appeler('/auth/v1/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, email_confirm: true, user_metadata: { prenom } }),
      }, serviceRoleKey);
      let jugeId = creation.ok && creation.corps && typeof creation.corps === 'object' && 'id' in creation.corps
        ? String(creation.corps.id) : null;
      // Compte déjà présent (422) : generate_link ci-dessous retrouve l'identifiant à partir de l'email.
      const lien = await appeler('/auth/v1/admin/generate_link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'magiclink', email, options: redirectTo ? { redirect_to: redirectTo } : undefined }),
      }, serviceRoleKey);
      const lienCorps = lien.ok && lien.corps && typeof lien.corps === 'object' ? /** @type {Record<string, unknown>} */ (lien.corps) : null;
      const proprietes = lienCorps?.properties && typeof lienCorps.properties === 'object' ? /** @type {Record<string, unknown>} */ (lienCorps.properties) : null;
      const utilisateurLien = lienCorps?.user && typeof lienCorps.user === 'object' ? /** @type {Record<string, unknown>} */ (lienCorps.user) : null;
      const action = typeof lienCorps?.action_link === 'string' ? lienCorps.action_link
        : typeof proprietes?.action_link === 'string' ? proprietes.action_link : null;
      const idLien = typeof lienCorps?.id === 'string' ? lienCorps.id
        : typeof utilisateurLien?.id === 'string' ? utilisateurLien.id : '';
      jugeId = jugeId || idLien || null;
      if (!jugeId) return repondreJson(req, res, 502, { error: 'creation_juge_impossible' });

      const role = await appeler(`/rest/v1/profils?id=eq.${encodeURIComponent(jugeId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ role: 'juge', prenom }),
      }, serviceRoleKey);
      if (!role.ok && role.status !== 404) return repondreJson(req, res, 502, { error: 'role_juge_impossible' });
      if (role.status === 404) {
        // Le profil est créé par le déclencheur Auth. S'il n'existe pas encore, on le pose.
        await appeler('/rest/v1/profils', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ id: jugeId, prenom, role: 'juge' }),
        }, serviceRoleKey);
      }
      const rattachement = await appeler('/rest/v1/soiree_juges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify({ soiree_id: soireeId, juge_id: jugeId }),
      }, serviceRoleKey);
      if (!rattachement.ok && rattachement.status !== 409) {
        return repondreJson(req, res, 502, { error: 'rattachement_impossible' });
      }
      return repondreJson(req, res, 200, { id: jugeId, lien: action });
    },
  };
}

/** @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env */
export function jugesDepuisEnvironnement(env) {
  return creerJuges({
    supabaseUrl: env.VITE_SUPABASE_URL,
    publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    redirectTo: env.CONTACT_ORIGIN ? `${env.CONTACT_ORIGIN.replace(/\/$/, '')}/jury` : null,
  });
}
