// @ts-check
// Calcul des échéances de la séquence d'e-mails (design §4) : quels e-mails partent, quand, et
// lesquels sont sautés. Fonctions pures, importées par le planificateur (envoi) et par l'admin
// (estimation des envois à venir). Isomorphe : aucun import node:*, aucune dépendance.
//
// Fuseau : heures et jours de Paris (serveur/fuseau-paris.mjs). Un « jour » court jusqu'à 06:00 le
// lendemain, comme prive.jour_des_soirees en base : une inscription à 00:30, pendant la soirée, compte
// encore pour la date de la veille (encart, plafond, même jour que la bienvenue).
//
// Horizons : la bienvenue n'est examinée que dans les 24 h qui suivent la confirmation, une étape de date que
// dans les 48 h qui suivent son échéance (ou les 48 h qui suivent le rattachement). Au-delà, rien n'est
// calculé ni enregistré : la RPC ne renvoie plus les envois anciens (volume borné).

import { ETAPES } from './gabarits-emails.mjs';
import {
  decalerJour,
  ecartJours,
  instantParis,
  jourCalendaireParis as jourCalendaire,
  jourDesSoirees,
  lireJour,
} from './fuseau-paris.mjs';

/** @typedef {import('./gabarits-emails.mjs').Etape} Etape */
/** @typedef {import('./gabarits-emails.mjs').DateEnrichie} DateEnrichie */

/**
 * Une ligne `modeles` de la RPC `emails_a_traiter` (tâche 1).
 * @typedef {{
 *   cle: Etape,
 *   nom: string,
 *   actif: boolean,
 *   sujet: string,
 *   preheader: string,
 *   corps: string,
 *   encart: string | null,
 *   jours_decalage: number | null,
 *   heure_envoi: string | null,
 * }} ModeleRpc
 */

/**
 * Le réglage d'un modèle, seul utile au calcul : une ligne de `modeles_emails` suffit.
 * @typedef {{ cle: string, actif: boolean, jours_decalage: number | null, heure_envoi: string | null }} ReglageModele
 */

/**
 * Un destinataire de la RPC, sans adresse ni prénom (relus avant l'envoi). `abonnement_a_confirmer` : une
 * demande de confirmation attend son clic ET le plafond des demandes (C6) permet encore d'en envoyer une.
 * @typedef {{
 *   id: string,
 *   abonnement_a_confirmer: boolean,
 *   desinscrit: boolean,
 *   annonces: boolean,
 *   confirme_le: string | null,
 * }} Destinataire
 */

/**
 * @typedef {{
 *   destinataire_id: string,
 *   calendrier_id: string,
 *   origine: 'inscription' | 'je_viens' | 'premiere_confirmation',
 *   cree_le: string,
 * }} Rattachement
 */

/**
 * Un envoi déjà enregistré, du mode courant.
 * @typedef {{
 *   destinataire_id: string,
 *   etape: Etape,
 *   calendrier_id: string | null,
 *   statut: 'en_attente' | 'envoye' | 'simule' | 'echec' | 'saute',
 *   raison: string | null,
 *   prevu_le: string,
 * }} Envoi
 */

/**
 * Réponse de la RPC `emails_a_traiter(p_maintenant, p_reel)`, décodée par lireEmailsATraiter. `envois` ne
 * contient que ceux du mode courant, et seulement ceux dont le calcul a besoin.
 * @typedef {{
 *   modeles: ModeleRpc[],
 *   dates: DateEnrichie[],
 *   prochaines: DateEnrichie[],
 *   destinataires: Destinataire[],
 *   rattachements: Rattachement[],
 *   envois: Envoi[],
 * }} EmailsATraiter
 */

/**
 * @typedef {'deja_passe_a_l_inscription' | 'meme_jour_que_bienvenue' | 'date_annulee' | 'aucune_date'
 *   | 'prochaines_dates_recent' | 'fenetre_depassee' | 'plafond_jour'} RaisonSaut
 */

