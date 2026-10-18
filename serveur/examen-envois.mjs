// @ts-check
// Examen d'un groupe de lignes d'envoi réclamées, juste avant l'envoi (fonctions sans entrée-sortie). Le
// planificateur relit, juste avant l'appel, le destinataire, les dates du lot (prochaines dates comprises) et les
// modèles : un état changé depuis la réservation l'emporte (désinscription, consentement, date annulée, déplacée ou
// supprimée, soirée suspendue, modèle désactivé ou réglé autrement, fenêtre dépassée).

import {
  DELAIS_NOUVEL_ESSAI_MS,
  ETAPES_DE_DATE,
  FENETRE_ENVOI_MS,
  TENTATIVES_MAX,
  comparerDates,
  dateDeBienvenue,
  echeance,
  soireeSuspendue,
} from './echeances-emails.mjs';
import { HEURE_MS, heureParis } from './emails-rest.mjs';
import { liensPour } from './liens-emails.mjs';

/** @typedef {import('./emails-rest.mjs').LigneEnvoi} LigneEnvoi */
/** @typedef {import('./emails-rest.mjs').DestinataireEnvoi} DestinataireEnvoi */
/** @typedef {import('./gabarits-emails.mjs').DateEnrichie} DateEnrichie */
/** @typedef {import('./gabarits-emails.mjs').DateAnnoncee} DateAnnoncee */
/** @typedef {import('./gabarits-emails.mjs').ContexteEmail} ContexteEmail */
/** @typedef {import('./gabarits-emails.mjs').ModeleEmail} ModeleEmail */
/** @typedef {import('./echeances-emails.mjs').EmailsATraiter} EmailsATraiter */
/** @typedef {import('./echeances-emails.mjs').ModeleRpc} ModeleRpc */

/** Le message n° 8 ne part plus 24 h après sa création : l'information serait périmée. */
const FENETRE_MESSAGE_MS = 24 * HEURE_MS;
// Délais des nouveaux essais et nombre d'essais : définis dans le module isomorphe (libellés de l'admin).
export { DELAIS_NOUVEL_ESSAI_MS, TENTATIVES_MAX };

/** Étapes 2 à 5 (rappels d'une date suivie) : leur date est relue au moment de l'envoi. */
const ETAPES_RAPPEL = new Set(['j_moins_7', 'veille', 'jour_j', 'lendemain']);
/** Étapes calées sur une date : l'échéance est recalculée au moment de l'envoi (date ou réglage changé). */
const ETAPES_CALEES = new Set(/** @type {readonly string[]} */ (ETAPES_DE_DATE));

/**
 * @typedef {{
 *   donnees: EmailsATraiter,
 *   dates: Map<string, DateEnrichie>,
 *   modeles: Map<string, ModeleRpc>,
 *   messages: Map<string, { id: string, sujet: string, corps: string }>,
 *   origine: string,
 *   cleLiens: string,
 *   organisateur: string | null,
 * }} ContexteEnvoi
 */

/**
 * `liberees` : lignes réservées pour une échéance qui n'est plus la bonne (date déplacée, réglage changé), à
 * supprimer sans envoi pour que la nouvelle échéance se réserve au calcul suivant (l'unicité l'en empêcherait).
 * @typedef {{
 *   sautes: { ids: string[], raison: string }[],
 *   liberees: string[],
 *   envoi: { lignes: LigneEnvoi[], modele: ModeleEmail, contexte: ContexteEmail, entetes: Record<string, string> } | null,
 * }} Examen
 */

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

/**
 * Une ligne peut être réclamée : jamais réclamée (ou rendue après une relecture impossible), ou en attente d'un
 * nouvel essai dont le délai est passé (5, 30 puis 120 min après l'essai précédent).
 * @param {LigneEnvoi} ligne @param {number} instant
 */
export function eligible(ligne, instant) {
  if (ligne.raison === null) return true;
  if (ligne.raison !== 'envoi_impossible') return false;
  const delai = DELAIS_NOUVEL_ESSAI_MS[Math.max(0, Math.min(ligne.tentatives, DELAIS_NOUVEL_ESSAI_MS.length) - 1)];
  const derniere = Date.parse(ligne.envoye_le ?? '');
  return Number.isNaN(derniere) || derniere + delai <= instant;
}

