// @ts-check
// Endpoints admin AAL2 de la séquence d'e-mails :
// - POST /api/admin/emails/test     rend un brouillon et l'envoie à l'adresse de l'admin (10 par heure)
// - POST /api/admin/emails/message  message n° 8 aux rattachés confirmés et non désinscrits d'une date
// - GET  /api/admin/emails/etat     mode, prêt, raisons d'inactivité, clé des liens, barrière, dernier passage,
//                                   dernier bilan, dernière erreur
// Toute requête passe d'abord par une limite par IP (60 par 10 min), avant tout appel à Supabase.

import { createHash } from 'node:crypto';
import { ipClientActualites } from './actualites.mjs';
import { verifierAdmin } from './admin-serveur.mjs';
import { HEURE_MS, MINUTE_MS, UUID, enc, iso, lireCorps, objet } from './emails-rest.mjs';
import { ETAPES, MODELES_DEFAUT, rendreEmail } from './gabarits-emails.mjs';
import { FENETRE_MS, creerLimiteurFormulaire, repondreJson, rogner } from './protections-formulaire.mjs';

/** @typedef {import('./emails-rest.mjs').ContexteEmails} ContexteEmails */
/** @typedef {import('./emails-rest.mjs').AccesSupabase} AccesSupabase */
/** @typedef {import('./emails-rest.mjs').Requete} Requete */
/** @typedef {import('./emails-rest.mjs').Reponse} Reponse */
/** @typedef {import('./gabarits-emails.mjs').Etape} Etape */
/** @typedef {import('./gabarits-emails.mjs').DateEnrichie} DateEnrichie */
/** @typedef {import('./gabarits-emails.mjs').ContexteEmail} ContexteEmail */
/** @typedef {import('./gabarits-emails.mjs').ModeleEmail} ModeleEmail */

export const CHEMIN_TEST = '/api/admin/emails/test';
export const CHEMIN_MESSAGE = '/api/admin/emails/message';
export const CHEMIN_ETAT = '/api/admin/emails/etat';

const TESTS_PAR_HEURE = 10;
/** Requêtes admin par IP et par 10 minutes, avant la vérification du jeton (sécurité M4). */
const REQUETES_ADMIN_PAR_IP = 60;
const DOUBLON_MESSAGE_MS = 10 * MINUTE_MS;
const PAGE_RATTACHES = 1_000;
const LIMITE_CORPS_ADMIN = 65_536;
const PRENOM_EXEMPLE = 'Camille';

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

/**
 * `cle` (facultative) : clé d'idempotence générée par l'admin à l'ouverture du formulaire (sécurité M3).
 * @param {unknown} brut @returns {{ calendrierId: string, sujet: string, corps: string, cle: string | null } | null}
 */
function validerMessage(brut) {
  if (!objet(brut)) return null;
  const cles = Object.keys(brut);
  const requises = ['calendrierId', 'sujet', 'corps'];
  if (!requises.every((cle) => cles.includes(cle)) || cles.some((cle) => ![...requises, 'cle'].includes(cle))) return null;
  const { calendrierId, sujet, corps, cle } = brut;
  if (typeof calendrierId !== 'string' || !UUID.test(calendrierId)) return null;
  if (!texteRequis(sujet, 200) || !texteRequis(corps, 8000)) return null;
  if (cle !== undefined && (typeof cle !== 'string' || !UUID.test(cle))) return null;
  return {
    calendrierId, sujet: rogner(/** @type {string} */ (sujet)), corps: rogner(/** @type {string} */ (corps)),
    cle: typeof cle === 'string' ? cle.toLowerCase() : null,
  };
}

/**
 * @param {ContexteEmails} ctx
 * @param {AccesSupabase} acces
 * @param {() => Record<string, unknown>} etat état du planificateur, pour /etat
 */