/**
 * Un envoi à réserver (`aEnvoyer`, en `en_attente`) ou à enregistrer `saute` (`sautes`, avec `raison`).
 * - `calendrierIds` : vide pour confirmation et bienvenue, une date par étape de date, toutes les
 *   dates d'une annonce (une ligne d'envoi par date).
 * - `prevuLe` : l'échéance pour une étape de date, l'instant du calcul pour les autres.
 * - `encartDateProche` : bienvenue seulement. La base ne le garde pas : voir `dateDeBienvenue`.
 * @typedef {{
 *   destinataireId: string,
 *   etape: Etape,
 *   calendrierIds: string[],
 *   prevuLe: string,
 *   encartDateProche?: boolean,
 *   raison?: RaisonSaut,
 * }} EnvoiPrevu
 */

/** @typedef {{ id: string, date_soiree: string, statut: string }} DateEstimee */
/** @typedef {{ etape: Etape, calendrierId: string, prevuLe: string, destinataires: number }} EnvoiEstime */

const HEURE_MS = 3_600_000;
const JOUR_MS = 24 * HEURE_MS;
/** Une étape due part dans les 12 h qui suivent son échéance ; au-delà, elle est sautée (aussi à l'envoi). */
export const FENETRE_ENVOI_MS = 12 * HEURE_MS;
/** Au plus une annonce, et un e-mail « prochaines dates », par personne tous les 7 jours glissants. */
const DELAI_GLISSANT_MS = 7 * JOUR_MS;
/** Encart « date proche » de la bienvenue : la date tombe 0 à 7 jours après la confirmation. */
const ENCART_JOURS_MAX = 7;
/** La bienvenue n'est examinée que dans les 24 h qui suivent la confirmation (RPC : confirmés depuis 24 h). */
const HORIZON_BIENVENUE_MS = 24 * HEURE_MS;
/** Une étape de date n'est examinée que dans les 48 h qui suivent son échéance, ou le rattachement. */
const HORIZON_ETAPE_MS = 48 * HEURE_MS;

/** Étapes calées sur une date suivie (2 à 6 de la séquence), dans l'ordre. */
export const ETAPES_DE_DATE = /** @type {const} */ (['j_moins_7', 'veille', 'jour_j', 'lendemain', 'prochaines_dates']);
const SANS_ECHEANCE = new Set(['confirmation', 'bienvenue', 'message']);
/**
 * Statuts qui occupent le plafond journalier et les délais glissants des annonces : un envoi parti, simulé
 * ou réservé. Un envoi interrompu (echec « interrompu ») compte aussi : il est peut-être parti (voir compte).
 */
const STATUTS_COMPTES = new Set(['envoye', 'simule', 'en_attente']);
const HORS_PLAFOND = new Set(['confirmation', 'message']);

/** Un envoi qui compte (plafond, délais) : parti, simulé, réservé, ou interrompu après sa réclamation. @param {Envoi} envoi */
const compte = (envoi) => STATUTS_COMPTES.has(envoi.statut) || (envoi.statut === 'echec' && envoi.raison === 'interrompu');
/**
 * Ordre de priorité sous le plafond : bienvenue, étapes de la date la plus proche, lendemain,
 * annonce, prochaines dates.
 * @type {Record<'bienvenue' | 'annonce' | typeof ETAPES_DE_DATE[number], number>}
 */
const PALIERS = { bienvenue: 0, j_moins_7: 1, veille: 1, jour_j: 1, lendemain: 2, annonce: 3, prochaines_dates: 4 };

/** Lundi de la semaine (lundi à dimanche) d'un jour : clé de regroupement des annonces. */
const lundiDe = (/** @type {string} */ jour) => decalerJour(jour, -((lireJour(jour).utc.getUTCDay() + 6) % 7));

// ——— Réponse de la RPC ———

/** @param {unknown} valeur @returns {string | null} */
function instantRpc(valeur) {
  if (valeur === null) return null;
  if (typeof valeur !== 'number' || !Number.isFinite(valeur)) throw new Error('réponse RPC invalide');
  return new Date(valeur).toISOString();
}

/** @param {unknown} valeur @param {number} longueur @returns {unknown[]} */
function tuple(valeur, longueur) {
  if (!Array.isArray(valeur) || valeur.length !== longueur) throw new Error('réponse RPC invalide');
  return valeur;
}

