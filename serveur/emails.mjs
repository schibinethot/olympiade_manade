// @ts-check
// Séquence d'e-mails (design du 17/10/2026) : planificateur en processus, liens publics signés et
// endpoints admin. La clé service_role reste dans ce processus.
//
// - POST /api/emails/lien            pages publiques (decrire, confirmer, desinscrire, arreter_annonces, je_viens)
// - POST /api/emails/desinscription  désinscription en un clic des messageries (RFC 8058)
// - /api/admin/emails/{test,message,etat}  admin AAL2
//
// Aucun GET ne change d'état (les messageries et antivirus ouvrent les liens). Aucune adresse e-mail en
// clair dans les journaux, ni corps ni détails d'une réponse PostgREST en erreur (code et statut seuls).
// Sans Supabase, clé service_role, origine publique ou clé de liens valable : 503 et planificateur inactif.
//
// Planificateur, chaque minute : RPC emails_a_traiter, calculerEnvois, réservation (unicité en base),
// lecture des envois dus, réclamation de chaque groupe juste avant son envoi, relecture du destinataire,
// contrôles de dernière minute (date annulée, consentement, désinscription), rendu, envoi au débit borné,
// statut. Livraison AU PLUS UNE FOIS : une ligne réclamée et jamais terminée n'est jamais renvoyée.
// prevu_le n'est jamais modifié après la réservation : le plafond journalier se compte dessus.

import { createHash } from 'node:crypto';
import { ipClientActualites } from './actualites.mjs';
import { verifierAdmin } from './admin-serveur.mjs';
import { emailsDepuisEnvironnement as posteDepuisEnvironnement } from './courriel.mjs';
import { calculerEnvois, dateDeBienvenue } from './echeances-emails.mjs';
import { ETAPES, MODELES_DEFAUT, rendreEmail } from './gabarits-emails.mjs';
import { cleLiensValide, finDeJourParis, liensPour, verifierLien } from './liens-emails.mjs';
import {
  FENETRE_MS,
  LIMITE_JETON,
  creerLimiteurFormulaire,
  entierBorne,
  lireJson,
  originePublique,
  origineSupabase,
  repondreJson,
  rogner,
} from './protections-formulaire.mjs';

/** @typedef {import('./gabarits-emails.mjs').Etape} Etape */
/** @typedef {import('./gabarits-emails.mjs').DateEnrichie} DateEnrichie */
/** @typedef {import('./gabarits-emails.mjs').DateAnnoncee} DateAnnoncee */
/** @typedef {import('./gabarits-emails.mjs').ContexteEmail} ContexteEmail */
/** @typedef {import('./gabarits-emails.mjs').ModeleEmail} ModeleEmail */
/** @typedef {import('./echeances-emails.mjs').EmailsATraiter} EmailsATraiter */
/** @typedef {import('./echeances-emails.mjs').EnvoiPrevu} EnvoiPrevu */
/** @typedef {import('./echeances-emails.mjs').ModeleRpc} ModeleRpc */
/** @typedef {import('./liens-emails.mjs').ChargeLien} ChargeLien */
/** @typedef {import('node:http').IncomingMessage} Requete */
/** @typedef {import('node:http').ServerResponse} Reponse */

/**
 * Transport : l'objet de emailsDepuisEnvironnement (courriel.mjs).
 * @typedef {{
 *   mode: string,
 *   pret: boolean,
 *   envoyer: (email: { to: string, subject: string, text: string, html?: string, headers?: Record<string, string> }) =>
 *     Promise<{ mode: string, envoye: boolean, echec: boolean }>,
 * }} Poste
 */

/**
 * @typedef {{
 *   supabaseUrl?: string | null,
 *   publishableKey?: string | null,
 *   serviceRoleKey?: string | null,
 *   origine?: string | null,
 *   cleLiens?: string | null,
 *   courriel?: Poste,
 *   debitParSeconde?: number | string,
 *   fetchFn?: typeof fetch,
 *   maintenant?: () => number,
 *   timers?: boolean,
 *   trustRailwayProxy?: boolean,
 *   railway?: boolean,
 *   barriereActive?: boolean,
 *   journal?: (ligne: Record<string, unknown>) => void,
 *   attendre?: (ms: number) => Promise<void>,
 * }} OptionsEmails
 */

/** @typedef {{ reserves: number, envoyes: number, simules: number, echecs: number, sautes: number }} Bilan */

/**
 * Destinataire embarqué dans une ligne d'envoi lue par le planificateur.
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

const CHEMIN_LIEN = '/api/emails/lien';
const CHEMIN_UN_CLIC = '/api/emails/desinscription';
const CHEMIN_TEST = '/api/admin/emails/test';
const CHEMIN_MESSAGE = '/api/admin/emails/message';
const CHEMIN_ETAT = '/api/admin/emails/etat';
const CHEMINS = new Set([CHEMIN_LIEN, CHEMIN_UN_CLIC, CHEMIN_TEST, CHEMIN_MESSAGE, CHEMIN_ETAT]);

const MINUTE_MS = 60_000;
const HEURE_MS = 60 * MINUTE_MS;
const JOUR_MS = 24 * HEURE_MS;
const INTERVALLE_MS = MINUTE_MS;
/** Une étape due part dans les 12 h qui suivent son échéance (même règle que calculerEnvois). */
const FENETRE_ENVOI_MS = 12 * HEURE_MS;
/** Le message n° 8 ne part plus 24 h après sa création : l'information serait périmée. */
const FENETRE_MESSAGE_MS = 24 * HEURE_MS;
/**
 * Une ligne réclamée (raison « en_cours ») et toujours pas terminée après ce délai a été interrompue
 * (arrêt brutal, statut non écrit) : elle passe en echec « interrompu », sans nouvel envoi.
 */
