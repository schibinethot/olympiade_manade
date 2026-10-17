// @ts-check
// Liens publics signés des e-mails :
// - POST /api/emails/lien            pages publiques (decrire, confirmer, desinscrire, arreter_annonces, je_viens)
// - POST /api/emails/desinscription  désinscription en un clic des messageries (RFC 8058)
// Aucun GET ne change d'état (les messageries et antivirus ouvrent les liens). Limites : par IP pour les
// seuls refus (lien invalide, expiré ou malformé), par destinataire pour un jeton valable.

import { ipClientActualites } from './actualites.mjs';
import { UUID, enc, iso, lireCorps, objet } from './emails-rest.mjs';
import { finDeJourParis, verifierLien } from './liens-emails.mjs';
import { FENETRE_MS, LIMITE_JETON, creerLimiteurFormulaire, lireJson, repondreJson } from './protections-formulaire.mjs';

/** @typedef {import('./emails-rest.mjs').ContexteEmails} ContexteEmails */
/** @typedef {import('./emails-rest.mjs').AccesSupabase} AccesSupabase */
/** @typedef {import('./emails-rest.mjs').DestinataireLien} DestinataireLien */
/** @typedef {import('./emails-rest.mjs').Requete} Requete */
/** @typedef {import('./emails-rest.mjs').Reponse} Reponse */
/** @typedef {import('./liens-emails.mjs').ChargeLien} ChargeLien */

export const CHEMIN_LIEN = '/api/emails/lien';
export const CHEMIN_UN_CLIC = '/api/emails/desinscription';

/** Limite par IP des seuls liens refusés (invalides, expirés, malformés), par 10 minutes. */
const LIENS_INVALIDES_PAR_IP = 30;
/** Limite par destinataire des liens valables (pages et un clic), par 10 minutes. */
const LIENS_PAR_DESTINATAIRE = 20;
const LIMITE_CORPS_UN_CLIC = 4_096;

/** Types de lien acceptés par action : `decrire` lit les trois, chaque écriture le sien seulement. */
const ACTIONS = /** @type {const} */ ({
  decrire: ['confirmation', 'desinscription', 'je_viens'],
  confirmer: ['confirmation'],
  desinscrire: ['desinscription'],
  arreter_annonces: ['desinscription'],
  je_viens: ['je_viens'],
});
/** @typedef {keyof typeof ACTIONS} ActionLien */

/** RFC 8058 : le corps porte List-Unsubscribe=One-Click (formulaire encodé ou multipart). @param {string} corps */
function demandeUnClic(corps) {
  if (/(?:^|&)List-Unsubscribe=One-Click(?:&|$)/.test(corps.trim())) return true;
  return /name="?List-Unsubscribe"?/i.test(corps) && /\bOne-Click\b/.test(corps);
}

/** @param {unknown} brut @returns {{ jeton: string, action: ActionLien } | null} */
function validerLien(brut) {
  if (!objet(brut)) return null;
  const cles = Object.keys(brut);
  if (cles.length !== 2 || !cles.includes('jeton') || !cles.includes('action')) return null;
  const { jeton, action } = brut;
  if (typeof jeton !== 'string' || jeton.length > LIMITE_JETON) return null;
  if (typeof action !== 'string' || !Object.hasOwn(ACTIONS, action)) return null;
  return { jeton, action: /** @type {ActionLien} */ (action) };
}