/**
 * Décode la réponse compacte de la RPC `emails_a_traiter` (une ligne par personne, dates citées par leur
 * position dans `dates`, horodatages en millisecondes : voir la migration) en EmailsATraiter. Lève une
 * erreur sur une forme inattendue.
 * @param {unknown} brut
 * @returns {EmailsATraiter}
 */
export function lireEmailsATraiter(brut) {
  const r = /** @type {Record<string, unknown>} */ (brut);
  if (!r || typeof r !== 'object' || Array.isArray(r)
      || !['modeles', 'dates', 'prochaines', 'destinataires'].every((cle) => Array.isArray(r[cle]))) {
    throw new Error('réponse RPC invalide');
  }
  const dates = /** @type {DateEnrichie[]} */ (r.dates);
  /** @param {unknown} valeur @returns {string | null} */
  const date = (valeur) => {
    if (valeur === null || typeof valeur === 'string') return valeur;
    const cible = typeof valeur === 'number' ? dates[valeur] : undefined;
    if (!cible) throw new Error('réponse RPC invalide');
    return cible.id;
  };
  /** @type {Destinataire[]} */
  const destinataires = [];
  /** @type {Rattachement[]} */
  const rattachements = [];
  /** @type {Envoi[]} */
  const envois = [];
  for (const ligne of /** @type {unknown[]} */ (r.destinataires)) {
    const [id, aDemander, desinscrit, annonces, confirmeLe, sesRattachements, sesEnvois] = tuple(ligne, 7);
    if (typeof id !== 'string' || !Array.isArray(sesRattachements) || !Array.isArray(sesEnvois)) throw new Error('réponse RPC invalide');
    destinataires.push({
      id, abonnement_a_confirmer: aDemander === true, desinscrit: desinscrit === true, annonces: annonces === true,
      confirme_le: instantRpc(confirmeLe),
    });
    for (const rattachement of sesRattachements) {
      const [calendrierId, origine, creeLe] = tuple(rattachement, 3);
      const calendrier = date(calendrierId);
      if (calendrier === null) throw new Error('réponse RPC invalide');
      rattachements.push({
        destinataire_id: id, calendrier_id: calendrier,
        origine: /** @type {Rattachement['origine']} */ (origine), cree_le: /** @type {string} */ (instantRpc(creeLe)),
      });
    }
    for (const envoi of sesEnvois) {
      const [etape, calendrierId, statut, raison, prevuLe] = tuple(envoi, 5);
      envois.push({
        destinataire_id: id, etape: /** @type {Etape} */ (etape), calendrier_id: date(calendrierId),
        statut: /** @type {Envoi['statut']} */ (statut), raison: /** @type {string | null} */ (raison),
        prevu_le: /** @type {string} */ (instantRpc(prevuLe)),
      });
    }
  }
  return {
    modeles: /** @type {ModeleRpc[]} */ (r.modeles),
    dates,
    prochaines: /** @type {DateEnrichie[]} */ (r.prochaines),
    destinataires,
    rattachements,
    envois,
  };
}

// ——— Échéances ———

/**
 * Échéance d'une étape datée : `date_soiree` + `jours_decalage`, à `heure_envoi`, heure de Paris.
 * Null pour confirmation, bienvenue et message, et pour un réglage incomplet.
 * @param {{ cle: string, jours_decalage: number | null, heure_envoi: string | null }} modele
 * @param {{ date_soiree: string }} date
 * @returns {Date | null}
 */
export function echeance(modele, date) {
  const { jours_decalage: jours, heure_envoi: heure } = modele;
  if (SANS_ECHEANCE.has(modele.cle) || typeof jours !== 'number' || !Number.isInteger(jours) || typeof heure !== 'string') return null;
  return new Date(instantParis(decalerJour(date.date_soiree, jours), heure));
}

/** Soirée liée annulée ou reportée : garde-fou du design (§2), pour une date qui se dit confirmée. */
export const soireeSuspendue = (/** @type {DateEnrichie | null | undefined} */ date) => (
  date?.soiree?.statut === 'annulee' || date?.soiree?.statut === 'reportee'
);

/**
 * @template {ReglageModele} M
 * @param {readonly M[]} modeles
 * @returns {Map<string, M>} les seuls modèles actifs : un modèle absent est inactif
 */
