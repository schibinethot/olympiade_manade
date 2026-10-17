// @ts-check
// Calcul des échéances de la séquence d'e-mails (design §4) : quels e-mails partent, quand, et
// lesquels sont sautés. Fonctions pures, importées par le planificateur (envoi) et par l'admin
// (estimation des envois à venir). Isomorphe : aucun import node:*, aucune dépendance.
//
// Fuseau : heures et jours de Paris, changements d'heure compris. Un « jour » court jusqu'à 06:00
// le lendemain, comme prive.jour_des_soirees en base : une inscription à 00:30, pendant la soirée,
// compte encore pour la date de la veille (encart, plafond, même jour que la bienvenue).

import { ETAPES, lireJour } from './gabarits-emails.mjs';

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
 * @typedef {{
 *   id: string,
 *   email: string,
 *   prenom: string | null,
 *   profil_id: string | null,
 *   abonne: boolean,
 *   abonnement_a_confirmer: boolean,
 *   desinscrit: boolean,
 *   annonces: boolean,
 *   confirme_le: string | null,
 *   inscrit_le: string,
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
 * @typedef {{
 *   id: string,
 *   destinataire_id: string,
 *   etape: Etape,
 *   calendrier_id: string | null,
 *   message_id: string | null,
 *   reel: boolean,
 *   statut: 'en_attente' | 'envoye' | 'simule' | 'echec' | 'saute',
 *   raison: string | null,
 *   tentatives: number,
 *   prevu_le: string,
 *   envoye_le: string | null,
 *   cree_le: string,
 * }} Envoi
 */

/**
 * Réponse de la RPC `emails_a_traiter(p_maintenant, p_reel)`. `envois` ne contient que ceux du mode courant.
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
 *   | 'fenetre_depassee' | 'plafond_jour'} RaisonSaut
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

const FUSEAU = 'Europe/Paris';
const HEURE_MS = 3_600_000;
const JOUR_MS = 24 * HEURE_MS;
/** Une étape due part dans les 12 h qui suivent son échéance ; au-delà, elle est sautée. */
const FENETRE_ENVOI_MS = 12 * HEURE_MS;
/** Au plus une annonce par personne tous les 7 jours glissants. */
const DELAI_ENTRE_ANNONCES_MS = 7 * JOUR_MS;
/** Jusqu'à cette heure, la nuit compte encore pour la veille (prive.jour_des_soirees). */
const FIN_DES_SOIREES_MS = 6 * HEURE_MS;
/** Encart « date proche » de la bienvenue : la date tombe 0 à 7 jours après la confirmation. */
const ENCART_JOURS_MAX = 7;

const ETAPES_DE_DATE = /** @type {const} */ (['j_moins_7', 'veille', 'jour_j', 'lendemain', 'prochaines_dates']);
/** Étapes 2 à 4 : suspendues quand la soirée liée est annulée ou reportée. */
const RAPPELS = new Set(['j_moins_7', 'veille', 'jour_j']);
const SANS_ECHEANCE = new Set(['confirmation', 'bienvenue', 'message']);
/** Statuts qui occupent le plafond (et la fenêtre des annonces). */
const STATUTS_COMPTES = new Set(['envoye', 'simule', 'en_attente']);
const HORS_PLAFOND = new Set(['confirmation', 'message']);
/**
 * Ordre de priorité sous le plafond : bienvenue, étapes de la date la plus proche, lendemain,
 * annonce, prochaines dates.
 * @type {Record<'bienvenue' | 'annonce' | typeof ETAPES_DE_DATE[number], number>}
 */
const PALIERS = { bienvenue: 0, j_moins_7: 1, veille: 1, jour_j: 1, lendemain: 2, annonce: 3, prochaines_dates: 4 };

// ——— Heure de Paris ———

const PARTIES_PARIS = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSEAU, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** Heure murale de Paris à l'instant `ms`, exprimée comme si elle était en UTC (à la seconde). */
function murParis(/** @type {number} */ ms) {
  /** @type {Record<string, number>} */
  const parties = {};
  for (const { type, value } of PARTIES_PARIS.formatToParts(ms)) if (type !== 'literal') parties[type] = Number(value);
  return Date.UTC(parties.year, parties.month - 1, parties.day, parties.hour, parties.minute, parties.second);
}

/** Écart entre l'heure de Paris et UTC à l'instant `ms` (+1 h ou +2 h). */
function decalageParis(/** @type {number} */ ms) {
  const seconde = Math.floor(ms / 1000) * 1000;
  return murParis(seconde) - seconde;
}

const jourUtc = (/** @type {number} */ ms) => new Date(ms).toISOString().slice(0, 10);

/** Jour calendaire de Paris : « AAAA-MM-JJ ». */
const jourCalendaire = (/** @type {number} */ ms) => jourUtc(murParis(ms));

/** Jour « des soirées » : avant 06:00 (Paris), l'instant compte encore pour la veille. */
const jourDesSoirees = (/** @type {number} */ ms) => jourUtc(murParis(ms) - FIN_DES_SOIREES_MS);

const decalerJour = (/** @type {string} */ jour, /** @type {number} */ jours) => jourUtc(lireJour(jour).utc.getTime() + jours * JOUR_MS);

const ecartJours = (/** @type {string} */ de, /** @type {string} */ a) => Math.round((lireJour(a).utc.getTime() - lireJour(de).utc.getTime()) / JOUR_MS);

/** Lundi de la semaine (lundi à dimanche) d'un jour : clé de regroupement des annonces. */
const lundiDe = (/** @type {string} */ jour) => decalerJour(jour, -((lireJour(jour).utc.getUTCDay() + 6) % 7));

/**
 * Instant (ms) du jour `jour` à l'heure `heure` de Paris.
 * @param {string} jour « AAAA-MM-JJ »
 * @param {string} heure « HH:MM » ou « HH:MM:SS »
 */
function instantParis(jour, heure) {
  const morceaux = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(heure);
  const [heures, minutes, secondes] = morceaux ? [morceaux[1], morceaux[2], morceaux[3] ?? '0'].map(Number) : [];
  if (!morceaux || heures > 23 || minutes > 59 || secondes > 59) throw new RangeError(`Heure invalide : ${heure}`);
  const mur = lireJour(jour).utc.getTime() + ((heures * 60 + minutes) * 60 + secondes) * 1000;
  // Le décalage lu à l'heure murale prise pour UTC peut être faux d'une heure près d'un changement
  // d'heure : on le relit à l'instant obtenu.
  return mur - decalageParis(mur - decalageParis(mur));
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
const soireeSuspendue = (/** @type {DateEnrichie} */ date) => date.soiree?.statut === 'annulee' || date.soiree?.statut === 'reportee';

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
const comparerDates = (/** @type {DateEnrichie} */ a, /** @type {DateEnrichie} */ b) => (
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

/**
 * La date de l'inscription (rattachement d'origine `inscription` le plus récent) et l'encart.
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
  if (!date || confirmeLe === null || date.statut !== 'confirmee' || soireeSuspendue(date)) return { date, encartDateProche: false };
  const ecart = ecartJours(jourDesSoirees(Date.parse(confirmeLe)), date.date_soiree);
  return { date, encartDateProche: ecart >= 0 && ecart <= ENCART_JOURS_MAX };
}

/**
 * Date de la bienvenue d'un destinataire, pour son rendu ({{date}}, {{ville}}, encart) : la date
 * rattachée par l'inscription, si elle figure dans `donnees.dates`. `encartDateProche` vaut vrai si
 * elle est confirmée, sans soirée suspendue, et tombe 0 à 7 jours (Paris) après `confirme_le`.
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
 * @param {Destinataire} destinataire
 * @param {string | null} jourBienvenue
 * @param {Contexte} ctx
 * @returns {'candidat' | 'rien' | RaisonSaut}
 */
function issueEtape(etape, date, rattachement, instant, destinataire, jourBienvenue, ctx) {
  if (instant < Date.parse(rattachement.cree_le)) return 'deja_passe_a_l_inscription';
  if (ctx.jour(instant) === jourBienvenue) return 'meme_jour_que_bienvenue';
  if (etape === 'prochaines_dates') {
    if (!destinataire.annonces) return 'rien';
    if (ctx.prochaines.length === 0) return 'aucune_date';
  } else if (date.statut === 'annulee') {
    return 'date_annulee';
  } else if (date.statut !== 'confirmee' || (RAPPELS.has(etape) && soireeSuspendue(date))) {
    // Date redevenue prévisionnelle, ou soirée liée annulée ou reportée : suspendue.
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
  const annonces = envois.filter((envoi) => envoi.etape === 'annonce');
  const recente = annonces.some((envoi) => STATUTS_COMPTES.has(envoi.statut) && ctx.maintenant - Date.parse(envoi.prevu_le) < DELAI_ENTRE_ANNONCES_MS);
  if (recente) return null;
  const rattachees = new Set(rattachements.map((rattachement) => rattachement.calendrier_id));
  const annoncees = new Set(annonces.map((envoi) => envoi.calendrier_id));
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

  // Règle 2 : la bienvenue, dans les 12 h qui suivent la confirmation.
  const bienvenue = envois.find((envoi) => envoi.etape === 'bienvenue' && STATUTS_COMPTES.has(envoi.statut));
  let jourBienvenue = bienvenue ? ctx.jour(Date.parse(bienvenue.prevu_le)) : null;
  if (ctx.modeles.has('bienvenue') && !aUnEnvoi(envois, 'bienvenue', null)) {
    const confirmation = Date.parse(confirmeLe);
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

  // Règle 3 : les étapes de chaque date rattachée.
  for (const rattachement of rattachements) {
    const date = ctx.dates.get(rattachement.calendrier_id);
    if (!date) continue;
    for (const etape of ETAPES_DE_DATE) {
      const modele = ctx.modeles.get(etape);
      const instant = modele ? ctx.echeance(modele, date) : null;
      if (instant === null || aUnEnvoi(envois, etape, date.id)) continue;
      const issue = issueEtape(etape, date, rattachement, instant, destinataire, jourBienvenue, ctx);
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
    .filter((envoi) => STATUTS_COMPTES.has(envoi.statut) && !HORS_PLAFOND.has(envoi.etape))
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