/** @param {LigneEnvoi[]} lignes @returns {LigneEnvoi[][]} */
export function grouper(lignes) {
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

/**
 * Ce qu'il faut faire d'un groupe de lignes réclamées : lignes sautées (avec leur raison), lignes à libérer et,
 * peut-être, un e-mail à rendre et envoyer.
 * @param {LigneEnvoi[]} groupe
 * @param {DestinataireEnvoi | null} d destinataire relu après la réclamation
 * @param {ContexteEnvoi} ctx
 * @param {number} instant
 * @returns {Examen}
 */
export function examiner(groupe, d, ctx, instant) {
  const premiere = groupe[0];
  const etape = premiere.etape;
  /** @returns {Examen} */
  const tout = (/** @type {string} */ raison) => ({ sautes: [{ ids: groupe.map((l) => l.id), raison }], liberees: [], envoi: null });
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

  const liens = liensPour({ origine: ctx.origine, cle: ctx.cleLiens, destinataireId: d.id, maintenant: instant });
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

  if (ETAPES_RAPPEL.has(etape)) {
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
      if (!valides.length) return { sautes, liberees: [], envoi: null };
      valides.sort((a, b) => comparerDates(a.date, b.date));
      lignes = valides.map((v) => v.ligne);
      date = valides[0].date;
      annoncees = valides.map((v) => ({ ...v.date, lienJeViens: jeViensPour(v.date) }));
    }
  } else if (etape === 'bienvenue') {
    // Dates relues du lot : une date annulée, ou dont la soirée est suspendue, depuis le calcul n'est pas citée.
    const bienvenue = dateDeBienvenue(
      { dates: [...ctx.dates.values()], rattachements: ctx.donnees.rattachements },
      { id: d.id, confirme_le: d.confirme_le },
    );
    date = bienvenue.date;
    encartDateProche = bienvenue.encartDateProche;
  } else if (etape === 'message') {
    date = (premiere.calendrier_id && ctx.dates.get(premiere.calendrier_id)) || null;
  }

  // Date déplacée, ou réglage du modèle changé, depuis la réservation (QA B1) : l'échéance recalculée n'est plus
  // celle de la ligne. Rien ne part ; la ligne est libérée pour que la nouvelle échéance se réserve.
  if (ETAPES_CALEES.has(etape) && date && enregistre) {
    const attendue = echeance(enregistre, date);
    if (attendue && attendue.getTime() !== Date.parse(premiere.prevu_le)) {
      return { sautes: [], liberees: groupe.map((l) => l.id), envoi: null };
    }
  }

  // {{prochaines_dates}} annonce d'autres dates : seulement avec le consentement aux annonces (revue juridique
  // B3), jamais dans une confirmation. Sinon la ligne disparaît. Les dates du calcul (jusqu'à 5 min plus tôt) sont
  // prises dans leur version relue (mineur n° 4) : une date annulée, supprimée, passée ou dont la soirée est
  // suspendue depuis n'y figure plus.
  const listeAutorisee = etape !== 'confirmation' && d.annonces === true;
  const { jour: aujourdhui } = heureParis(instant);
  const prochaines = !listeAutorisee ? [] : ctx.donnees.prochaines
    .flatMap((p) => {
      const relue = ctx.dates.get(p.id);
      return relue && relue.id !== date?.id && relue.statut === 'confirmee' && !soireeSuspendue(relue)
        && relue.date_soiree > aujourdhui ? [relue] : [];
    })
    .sort(comparerDates)
    .slice(0, 3)
    .map((p) => ({ ...p, lienJeViens: jeViensPour(p) }));
  if (etape === 'prochaines_dates' && prochaines.length === 0) return tout('aucune_date');

  return {
    sautes,
    liberees: [],
    envoi: {
      lignes,
      modele,
      contexte: {
        prenom: d.prenom,
        maintenant: new Date(instant),
        origine: ctx.origine,
        etape,
        annonces: d.annonces === true,
        organisateur: ctx.organisateur,
        date,
        prochaines,
        annoncees,
        encartDateProche,
        liens: {
          desinscription: liens.desinscription,
          confirmation: etape === 'confirmation' ? liens.confirmation(premiere.id) : null,
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