const modelesActifs = (modeles) => new Map(modeles.filter((modele) => modele.actif).map((modele) => [modele.cle, modele]));

/**
 * @template T
 * @param {readonly T[]} lignes
 * @param {(ligne: T) => string} cle
 * @returns {Map<string, T[]>}
 */
function grouper(lignes, cle) {
  /** @type {Map<string, T[]>} */
  const groupes = new Map();
  for (const ligne of lignes) {
    const valeur = cle(ligne);
    const groupe = groupes.get(valeur);
    if (groupe) groupe.push(ligne);
    else groupes.set(valeur, [ligne]);
  }
  return groupes;
}

const comparerTextes = (/** @type {string} */ a, /** @type {string} */ b) => (a < b ? -1 : a > b ? 1 : 0);

/** Tri des dates de la RPC : `date_soiree`, puis `heure` (nulle en dernier), puis `id`. */
export const comparerDates = (/** @type {DateEnrichie} */ a, /** @type {DateEnrichie} */ b) => (
  comparerTextes(a.date_soiree, b.date_soiree) || comparerTextes(a.heure ?? '~', b.heure ?? '~') || comparerTextes(a.id, b.id)
);

// ——— Calcul d'un passage ———

/**
 * @typedef {{
 *   maintenant: number,
 *   modeles: Map<string, ModeleRpc>,
 *   dates: Map<string, DateEnrichie>,
 *   datesTriees: DateEnrichie[],
 *   prochaines: DateEnrichie[],
 *   rattachements: Map<string, Rattachement[]>,
 *   envois: Map<string, Envoi[]>,
 *   echeance: (modele: ModeleRpc, date: DateEnrichie) => number | null,
 *   debutDuJour: (date: DateEnrichie) => number,
 *   jour: (ms: number) => string,
 * }} Contexte
 */

/**
 * Rang d'un envoi sous le plafond (plus petit = prioritaire), et le jour qu'il occupe.
 * @typedef {{ palier: number, dateSoiree: string, instant: number, jour: string }} Rang
 */
/** @typedef {Rang & { envoi: EnvoiPrevu }} Candidat */

/**
 * Ce qui, chez un destinataire, décide du sort de ses étapes de date.
 * @typedef {{ destinataire: Destinataire, jourBienvenue: string | null, prochainesRecentes: boolean }} Situation
 */

/** Palier, puis date la plus proche, puis échéance la plus tôt. */
const comparerRangs = (/** @type {Rang} */ a, /** @type {Rang} */ b) => (
  a.palier - b.palier || comparerTextes(a.dateSoiree, b.dateSoiree) || a.instant - b.instant
);

/**
 * Les mêmes échéances et les mêmes jours reviennent pour des milliers de destinataires : ils sont
 * calculés une fois par passage.
 * @param {EmailsATraiter} donnees
 * @param {number} maintenant
 * @returns {Contexte}
 */
function preparer(donnees, maintenant) {
  /** @type {Map<string, number | null>} */
  const echeances = new Map();
  /** @type {Map<string, number>} */
  const debuts = new Map();
  /** @type {Map<number, string>} */
  const jours = new Map();
  return {
    maintenant,
    modeles: modelesActifs(donnees.modeles),
    dates: new Map(donnees.dates.map((date) => [date.id, date])),
    datesTriees: [...donnees.dates].sort(comparerDates),
    prochaines: donnees.prochaines,
    rattachements: grouper(donnees.rattachements, (rattachement) => rattachement.destinataire_id),
    envois: grouper(donnees.envois, (envoi) => envoi.destinataire_id),
    echeance(modele, date) {
      const cle = `${modele.cle} ${date.id}`;
      if (!echeances.has(cle)) echeances.set(cle, echeance(modele, date)?.getTime() ?? null);
      return /** @type {number | null} */ (echeances.get(cle));
    },
    debutDuJour(date) {
      if (!debuts.has(date.id)) debuts.set(date.id, instantParis(date.date_soiree, '00:00'));
      return /** @type {number} */ (debuts.get(date.id));
    },
    jour(ms) {
      if (!jours.has(ms)) jours.set(ms, jourDesSoirees(ms));
      return /** @type {string} */ (jours.get(ms));
    },
  };
}