export function creerAdminEmails(ctx, acces, etat) {
  const { supabaseUrl, publishableKey, demander, serveurPret, origine, maintenant, poste, mode, actif, reel, trustRailwayProxy } = ctx;
  const { rest, lireDates, lireProchaines, insererEnvois, lireOrganisateur } = acces;
  const limiteurIp = creerLimiteurFormulaire({ maintenant, parIp: REQUETES_ADMIN_PAR_IP, global: 1_000_000 });
  /** @type {Map<string, { debut: number, n: number }>} */
  const testsParAdmin = new Map();
  /** @type {Map<string, { cree: number, promesse: Promise<{ messageId: string, destinataires: number }> }>} */
  const messagesRecents = new Map();

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
    // Même règle que l'envoi réel (examen-envois.mjs), pour une personne qui a accepté les annonces : la liste
    // des prochaines dates hors confirmation, « Je viens » et {{dates_annoncees}} dans l'annonce seulement.
    const prochaines = demande.cle === 'confirmation' ? [] : (await lireProchaines(instant))
      .filter((p) => p.id !== date?.id)
      .map((p) => ({ ...p, lienJeViens: exempleJeViens }));
    const annonce = demande.cle === 'annonce';
    /** @type {string | null} */
    let organisateur = null;
    try { organisateur = await lireOrganisateur(); } catch { /* le test part sans la ligne d'identité */ }
    /** @type {ContexteEmail} */
    const contexte = {
      prenom: PRENOM_EXEMPLE,
      maintenant: new Date(instant),
      origine,
      etape: demande.cle,
      annonces: true,
      organisateur,
      date,
      prochaines,
      annoncees: annonce && date ? [{ ...date, lienJeViens: exempleJeViens }] : [],
      encartDateProche: demande.cle === 'bienvenue' && date !== null,
      liens: {
        desinscription: `${base}/emails/desinscription`,
        confirmation: demande.cle === 'confirmation' ? `${base}/emails/confirmation` : null,
        jeViens: annonce && date ? exempleJeViens : null,
      },
    };
    let rendu;
    try { rendu = rendreEmail(demande.brouillon, contexte, { cible: 'email' }); }
    catch { return repondreJson(req, res, 400, { error: 'brouillon_invalide' }); }
    const resultat = await poste.envoyer({
      to: admin.email, subject: `[Test] ${rendu.sujet}`, text: rendu.texte, html: rendu.html, etape: `test:${demande.cle}`,
    });
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

  /**
   * Message déjà enregistré sous cette clé d'idempotence. @param {string} cle
   * @returns {Promise<{ id: string, destinataires: number, calendrier_id: string | null, sujet: string, corps: string } | null>}
   */
  async function messageDeCle(cle) {
    const lignes = await rest(`/rest/v1/messages_inscrits?select=id,destinataires,calendrier_id,sujet,corps&cle=eq.${enc(cle)}&limit=1`);
    return Array.isArray(lignes) && lignes[0] ? lignes[0] : null;
  }

  /**
   * Une clé ne sert qu'à un message : même date, même objet, même texte. @param {{ calendrier_id?: string | null, sujet?: string, corps?: string }} existant
   * @param {{ calendrierId: string, sujet: string, corps: string }} demande
   */
  function memeMessage(existant, demande) {
    return existant.calendrier_id === demande.calendrierId && existant.sujet === demande.sujet && existant.corps === demande.corps;
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

    /** @type {{ messageId: string, destinataires: number }} */
    let message;
    if (demande.cle) {
      // Clé d'idempotence (sécurité M3), unique en base : un nouvel essai, depuis n'importe quelle réplique,
      // renvoie le résultat du premier et complète les envois qui manquaient.
      const existant = await messageDeCle(demande.cle);
      if (existant && !memeMessage(existant, demande)) return repondreJson(req, res, 409, { error: 'cle_deja_utilisee' });
      if (existant) message = { messageId: existant.id, destinataires: existant.destinataires };
      else {
        if (destinataires.length === 0) return repondreJson(req, res, 200, { ok: true, destinataires: 0 });
        const lignes = await rest('/rest/v1/messages_inscrits?on_conflict=cle&select=id,destinataires', {
          methode: 'POST',
          corps: {
            calendrier_id: demande.calendrierId, sujet: demande.sujet, corps: demande.corps, cree_par: admin.id,
            destinataires: destinataires.length, cle: demande.cle,
          },
          prefer: 'resolution=ignore-duplicates,return=representation',
        });
        const cree = Array.isArray(lignes) ? lignes[0] : null;
        // Deux essais simultanés : celui qui n'a rien inséré relit le message de l'autre.
        const retenu = cree ?? await messageDeCle(demande.cle);
        if (!retenu || typeof retenu.id !== 'string') throw new Error('message non enregistré');
        if (!cree && !memeMessage(retenu, demande)) return repondreJson(req, res, 409, { error: 'cle_deja_utilisee' });
        message = { messageId: retenu.id, destinataires: Number(retenu.destinataires) };
      }
    } else {
      // Sans clé : un double clic (ou une nouvelle tentative après une panne) réutilise le même message, en
      // mémoire de cette réplique, pendant 10 minutes.
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
      message = await entree.promesse;
    }
    await insererEnvois(destinataires.map((id) => ({
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
    // Limite par IP avant tout appel à Supabase : un jeton forgé ne fait pas travailler l'API d'Auth.
    if (!limiteurIp.accepter(ipClientActualites(req, trustRailwayProxy))) {
      req.resume();
      return repondreJson(req, res, 429, { error: 'too_many_requests' }, { 'Retry-After': String(Math.ceil(FENETRE_MS / 1000)) });
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

  return { repondreAdmin };
}
