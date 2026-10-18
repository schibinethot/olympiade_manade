// @ts-check
// Séquence d'e-mails : types partagés, constantes, utilitaires et accès PostgREST en service_role.
// Aucun corps ni détail d'une réponse PostgREST en erreur n'est journalisé (les 23505 contiennent
// l'adresse) : seuls le statut HTTP et le code.

import { heureParis } from './fuseau-paris.mjs';

export { heureParis };

/** @typedef {import('./gabarits-emails.mjs').Etape} Etape */
/** @typedef {import('./gabarits-emails.mjs').DateEnrichie} DateEnrichie */
/** @typedef {import('node:http').IncomingMessage} Requete */
/** @typedef {import('node:http').ServerResponse} Reponse */

/**
 * Transport : l'objet de emailsDepuisEnvironnement (courriel.mjs). `manques` : ce qui manque en mode smtp
 * (« smtp_incomplet », « expediteur »). `definitif` : refus permanent du serveur SMTP (5xx), sans nouvel essai.
 * @typedef {{
 *   mode: string,
 *   pret: boolean,
 *   manques?: string[],
 *   envoyer: (email: { to: string, subject: string, text: string, html?: string, headers?: Record<string, string>, etape?: string }) =>
 *     Promise<{ mode: string, envoye: boolean, echec: boolean, definitif?: boolean }>,
 * }} Poste
 */

/**
 * Réglages résolus de creerEmails, partagés par les modules de la séquence.
 * @typedef {{
 *   supabaseUrl: string | null,
 *   publishableKey: string | null,
 *   serviceRoleKey: string | null,
 *   origine: string | null,
 *   cleLiens: string | null,
 *   poste: Poste,
 *   mode: 'off' | 'log' | 'smtp',
 *   reel: boolean,
 *   debit: number,
 *   demander: typeof fetch,
 *   maintenant: () => number,
 *   timers: boolean,
 *   trustRailwayProxy: boolean,
 *   railway: boolean,
 *   barriereActive: boolean,
 *   journal: (ligne: Record<string, unknown>) => void,
 *   attendre: (ms: number) => Promise<void>,
 *   serveurPret: boolean,
 *   configure: boolean,
 *   smtpSuspendu: boolean,
 *   actif: boolean,
 *   raisonsInactif: string[],
 * }} ContexteEmails
 */

/**
 * Bilan d'un passage. `liberes` : lignes réservées pour une échéance qui a changé (date déplacée), supprimées
 * pour que la nouvelle échéance se réserve.
 * @typedef {{ reserves: number, envoyes: number, simules: number, echecs: number, sautes: number, liberes: number }} Bilan
 */

/**
 * Destinataire embarqué dans une ligne d'envoi lue par le planificateur (ou relu après la réclamation).
 * @typedef {{
 *   id: string, email: string, prenom: string | null, annonces: boolean, abonnement_a_confirmer: boolean,
 *   confirme_le: string | null, desinscrit_le: string | null,
 * }} DestinataireEnvoi
 */

/**
 * @typedef {{
 *   id: string, destinataire_id: string, etape: Etape, calendrier_id: string | null, message_id: string | null,
 *   raison: string | null, tentatives: number, prevu_le: string, envoye_le: string | null,
 *   destinataires_emails: DestinataireEnvoi | null,
 * }} LigneEnvoi
 */

/**
 * @typedef {{
 *   id: string, email: string, abonne: boolean, annonces: boolean, abonnement_a_confirmer: boolean,
 *   confirme_le: string | null, desinscrit_le: string | null,
 * }} DestinataireLien
 */