/**
 * @param {string} destinataireId
 * @param {Etape} etape
 * @param {string[]} calendrierIds
 * @param {number} instant
 * @returns {EnvoiPrevu}
 */
const envoiPrevu = (destinataireId, etape, calendrierIds, instant) => ({
  destinataireId, etape, calendrierIds, prevuLe: new Date(instant).toISOString(),
});

/** Un envoi existe déjà pour cette étape et cette date, quel que soit son statut. */
const aUnEnvoi = (/** @type {Envoi[]} */ envois, /** @type {Etape} */ etape, /** @type {string | null} */ calendrierId) => (
  envois.some((envoi) => envoi.etape === etape && envoi.calendrier_id === calendrierId)
);

/** Un envoi compté de cette étape, toutes dates confondues, prévu il y a moins de 7 jours. */
const envoiRecent = (/** @type {readonly Envoi[]} */ envois, /** @type {Etape} */ etape, /** @type {number} */ maintenant) => (
  envois.some((envoi) => envoi.etape === etape && compte(envoi) && maintenant - Date.parse(envoi.prevu_le) < DELAI_GLISSANT_MS)
);

/**
 * La date de l'inscription (rattachement d'origine `inscription` le plus récent) et l'encart. Seule
 * une date confirmée, dont la soirée liée n'est ni annulée ni reportée, est citée : la RPC peut renvoyer une
 * date lointaine annulée ou prévisionnelle.
 * @param {string | null} confirmeLe
 * @param {readonly Rattachement[]} rattachements du destinataire
 * @param {Map<string, DateEnrichie>} dates
 * @returns {{ date: DateEnrichie | null, encartDateProche: boolean }}
 */
function bienvenuePour(confirmeLe, rattachements, dates) {
  /** @type {DateEnrichie | null} */
  let date = null;
  let creeLe = -Infinity;
  for (const rattachement of rattachements) {
    const candidate = rattachement.origine === 'inscription' ? dates.get(rattachement.calendrier_id) : undefined;
    if (candidate && Date.parse(rattachement.cree_le) >= creeLe) {
      date = candidate;
      creeLe = Date.parse(rattachement.cree_le);
    }
  }
  if (!date || date.statut !== 'confirmee' || soireeSuspendue(date)) return { date: null, encartDateProche: false };
  if (confirmeLe === null) return { date, encartDateProche: false };
  const ecart = ecartJours(jourDesSoirees(Date.parse(confirmeLe)), date.date_soiree);
  return { date, encartDateProche: ecart >= 0 && ecart <= ENCART_JOURS_MAX };
}

/**
 * Date de la bienvenue d'un destinataire, pour son rendu ({{date}}, {{ville}}, encart) : la date
 * rattachée par l'inscription, si elle figure dans `donnees.dates`, qu'elle est confirmée et que sa soirée
 * liée n'est ni annulée ni reportée ; sinon null. `encartDateProche` vaut vrai si la date tombe 0 à
 * 7 jours (Paris) après `confirme_le`.
 * @param {Pick<EmailsATraiter, 'dates' | 'rattachements'>} donnees
 * @param {Pick<Destinataire, 'id' | 'confirme_le'>} destinataire
 * @returns {{ date: DateEnrichie | null, encartDateProche: boolean }}
 */
export function dateDeBienvenue(donnees, destinataire) {
  const rattachements = donnees.rattachements.filter((rattachement) => rattachement.destinataire_id === destinataire.id);
  return bienvenuePour(destinataire.confirme_le, rattachements, new Map(donnees.dates.map((date) => [date.id, date])));
}

/**
 * Sort d'une étape de date (règle 3), conditions dans l'ordre du brief :
 * 'candidat' (part, sous réserve du plafond), 'rien' (suspendue, rien n'est enregistré : elle
 * repart si la situation change dans sa fenêtre) ou la raison du saut.
 * @param {typeof ETAPES_DE_DATE[number]} etape
 * @param {DateEnrichie} date
 * @param {Rattachement} rattachement
 * @param {number} instant échéance
 * @param {Situation} situation
 * @param {Contexte} ctx
 * @returns {'candidat' | 'rien' | RaisonSaut}
 */
