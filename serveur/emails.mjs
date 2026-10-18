// @ts-check
// Séquence d'e-mails (design du 17/10/2026) : façade du planificateur en processus, des liens publics
// signés et des endpoints admin. La clé service_role reste dans ce processus.
//
// - POST /api/emails/lien, POST /api/emails/desinscription : liens publics (emails-liens.mjs)
// - /api/admin/emails/{test,message,etat}                  : admin AAL2 (emails-admin.mjs)
// - planificateur, chaque minute                            : planificateur-emails.mjs, examen-envois.mjs
// - accès PostgREST, types et utilitaires partagés          : emails-rest.mjs
//
// Aucun GET ne change d'état. Aucune adresse e-mail en clair dans les journaux, ni corps ni détails d'une
// réponse PostgREST en erreur. Sans Supabase, clé service_role, origine publique ou clé de liens valable :
// 503 et planificateur inactif. Barrière d'accès active (site privé) : aucun envoi réel.

import { emailsDepuisEnvironnement as posteDepuisEnvironnement } from './courriel.mjs';
import { CHEMIN_ETAT, CHEMIN_MESSAGE, CHEMIN_TEST, creerAdminEmails } from './emails-admin.mjs';
import { CHEMIN_LIEN, CHEMIN_UN_CLIC, creerLiensPublics } from './emails-liens.mjs';
import { creerAccesSupabase, texte } from './emails-rest.mjs';
import { cleLiensValide } from './liens-emails.mjs';
import { creerPlanificateur } from './planificateur-emails.mjs';
import { entierBorne, originePublique, origineSupabase, repondreJson } from './protections-formulaire.mjs';

/** @typedef {import('./emails-rest.mjs').Poste} Poste */
/** @typedef {import('./emails-rest.mjs').ContexteEmails} ContexteEmails */
/** @typedef {import('./emails-rest.mjs').Requete} Requete */
/** @typedef {import('./emails-rest.mjs').Reponse} Reponse */

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

const CHEMINS = new Set([CHEMIN_LIEN, CHEMIN_UN_CLIC, CHEMIN_TEST, CHEMIN_MESSAGE, CHEMIN_ETAT]);

/** @param {OptionsEmails} [options] */
export function creerEmails(options = {}) {
  const supabaseUrl = origineSupabase(options.supabaseUrl);
  const serviceRoleKey = texte(options.serviceRoleKey) || null;
  const origine = originePublique(options.origine);
  const cleLiens = cleLiensValide(options.cleLiens) ? options.cleLiens : null;
  /** @type {Poste} */
  const poste = options.courriel ?? { mode: 'off', pret: false, envoyer: async () => ({ mode: 'off', envoye: false, echec: false }) };
  /** @type {'off' | 'log' | 'smtp'} */
  const mode = poste.mode === 'smtp' ? 'smtp' : poste.mode === 'log' ? 'log' : 'off';
  const barriereActive = options.barriereActive === true;
  const serveurPret = !!(supabaseUrl && serviceRoleKey);
  const configure = !!(serveurPret && origine && cleLiens);
  // Site privé (barrière ACCES_TOKEN) : les liens des e-mails (désinscription comprise) seraient
  // inaccessibles aux destinataires. Aucun envoi réel ne part ; le mode log reste possible.
  const smtpSuspendu = barriereActive && mode === 'smtp';
  // Raisons connues au démarrage ; l'identité de l'organisateur (« identite », mode smtp) est relue par le
  // planificateur (voir son etat()).
  /** @type {string[]} */
  const raisonsInactif = [];
  if (mode === 'off') raisonsInactif.push('mode_off');
  if (smtpSuspendu) raisonsInactif.push('barriere');
  if (mode === 'smtp') {
    const manques = poste.manques ?? (poste.pret ? [] : ['smtp_incomplet']);
    for (const raison of ['smtp_incomplet', 'expediteur']) if (manques.includes(raison)) raisonsInactif.push(raison);
  }
  if (!cleLiens) raisonsInactif.push('cle_liens');
  if (!origine) raisonsInactif.push('origine');
  if (!serveurPret) raisonsInactif.push('supabase');
  const actif = configure && mode !== 'off' && poste.pret && !smtpSuspendu;

  /** @type {ContexteEmails} */
  const ctx = {
    supabaseUrl,
    publishableKey: texte(options.publishableKey) || null,
    serviceRoleKey,
    origine,
    cleLiens,
    poste,
    mode,
    reel: mode === 'smtp',
    debit: entierBorne(options.debitParSeconde, 5, 1, 20),
    demander: options.fetchFn ?? fetch,
    maintenant: options.maintenant ?? Date.now,
    timers: options.timers !== false,
    trustRailwayProxy: options.trustRailwayProxy === true,
    railway: options.railway === true,
    barriereActive,
    journal: options.journal ?? ((ligne) => console.log(JSON.stringify(ligne))),
    attendre: options.attendre ?? ((ms) => new Promise((ok) => { setTimeout(ok, ms); })),
    serveurPret,
    configure,
    smtpSuspendu,
    actif,
    raisonsInactif,
  };
  const acces = creerAccesSupabase(ctx);
  const planificateur = creerPlanificateur(ctx, acces);
  const liens = creerLiensPublics(ctx, acces);
  const admin = creerAdminEmails(ctx, acces, planificateur.etat);

  /** @param {Requete} req @param {Reponse} res */
  async function repondre(req, res) {
    let chemin = '';
    try { chemin = new URL(req.url ?? '/', 'http://serveur').pathname; } catch { /* chemin vide : 404 ci-dessous */ }
    try {
      if (chemin === CHEMIN_LIEN) return await liens.repondreLien(req, res);
      if (chemin === CHEMIN_UN_CLIC) return await liens.repondreUnClic(req, res);
      if (CHEMINS.has(chemin)) return await admin.repondreAdmin(req, res, chemin);
      return repondreJson(req, res, 404, { error: 'introuvable' });
    } catch (erreur) {
      acces.signaler('requête e-mails impossible', erreur, { chemin });
      if (!res.headersSent) repondreJson(req, res, 503, { error: 'Service momentanément indisponible.' });
      else res.destroy();
    }
  }

  return {
    configure,
    mode,
    actif,
    /**
     * La confirmation part vraiment (SMTP réel, planificateur prêt, identité de l'organisateur connue) : l'accueil
     * peut dire « vérifiez votre boîte mail ». Relu à chaque appel.
     */
    get confirmationActive() {
      return mode === 'smtp' && planificateur.etat().pret;
    },
    /** @param {string | undefined} url */
    estRoute(url) {
      try { return CHEMINS.has(new URL(url ?? '/', 'http://serveur').pathname); }
      catch { return false; }
    },
    repondre,
    demarrer: planificateur.demarrer,
    arreter: planificateur.arreter,
    passer: planificateur.passer,
    etat: planificateur.etat,
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
