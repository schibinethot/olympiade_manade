// @ts-check
// Planificateur des e-mails, en processus. Chaque minute : lecture des envois dus, réclamation de chaque groupe
// juste avant son envoi, relecture du destinataire, des dates du lot et des modèles, examen (examen-envois.mjs),
// rendu, envoi au débit borné, statut. Toutes les 5 minutes : RPC emails_a_traiter, calculerEnvois, réservation
// (unicité en base). Chaque jour après 03:00 : purges.
// Livraison AU PLUS UNE FOIS : une ligne réclamée dont l'envoi a pu commencer n'est jamais renvoyée. Un nouvel essai
// ne suit qu'un échec certain, avant le corps ou refusé par le relais ; un corps parti sans réponse (délai, coupure)
// devient echec « interrompu », comme une ligne réclamée dont le statut n'a pas pu s'écrire. Une ligne réclamée avant
// toute tentative (relecture impossible, arrêt) est rendue. prevu_le n'est jamais modifié après la réservation : le
// plafond journalier se compte dessus.

import { calculerEnvois, lireEmailsATraiter, sautsPerimes } from './echeances-emails.mjs';
import {
  LIMITE_RPC_OCTETS,
  LOT_IDS,
  LOT_LECTURE,
  MINUTE_MS,
  SELECT_DESTINATAIRE_ENVOI,
  SELECT_ENVOI,
  enc,
  heureParis,
  iso,
  tranches,
} from './emails-rest.mjs';
import { DELAIS_NOUVEL_ESSAI_MS, TENTATIVES_MAX, eligible, examiner, grouper } from './examen-envois.mjs';
import { ETAPES, MODELES_DEFAUT, rendreEmail } from './gabarits-emails.mjs';

/** @typedef {import('./emails-rest.mjs').ContexteEmails} ContexteEmails */
/** @typedef {import('./emails-rest.mjs').AccesSupabase} AccesSupabase */
/** @typedef {import('./emails-rest.mjs').Bilan} Bilan */
/** @typedef {import('./emails-rest.mjs').LigneEnvoi} LigneEnvoi */
/** @typedef {import('./emails-rest.mjs').DestinataireEnvoi} DestinataireEnvoi */
/** @typedef {import('./examen-envois.mjs').ContexteEnvoi} ContexteEnvoi */
/** @typedef {import('./gabarits-emails.mjs').DateEnrichie} DateEnrichie */
/** @typedef {import('./echeances-emails.mjs').EmailsATraiter} EmailsATraiter */
/** @typedef {import('./echeances-emails.mjs').EnvoiPrevu} EnvoiPrevu */
/** @typedef {import('./echeances-emails.mjs').ModeleRpc} ModeleRpc */

/** Lecture et envoi des dus. */
const INTERVALLE_MS = MINUTE_MS;
/** Calcul des envois (RPC emails_a_traiter), au plus une fois par période. */
const CALCUL_MS = 5 * MINUTE_MS;
/**
 * Une ligne réclamée (raison « en_cours ») et toujours pas terminée après ce délai a été interrompue
 * (arrêt brutal, statut non écrit) : elle passe en echec « interrompu », sans nouvel envoi.
 */
const BAIL_MS = 10 * MINUTE_MS;
/** Groupes réclamés, puis destinataires et dates relus, par paquets de cette taille juste avant l'envoi. */
const LOT_ENVOI = 10;
/** Purge des demandes non confirmées : retraits par appel, et appels par jour au plus. */
const LOT_PURGE = 500;
const TOURS_PURGE = 20;
const SELECT_MODELE = 'cle,nom,actif,sujet,preheader,corps,encart,jours_decalage,heure_envoi';

const bilanVide = () => /** @type {Bilan} */ ({ reserves: 0, envoyes: 0, simules: 0, echecs: 0, sautes: 0, liberes: 0 });

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

/**
 * Lignes d'envoi à insérer pour un envoi prévu : une par date (une annonce porte plusieurs dates), aucune date
 * pour confirmation et bienvenue. Même forme dans le planificateur et dans le test de composition SQL.
 * @param {EnvoiPrevu} envoi @param {'en_attente' | 'saute'} statut @param {boolean} reel
 */
export function lignesReservees(envoi, statut, reel) {
  const dates = envoi.calendrierIds.length ? envoi.calendrierIds : [null];
  return dates.map((calendrierId) => ({
    destinataire_id: envoi.destinataireId, etape: envoi.etape, calendrier_id: calendrierId, message_id: null, reel, statut,
    raison: statut === 'saute' ? envoi.raison ?? null : null, prevu_le: envoi.prevuLe,
  }));
}

