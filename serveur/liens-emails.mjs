// @ts-check
// Liens signés des e-mails (confirmation, désinscription, « je viens »).
// Jeton : base64url(JSON).base64url(HMAC-SHA256). Serveur uniquement (node:crypto).
// Aucun GET ne change d’état : le jeton ne fait que désigner l’action à confirmer.

import { createHmac, timingSafeEqual } from 'node:crypto';

const FUSEAU = 'Europe/Paris';
const JOUR_MS = 86_400_000;
const VALIDITE_CONFIRMATION_MS = 7 * JOUR_MS;

const HORLOGE_PARIS = new Intl.DateTimeFormat('en-GB', {
  timeZone: FUSEAU, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

/**
 * @typedef {{ t: 'confirmation' | 'desinscription' | 'je_viens', d: string, c?: string, e?: number }} ChargeLien
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
  if (!cle) throw new Error('Clé de liens absente.');
  const corps = Buffer.from(JSON.stringify(charge), 'utf8').toString('base64url');
  return `${corps}.${signature(cle, corps).toString('base64url')}`;
}

/**
 * @param {string | undefined} cle
 * @param {string | undefined} jeton
 * @param {number} [maintenant]
 * @returns {ChargeLien | null}
 */
export function verifierLien(cle, jeton, maintenant = Date.now()) {
  if (!cle || typeof jeton !== 'string') return null;
  const morceaux = jeton.split('.');
  if (morceaux.length !== 2 || !morceaux[0] || !morceaux[1]) return null;
  const [corps, recue] = morceaux;
  const attendue = signature(cle, corps);
  const fournie = Buffer.from(recue, 'base64url');
  if (fournie.length !== attendue.length || !timingSafeEqual(fournie, attendue)) return null;
  try {
    const charge = JSON.parse(Buffer.from(corps, 'base64url').toString('utf8'));
    if (!charge || typeof charge !== 'object' || typeof charge.t !== 'string' || typeof charge.d !== 'string') return null;
    if (charge.e !== undefined && (typeof charge.e !== 'number' || !(maintenant <= charge.e))) return null;
    return charge;
  } catch {
    return null;
  }
}

/**
 * Instant (ms) où l’horloge de Paris affiche le jour et l’heure donnés, juste aux changements d’heure.
 * @param {number} annee
 * @param {number} mois 1-12
 * @param {number} jour
 * @param {number} heures
 * @param {number} minutes
 */
function instantParis(annee, mois, jour, heures, minutes) {
  const voulu = `${annee}-${mois}-${jour} ${heures}:${minutes}`;
  const naif = Date.UTC(annee, mois - 1, jour, heures, minutes);
  for (const decalageHeures of [1, 2]) {
    const instant = naif - decalageHeures * 3_600_000;
    const p = Object.fromEntries(HORLOGE_PARIS.formatToParts(instant).map((x) => [x.type, Number(x.value)]));
    if (`${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}` === voulu) return instant;
  }
  throw new RangeError('Heure de Paris introuvable.');
}

/**
 * Dernière milliseconde du jour (heure de Paris) de « AAAA-MM-JJ ».
 * @param {string} dateIso
 */
function finDeJourParis(dateIso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  if (!m) throw new RangeError(`Date invalide : ${dateIso}`);
  const lendemain = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  return instantParis(lendemain.getUTCFullYear(), lendemain.getUTCMonth() + 1, lendemain.getUTCDate(), 0, 0) - 1;
}

/**
 * @param {{ origine: string, cle: string, destinataireId: string, maintenant?: number }} options
 */
export function liensPour({ origine, cle, destinataireId, maintenant = Date.now() }) {
  const base = origine.replace(/\/+$/, '');
  /** @param {string} chemin @param {ChargeLien} charge */
  const lien = (chemin, charge) => `${base}${chemin}?j=${signerLien(cle, charge)}`;
  const desinscription = { t: /** @type {const} */ ('desinscription'), d: destinataireId };
  return {
    desinscription: lien('/emails/desinscription', desinscription),
    desinscriptionUnClic: lien('/api/emails/desinscription', desinscription),
    confirmation: lien('/emails/confirmation', { t: 'confirmation', d: destinataireId, e: maintenant + VALIDITE_CONFIRMATION_MS }),
    /** @param {string} calendrierId @param {string} dateSoiree « AAAA-MM-JJ » */
    jeViens: (calendrierId, dateSoiree) => lien('/emails/je-viens', { t: 'je_viens', d: destinataireId, c: calendrierId, e: finDeJourParis(dateSoiree) }),
  };
}
