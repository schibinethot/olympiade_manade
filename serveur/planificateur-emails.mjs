// @ts-check
// Planificateur des e-mails, en processus, chaque minute : RPC emails_a_traiter, calculerEnvois, réservation
// (unicité en base), lecture des envois dus, réclamation de chaque groupe juste avant son envoi, relecture du
// destinataire, examen (examen-envois.mjs), rendu, envoi au débit borné, statut, purges quotidiennes.
// Livraison AU PLUS UNE FOIS : une ligne réclamée et jamais terminée n'est jamais renvoyée. prevu_le n'est
// jamais modifié après la réservation : le plafond journalier se compte dessus.

import { calculerEnvois } from './echeances-emails.mjs';
import {
  JOUR_MS,
  LIMITE_RPC_OCTETS,
  LOT_IDS,
  LOT_LECTURE,
  MINUTE_MS,
  SELECT_DESTINATAIRE_ENVOI,
  SELECT_ENVOI,
  enc,
  heureParis,
  iso,
  objet,
  tranches,
} from './emails-rest.mjs';
import { eligible, examiner, grouper } from './examen-envois.mjs';
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

const INTERVALLE_MS = MINUTE_MS;
/**
 * Une ligne réclamée (raison « en_cours ») et toujours pas terminée après ce délai a été interrompue
 * (arrêt brutal, statut non écrit) : elle passe en echec « interrompu », sans nouvel envoi.
 */
const BAIL_MS = 10 * MINUTE_MS;
const TENTATIVES_MAX = 3;
/** Groupes réclamés, puis destinataires relus, par paquets de cette taille juste avant l'envoi. */
const LOT_ENVOI = 10;

const bilanVide = () => /** @type {Bilan} */ ({ reserves: 0, envoyes: 0, simules: 0, echecs: 0, sautes: 0 });

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

/** @param {unknown} donnees @returns {EmailsATraiter} */
function lireDonneesRpc(donnees) {
  const d = /** @type {Record<string, unknown>} */ (donnees);
  if (!objet(d) || !['modeles', 'dates', 'prochaines', 'destinataires', 'rattachements', 'envois'].every((cle) => Array.isArray(d[cle]))) {
    throw new Error('réponse RPC invalide');
  }
  return /** @type {EmailsATraiter} */ (/** @type {unknown} */ (d));
}

/** @param {ContexteEmails} ctx @param {AccesSupabase} acces */
export function creerPlanificateur(ctx, acces) {
  const { origine, cleLiens, poste, mode, reel, debit, maintenant, timers, trustRailwayProxy, railway, barriereActive, journal,
    attendre, serveurPret, smtpSuspendu, actif } = ctx;
  const { rest, signaler, lireDates, insererEnvois } = acces;
  const lignesModeles = lignesModelesParDefaut();

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

  function etat() {
    return {
      mode, pret: actif, cleLiens: cleLiens !== null, barriereActive, dernierPassage,
      dernierBilan: dernierBilan ? { ...dernierBilan } : null,
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
    const { sautes, envoi } = examiner(groupe, destinataire, contexte, instant);
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
    const contexte = {
      donnees, dates, messages, modeles: new Map(donnees.modeles.map((modele) => [modele.cle, modele])),
      origine: /** @type {string} */ (origine), cleLiens: /** @type {string} */ (cleLiens),
    };

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
          await traiter(groupe, frais.get(groupe[0].destinataire_id) ?? null, contexte, instant, bilan, departs);
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

  /** Un passage du planificateur. Rien si inactif (mode off, configuration incomplète, barrière) ou déjà en cours. */
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
      const reservees = await insererEnvois([
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

  return { passer, demarrer, arreter, etat };
}