function issueEtape(etape, date, rattachement, instant, situation, ctx) {
  if (instant < Date.parse(rattachement.cree_le)) return 'deja_passe_a_l_inscription';
  if (ctx.jour(instant) === situation.jourBienvenue) return 'meme_jour_que_bienvenue';
  if (etape === 'prochaines_dates') {
    if (!situation.destinataire.annonces) return 'rien';
    // Une personne rattachée à plusieurs dates ne reçoit pas deux fois les mêmes prochaines dates.
    if (situation.prochainesRecentes) return 'prochaines_dates_recent';
    if (ctx.prochaines.length === 0) return 'aucune_date';
  } else if (date.statut === 'annulee') {
    return 'date_annulee';
  } else if (date.statut !== 'confirmee' || soireeSuspendue(date)) {
    // Étapes 2 à 5 suspendues : date redevenue prévisionnelle, ou soirée liée annulée ou reportée
    // (pas de rappel, ni de « merci » le lendemain, pour une soirée qui n'a pas lieu).
    return 'rien';
  }
  if (ctx.maintenant > instant + FENETRE_ENVOI_MS) return 'fenetre_depassee';
  return 'candidat';
}

/**
 * Règle 4 : une seule annonce regroupe les dates confirmées non rattachées, pas encore annoncées,
 * dont le J-10 est passé et la date pas commencée, plus les dates de leur semaine (lundi à
 * dimanche). Elle ne part qu'à partir de l'heure de l'annonce (10:00), dans sa fenêtre de 12 h :
 * une annonce reportée ne part jamais à l'aube.
 * @param {Destinataire} destinataire
 * @param {readonly Rattachement[]} rattachements
 * @param {readonly Envoi[]} envois
 * @param {Contexte} ctx
 * @returns {Candidat | null}
 */
function annonceDe(destinataire, rattachements, envois, ctx) {
  const modele = ctx.modeles.get('annonce');
  if (!modele || !destinataire.annonces || modele.heure_envoi === null) return null;
  const ouverture = instantParis(jourCalendaire(ctx.maintenant), modele.heure_envoi);
  if (ctx.maintenant < ouverture || ctx.maintenant > ouverture + FENETRE_ENVOI_MS) return null;
  if (envoiRecent(envois, 'annonce', ctx.maintenant)) return null;
  const rattachees = new Set(rattachements.map((rattachement) => rattachement.calendrier_id));
  const annoncees = new Set(envois.filter((envoi) => envoi.etape === 'annonce').map((envoi) => envoi.calendrier_id));
  const possibles = ctx.datesTriees.filter((date) => (
    date.statut === 'confirmee' && !soireeSuspendue(date) && !rattachees.has(date.id) && !annoncees.has(date.id)
    && ctx.maintenant < ctx.debutDuJour(date)
  ));
  const ouvertes = possibles.filter((date) => (ctx.echeance(modele, date) ?? Infinity) <= ctx.maintenant);
  if (ouvertes.length === 0) return null;
  const semaines = new Set(ouvertes.map((date) => lundiDe(date.date_soiree)));
  const retenues = possibles.filter((date) => semaines.has(lundiDe(date.date_soiree)));
  return {
    envoi: envoiPrevu(destinataire.id, 'annonce', retenues.map((date) => date.id), ctx.maintenant),
    palier: PALIERS.annonce,
    dateSoiree: '',
    instant: ctx.maintenant,
    jour: ctx.jour(ctx.maintenant),
  };
}

/**
 * Règle 5 : un e-mail automatique par personne et par jour. Le plus prioritaire part ; les autres
 * sont sautés (`plafond_jour`), sauf l'annonce, reportée sans rien enregistrer. Un envoi dû attend,
 * sans rien enregistrer, si une étape plus prioritaire tombe plus tard le même jour : la priorité
 * vaut pour la journée, pas seulement pour le passage.
 * @param {Candidat[]} candidats
 * @param {Rang[]} attendus étapes de date candidates, pas encore dues
 * @param {Set<string>} occupes jours déjà pris par un envoi
 */
