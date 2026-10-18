// @ts-check
// Liens signés des e-mails (confirmation, désinscription, « je viens »).
// Jeton : base64url(JSON).base64url(HMAC-SHA256). Serveur uniquement (node:crypto).
// Aucun GET ne change d’état : le jeton ne fait que désigner l’action à confirmer.
//
// Les pages reçoivent le jeton dans le fragment (`#j=`) : un fragment ne part ni dans les journaux du serveur ni
// dans l’en-tête Referer (sécurité M6). Seul le POST en un clic des messageries (RFC 8058) garde `?j=`.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { finDeJourParis } from './fuseau-paris.mjs';

export { finDeJourParis };

const JOUR_MS = 86_400_000;
const VALIDITE_CONFIRMATION_MS = 7 * JOUR_MS;

/**
 * `n` (confirmation) : identifiant de la ligne d'envoi de cette demande ; le lien meurt avec elle (nouvelle
 * demande, renvoi, purge). `c` et `e` (« je viens ») : la date et la fin de son jour.
 * @typedef {{ t: 'confirmation' | 'desinscription' | 'je_viens', d: string, c?: string, e?: number, n?: string }} ChargeLien
 */

/**
 * @param {string} cle
 * @param {string} corps
 */
function signature(cle, corps) {
  return createHmac('sha256', cle).update(corps).digest();
}

/**
 * @param {string} cle clé secrète (hexadécimale, 64 caractères attendus)
 * @param {ChargeLien} charge
 * @returns {string}
 */
export function signerLien(cle, charge) {
  if (!cleLiensValide(cle)) throw new Error('Clé de liens invalide (64 caractères hexadécimaux attendus).');
  const corps = Buffer.from(JSON.stringify(charge), 'utf8').toString('base64url');
  return `${corps}.${signature(cle, corps).toString('base64url')}`;
}

/**
 * Clé de liens exploitable : 64 caractères hexadécimaux. Le serveur répond 503 sinon.
 * @param {unknown} cle
 * @returns {cle is string}
 */
export function cleLiensValide(cle) {
  return typeof cle === 'string' && /^[0-9a-f]{64}$/i.test(cle);
}

const TYPES = Object.freeze({ confirmation: true, desinscription: true, je_viens: true });
const FORME_JETON = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;

/**
 * @param {string | undefined} cle
 * @param {string | undefined} jeton
 * @param {number} [maintenant]
 * @param {ChargeLien['t']} [typeAttendu] type exigé ; le serveur le passe toujours
 * @returns {ChargeLien | null}
 */
export function verifierLien(cle, jeton, maintenant = Date.now(), typeAttendu) {
  if (!cleLiensValide(cle) || typeof jeton !== 'string' || !FORME_JETON.test(jeton)) return null;
  const [corps, recue] = jeton.split('.');
  // Comparaison en texte base64url canonique : refuse toute variante du dernier caractère.
  const attendue = Buffer.from(signature(cle, corps).toString('base64url'), 'utf8');
  const fournie = Buffer.from(recue, 'utf8');
  if (fournie.length !== attendue.length || !timingSafeEqual(fournie, attendue)) return null;
  try {
    const charge = JSON.parse(Buffer.from(corps, 'base64url').toString('utf8'));
    if (!charge || typeof charge !== 'object' || typeof charge.d !== 'string') return null;
    if (typeof charge.t !== 'string' || !Object.hasOwn(TYPES, charge.t)) return null;
    if (typeAttendu !== undefined && charge.t !== typeAttendu) return null;
    if (charge.t === 'je_viens' && (typeof charge.c !== 'string' || typeof charge.e !== 'number')) return null;
    if (charge.t === 'confirmation' && typeof charge.n !== 'string') return null;
    if (charge.e !== undefined && (typeof charge.e !== 'number' || !(maintenant <= charge.e))) return null;
    return charge;
  } catch {
    return null;
  }
}

/**
 * @param {{ origine: string, cle: string, destinataireId: string, maintenant?: number }} options
 */
export function liensPour({ origine, cle, destinataireId, maintenant = Date.now() }) {
  const base = origine.replace(/\/+$/, '');
  /** Page publique : jeton dans le fragment. @param {string} chemin @param {ChargeLien} charge */
  const page = (chemin, charge) => `${base}${chemin}#j=${signerLien(cle, charge)}`;
  const desinscription = { t: /** @type {const} */ ('desinscription'), d: destinataireId };
  return {
    desinscription: page('/emails/desinscription', desinscription),
    // POST en un clic des messageries : elles n'envoient que l'URL, le jeton reste donc dans la requête.
    desinscriptionUnClic: `${base}/api/emails/desinscription?j=${signerLien(cle, desinscription)}`,
    /** @param {string} envoiId ligne d'envoi de cette demande de confirmation */
    confirmation: (envoiId) => page('/emails/confirmation', {
      t: 'confirmation', d: destinataireId, n: envoiId, e: maintenant + VALIDITE_CONFIRMATION_MS,
    }),
    /** @param {string} calendrierId @param {string} dateSoiree « AAAA-MM-JJ » */
    jeViens: (calendrierId, dateSoiree) => page('/emails/je-viens', { t: 'je_viens', d: destinataireId, c: calendrierId, e: finDeJourParis(dateSoiree) }),
  };
}