/** @param {ContexteEmails} ctx @param {AccesSupabase} acces */
export function creerLiensPublics(ctx, acces) {
  const { configure, origine, cleLiens, maintenant, trustRailwayProxy } = ctx;
  const { rest, lireDestinataire } = acces;
  const limiteurIp = creerLimiteurFormulaire({ maintenant, parIp: LIENS_INVALIDES_PAR_IP, global: 1_000_000 });
  const limiteurDestinataires = creerLimiteurFormulaire({ maintenant, parIp: LIENS_PAR_DESTINATAIRE, global: 1_000_000 });

  /**
   * @param {string} jeton
   * @param {readonly ChargeLien['t'][]} types
   * @param {number} instant
   * @returns {ChargeLien | 'expire' | null}
   */
  function verifierJeton(jeton, types, instant) {
    if (!cleLiens) return null;
    for (const type of types) {
      const charge = verifierLien(cleLiens, jeton, instant, type);
      if (charge) {
        if (!UUID.test(charge.d) || (charge.t === 'je_viens' && !UUID.test(String(charge.c)))) return null;
        return charge;
      }
    }
    // Signature valable mais échéance passée : lien expiré (410), pas invalide.
    for (const type of types) if (verifierLien(cleLiens, jeton, 0, type)) return 'expire';
    return null;
  }

  /** @param {ChargeLien['t']} type @param {DestinataireLien} d */
  function etatDe(type, d) {
    return { type, abonne: d.abonne === true, annonces: d.annonces === true, desinscrit: d.desinscrit_le !== null };
  }

  /** Date d'un lien « Je viens », encore confirmée et à la même date qu'à la signature. @param {ChargeLien} charge */
  async function dateJeViens(charge) {
    const lignes = await rest(`/rest/v1/calendrier?select=id,nom,ville,date_soiree,statut&id=eq.${enc(String(charge.c))}&limit=1`);
    const date = Array.isArray(lignes) ? lignes[0] : null;
    if (!date || date.statut !== 'confirmee') return null;
    try {
      return finDeJourParis(date.date_soiree) === charge.e ? date : null;
    } catch {
      return null;
    }
  }

  /** @param {ChargeLien} charge @returns {Promise<{ statut: number } | { etat: unknown }>} */
  async function decrire(charge) {
    const d = await lireDestinataire(charge.d);
    if (charge.t === 'desinscription') {
      // Plus aucune ligne : plus aucun e-mail.
      return { etat: d ? etatDe('desinscription', d) : { type: 'desinscription', abonne: false, annonces: false, desinscrit: true } };
    }
    if (charge.t === 'confirmation') return d ? { etat: etatDe('confirmation', d) } : { statut: 410 };
    const date = await dateJeViens(charge);
    if (!d || !date || d.desinscrit_le !== null || d.confirme_le === null) return { statut: 410 };
    return { etat: { ...etatDe('je_viens', d), date: { nom: date.nom, ville: date.ville, date: date.date_soiree } } };
  }

  /** Clic de confirmation : un seul PATCH, le déclencheur de la base applique tous les effets. @param {string} id @param {number} instant */
  async function confirmer(id, instant) {
    const lignes = await rest(`/rest/v1/destinataires_emails?id=eq.${enc(id)}&abonnement_a_confirmer=is.true&select=id,abonnement_a_confirmer`, {
      methode: 'PATCH',
      corps: { abonnement_confirme_le: iso(instant) },
      prefer: 'return=representation',
    });
    return Array.isArray(lignes) && lignes.some((ligne) => ligne.abonnement_a_confirmer === false) ? 'fait' : 'deja_fait';
  }

  /**
   * « Tout arrêter » : d'abord desinscrit_le et annonces (la ligne devient liste d'opposition), PUIS la
   * suppression de l'abonnement. Dans l'ordre inverse, le déclencheur de retrait effacerait la ligne.
   * @param {string} id @param {number} instant
   */
  async function desinscrire(id, instant) {
    const d = await lireDestinataire(id);
    if (!d) return 'deja_fait';
    const deja = d.desinscrit_le !== null;
    if (!deja) {
      await rest(`/rest/v1/destinataires_emails?id=eq.${enc(id)}&desinscrit_le=is.null`, {
        methode: 'PATCH',
        corps: { desinscrit_le: iso(instant), annonces: false },
        prefer: 'return=minimal',
      });
    }
    if (d.abonne) await rest(`/rest/v1/abonnements_actualites?email=eq.${enc(d.email)}`, { methode: 'DELETE', prefer: 'return=minimal' });
    return deja && !d.abonne ? 'deja_fait' : 'fait';
  }

  /** Arrête seulement les annonces : l'abonnement (et les rappels de date) restent. @param {string} id */
  async function arreterAnnonces(id) {
    const lignes = await rest(`/rest/v1/destinataires_emails?id=eq.${enc(id)}&annonces=is.true&select=id`, {
      methode: 'PATCH',
      corps: { annonces: false },
      prefer: 'return=representation',
    });
    return Array.isArray(lignes) && lignes.length > 0 ? 'fait' : 'deja_fait';
  }

  /** @param {ChargeLien} charge @returns {Promise<{ statut: number } | { etat: unknown }>} */
  async function jeViens(charge) {
    const d = await lireDestinataire(charge.d);
    const date = d ? await dateJeViens(charge) : null;
    if (!d || !date || d.desinscrit_le !== null || d.confirme_le === null) return { statut: 410 };
    const lignes = await rest('/rest/v1/rattachements_emails?on_conflict=destinataire_id,calendrier_id&select=destinataire_id', {
      methode: 'POST',
      corps: { destinataire_id: d.id, calendrier_id: date.id, origine: 'je_viens' },
      prefer: 'resolution=ignore-duplicates,return=representation',
    });
    return { etat: Array.isArray(lignes) && lignes.length > 0 ? 'fait' : 'deja_fait' };
  }

  /** @param {Requete} req @param {Reponse} res */
  function tropDeDemandes(req, res) {
    return repondreJson(req, res, 429, { error: 'Trop de demandes. Réessayez plus tard.' }, { 'Retry-After': String(Math.ceil(FENETRE_MS / 1000)) });
  }

  /**
   * Refus d'un lien invalide, expiré ou malformé : seuls ces refus comptent dans la limite par IP. Un jeton
   * valable n'y est jamais compté (réseau partagé, IP des messageries).
   * @param {Requete} req @param {Reponse} res @param {string} ip @param {number} statut @param {string} message
   */
  function refuserLien(req, res, ip, statut, message) {
    if (!limiteurIp.accepter(ip)) return tropDeDemandes(req, res);
    return repondreJson(req, res, statut, { error: message });
  }

  /** @param {Requete} req @param {Reponse} res */
  async function repondreLien(req, res) {
    if (req.method !== 'POST') return repondreJson(req, res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'POST' });
    if (!configure) return repondreJson(req, res, 503, { error: 'Service momentanément indisponible.' });
    // L'Origin d'abord : une requête d'un autre site ne consomme aucune limite.
    if (req.headers.origin !== origine) {
      req.resume();
      return repondreJson(req, res, 403, { error: 'Origine de demande non autorisée.' });
    }
    if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type'] ?? ''))) {
      req.resume();
      return repondreJson(req, res, 415, { error: 'Format de demande non pris en charge.' });
    }
    const ip = ipClientActualites(req, trustRailwayProxy);
    let brut;
    try { brut = await lireJson(req); }
    catch (erreur) {
      const statut = /** @type {{ statut?: number }} */ (erreur).statut ?? 400;
      return refuserLien(req, res, ip, statut, statut === 413 ? 'La demande est trop volumineuse.' : 'Format de demande invalide.');
    }
    const demande = validerLien(brut);
    if (!demande) return refuserLien(req, res, ip, 400, 'Format de demande invalide.');
    const instant = maintenant();
    const charge = verifierJeton(demande.jeton, ACTIONS[demande.action], instant);
    if (charge === 'expire') return refuserLien(req, res, ip, 410, 'Ce lien a expiré.');
    if (!charge) return refuserLien(req, res, ip, 400, 'Ce lien n’est pas valide.');
    if (!limiteurDestinataires.accepter(charge.d)) return tropDeDemandes(req, res);

    /** @type {{ statut: number } | { etat: unknown }} */
    let resultat;
    if (demande.action === 'decrire') resultat = await decrire(charge);
    else if (demande.action === 'confirmer') resultat = { etat: await confirmer(charge.d, instant) };
    else if (demande.action === 'desinscrire') resultat = { etat: await desinscrire(charge.d, instant) };
    else if (demande.action === 'arreter_annonces') resultat = { etat: await arreterAnnonces(charge.d) };
    else resultat = await jeViens(charge);
    if ('statut' in resultat) return repondreJson(req, res, resultat.statut, { error: 'Ce lien a expiré.' });
    return repondreJson(req, res, 200, { ok: true, etat: resultat.etat });
  }

  /**
   * Désinscription en un clic : appelée par les messageries, sans Origin, depuis leurs propres IP. Même
   * règle de limite que les pages : par IP pour les refus, par destinataire pour un jeton valable.
   * @param {Requete} req @param {Reponse} res
   */
  async function repondreUnClic(req, res) {
    if (req.method !== 'POST') return repondreJson(req, res, 405, { error: 'Méthode non autorisée.' }, { Allow: 'POST' });
    if (!configure) return repondreJson(req, res, 503, { error: 'Service momentanément indisponible.' });
    const ip = ipClientActualites(req, trustRailwayProxy);
    const jeton = new URL(req.url ?? '/', 'http://serveur').searchParams.get('j') ?? '';
    const charge = verifierJeton(jeton, ['desinscription'], maintenant());
    if (!charge || charge === 'expire') {
      req.resume();
      return refuserLien(req, res, ip, 400, 'Ce lien n’est pas valide.');
    }
    if (!limiteurDestinataires.accepter(charge.d)) {
      req.resume();
      return tropDeDemandes(req, res);
    }
    let corps;
    try { corps = await lireCorps(req, LIMITE_CORPS_UN_CLIC); }
    catch (erreur) {
      return refuserLien(req, res, ip, /** @type {{ statut?: number }} */ (erreur).statut ?? 400, 'Format de demande invalide.');
    }
    if (!demandeUnClic(corps)) return refuserLien(req, res, ip, 400, 'Format de demande invalide.');
    await desinscrire(charge.d, maintenant());
    return repondreJson(req, res, 200, { ok: true });
  }

  return { repondreLien, repondreUnClic };
}