const BAIL_MS = 10 * MINUTE_MS;
const TENTATIVES_MAX = 3;
const DELAI_NOUVEL_ESSAI_MS = 5 * MINUTE_MS;
const LOT_LECTURE = 500;
const LOT_INSERTION = 500;
const LOT_IDS = 50;
/** Groupes réclamés, puis destinataires relus, par paquets de cette taille juste avant l'envoi. */
const LOT_ENVOI = 10;
const PAGE_RATTACHES = 1_000;
/** Limite par IP des seuls liens refusés (invalides, expirés, malformés), par 10 minutes. */
const LIENS_INVALIDES_PAR_IP = 30;
/** Limite par destinataire des liens valables (pages et un clic), par 10 minutes. */
const LIENS_PAR_DESTINATAIRE = 20;
const TESTS_PAR_HEURE = 10;
const DOUBLON_MESSAGE_MS = 10 * MINUTE_MS;
const LIMITE_RPC_OCTETS = 64 * 1024 * 1024;
const LIMITE_REST_OCTETS = 8 * 1024 * 1024;
const LIMITE_CORPS_ADMIN = 65_536;
const LIMITE_CORPS_UN_CLIC = 4_096;
const PRENOM_EXEMPLE = 'Camille';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONFLIT_ENVOIS = 'destinataire_id,etape,calendrier_id,message_id,reel';
const SELECT_DATE = 'id,nom,ville,arenes,date_soiree,heure,statut,lien_billetterie,infos_pratiques';
const SELECT_DESTINATAIRE = 'id,email,abonne,annonces,abonnement_a_confirmer,confirme_le,desinscrit_le';
const SELECT_DESTINATAIRE_ENVOI = 'id,email,prenom,annonces,abonnement_a_confirmer,confirme_le,desinscrit_le';
const SELECT_ENVOI = `id,destinataire_id,etape,calendrier_id,message_id,raison,tentatives,prevu_le,envoye_le,destinataires_emails(${SELECT_DESTINATAIRE_ENVOI})`;

/** Types de lien acceptés par action : `decrire` lit les trois, chaque écriture le sien seulement. */
const ACTIONS = /** @type {const} */ ({
  decrire: ['confirmation', 'desinscription', 'je_viens'],
  confirmer: ['confirmation'],
  desinscrire: ['desinscription'],
  arreter_annonces: ['desinscription'],
  je_viens: ['je_viens'],
});
/** @typedef {keyof typeof ACTIONS} ActionLien */

/** Étapes 2 à 5 : relues au moment de l'envoi (date annulée ou soirée suspendue entre-temps). */
const ETAPES_DE_DATE = new Set(['j_moins_7', 'veille', 'jour_j', 'lendemain']);

const PARIS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
});

/** Jour calendaire (« AAAA-MM-JJ ») et heure de Paris. @param {number} ms */
function heureParis(ms) {
  /** @type {Record<string, string>} */
  const p = {};
  for (const { type, value } of PARIS.formatToParts(ms)) p[type] = value;
  return { jour: `${p.year}-${p.month}-${p.day}`, heure: Number(p.hour) };
}

const iso = (/** @type {number} */ ms) => new Date(ms).toISOString();
const bilanVide = () => /** @type {Bilan} */ ({ reserves: 0, envoyes: 0, simules: 0, echecs: 0, sautes: 0 });
const enc = encodeURIComponent;

/** @template T @param {readonly T[]} liste @param {number} taille @returns {T[][]} */
function tranches(liste, taille) {
  /** @type {T[][]} */
  const resultat = [];
  for (let i = 0; i < liste.length; i += taille) resultat.push(liste.slice(i, i + taille));
  return resultat;
}

/** @param {unknown} valeur @returns {valeur is Record<string, unknown>} */
function objet(valeur) {
  return !!valeur && typeof valeur === 'object' && !Array.isArray(valeur);
}