export const MINUTE_MS = 60_000;
export const HEURE_MS = 60 * MINUTE_MS;
export const JOUR_MS = 24 * HEURE_MS;
export const LOT_LECTURE = 500;
export const LOT_IDS = 50;
const LOT_INSERTION = 500;
/** Réponse de emails_a_traiter : 1,3 Mo mesurés pour 5 000 personnes suivant la même date (rapport de la vague finale). */
export const LIMITE_RPC_OCTETS = 16 * 1024 * 1024;
const LIMITE_REST_OCTETS = 8 * 1024 * 1024;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONFLIT_ENVOIS = 'destinataire_id,etape,calendrier_id,message_id,reel';
const SELECT_DATE = 'id,nom,ville,arenes,date_soiree,heure,statut,lien_billetterie,infos_pratiques';
const SELECT_DESTINATAIRE = 'id,email,abonne,annonces,abonnement_a_confirmer,confirme_le,desinscrit_le';
export const SELECT_DESTINATAIRE_ENVOI = 'id,email,prenom,annonces,abonnement_a_confirmer,confirme_le,desinscrit_le';
export const SELECT_ENVOI = `id,destinataire_id,etape,calendrier_id,message_id,raison,tentatives,prevu_le,envoye_le,destinataires_emails(${SELECT_DESTINATAIRE_ENVOI})`;

export const iso = (/** @type {number} */ ms) => new Date(ms).toISOString();
export const enc = encodeURIComponent;

/** @template T @param {readonly T[]} liste @param {number} taille @returns {T[][]} */
export function tranches(liste, taille) {
  /** @type {T[][]} */
  const resultat = [];
  for (let i = 0; i < liste.length; i += taille) resultat.push(liste.slice(i, i + taille));
  return resultat;
}

/** @param {unknown} valeur @returns {valeur is Record<string, unknown>} */
export function objet(valeur) {
  return !!valeur && typeof valeur === 'object' && !Array.isArray(valeur);
}

/** @param {unknown} valeur */
export function texte(valeur) {
  return typeof valeur === 'string' ? valeur.trim() : '';
}

/** Erreur PostgREST réduite au statut HTTP et au code : jamais le corps (les 23505 contiennent l'adresse). */
class ErreurRest extends Error {
  /** @param {number} statut @param {string | null} code */
  constructor(statut, code) {
    super(`HTTP ${statut}${code ? ` ${code}` : ''}`);
    this.name = 'ErreurRest';
    this.statut = statut;
    this.code = code;
  }
}

/** @param {string} corps */
function codeErreur(corps) {
  try {
    const code = JSON.parse(corps)?.code;
    return typeof code === 'string' && /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(code) ? code : null;
  } catch {
    return null;
  }
}

/** @param {Response} reponse @param {number} max */
async function texteBorne(reponse, max) {
  const annonce = Number(reponse.headers.get('content-length'));
  if (Number.isFinite(annonce) && annonce > max) throw new Error('réponse trop volumineuse');
  const corps = await reponse.text();
  if (Buffer.byteLength(corps) > max) throw new Error('réponse trop volumineuse');
  return corps;
}

/** Corps brut d'une requête, borné en taille et en durée. @param {Requete} req @param {number} max @returns {Promise<string>} */
export function lireCorps(req, max) {
  return new Promise((resoudre, rejeter) => {
    /** @type {Buffer[]} */
    const morceaux = [];
    let taille = 0;
    const minuterie = setTimeout(() => finir(new Error('délai de lecture dépassé')), 5_000);
    minuterie.unref?.();
    /** @param {Error | null} erreur */
    function finir(erreur) {
      clearTimeout(minuterie);
      req.off('data', donnees).off('end', terminer).off('error', finir);
      if (erreur) {
        req.resume();
        rejeter(erreur);
      } else resoudre(Buffer.concat(morceaux).toString('utf8'));
    }
    /** @param {Buffer} morceau */
    function donnees(morceau) {
      taille += morceau.length;
      if (taille > max) finir(Object.assign(new Error('corps trop volumineux'), { statut: 413 }));
      else morceaux.push(morceau);
    }
    function terminer() { finir(null); }
    req.on('data', donnees).once('end', terminer).once('error', finir);
  });
}