function appliquerPlafond(candidats, attendus, occupes) {
  /** @type {EnvoiPrevu[]} */
  const aEnvoyer = [];
  /** @type {EnvoiPrevu[]} */
  const sautes = [];
  for (const candidat of [...candidats].sort(comparerRangs)) {
    if (!occupes.has(candidat.jour)) {
      if (attendus.some((attendu) => attendu.jour === candidat.jour && comparerRangs(attendu, candidat) < 0)) continue;
      occupes.add(candidat.jour);
      aEnvoyer.push(candidat.envoi);
    } else if (candidat.envoi.etape !== 'annonce') {
      sautes.push({ ...candidat.envoi, raison: 'plafond_jour' });
    }
  }
  return { aEnvoyer, sautes };
}

/**
 * @param {Destinataire} destinataire
 * @param {Contexte} ctx
 * @returns {{ aEnvoyer: EnvoiPrevu[], sautes: EnvoiPrevu[] }}
 */
function envoisDe(destinataire, ctx) {
  const envois = ctx.envois.get(destinataire.id) ?? [];
  const rattachements = ctx.rattachements.get(destinataire.id) ?? [];
  /** @type {EnvoiPrevu[]} */
  const aEnvoyer = [];
  /** @type {EnvoiPrevu[]} */
  const sautes = [];

  // Règle 1 : la demande de confirmation, hors plafond, même pour une adresse désinscrite.
  if (destinataire.abonnement_a_confirmer && ctx.modeles.has('confirmation') && !aUnEnvoi(envois, 'confirmation', null)) {
    aEnvoyer.push(envoiPrevu(destinataire.id, 'confirmation', [], ctx.maintenant));
  }
  const confirmeLe = destinataire.confirme_le;
  if (destinataire.desinscrit || confirmeLe === null) return { aEnvoyer, sautes };

  /** @type {Candidat[]} */
  const candidats = [];
  /** @type {Rang[]} */
  const attendus = [];

  // Règle 2 : la bienvenue, dans les 12 h qui suivent la confirmation ; examinée pendant 24 h (horizon).
  const bienvenue = envois.find((envoi) => envoi.etape === 'bienvenue' && compte(envoi));
  let jourBienvenue = bienvenue ? ctx.jour(Date.parse(bienvenue.prevu_le)) : null;
  const confirmation = Date.parse(confirmeLe);
  if (ctx.modeles.has('bienvenue') && !aUnEnvoi(envois, 'bienvenue', null) && ctx.maintenant <= confirmation + HORIZON_BIENVENUE_MS) {
    if (ctx.maintenant > confirmation + FENETRE_ENVOI_MS) {
      sautes.push({ ...envoiPrevu(destinataire.id, 'bienvenue', [], confirmation), raison: 'fenetre_depassee' });
    } else {
      const { encartDateProche } = bienvenuePour(confirmeLe, rattachements, ctx.dates);
      jourBienvenue = ctx.jour(ctx.maintenant);
      candidats.push({
        envoi: { ...envoiPrevu(destinataire.id, 'bienvenue', [], ctx.maintenant), encartDateProche },
        palier: PALIERS.bienvenue,
        dateSoiree: '',
        instant: ctx.maintenant,
        jour: jourBienvenue,
      });
    }
  }

  // Règle 3 : les étapes de chaque date rattachée. Deux « prochaines dates » ne tombent jamais dans
  // le même passage (24 h d'écart au moins, ou le même jour, réglé par le plafond) : seul
  // l'historique compte pour les 7 jours.
  /** @type {Situation} */
  const situation = { destinataire, jourBienvenue, prochainesRecentes: envoiRecent(envois, 'prochaines_dates', ctx.maintenant) };
  for (const rattachement of rattachements) {
    const date = ctx.dates.get(rattachement.calendrier_id);
    if (!date) continue;
    // Horizon : un rattachement récent examine toutes ses étapes (déjà passées à l'inscription comprises).
    const rattachementRecent = ctx.maintenant - Date.parse(rattachement.cree_le) <= HORIZON_ETAPE_MS;
    for (const etape of ETAPES_DE_DATE) {
      const modele = ctx.modeles.get(etape);
      const instant = modele ? ctx.echeance(modele, date) : null;
      if (instant === null || aUnEnvoi(envois, etape, date.id)) continue;
      if (!rattachementRecent && ctx.maintenant - instant > HORIZON_ETAPE_MS) continue;
      const issue = issueEtape(etape, date, rattachement, instant, situation, ctx);
      /** @type {Rang} */
      const rang = { palier: PALIERS[etape], dateSoiree: date.date_soiree, instant, jour: ctx.jour(instant) };
      if (instant > ctx.maintenant) {
        if (issue === 'candidat') attendus.push(rang);
      } else if (issue === 'candidat') {
        candidats.push({ ...rang, envoi: envoiPrevu(destinataire.id, etape, [date.id], instant) });
      } else if (issue !== 'rien') {
        sautes.push({ ...envoiPrevu(destinataire.id, etape, [date.id], instant), raison: issue });
      }
    }
  }

  // Règle 4 : l'annonce des autres dates.
  const annonce = annonceDe(destinataire, rattachements, envois, ctx);
  if (annonce) candidats.push(annonce);

  // Règle 5 : le plafond journalier.
  const occupes = new Set(envois
    .filter((envoi) => compte(envoi) && !HORS_PLAFOND.has(envoi.etape))
    .map((envoi) => ctx.jour(Date.parse(envoi.prevu_le))));
  const plafond = appliquerPlafond(candidats, attendus, occupes);
  return { aEnvoyer: [...aEnvoyer, ...plafond.aEnvoyer], sautes: [...sautes, ...plafond.sautes] };
}

