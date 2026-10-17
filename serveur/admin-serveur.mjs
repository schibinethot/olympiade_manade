// @ts-check
// Vérification d'un admin AAL2 pour les endpoints serveur, sur le modèle de juges.mjs (inchangé) :
// le jeton est validé par /auth/v1/user, l'AAL2 lu dans le jeton validé, puis le rôle relu sous RLS.

import { niveauAal } from './supervision.mjs';

const DELAI_MS = 5_000;

/** @param {import('node:http').IncomingMessage} req */
function bearer(req) {
  const valeur = req.headers.authorization;
  if (typeof valeur !== 'string') return null;
  return /^Bearer ([A-Za-z0-9._~-]+)$/.exec(valeur)?.[1] ?? null;
}

/** @param {Response} reponse */
async function json(reponse) {
  try {
    return await reponse.json();
  } catch {
    return null;
  }
}

/**
 * @typedef {{ ok: true, id: string, email: string | null } | { ok: false, statut: number, error: string }} VerificationAdmin
 */

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {{ supabaseUrl: string | null, publishableKey: string | null, demander?: typeof fetch }} options
 * @returns {Promise<VerificationAdmin>}
 */
export async function verifierAdmin(req, { supabaseUrl, publishableKey, demander = fetch }) {
  if (!supabaseUrl || !publishableKey) return { ok: false, statut: 503, error: 'service_indisponible' };
  const jeton = bearer(req);
  if (!jeton) return { ok: false, statut: 401, error: 'authentication_required' };
  const entetes = { apikey: publishableKey, Authorization: `Bearer ${jeton}` };
  try {
    const session = await demander(`${supabaseUrl}/auth/v1/user`, { headers: entetes, signal: AbortSignal.timeout(DELAI_MS) });
    if (session.status === 401 || session.status === 403) return { ok: false, statut: 401, error: 'invalid_token' };
    if (!session.ok) return { ok: false, statut: 503, error: 'service_unavailable' };
    const utilisateur = await json(session);
    if (!utilisateur || typeof utilisateur.id !== 'string') return { ok: false, statut: 401, error: 'invalid_token' };
    // /auth/v1/user vient de valider signature et expiration : l'AAL du même jeton est fiable.
    if (niveauAal(jeton) !== 'aal2') return { ok: false, statut: 403, error: 'mfa_required' };
    const filtre = encodeURIComponent(`eq.${utilisateur.id}`);
    const profil = await demander(`${supabaseUrl}/rest/v1/profils?select=id,role&id=${filtre}&limit=1`, {
      headers: entetes,
      signal: AbortSignal.timeout(DELAI_MS),
    });
    if (!profil.ok) return { ok: false, statut: 503, error: 'service_unavailable' };
    const lignes = await json(profil);
    const admin = Array.isArray(lignes) && lignes.length === 1 && lignes[0]?.id === utilisateur.id && lignes[0]?.role === 'admin';
    if (!admin) return { ok: false, statut: 403, error: 'forbidden' };
    return { ok: true, id: utilisateur.id, email: typeof utilisateur.email === 'string' ? utilisateur.email : null };
  } catch {
    return { ok: false, statut: 503, error: 'service_unavailable' };
  }
}