/** Ligne `calendrier` (et soirée embarquée) vers la forme DateEnrichie de la RPC. @param {Record<string, any>} ligne @param {string | null} vainqueur @returns {DateEnrichie} */
function dateDepuisLigne(ligne, vainqueur) {
  const soiree = objet(ligne.soirees) ? /** @type {Record<string, any>} */ (ligne.soirees) : null;
  const manades = Array.isArray(soiree?.soiree_manades)
    ? [...soiree.soiree_manades]
      .sort((a, b) => Number(a?.ordre ?? 0) - Number(b?.ordre ?? 0))
      .map((m) => m?.manades?.nom)
      .filter((nom) => typeof nom === 'string')
    : [];
  return {
    id: ligne.id,
    nom: ligne.nom,
    ville: ligne.ville,
    arenes: ligne.arenes ?? null,
    date_soiree: ligne.date_soiree,
    heure: ligne.heure ?? null,
    statut: ligne.statut,
    lien_billetterie: ligne.lien_billetterie ?? null,
    infos_pratiques: ligne.infos_pratiques ?? null,
    soiree: soiree ? { slug: soiree.slug, statut: soiree.statut } : null,
    manades,
    vainqueur,
  };
}

/**
 * Accès PostgREST en service_role et lectures partagées par les liens, l'admin et le planificateur.
 * @param {ContexteEmails} ctx
 */