/** Message court d'une erreur pour l'admin : jamais d'adresse ni de détail PostgREST, le statut HTTP au plus. @param {string} quoi @param {unknown} erreur */
function messageCourt(quoi, erreur) {
  const statut = /** @type {{ statut?: unknown }} */ (erreur ?? {}).statut;
  return typeof statut === 'number' ? `${quoi} (HTTP ${statut})` : quoi;
}

/** @param {ContexteEmails} ctx @param {AccesSupabase} acces */
export function creerPlanificateur(ctx, acces) {
  const { origine, cleLiens, poste, mode, reel, debit, maintenant, timers, trustRailwayProxy, railway, barriereActive, journal,
    attendre, serveurPret, smtpSuspendu, actif, raisonsInactif } = ctx;
  const { rest, restMesure, signaler, lireDates, insererEnvois, lireOrganisateur } = acces;
  const lignesModeles = lignesModelesParDefaut();

  let enCours = false;
  let seme = false;
  let arretDemande = false;
  /** @type {(() => void)[]} */
  const finDuPassage = [];
  /** Groupes réclamés dont l'examen n'a pas commencé : arreter() les rend sans attendre le groupe en cours. */
  /** @type {Set<LigneEnvoi[]>} */
  const nonCommences = new Set();
  /** @type {string | null} */
  let dernierPassage = null;
  /** @type {Bilan | null} */
  let dernierBilan = null;
  /** @type {{ instant: string, message: string } | null} */
  let derniereErreur = null;
  /** @type {string | null} */
  let dernierePurge = null;
  let dernierCalcul = -Infinity;
  /** @type {EmailsATraiter | null} */
  let donnees = null;
  /** Ligne d'identité du pied ; `identiteConnue` faux tant qu'aucune lecture n'a abouti. */
  /** @type {string | null} */
  let organisateur = null;
  let identiteConnue = false;
  let modeChangeFait = false;
  /** @type {ReturnType<typeof setInterval> | null} */
  let minuteur = null;

  /** Raisons pour lesquelles aucun e-mail ne part (C-0.3) : configuration, puis identité en mode smtp. */
  function raisons() {
    const liste = [...raisonsInactif];
    if (mode === 'smtp' && (!identiteConnue || organisateur === null)) liste.push('identite');
    return liste;
  }

  function etat() {
    const liste = raisons();
    return {
      mode,
      pret: liste.length === 0,
      raisonsInactif: liste,
      cleLiens: cleLiens !== null,
      barriereActive,
      dernierPassage,
      dernierBilan: dernierBilan ? { ...dernierBilan } : null,
      derniereErreur: derniereErreur ? { ...derniereErreur } : null,
    };
  }

  /** Sème les modèles manquants sans toucher aux lignes existantes ; un échec est retenté au passage suivant. */
  async function semer() {
    if (!serveurPret) return;
    try {
      await rest('/rest/v1/modeles_emails?on_conflict=cle', {
        methode: 'POST', corps: lignesModeles, prefer: 'resolution=ignore-duplicates,return=minimal',
      });
      seme = true;
    } catch (erreur) {
      signaler('semis des modèles d’e-mails impossible', erreur);
    }
  }

  /** Relit l'identité de l'organisateur ; une erreur garde la dernière valeur connue. */
  async function relireIdentite() {
    try {
      organisateur = await lireOrganisateur();
      identiteConnue = true;
    } catch (erreur) {
      signaler('lecture de l’identité de l’organisateur impossible', erreur);
    }
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

  /**
   * Rend un groupe réclamé dont l'envoi n'a jamais commencé : l'état d'avant la réclamation est rétabli (raison
   * nulle pour une ligne neuve), par identifiant et sur les seules lignes encore « en_cours ». @param {LigneEnvoi[]} groupe
   */
  async function rendre(groupe) {
    const [premiere] = groupe;
    try {
      await rest(`/rest/v1/envois_emails?id=in.(${groupe.map((l) => l.id).join(',')})&raison=eq.en_cours`, {
        methode: 'PATCH', corps: { raison: premiere.raison, envoye_le: premiere.envoye_le }, prefer: 'return=minimal',
      });
    } catch (erreur) {
      // La ligne reste « en_cours » : soldée « interrompu », jamais renvoyée.
      signaler('remise en file d’un e-mail impossible', erreur, { etape: premiere.etape });
    }
  }

  /** Lignes réservées pour une échéance qui a changé : supprimées, la nouvelle échéance se réservera. @param {string[]} ids */
  async function liberer(ids) {
    for (const lot of tranches(ids, LOT_IDS)) {
      await rest(`/rest/v1/envois_emails?id=in.(${lot.join(',')})&statut=eq.en_attente&raison=eq.en_cours`, {
        methode: 'DELETE', prefer: 'return=minimal',
      });
    }
  }

  /**
   * Sauts enregistrés pour une échéance qui n'est plus la bonne (sautsPerimes) : supprimés juste avant la réservation de
   * la nouvelle, comme liberer() pour une ligne réservée. Filtrés sur le saut et sur une échéance différente : une
   * ligne écrite entre-temps pour la nouvelle échéance reste. @param {ReturnType<typeof sautsPerimes>} perimes
   */
  async function effacerSautsPerimes(perimes) {
    for (const { etape, calendrierId, prevuLe, destinataireIds } of perimes) {
      for (const lot of tranches(destinataireIds, LOT_IDS)) {
        await rest(`/rest/v1/envois_emails?destinataire_id=in.(${lot.join(',')})&etape=eq.${etape}&calendrier_id=eq.${calendrierId}`
          + `&message_id=is.null&reel=is.${reel}&statut=eq.saute&prevu_le=neq.${enc(prevuLe)}`, { methode: 'DELETE', prefer: 'return=minimal' });
      }
    }
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

  /**
   * Premier passage en smtp : les réservations simulées encore en attente (recette en log) ne partent pas
   * pour de vrai ; elles passent en saute « mode_change ».
   */
  async function solderModeChange() {
    const lignes = await rest('/rest/v1/envois_emails?reel=is.false&statut=eq.en_attente&select=id', {
      methode: 'PATCH',
      corps: { statut: 'saute', raison: 'mode_change', envoye_le: null },
      prefer: 'return=representation',
    });
    modeChangeFait = true;
    return Array.isArray(lignes) ? lignes.length : 0;
  }

  /**
   * Envois dus du mode courant, éligibles côté PostgREST : nouveaux (raison nulle), puis une requête par
   * nombre de tentatives, chacune avec son délai (5, 30 puis 120 min après l'essai précédent).
   * @param {number} instant @returns {Promise<LigneEnvoi[]>}
   */
  async function lireDus(instant) {
    const base = `/rest/v1/envois_emails?select=${SELECT_ENVOI}&statut=eq.en_attente&reel=is.${reel}`
      + `&prevu_le=lte.${enc(iso(instant))}&order=prevu_le.asc,destinataire_id.asc,id.asc&limit=${LOT_LECTURE}`;
    /** @type {LigneEnvoi[]} */
    const lues = [...(await rest(`${base}&raison=is.null`) ?? [])];
    for (let tentatives = 1; tentatives < TENTATIVES_MAX; tentatives += 1) {
      const avant = enc(iso(instant - DELAIS_NOUVEL_ESSAI_MS[tentatives - 1]));
      lues.push(...(await rest(`${base}&raison=eq.envoi_impossible&tentatives=eq.${tentatives}&envoye_le=lte.${avant}`) ?? []));
    }
    return lues.filter((ligne) => eligible(ligne, instant));
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
   * Dates du lot relues juste après les destinataires (sécurité I1) : un passage peut durer, une date annulée,
   * déplacée ou supprimée entre la réservation et l'envoi l'emporte. Une date disparue est retirée (date_absente).
   * La date citée par une bienvenue (rattachement d'inscription) est relue aussi, et les prochaines dates du calcul
   * dès qu'un e-mail du lot peut les lister ({{prochaines_dates}} : consentant aux annonces, hors confirmation).
   * @param {LigneEnvoi[][]} reclames @param {Map<string, DateEnrichie>} dates @param {EmailsATraiter} sources
   * @param {Map<string, DestinataireEnvoi>} frais destinataires relus
   */
  async function relireDates(reclames, dates, sources, frais) {
    const bienvenues = new Set(reclames.flat().filter((l) => l.etape === 'bienvenue').map((l) => l.destinataire_id));
    const listes = reclames.some((groupe) => groupe[0].etape !== 'confirmation' && frais.get(groupe[0].destinataire_id)?.annonces === true);
    const ids = [...new Set([
      ...reclames.flat().map((l) => l.calendrier_id).filter((id) => id !== null),
      ...sources.rattachements.filter((r) => bienvenues.has(r.destinataire_id) && r.origine === 'inscription').map((r) => r.calendrier_id),
      ...(listes ? sources.prochaines.map((p) => p.id) : []),
    ])];
    if (!ids.length) return;
    const fraiches = await lireDates(/** @type {string[]} */ (ids));
    for (const id of ids) if (id) dates.delete(id);
    for (const date of fraiches) dates.set(date.id, date);
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
   * @param {ContexteEnvoi} contexte @param {number} instant @param {Bilan} bilan @param {number[]} departs
   */
  async function traiter(groupe, destinataire, contexte, instant, bilan, departs) {
    // Jusqu'à la tentative d'envoi, une erreur rend le groupe ; après, la ligne reste « en_cours » (au plus une fois).
    let tente = false;
    try {
      const { sautes, liberees, envoi } = examiner(groupe, destinataire, contexte, instant);
      for (const saut of sautes) {
        await marquer(saut.ids, { statut: 'saute', raison: saut.raison, envoye_le: null });
        bilan.sautes += saut.ids.length;
      }
      if (liberees.length) {
        await liberer(liberees);
        bilan.liberes += liberees.length;
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
      tente = true;
      /** @type {{ envoye: boolean, echec: boolean, definitif?: boolean, incertain?: boolean }} */
      let resultat;
      try {
        resultat = await poste.envoyer({
          to: destinataire.email, subject: rendu.sujet, text: rendu.texte, html: rendu.html, headers: envoi.entetes, etape: groupe[0].etape,
        });
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
      // Corps parti sans réponse du relais (incertain) : peut-être remis, compté comme un envoi interrompu, jamais
      // réessayé (au plus une fois). Refus définitif (5xx pour ce message, adresse invalide) : echec, sans nouvel
      // essai. Sinon (4xx, réseau, réglage), un nouvel essai après 5, 30 puis 120 min ; la raison réécrite n'est pas
      // prise pour une interruption.
      if (resultat.incertain) await marquer(ids, { statut: 'echec', tentatives, raison: 'interrompu', envoye_le: fin });
      else if (resultat.definitif) await marquer(ids, { statut: 'echec', tentatives, raison: 'refus_definitif', envoye_le: fin });
      else if (tentatives >= TENTATIVES_MAX) await marquer(ids, { statut: 'echec', tentatives, raison: 'envoi_impossible', envoye_le: fin });
      else await marquer(ids, { tentatives, raison: 'envoi_impossible', envoye_le: fin });
    } catch (erreur) {
      if (!tente) await rendre(groupe);
      throw erreur;
    }
  }

  /** Modèles relus avant l'envoi : un modèle désactivé ou réglé autrement depuis le calcul l'emporte. */
  async function relireModeles() {
    const lignes = await rest(`/rest/v1/modeles_emails?select=${SELECT_MODELE}`);
    return new Map((Array.isArray(lignes) ? lignes : []).map((/** @type {ModeleRpc} */ modele) => [modele.cle, modele]));
  }

  /** @param {EmailsATraiter} sources @param {number} instant @param {Bilan} bilan */
  async function envoyerDus(sources, instant, bilan) {
    const lues = await lireDus(instant);
    if (!lues.length) return;
    /** @type {LigneEnvoi[]} */
    const lignes = await completerAnnonces(lues, instant);

    /** @type {Map<string, DateEnrichie>} */
    const dates = new Map([...sources.dates, ...sources.prochaines].map((date) => [date.id, date]));
    const idsMessages = [...new Set(lignes.map((ligne) => ligne.message_id).filter((id) => id !== null))];
    /** @type {Map<string, { id: string, sujet: string, corps: string }>} */
    const messages = new Map();
    for (const lot of tranches(/** @type {string[]} */ (idsMessages), LOT_IDS)) {
      for (const message of await rest(`/rest/v1/messages_inscrits?select=id,sujet,corps&id=in.(${lot.join(',')})`) ?? []) messages.set(message.id, message);
    }
    /** @type {ContexteEnvoi} */
    const contexte = {
      donnees: sources, dates, messages, modeles: await relireModeles(),
      origine: /** @type {string} */ (origine), cleLiens: /** @type {string} */ (cleLiens), organisateur,
    };

    /** @type {number[]} */
    const departs = [];
    for (const lot of tranches(grouper(lignes), LOT_ENVOI)) {
      // Arrêt demandé (SIGTERM) : le groupe en cours est fini, plus aucune ligne n'est réclamée.
      if (arretDemande) break;
      /** @type {LigneEnvoi[][]} */
      const reclames = [];
      for (const groupe of lot) {
        if (arretDemande) break;
        try {
          const retenues = await reclamer(groupe, maintenant());
          if (retenues.length) {
            reclames.push(retenues);
            nonCommences.add(retenues);
          }
        } catch (erreur) {
          // État incertain : une ligne touchée sera soldée « interrompu », jamais renvoyée.
          signaler('réclamation d’un e-mail impossible', erreur, { etape: groupe[0].etape });
        }
      }
      // SIGTERM pendant une réclamation : arreter() n'a pas vu le groupe qu'elle retenait. Tout ce qui reste à commencer
      // est rendu tout de suite, avant la relecture (qui pourrait dépasser le délai de sortie).
      if (arretDemande) {
        for (const groupe of reclames) if (nonCommences.delete(groupe)) await rendre(groupe);
        break;
      }
      if (!reclames.length) continue;
      // Relecture après la réclamation : une désinscription, un retrait de consentement ou une date changée
      // depuis la lecture l'emporte. Impossible : les lignes réclamées sont rendues, rien ne part.
      /** @type {Map<string, DestinataireEnvoi>} */
      let frais;
      try {
        frais = await relireDestinataires(reclames.map((groupe) => groupe[0].destinataire_id));
        await relireDates(reclames, dates, sources, frais);
      } catch (erreur) {
        signaler('relecture avant envoi impossible', erreur);
        for (const groupe of reclames) if (nonCommences.delete(groupe)) await rendre(groupe);
        throw erreur;
      }
      for (const groupe of reclames) {
        // Déjà rendu par arreter() (SIGTERM pendant un groupe précédent ou pendant la relecture).
        if (!nonCommences.delete(groupe)) continue;
        // Arrêt demandé sans que arreter() ait vu ce groupe : rendu ici, sans examen.
        if (arretDemande) {
          await rendre(groupe);
          continue;
        }
        try {
          await traiter(groupe, frais.get(groupe[0].destinataire_id) ?? null, contexte, instant, bilan, departs);
        } catch (erreur) {
          signaler('fin d’envoi d’un e-mail impossible', erreur, { etape: groupe[0].etape });
        }
      }
    }
  }

  /**
   * Au premier passage après 03:00 (Paris) chaque jour : journal de plus de 12 mois ; en mode réel, demandes
   * jamais confirmées (RPC purger_demandes_non_confirmees, qui retire chaque abonnement par son identifiant).
   * @param {number} instant
   */
  async function purgerSiBesoin(instant) {
    const { jour, heure } = heureParis(instant);
    if (heure < 3 || dernierePurge === jour) return;
    try {
      const limite = new Date(instant);
      limite.setUTCFullYear(limite.getUTCFullYear() - 1);
      await rest(`/rest/v1/envois_emails?cree_le=lt.${enc(limite.toISOString())}`, { methode: 'DELETE', prefer: 'return=minimal' });
      // En mode log, aucune confirmation réelle n'est partie : les demandes attendent le passage en smtp.
      let nonConfirmes = 0;
      if (reel) {
        for (let tour = 0; tour < TOURS_PURGE; tour += 1) {
          const nombre = Number(await rest('/rest/v1/rpc/purger_demandes_non_confirmees', {
            methode: 'POST', corps: { p_maintenant: iso(instant), p_limite: LOT_PURGE },
          })) || 0;
          nonConfirmes += nombre;
          if (nombre < LOT_PURGE) break;
        }
      }
      dernierePurge = jour;
      journal({ level: 'info', timestamp: iso(Date.now()), message: 'purge des e-mails', nonConfirmes });
    } catch (erreur) {
      signaler('purge des e-mails impossible', erreur);
    }
  }

  /** Calcul des envois : RPC, calculerEnvois, réservation. Journalise la taille et la durée de la RPC. @param {number} instant @param {Bilan} bilan */
  async function calculer(instant, bilan) {
    const debut = Date.now();
    const { donnees: brut, octets } = await restMesure('/rest/v1/rpc/emails_a_traiter', {
      methode: 'POST', corps: { p_maintenant: iso(instant), p_reel: reel }, delai: 30_000, max: LIMITE_RPC_OCTETS,
    });
    const lues = lireEmailsATraiter(brut);
    const duree = Date.now() - debut;
    const { aEnvoyer, sautes } = calculerEnvois(lues, new Date(instant));
    // Sauts pour une ancienne échéance (report pendant un calcul, réglage changé) : supprimés avant la réservation.
    const perimes = sautsPerimes(lues, [...aEnvoyer, ...sautes]);
    if (perimes.length) await effacerSautsPerimes(perimes);
    const reservees = await insererEnvois([
      ...aEnvoyer.flatMap((envoi) => lignesReservees(envoi, 'en_attente', reel)),
      ...sautes.flatMap((envoi) => lignesReservees(envoi, 'saute', reel)),
    ]);
    for (const ligne of reservees) {
      if (ligne.statut === 'en_attente') bilan.reserves += 1;
      else if (ligne.statut === 'saute') bilan.sautes += 1;
    }
    journal({
      level: 'info', timestamp: iso(Date.now()), message: 'calcul des envois', octets, dureeMs: duree,
      destinataires: lues.destinataires.length, envois: lues.envois.length,
    });
    donnees = lues;
    dernierCalcul = instant;
  }

  /**
   * Un passage du planificateur. Rien si inactif (mode off, configuration incomplète, barrière) ou déjà en
   * cours. En mode smtp sans identité de l'organisateur, rien ne part (revue juridique B4).
   */
  async function passer() {
    const bilan = bilanVide();
    if (!actif || enCours || arretDemande) return bilan;
    enCours = true;
    try {
      if (!seme) await semer();
      const instant = maintenant();
      if (mode === 'smtp' && !modeChangeFait) {
        const soldees = await solderModeChange();
        if (soldees) journal({ level: 'info', timestamp: iso(Date.now()), message: 'envois simulés en attente sautés (passage en smtp)', nombre: soldees });
      }
      const calculDu = donnees === null || instant - dernierCalcul >= CALCUL_MS;
      if (calculDu || !identiteConnue) await relireIdentite();
      if (mode === 'smtp' && (!identiteConnue || organisateur === null)) {
        dernierPassage = iso(instant);
        dernierBilan = { ...bilan };
        derniereErreur = null;
        return bilan;
      }
      if (calculDu) await calculer(instant, bilan);
      bilan.echecs += await solderInterrompus(instant);
      if (donnees && !arretDemande) await envoyerDus(donnees, instant, bilan);
      if (!arretDemande) await purgerSiBesoin(instant);
      dernierPassage = iso(instant);
      dernierBilan = { ...bilan };
      derniereErreur = null;
      if (bilan.reserves || bilan.envoyes || bilan.simules || bilan.echecs || bilan.liberes) {
        journal({ level: 'info', timestamp: iso(Date.now()), message: 'passage du planificateur d’e-mails', mode, ...bilan });
      }
    } catch (erreur) {
      signaler('passage du planificateur d’e-mails impossible', erreur);
      derniereErreur = { instant: iso(Date.now()), message: messageCourt('passage du planificateur impossible', erreur) };
    } finally {
      enCours = false;
      for (const resoudre of finDuPassage.splice(0)) resoudre();
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
          message: 'liens des e-mails et endpoints admin : EMAILS_TRUST_RAILWAY_PROXY faux sur Railway, toutes les IP partagent '
            + 'la limite des liens refusés et celle des requêtes admin (60 par 10 min, /test, /message et /etat compris)',
        });
      }
      if (!actif) {
        journal({
          level: 'info', timestamp: iso(Date.now()), message: 'planificateur d’e-mails inactif', mode, raisons: raisons(),
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

  /**
   * Arrêt (SIGTERM) : plus de nouveau passage, plus aucune réclamation. Les groupes réclamés mais pas commencés sont
   * rendus aussitôt, sans attendre le groupe en cours : un envoi SMTP lent peut dépasser le délai d'arrêt (statique.mjs).
   * La promesse se résout quand ils sont rendus et que le passage en cours a fini (aussitôt s'il n'y en a pas).
   * @returns {Promise<void>}
   */
  function arreter() {
    arretDemande = true;
    if (minuteur) clearInterval(minuteur);
    minuteur = null;
    const rendus = [...nonCommences].map((groupe) => {
      nonCommences.delete(groupe);
      return rendre(groupe);
    });
    /** @type {Promise<void>} */
    const fin = enCours ? new Promise((resoudre) => { finDuPassage.push(resoudre); }) : Promise.resolve();
    return Promise.all([fin, ...rendus]).then(() => undefined);
  }

  return { passer, demarrer, arreter, etat };
}