/**
 * Ce qu'un passage du planificateur doit réserver (`aEnvoyer`) et enregistrer sauté (`sautes`).
 * Un modèle inactif ou absent ne produit rien. Une étape qui a déjà une ligne d'envoi, quel que
 * soit son statut, n'est jamais recalculée.
 * @param {EmailsATraiter} donnees réponse de la RPC, `envois` du mode courant
 * @param {Date} maintenant
 * @returns {{ aEnvoyer: EnvoiPrevu[], sautes: EnvoiPrevu[] }}
 */
export function calculerEnvois(donnees, maintenant) {
  const ctx = preparer(donnees, maintenant.getTime());
  /** @type {EnvoiPrevu[]} */
  const aEnvoyer = [];
  /** @type {EnvoiPrevu[]} */
  const sautes = [];
  for (const destinataire of donnees.destinataires) {
    const resultat = envoisDe(destinataire, ctx);
    aEnvoyer.push(...resultat.aEnvoyer);
    sautes.push(...resultat.sautes);
  }
  return { aEnvoyer, sautes };
}

/**
 * Estimation de l'admin : les étapes de date prévues dans les `jours` prochains jours, une par date,
 * avec le nombre de rattachés. Sans plafonds ni historique d'envois, sans consentement : les
 * prochaines dates sont comptées sur tous les rattachés. Les annonces, qui visent les non-rattachés,
 * n'y figurent pas. Une date annulée ou prévisionnelle ne garde que ses prochaines dates.
 * @param {readonly ReglageModele[]} modeles
 * @param {readonly DateEstimee[]} dates
 * @param {Record<string, number>} rattachesParDate
 * @param {Date} maintenant
 * @param {number} [jours]
 * @returns {EnvoiEstime[]}
 */
export function envoisAVenir(modeles, dates, rattachesParDate, maintenant, jours = 7) {
  const actifs = modelesActifs(modeles);
  const debut = maintenant.getTime();
  const fin = debut + jours * JOUR_MS;
  /** @type {(Omit<EnvoiEstime, 'prevuLe'> & { instant: number })[]} */
  const prevus = [];
  for (const date of dates) {
    for (const etape of ETAPES_DE_DATE) {
      const modele = actifs.get(etape);
      if (!modele || (etape !== 'prochaines_dates' && date.statut !== 'confirmee')) continue;
      const instant = echeance(modele, date)?.getTime();
      if (instant === undefined || instant < debut || instant >= fin) continue;
      prevus.push({ etape, calendrierId: date.id, instant, destinataires: rattachesParDate[date.id] ?? 0 });
    }
  }
  return prevus
    .sort((a, b) => a.instant - b.instant || ETAPES.indexOf(a.etape) - ETAPES.indexOf(b.etape) || comparerTextes(a.calendrierId, b.calendrierId))
    .map(({ instant, ...prevu }) => ({ ...prevu, prevuLe: new Date(instant).toISOString() }));
}