/** @param {unknown} valeur */
function texte(valeur) {
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
function lireCorps(req, max) {
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

/** Texte borné, au moins un caractère hors espaces (mêmes règles que les contraintes de la base). @param {unknown} valeur @param {number} max */
function texteRequis(valeur, max) {
  return typeof valeur === 'string' && valeur.length <= max && rogner(valeur).length > 0;
}

/**
 * @param {unknown} brut
 * @returns {{ cle: Etape, brouillon: ModeleEmail, calendrierId: string | null } | null}
 */
function validerTest(brut) {
  if (!objet(brut) || Object.keys(brut).some((cle) => !['cle', 'brouillon', 'calendrierId'].includes(cle))) return null;
  const { cle, brouillon, calendrierId } = brut;
  if (typeof cle !== 'string' || !ETAPES.includes(/** @type {Etape} */ (cle))) return null;
  if (!objet(brouillon) || Object.keys(brouillon).some((c) => !['sujet', 'preheader', 'corps', 'encart'].includes(c))) return null;
  const { sujet, preheader, corps, encart } = brouillon;
  if (!texteRequis(sujet, 200) || !texteRequis(corps, 8000)) return null;
  if (preheader !== undefined && (typeof preheader !== 'string' || preheader.length > 200)) return null;
  if (encart !== undefined && encart !== null && (typeof encart !== 'string' || encart.length > 4000)) return null;
  if (calendrierId !== undefined && calendrierId !== null && (typeof calendrierId !== 'string' || !UUID.test(calendrierId))) return null;
  return {
    cle: /** @type {Etape} */ (cle),
    brouillon: {
      sujet: /** @type {string} */ (sujet),
      preheader: typeof preheader === 'string' ? preheader : '',
      corps: /** @type {string} */ (corps),
      encart: typeof encart === 'string' ? encart : null,
    },
    calendrierId: typeof calendrierId === 'string' ? calendrierId : null,
  };
}

/** @param {unknown} brut @returns {{ calendrierId: string, sujet: string, corps: string } | null} */
function validerMessage(brut) {
  if (!objet(brut)) return null;
  const cles = Object.keys(brut);
  if (cles.length !== 3 || !['calendrierId', 'sujet', 'corps'].every((cle) => cles.includes(cle))) return null;
  const { calendrierId, sujet, corps } = brut;
  if (typeof calendrierId !== 'string' || !UUID.test(calendrierId)) return null;
  if (!texteRequis(sujet, 200) || !texteRequis(corps, 8000)) return null;
  return { calendrierId, sujet: rogner(/** @type {string} */ (sujet)), corps: rogner(/** @type {string} */ (corps)) };
}

/** Tri des dates : date_soiree, heure (nulle en dernier), id. @param {DateEnrichie} a @param {DateEnrichie} b */
function comparerDates(a, b) {
  const cle = (/** @type {DateEnrichie} */ d) => `${d.date_soiree} ${d.heure ?? '~'} ${d.id}`;
  return cle(a) < cle(b) ? -1 : cle(a) > cle(b) ? 1 : 0;
}

/** @param {DateEnrichie | undefined} date */
function soireeSuspendue(date) {
  return date?.soiree?.statut === 'annulee' || date?.soiree?.statut === 'reportee';
}

/**
 * Raison de ne pas envoyer une étape de date (2 à 5), relue au moment de l'envoi.
 * @param {DateEnrichie | undefined} date
 */
function raisonDate(date) {
  if (!date) return 'date_absente';
  if (date.statut === 'annulee') return 'date_annulee';
  if (date.statut !== 'confirmee') return 'date_non_confirmee';
  if (soireeSuspendue(date)) return 'soiree_suspendue';
  return null;
}

/** @param {unknown} donnees @returns {EmailsATraiter} */
function lireDonneesRpc(donnees) {
  const d = /** @type {Record<string, unknown>} */ (donnees);
  if (!objet(d) || !['modeles', 'dates', 'prochaines', 'destinataires', 'rattachements', 'envois'].every((cle) => Array.isArray(d[cle]))) {
    throw new Error('réponse RPC invalide');
  }
  return /** @type {EmailsATraiter} */ (/** @type {unknown} */ (d));
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
 * Corps du semis des modèles : les 9 textes de départ, avec exactement les colonnes que service_role
 * peut insérer. Testé contre les contraintes réelles de la migration (tests/db/semis-modeles-emails.test.ts).
 */
export function lignesModelesParDefaut() {
  return ETAPES.map((cle) => {
    const modele = MODELES_DEFAUT[cle];
    return {
      cle, nom: modele.nom, actif: true, sujet: modele.sujet, preheader: modele.preheader, corps: modele.corps,
      encart: modele.encart, jours_decalage: modele.jours_decalage, heure_envoi: modele.heure_envoi,
    };
  });
}

/** @param {OptionsEmails} [options] */
export function creerEmails(options = {}) {
  const supabaseUrl = origineSupabase(options.supabaseUrl);
  const publishableKey = texte(options.publishableKey) || null;
  const serviceRoleKey = texte(options.serviceRoleKey) || null;
  const origine = originePublique(options.origine);
  const cleLiens = cleLiensValide(options.cleLiens) ? options.cleLiens : null;
  /** @type {Poste} */
  const poste = options.courriel ?? { mode: 'off', pret: false, envoyer: async () => ({ mode: 'off', envoye: false, echec: false }) };
  /** @type {'off' | 'log' | 'smtp'} */
  const mode = poste.mode === 'smtp' ? 'smtp' : poste.mode === 'log' ? 'log' : 'off';
  const reel = mode === 'smtp';
  const debit = entierBorne(options.debitParSeconde, 5, 1, 20);
  const demander = options.fetchFn ?? fetch;
  const maintenant = options.maintenant ?? Date.now;
  const timers = options.timers !== false;
  const trustRailwayProxy = options.trustRailwayProxy === true;
  const railway = options.railway === true;
  const barriereActive = options.barriereActive === true;
  const journal = options.journal ?? ((ligne) => console.log(JSON.stringify(ligne)));
  const attendre = options.attendre ?? ((ms) => new Promise((ok) => { setTimeout(ok, ms); }));
  const serveurPret = !!(supabaseUrl && serviceRoleKey);
  const configure = !!(serveurPret && origine && cleLiens);
  // Site privé (barrière ACCES_TOKEN) : les liens des e-mails (désinscription comprise) seraient
  // inaccessibles aux destinataires. Aucun envoi réel ne part ; le mode log reste possible.
  const smtpSuspendu = barriereActive && mode === 'smtp';
  const actif = configure && mode !== 'off' && poste.pret && !smtpSuspendu;
  const limiteurIp = creerLimiteurFormulaire({ maintenant, parIp: LIENS_INVALIDES_PAR_IP, global: 1_000_000 });
  const limiteurDestinataires = creerLimiteurFormulaire({ maintenant, parIp: LIENS_PAR_DESTINATAIRE, global: 1_000_000 });
  /** @type {Map<string, { debut: number, n: number }>} */
  const testsParAdmin = new Map();
  /** @type {Map<string, { cree: number, promesse: Promise<{ messageId: string, destinataires: number }> }>} */
  const messagesRecents = new Map();

  let enCours = false;
  let seme = false;
  /** @type {string | null} */
  let dernierPassage = null;
  /** @type {Bilan | null} */
  let dernierBilan = null;
  /** @type {string | null} */
  let dernierePurge = null;
  /** @type {ReturnType<typeof setInterval> | null} */
  let minuteur = null;

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
   * Appel PostgREST en service_role.
   * @param {string} chemin
   * @param {{ methode?: string, corps?: unknown, prefer?: string, delai?: number, max?: number }} [o]
   * @returns {Promise<any>}
   */
  async function rest(chemin, { methode = 'GET', corps, prefer, delai = 10_000, max = LIMITE_REST_OCTETS } = {}) {
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
    return texteReponse ? JSON.parse(texteReponse) : null;
  }

  // ——— Lectures partagées ———

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

  /** Les 3 prochaines dates confirmées (Paris), pour l'e-mail de test. @param {number} instant @returns {Promise<DateEnrichie[]>} */
  async function lireProchaines(instant) {
    const { jour } = heureParis(instant);
    const lignes = await rest(`/rest/v1/calendrier?select=${SELECT_DATE}&statut=eq.confirmee&date_soiree=gt.${jour}&order=date_soiree.asc,heure.asc.nullslast,id.asc&limit=3`) ?? [];
    return lignes.map((/** @type {Record<string, any>} */ ligne) => dateDepuisLigne(ligne, null));
  }

  // ——— Liens publics ———

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

  // ——— Admin ———

  function etat() {
    return {
      mode, pret: actif, cleLiens: cleLiens !== null, barriereActive, dernierPassage,
      dernierBilan: dernierBilan ? { ...dernierBilan } : null,
    };
  }

  /** @param {string} id */
  function quotaTest(id) {
    const instant = maintenant();
    const compteur = testsParAdmin.get(id);
    if (!compteur || instant - compteur.debut >= HEURE_MS) {
      testsParAdmin.set(id, { debut: instant, n: 1 });
      return true;
    }
    if (compteur.n >= TESTS_PAR_HEURE) return false;
    compteur.n += 1;
    return true;
  }

  /** @param {Requete} req */
  async function lireJsonAdmin(req) {
    const brut = await lireCorps(req, LIMITE_CORPS_ADMIN);
    try {
      return JSON.parse(brut);
    } catch {
      throw Object.assign(new Error('JSON invalide'), { statut: 400 });
    }
  }

  /** @param {Requete} req @param {Reponse} res @param {{ id: string, email: string | null }} admin */
  async function envoyerTest(req, res, admin) {
    if (!serveurPret || !origine) return repondreJson(req, res, 503, { error: 'service_indisponible' });
    let brut;
    try { brut = await lireJsonAdmin(req); }
    catch (erreur) { return repondreJson(req, res, /** @type {{ statut?: number }} */ (erreur).statut ?? 400, { error: 'format_invalide' }); }
    const demande = validerTest(brut);
    if (!demande) return repondreJson(req, res, 400, { error: 'format_invalide' });
    if (!admin.email) return repondreJson(req, res, 400, { error: 'adresse_admin_absente' });
    if (!quotaTest(admin.id)) return repondreJson(req, res, 429, { error: 'too_many_requests' }, { 'Retry-After': '3600' });
    const instant = maintenant();
    /** @type {DateEnrichie | null} */
    let date = null;
    if (demande.calendrierId) {
      date = (await lireDates([demande.calendrierId]))[0] ?? null;
      if (!date) return repondreJson(req, res, 404, { error: 'date_introuvable' });
    }
    // Liens d'exemple, sans jeton : un e-mail de test ne doit donner aucun pouvoir sur une vraie adresse.
    const base = origine.replace(/\/+$/, '');
    const exempleJeViens = `${base}/emails/je-viens`;
    const prochaines = (await lireProchaines(instant))
      .filter((p) => p.id !== date?.id)
      .map((p) => ({ ...p, lienJeViens: exempleJeViens }));
    /** @type {ContexteEmail} */
    const contexte = {
      prenom: PRENOM_EXEMPLE,
      maintenant: new Date(instant),
      origine,
      date,
      prochaines,
      annoncees: date ? [{ ...date, lienJeViens: exempleJeViens }] : [],
      encartDateProche: demande.cle === 'bienvenue' && date !== null,
      liens: {
        desinscription: `${base}/emails/desinscription`,
        confirmation: demande.cle === 'confirmation' ? `${base}/emails/confirmation` : null,
        jeViens: date ? exempleJeViens : null,
      },
    };
    let rendu;
    try { rendu = rendreEmail(demande.brouillon, contexte, { cible: 'email' }); }
    catch { return repondreJson(req, res, 400, { error: 'brouillon_invalide' }); }
    const resultat = await poste.envoyer({ to: admin.email, subject: `[Test] ${rendu.sujet}`, text: rendu.texte, html: rendu.html });
    if (resultat.echec) return repondreJson(req, res, 502, { error: 'envoi_impossible' });
    return repondreJson(req, res, 200, { ok: true, mode });
  }

  /** Rattachés confirmés et non désinscrits d'une date, page par page. @param {string} calendrierId */
  async function rattachesDe(calendrierId) {
    /** @type {string[]} */
    const ids = [];
    // Jusqu'à une page vide : une limite max-rows de PostgREST plus basse que la page ne fait rien perdre.
    for (let offset = 0; ;) {
      const lignes = await rest(`/rest/v1/rattachements_emails?select=destinataire_id,destinataires_emails!inner(id)`
        + `&calendrier_id=eq.${enc(calendrierId)}&destinataires_emails.confirme_le=not.is.null`
        + `&destinataires_emails.desinscrit_le=is.null&order=destinataire_id.asc&limit=${PAGE_RATTACHES}&offset=${offset}`) ?? [];
      if (!lignes.length) break;
      ids.push(...lignes.map((/** @type {{ destinataire_id: string }} */ l) => l.destinataire_id));
      offset += lignes.length;
    }
    return [...new Set(ids)];
  }

  /** Réserve des lignes d'envoi sans jamais écraser une ligne existante. @param {Record<string, unknown>[]} lignes */
  async function inserer(lignes) {
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

  /** @param {Requete} req @param {Reponse} res @param {{ id: string }} admin */
  async function envoyerMessage(req, res, admin) {
    if (!actif) return repondreJson(req, res, 503, { error: 'planificateur_inactif' });
    let brut;
    try { brut = await lireJsonAdmin(req); }
    catch (erreur) { return repondreJson(req, res, /** @type {{ statut?: number }} */ (erreur).statut ?? 400, { error: 'format_invalide' }); }
    const demande = validerMessage(brut);
    if (!demande) return repondreJson(req, res, 400, { error: 'format_invalide' });
    // Le texte d'exemple (« Écrivez ici votre message… ») ne part jamais tel quel.
    if (demande.corps === rogner(MODELES_DEFAUT.message.corps)) return repondreJson(req, res, 400, { error: 'corps_par_defaut' });
    const calendrier = await rest(`/rest/v1/calendrier?select=id&id=eq.${enc(demande.calendrierId)}&limit=1`);
    if (!Array.isArray(calendrier) || !calendrier[0]) return repondreJson(req, res, 404, { error: 'date_introuvable' });

    const instant = maintenant();
    for (const [cle, entree] of messagesRecents) if (instant - entree.cree >= DOUBLON_MESSAGE_MS) messagesRecents.delete(cle);
    const destinataires = await rattachesDe(demande.calendrierId);
    // Un double clic (ou une nouvelle tentative après une panne) réutilise le même message : les envois
    // déjà réservés ne sont pas dupliqués, ceux qui manquaient sont ajoutés.
    const cle = createHash('sha256').update([admin.id, demande.calendrierId, demande.sujet, demande.corps].join('\n')).digest('hex');
    let entree = messagesRecents.get(cle);
    if (!entree) {
      if (destinataires.length === 0) return repondreJson(req, res, 200, { ok: true, destinataires: 0 });
      const promesse = rest('/rest/v1/messages_inscrits?select=id', {
        methode: 'POST',
        corps: {
          calendrier_id: demande.calendrierId, sujet: demande.sujet, corps: demande.corps, cree_par: admin.id,
          destinataires: destinataires.length,
        },
        prefer: 'return=representation',
      }).then((lignes) => {
        const id = Array.isArray(lignes) ? lignes[0]?.id : null;
        if (typeof id !== 'string') throw new Error('message non enregistré');
        return { messageId: id, destinataires: destinataires.length };
      });
      entree = { cree: instant, promesse };
      messagesRecents.set(cle, entree);
      promesse.catch(() => messagesRecents.delete(cle));
    }
    const message = await entree.promesse;
    await inserer(destinataires.map((id) => ({
      destinataire_id: id, etape: 'message', calendrier_id: demande.calendrierId, message_id: message.messageId, reel,
      statut: 'en_attente', raison: null, prevu_le: iso(instant),
    })));
    return repondreJson(req, res, 200, { ok: true, destinataires: message.destinataires });
  }

  /** @param {Requete} req @param {Reponse} res @param {string} chemin */
  async function repondreAdmin(req, res, chemin) {
    const methode = chemin === CHEMIN_ETAT ? 'GET' : 'POST';
    if (req.method !== methode) {
      req.resume();
      return repondreJson(req, res, 405, { error: 'methode_non_autorisee' }, { Allow: methode });
    }
    const verification = await verifierAdmin(req, { supabaseUrl, publishableKey, demander });
    if (!verification.ok) {
      req.resume();
      return repondreJson(req, res, verification.statut, { error: verification.error });
    }
    if (chemin === CHEMIN_ETAT) return repondreJson(req, res, 200, etat());
    if (chemin === CHEMIN_TEST) return envoyerTest(req, res, verification);
    return envoyerMessage(req, res, verification);
  }

  // ——— Planificateur ———

  const LIGNES_MODELES = lignesModelesParDefaut();

  /** Sème les modèles manquants sans toucher aux lignes existantes ; un échec est retenté au passage suivant. */
  async function semer() {
    if (!serveurPret) return;
    try {
      await rest('/rest/v1/modeles_emails?on_conflict=cle', {
        methode: 'POST', corps: LIGNES_MODELES, prefer: 'resolution=ignore-duplicates,return=minimal',
      });
      seme = true;
    } catch (erreur) {
      signaler('semis des modèles d’e-mails impossible', erreur);
    }
  }

  /** @param {EnvoiPrevu} envoi @param {'en_attente' | 'saute'} statut */
  function lignesReservees(envoi, statut) {
    const dates = envoi.calendrierIds.length ? envoi.calendrierIds : [null];
    return dates.map((calendrierId) => ({
      destinataire_id: envoi.destinataireId, etape: envoi.etape, calendrier_id: calendrierId, message_id: null, reel, statut,
      raison: statut === 'saute' ? envoi.raison ?? null : null, prevu_le: envoi.prevuLe,
    }));
  }

  /** Statut d'un envoi. prevu_le n'y figure jamais : l'échéance d'origine reste. @param {string[]} ids @param {Record<string, unknown>} champs */
  async function marquer(ids, champs) {
    for (const lot of tranches(ids, LOT_IDS)) {
      const chemin = `/rest/v1/envois_emails?id=in.(${lot.join(',')})`;
      try {
        await rest(chemin, { methode: 'PATCH', corps: champs, prefer: 'return=minimal' });
      } catch {
        // Un second essai ; s'il échoue aussi, la ligne reste « en_cours » et sera soldée « interrompu ».
        await rest(chemin, { methode: 'PATCH', corps: champs, prefer: 'return=minimal' });
      }
    }
  }

  /** Une ligne peut être réclamée : jamais réclamée, ou en attente d'un nouvel essai dont le délai est passé. @param {LigneEnvoi} ligne @param {number} instant */
  function eligible(ligne, instant) {
    if (ligne.raison === null) return true;
    if (ligne.raison !== 'envoi_impossible') return false;
    const derniere = Date.parse(ligne.envoye_le ?? '');
    return Number.isNaN(derniere) || derniere + DELAI_NOUVEL_ESSAI_MS * ligne.tentatives <= instant;
  }

  /**
   * Réclame un groupe juste avant son envoi : raison passe à « en_cours » et envoye_le note l'instant, par
   * un UPDATE filtré sur l'état lu (raison, tentatives). Deux instances qui lisent la même ligne : une
   * seule la touche. Une ligne déjà « en_cours » n'est jamais réclamée.
   * @param {LigneEnvoi[]} groupe @param {number} instant @returns {Promise<LigneEnvoi[]>}
   */
  async function reclamer(groupe, instant) {
    const [premiere] = groupe;
    if (!eligible(premiere, instant)) return [];
    const etatLu = premiere.raison === null ? 'raison=is.null' : 'raison=eq.envoi_impossible';
    const lignes = await rest(`/rest/v1/envois_emails?id=in.(${groupe.map((l) => l.id).join(',')})&statut=eq.en_attente`
      + `&${etatLu}&tentatives=eq.${Number(premiere.tentatives) || 0}&select=id`, {
      methode: 'PATCH',
      corps: { raison: 'en_cours', envoye_le: iso(instant) },
      prefer: 'return=representation',
    });
    const ids = new Set((Array.isArray(lignes) ? lignes : []).map((/** @type {{ id: string }} */ l) => l.id));
    return groupe.filter((ligne) => ids.has(ligne.id));
  }

  /** Lignes réclamées et jamais terminées depuis le bail : echec « interrompu », jamais renvoyées. @param {number} instant */
  async function solderInterrompus(instant) {
    const lignes = await rest(`/rest/v1/envois_emails?statut=eq.en_attente&reel=is.${reel}&raison=eq.en_cours`
      + `&envoye_le=lt.${enc(iso(instant - BAIL_MS))}&select=id`, {
      methode: 'PATCH',
      corps: { statut: 'echec', raison: 'interrompu' },
      prefer: 'return=representation',
    });
    const nombre = Array.isArray(lignes) ? lignes.length : 0;
    if (nombre) journal({ level: 'warn', timestamp: iso(Date.now()), message: 'envois interrompus, non renvoyés', nombre });
    return nombre;
  }

  /** Envois dus du mode courant : nouveaux, puis nouveaux essais dont le délai est passé. @param {number} instant @returns {Promise<LigneEnvoi[]>} */
  async function lireDus(instant) {
    const base = `/rest/v1/envois_emails?select=${SELECT_ENVOI}&statut=eq.en_attente&reel=is.${reel}`
      + `&prevu_le=lte.${enc(iso(instant))}&order=prevu_le.asc,destinataire_id.asc,id.asc&limit=${LOT_LECTURE}`;
    const nouveaux = await rest(`${base}&raison=is.null`) ?? [];
    const essais = await rest(`${base}&raison=eq.envoi_impossible`) ?? [];
    return [...nouveaux, ...essais].filter((ligne) => eligible(ligne, instant));
  }

  /** Les lignes d'une même annonce partent ensemble : complète celles qu'une limite de lecture aurait coupées. @param {LigneEnvoi[]} lues @param {number} instant */
  async function completerAnnonces(lues, instant) {
    const parId = new Map(lues.map((ligne) => [ligne.id, ligne]));
    const ids = [...new Set(lues.filter((ligne) => ligne.etape === 'annonce').map((ligne) => ligne.destinataire_id))];
    for (const lot of tranches(ids, LOT_IDS)) {
      const lignes = await rest(`/rest/v1/envois_emails?select=${SELECT_ENVOI}&etape=eq.annonce&statut=eq.en_attente&reel=is.${reel}`
        + `&prevu_le=lte.${enc(iso(instant))}&destinataire_id=in.(${lot.join(',')})`) ?? [];
      for (const ligne of lignes) if (eligible(ligne, instant)) parId.set(ligne.id, ligne);
    }
    return [...parId.values()];
  }

  /** @param {LigneEnvoi[]} lignes @returns {LigneEnvoi[][]} */
  function grouper(lignes) {
    /** @type {Map<string, LigneEnvoi[]>} */
    const groupes = new Map();
    for (const ligne of lignes) {
      // Une annonce : toutes ses lignes, dans le même état (réservées et mises à jour ensemble).
      const cle = ligne.etape === 'annonce' ? `annonce ${ligne.destinataire_id} ${ligne.raison} ${ligne.tentatives}` : ligne.id;
      const groupe = groupes.get(cle);
      if (groupe) groupe.push(ligne);
      else groupes.set(cle, [ligne]);
    }
    return [...groupes.values()];
  }

  /** Destinataires relus juste après la réclamation. @param {string[]} ids @returns {Promise<Map<string, DestinataireEnvoi>>} */
  async function relireDestinataires(ids) {
    /** @type {Map<string, DestinataireEnvoi>} */
    const frais = new Map();
    for (const lot of tranches([...new Set(ids)], LOT_IDS)) {
      for (const ligne of await rest(`/rest/v1/destinataires_emails?select=${SELECT_DESTINATAIRE_ENVOI}&id=in.(${lot.join(',')})`) ?? []) {
        frais.set(ligne.id, ligne);
      }
    }
    return frais;
  }

  /**
   * @typedef {{
   *   donnees: EmailsATraiter,
   *   dates: Map<string, DateEnrichie>,
   *   modeles: Map<string, ModeleRpc>,
   *   messages: Map<string, { id: string, sujet: string, corps: string }>,
   * }} ContexteEnvoi
   */

  /**
   * Ce qu'il faut faire d'un groupe de lignes réclamées : lignes sautées (avec leur raison) et, peut-être,
   * un e-mail à rendre et envoyer. Tout est relu ici : un état changé depuis la réservation l'emporte.
   * @param {LigneEnvoi[]} groupe
   * @param {DestinataireEnvoi | null} d destinataire relu après la réclamation
   * @param {ContexteEnvoi} ctx
   * @param {number} instant
   * @returns {{ sautes: { ids: string[], raison: string }[], envoi: { lignes: LigneEnvoi[], modele: ModeleEmail, contexte: ContexteEmail, entetes: Record<string, string> } | null }}
   */
  function examiner(groupe, d, ctx, instant) {
    const premiere = groupe[0];
    const etape = premiere.etape;
    const tout = (/** @type {string} */ raison) => ({ sautes: [{ ids: groupe.map((l) => l.id), raison }], envoi: null });
    if (!d) return tout('destinataire_absent');
    if (etape !== 'confirmation' && d.desinscrit_le !== null) return tout('desinscrit');
    if (etape === 'confirmation' && !d.abonnement_a_confirmer) return tout('deja_confirme');
    if (etape !== 'confirmation' && d.confirme_le === null) return tout('non_confirme');
    const retard = instant - Date.parse(premiere.prevu_le);
    if (etape !== 'confirmation' && etape !== 'message' && retard > FENETRE_ENVOI_MS) return tout('fenetre_depassee');
    if (etape === 'message' && retard > FENETRE_MESSAGE_MS) return tout('fenetre_depassee');

    /** @type {ModeleEmail} */
    let modele;
    const enregistre = ctx.modeles.get(etape);
    if (etape === 'message') {
      const message = premiere.message_id ? ctx.messages.get(premiere.message_id) : undefined;
      if (!message) return tout('message_absent');
      modele = { sujet: message.sujet, preheader: enregistre?.preheader ?? '', corps: message.corps, encart: null };
    } else {
      if (!enregistre || !enregistre.actif) return tout('modele_inactif');
      modele = { sujet: enregistre.sujet, preheader: enregistre.preheader, corps: enregistre.corps, encart: enregistre.encart };
    }

    const liens = liensPour({ origine: /** @type {string} */ (origine), cle: /** @type {string} */ (cleLiens), destinataireId: d.id, maintenant: instant });
    const jeViensPour = (/** @type {DateEnrichie} */ date) => {
      try { return liens.jeViens(date.id, date.date_soiree); } catch { return null; }
    };
    /** @type {{ ids: string[], raison: string }[]} */
    const sautes = [];
    let lignes = groupe;
    /** @type {DateEnrichie | null} */
    let date = null;
    /** @type {DateAnnoncee[]} */
    let annoncees = [];
    let encartDateProche = false;

    if (ETAPES_DE_DATE.has(etape)) {
      const relue = premiere.calendrier_id ? ctx.dates.get(premiere.calendrier_id) : undefined;
      const raison = raisonDate(relue);
      if (raison) return tout(raison);
      date = /** @type {DateEnrichie} */ (relue);
    } else if (etape === 'prochaines_dates' || etape === 'annonce') {
      if (!d.annonces) return tout('sans_consentement');
      if (etape === 'prochaines_dates') date = (premiere.calendrier_id && ctx.dates.get(premiere.calendrier_id)) || null;
      else {
        const { jour } = heureParis(instant);
        /** @type {{ ligne: LigneEnvoi, date: DateEnrichie }[]} */
        const valides = [];
        for (const ligne of groupe) {
          const relue = ligne.calendrier_id ? ctx.dates.get(ligne.calendrier_id) : undefined;
          const raison = raisonDate(relue) ?? (relue && relue.date_soiree <= jour ? 'date_passee' : null);
          if (raison) sautes.push({ ids: [ligne.id], raison });
          else valides.push({ ligne, date: /** @type {DateEnrichie} */ (relue) });
        }
        if (!valides.length) return { sautes, envoi: null };
        valides.sort((a, b) => comparerDates(a.date, b.date));
        lignes = valides.map((v) => v.ligne);
        date = valides[0].date;
        annoncees = valides.map((v) => ({ ...v.date, lienJeViens: jeViensPour(v.date) }));
      }
    } else if (etape === 'bienvenue') {
      const bienvenue = dateDeBienvenue(ctx.donnees, { id: d.id, confirme_le: d.confirme_le });
      date = bienvenue.date;
      encartDateProche = bienvenue.encartDateProche;
    } else if (etape === 'message') {
      date = (premiere.calendrier_id && ctx.dates.get(premiere.calendrier_id)) || null;
    }

    // {{prochaines_dates}} annonce d'autres dates : seulement avec le consentement aux annonces, ou dans un
    // message de l'organisateur aux inscrits d'une date (report, annulation). Sinon la ligne disparaît.
    const listeAutorisee = etape === 'message' || (etape !== 'confirmation' && d.annonces === true);
    const prochaines = !listeAutorisee ? [] : ctx.donnees.prochaines
      .filter((p) => p.id !== date?.id)
      .slice(0, 3)
      .map((p) => ({ ...p, lienJeViens: jeViensPour(p) }));
    if (etape === 'prochaines_dates' && prochaines.length === 0) return tout('aucune_date');

    return {
      sautes,
      envoi: {
        lignes,
        modele,
        contexte: {
          prenom: d.prenom,
          maintenant: new Date(instant),
          origine: /** @type {string} */ (origine),
          date,
          prochaines,
          annoncees,
          encartDateProche,
          liens: {
            desinscription: liens.desinscription,
            confirmation: etape === 'confirmation' ? liens.confirmation : null,
            jeViens: etape === 'annonce' && date ? jeViensPour(date) : null,
          },
        },
        // Pas de mailto : aucune boîte ne traite les demandes envoyées par e-mail.
        entetes: {
          'List-Unsubscribe': `<${liens.desinscriptionUnClic}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      },
    };
  }

  /** Au plus `debit` envois commencés par seconde glissante. @param {number[]} departs */
  async function patienter(departs) {
    if (departs.length >= debit) {
      const attente = departs[0] + 1000 - Date.now();
      if (attente > 0) await attendre(Math.min(attente, 1000));
      departs.shift();
    }
    departs.push(Date.now());
  }

  /**
   * @param {LigneEnvoi[]} groupe lignes réclamées
   * @param {DestinataireEnvoi | null} destinataire relu après la réclamation
   * @param {ContexteEnvoi} ctx @param {number} instant @param {Bilan} bilan @param {number[]} departs
   */
  async function traiter(groupe, destinataire, ctx, instant, bilan, departs) {
    const { sautes, envoi } = examiner(groupe, destinataire, ctx, instant);
    for (const saut of sautes) {
      await marquer(saut.ids, { statut: 'saute', raison: saut.raison, envoye_le: null });
      bilan.sautes += saut.ids.length;
    }
    if (!envoi || !destinataire) return;
    const ids = envoi.lignes.map((ligne) => ligne.id);
    const tentatives = Math.max(...envoi.lignes.map((ligne) => Number(ligne.tentatives) || 0)) + 1;
    let rendu;
    try {
      rendu = rendreEmail(envoi.modele, envoi.contexte, { cible: 'email' });
    } catch (erreur) {
      // Un rendu impossible le restera : échec définitif, sans nouvel essai.
      await marquer(ids, { statut: 'echec', raison: 'rendu_invalide', tentatives, envoye_le: null });
      bilan.echecs += 1;
      signaler('rendu d’e-mail impossible', erreur, { etape: groupe[0].etape });
      return;
    }
    await patienter(departs);
    /** @type {{ envoye: boolean, echec: boolean }} */
    let resultat;
    try {
      resultat = await poste.envoyer({ to: destinataire.email, subject: rendu.sujet, text: rendu.texte, html: rendu.html, headers: envoi.entetes });
    } catch {
      resultat = { envoye: false, echec: true };
    }
    const fin = iso(maintenant());
    if (!resultat.echec) {
      const statut = resultat.envoye ? 'envoye' : 'simule';
      await marquer(ids, { statut, envoye_le: fin, raison: null });
      if (statut === 'envoye') bilan.envoyes += 1;
      else bilan.simules += 1;
      return;
    }
    bilan.echecs += 1;
    // Un échec SMTP réécrit la raison : le nouvel essai n'est pas pris pour une interruption. envoye_le
    // garde l'heure de cet essai, le suivant attend 5 min × tentatives.
    if (tentatives >= TENTATIVES_MAX) await marquer(ids, { statut: 'echec', tentatives, raison: 'envoi_impossible', envoye_le: fin });
    else await marquer(ids, { tentatives, raison: 'envoi_impossible', envoye_le: fin });
  }

  /** @param {EmailsATraiter} donnees @param {number} instant @param {Bilan} bilan */
  async function envoyerDus(donnees, instant, bilan) {
    const lues = await lireDus(instant);
    if (!lues.length) return;
    /** @type {LigneEnvoi[]} */
    const lignes = await completerAnnonces(lues, instant);

    /** @type {Map<string, DateEnrichie>} */
    const dates = new Map([...donnees.dates, ...donnees.prochaines].map((date) => [date.id, date]));
    const manquantes = [...new Set(lignes.map((ligne) => ligne.calendrier_id).filter((id) => id !== null && !dates.has(id)))];
    for (const date of await lireDates(/** @type {string[]} */ (manquantes))) dates.set(date.id, date);
    const idsMessages = [...new Set(lignes.map((ligne) => ligne.message_id).filter((id) => id !== null))];
    /** @type {Map<string, { id: string, sujet: string, corps: string }>} */
    const messages = new Map();
    for (const lot of tranches(/** @type {string[]} */ (idsMessages), LOT_IDS)) {
      for (const message of await rest(`/rest/v1/messages_inscrits?select=id,sujet,corps&id=in.(${lot.join(',')})`) ?? []) messages.set(message.id, message);
    }
    /** @type {ContexteEnvoi} */
    const ctx = { donnees, dates, messages, modeles: new Map(donnees.modeles.map((modele) => [modele.cle, modele])) };

    /** @type {number[]} */
    const departs = [];
    for (const lot of tranches(grouper(lignes), LOT_ENVOI)) {
      /** @type {LigneEnvoi[][]} */
      const reclames = [];
      for (const groupe of lot) {
        const retenues = await reclamer(groupe, maintenant());
        if (retenues.length) reclames.push(retenues);
      }
      if (!reclames.length) continue;
      // Relecture après la réclamation : une désinscription ou un retrait de consentement survenu depuis
      // la lecture l'emporte.
      const frais = await relireDestinataires(reclames.map((groupe) => groupe[0].destinataire_id));
      for (const groupe of reclames) {
        try {
          await traiter(groupe, frais.get(groupe[0].destinataire_id) ?? null, ctx, instant, bilan, departs);
        } catch (erreur) {
          // Statut non écrit : la ligne reste « en_cours » et sera soldée « interrompu », jamais renvoyée.
          signaler('fin d’envoi d’un e-mail impossible', erreur, { etape: groupe[0].etape });
        }
      }
    }
  }

  /** Au premier passage après 03:00 (Paris) chaque jour : journal de plus de 12 mois, abonnés non confirmés. @param {number} instant */
  async function purgerSiBesoin(instant) {
    const { jour, heure } = heureParis(instant);
    if (heure < 3 || dernierePurge === jour) return;
    try {
      const limite = new Date(instant);
      limite.setUTCFullYear(limite.getUTCFullYear() - 1);
      await rest(`/rest/v1/envois_emails?cree_le=lt.${enc(limite.toISOString())}`, { methode: 'DELETE', prefer: 'return=minimal' });
      // Non confirmés 30 jours après l'envoi RÉEL de leur confirmation, jamais avant. Annuler la demande,
      // c'est supprimer l'abonnement : les déclencheurs font le reste (ligne d'un spectateur ou d'un
      // désinscrit gardée). Borné en tours : une ligne incohérente ne fait pas tourner la purge sans fin.
      let nonConfirmes = 0;
      for (let tour = 0; tour < 20; tour += 1) {
        const lignes = await rest(`/rest/v1/envois_emails?select=destinataire_id,destinataires_emails!inner(email)`
          + `&etape=eq.confirmation&reel=is.true&statut=eq.envoye&envoye_le=lt.${enc(iso(instant - 30 * JOUR_MS))}`
          + `&destinataires_emails.abonnement_a_confirmer=is.true&limit=${LOT_LECTURE}`) ?? [];
        if (!lignes.length) break;
        for (const ligne of lignes) {
          const email = ligne.destinataires_emails?.email;
          if (typeof email !== 'string') continue;
          await rest(`/rest/v1/abonnements_actualites?email=eq.${enc(email)}`, { methode: 'DELETE', prefer: 'return=minimal' });
          nonConfirmes += 1;
        }
      }
      dernierePurge = jour;
      journal({ level: 'info', timestamp: iso(Date.now()), message: 'purge des e-mails', nonConfirmes });
    } catch (erreur) {
      signaler('purge des e-mails impossible', erreur);
    }
  }

  /** Un passage du planificateur. Rien si inactif (mode off, configuration incomplète) ou déjà en cours. */
  async function passer() {
    const bilan = bilanVide();
    if (!actif || enCours) return bilan;
    enCours = true;
    try {
      if (!seme) await semer();
      const instant = maintenant();
      const donnees = lireDonneesRpc(await rest('/rest/v1/rpc/emails_a_traiter', {
        methode: 'POST', corps: { p_maintenant: iso(instant), p_reel: reel }, delai: 30_000, max: LIMITE_RPC_OCTETS,
      }));
      const { aEnvoyer, sautes } = calculerEnvois(donnees, new Date(instant));
      const reservees = await inserer([
        ...aEnvoyer.flatMap((envoi) => lignesReservees(envoi, 'en_attente')),
        ...sautes.flatMap((envoi) => lignesReservees(envoi, 'saute')),
      ]);
      for (const ligne of reservees) {
        if (ligne.statut === 'en_attente') bilan.reserves += 1;
        else if (ligne.statut === 'saute') bilan.sautes += 1;
      }
      bilan.echecs += await solderInterrompus(instant);
      await envoyerDus(donnees, instant, bilan);
      await purgerSiBesoin(instant);
      dernierPassage = iso(instant);
      dernierBilan = { ...bilan };
      if (bilan.reserves || bilan.envoyes || bilan.simules || bilan.echecs) {
        journal({ level: 'info', timestamp: iso(Date.now()), message: 'passage du planificateur d’e-mails', mode, ...bilan });
      }
    } catch (erreur) {
      signaler('passage du planificateur d’e-mails impossible', erreur);
    } finally {
      enCours = false;
    }
    return bilan;
  }

  /** Sème les modèles, puis lance le minuteur (60 s) si le planificateur est actif et les minuteurs permis. */
  async function demarrer() {
    // Ne rejette jamais : statique.mjs l'appelle sans attendre, et le serveur ne doit pas tomber.
    try {
      await semer();
      if (smtpSuspendu) {
        journal({
          level: 'warn', timestamp: iso(Date.now()),
          message: 'envois réels suspendus : barrière d’accès active (ACCES_TOKEN), les liens des e-mails seraient inaccessibles',
        });
      }
      if (railway && !trustRailwayProxy) {
        journal({
          level: 'warn', timestamp: iso(Date.now()),
          message: 'liens des e-mails : EMAILS_TRUST_RAILWAY_PROXY faux sur Railway, toutes les IP partagent la limite des liens refusés',
        });
      }
      if (!actif) {
        journal({
          level: 'info', timestamp: iso(Date.now()), message: 'planificateur d’e-mails inactif', mode,
          supabase: serveurPret, origine: origine !== null, cleLiens: cleLiens !== null, smtpPret: poste.pret,
        });
        return;
      }
      if (timers && !minuteur) {
        minuteur = setInterval(() => { void passer(); }, INTERVALLE_MS);
        minuteur.unref?.();
        void passer();
      }
    } catch (erreur) {
      signaler('démarrage du planificateur d’e-mails impossible', erreur);
    }
  }

  function arreter() {
    if (minuteur) clearInterval(minuteur);
    minuteur = null;
  }

  /** @param {Requete} req @param {Reponse} res */
  async function repondre(req, res) {
    let chemin = '';
    try { chemin = new URL(req.url ?? '/', 'http://serveur').pathname; } catch { /* chemin vide : 503 ci-dessous */ }
    try {
      if (chemin === CHEMIN_LIEN) return await repondreLien(req, res);
      if (chemin === CHEMIN_UN_CLIC) return await repondreUnClic(req, res);
      if (CHEMINS.has(chemin)) return await repondreAdmin(req, res, chemin);
      return repondreJson(req, res, 404, { error: 'introuvable' });
    } catch (erreur) {
      signaler('requête e-mails impossible', erreur, { chemin });
      if (!res.headersSent) repondreJson(req, res, 503, { error: 'Service momentanément indisponible.' });
      else res.destroy();
    }
  }

  return {
    configure,
    mode,
    actif,
    /** La confirmation part vraiment (SMTP réel) : l'accueil peut dire « vérifiez votre boîte mail ». */
    confirmationActive: actif && mode === 'smtp',
    /** @param {string | undefined} url */
    estRoute(url) {
      try { return CHEMINS.has(new URL(url ?? '/', 'http://serveur').pathname); }
      catch { return false; }
    },
    repondre,
    demarrer,
    arreter,
    passer,
    etat,
  };
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 * @param {{ barriereActive?: boolean }} [plus] barrière d'accès du site (statique.mjs), lue dans ACCES_TOKEN à défaut
 */
export function emailsDepuisEnvironnement(env, plus = {}) {
  // EMAILS_TRUST_RAILWAY_PROXY, ou à défaut le réglage déjà posé pour les actualités (même ingress).
  const confiance = texte(env.EMAILS_TRUST_RAILWAY_PROXY) || texte(env.ACTUALITES_TRUST_RAILWAY_PROXY);
  return creerEmails({
    supabaseUrl: env.VITE_SUPABASE_URL,
    publishableKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    origine: env.CONTACT_ORIGIN,
    cleLiens: env.EMAILS_CLE_LIENS,
    courriel: posteDepuisEnvironnement(env),
    debitParSeconde: env.EMAILS_DEBIT_PAR_SECONDE,
    trustRailwayProxy: confiance === 'true',
    railway: texte(env.RAILWAY_ENVIRONMENT) !== '',
    barriereActive: plus.barriereActive ?? texte(env.ACCES_TOKEN) !== '',
  });
}