export function creerAccesSupabase(ctx) {
  const { supabaseUrl, serviceRoleKey, demander, journal } = ctx;

  /** @param {string} message @param {unknown} erreur @param {Record<string, unknown>} [plus] */
  function signaler(message, erreur, plus = {}) {
    journal({
      level: 'error',
      timestamp: iso(Date.now()),
      message,
      ...plus,
      ...(erreur instanceof ErreurRest ? { statut: erreur.statut, code: erreur.code } : { erreur: erreur instanceof Error ? erreur.name : 'inconnue' }),
    });
  }

  /**
   * Appel PostgREST en service_role, avec la taille de la réponse (journal de la RPC).
   * @param {string} chemin
   * @param {{ methode?: string, corps?: unknown, prefer?: string, delai?: number, max?: number }} [o]
   * @returns {Promise<{ donnees: any, octets: number }>}
   */
  async function restMesure(chemin, { methode = 'GET', corps, prefer, delai = 10_000, max = LIMITE_REST_OCTETS } = {}) {
    const cle = /** @type {string} */ (serviceRoleKey);
    const reponse = await demander(`${supabaseUrl}${chemin}`, {
      method: methode,
      headers: {
        apikey: cle,
        Authorization: `Bearer ${cle}`,
        ...(corps === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(prefer ? { Prefer: prefer } : {}),
      },
      body: corps === undefined ? undefined : JSON.stringify(corps),
      signal: AbortSignal.timeout(delai),
    });
    const texteReponse = await texteBorne(reponse, max);
    if (!reponse.ok) throw new ErreurRest(reponse.status, codeErreur(texteReponse));
    return { donnees: texteReponse ? JSON.parse(texteReponse) : null, octets: Buffer.byteLength(texteReponse) };
  }

  /**
   * Appel PostgREST en service_role. Une adresse e-mail n'est jamais placée dans `chemin` (journaux de l'API) :
   * elle passe dans le corps d'un POST de RPC.
   * @param {string} chemin
   * @param {{ methode?: string, corps?: unknown, prefer?: string, delai?: number, max?: number }} [o]
   * @returns {Promise<any>}
   */
  async function rest(chemin, o = {}) {
    return (await restMesure(chemin, o)).donnees;
  }

  /**
   * Ligne d'identité du pied des e-mails (revue juridique B4), lue dans identite_legale (même source que la page
   * des mentions légales) : « L’Olympiade des Manades est organisée par <nom>, <forme>, <adresse>. », avec les
   * seuls champs remplis. Sans nom (raison sociale), table vide ou absente de la base : null. Une autre erreur
   * remonte (l'appelant garde la dernière valeur connue).
   * @returns {Promise<string | null>}
   */
  async function lireOrganisateur() {
    let lignes;
    try {
      lignes = await rest('/rest/v1/identite_legale?select=raison_sociale,forme_juridique,adresse&limit=1');
    } catch (erreur) {
      if (erreur instanceof ErreurRest && (erreur.statut === 404 || erreur.code === 'PGRST205' || erreur.code === '42P01')) return null;
      throw erreur;
    }
    const identite = Array.isArray(lignes) ? lignes[0] : null;
    // Une seule ligne : sauts de ligne et caractères de contrôle d'une adresse saisie sur plusieurs lignes deviennent
    // des espaces.
    const propre = (/** @type {unknown} */ v) => (typeof v === 'string' ? v.replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim() : '');
    const nom = propre(identite?.raison_sociale);
    if (!nom) return null;
    const texteLigne = [nom, propre(identite?.forme_juridique), propre(identite?.adresse)].filter(Boolean).join(', ');
    return `L’Olympiade des Manades est organisée par ${texteLigne}${texteLigne.endsWith('.') ? '' : '.'}`;
  }

  /** @param {string} id @returns {Promise<DestinataireLien | null>} */
  async function lireDestinataire(id) {
    const lignes = await rest(`/rest/v1/destinataires_emails?select=${SELECT_DESTINATAIRE}&id=eq.${enc(id)}&limit=1`);
    return Array.isArray(lignes) && lignes[0] ? lignes[0] : null;
  }

  /** Dates enrichies (soirée, manades, vainqueur) hors de la réponse de la RPC. @param {string[]} ids @returns {Promise<DateEnrichie[]>} */
  async function lireDates(ids) {
    /** @type {DateEnrichie[]} */
    const dates = [];
    for (const lot of tranches([...new Set(ids)].filter((id) => UUID.test(id)), LOT_IDS)) {
      const lignes = await rest(`/rest/v1/calendrier?select=${SELECT_DATE},soirees(slug,statut,soiree_manades(ordre,manades(nom)))&id=in.(${lot.join(',')})`) ?? [];
      for (const ligne of lignes) {
        const palmares = await rest(`/rest/v1/palmares?select=vainqueur&statut=eq.confirme&date_soiree=eq.${enc(ligne.date_soiree)}&ville=eq.${enc(ligne.ville)}&order=id.asc&limit=1`) ?? [];
        dates.push(dateDepuisLigne(ligne, typeof palmares[0]?.vainqueur === 'string' ? palmares[0].vainqueur : null));
      }
    }
    return dates;
  }

  /**
   * Les 3 prochaines dates confirmées (Paris) dont la soirée liée n'est ni annulée ni reportée (comme la RPC),
   * pour l'e-mail de test. @param {number} instant @returns {Promise<DateEnrichie[]>}
   */
  async function lireProchaines(instant) {
    const { jour } = heureParis(instant);
    const lignes = await rest(`/rest/v1/calendrier?select=${SELECT_DATE},soirees(slug,statut)&statut=eq.confirmee&date_soiree=gt.${jour}`
      + '&order=date_soiree.asc,heure.asc.nullslast,id.asc&limit=6') ?? [];
    return lignes
      .map((/** @type {Record<string, any>} */ ligne) => dateDepuisLigne(ligne, null))
      .filter((/** @type {DateEnrichie} */ date) => date.soiree?.statut !== 'annulee' && date.soiree?.statut !== 'reportee')
      .slice(0, 3);
  }

  /** Réserve des lignes d'envoi sans jamais écraser une ligne existante. @param {Record<string, unknown>[]} lignes */
  async function insererEnvois(lignes) {
    /** @type {{ id: string, statut: string }[]} */
    const inserees = [];
    for (const lot of tranches(lignes, LOT_INSERTION)) {
      const resultat = await rest(`/rest/v1/envois_emails?on_conflict=${CONFLIT_ENVOIS}&select=id,statut`, {
        methode: 'POST',
        corps: lot,
        prefer: 'resolution=ignore-duplicates,return=representation',
      });
      if (Array.isArray(resultat)) inserees.push(...resultat);
    }
    return inserees;
  }

  return { rest, restMesure, signaler, lireDestinataire, lireDates, lireProchaines, insererEnvois, lireOrganisateur };
}

/** @typedef {ReturnType<typeof creerAccesSupabase>} AccesSupabase */
