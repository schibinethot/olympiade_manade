// @ts-check
// Rendu partagé des e-mails de la séquence (design §5) : importé par le planificateur (envoi) et par
// l'admin (aperçu en direct). Isomorphe : aucun import node:*, aucune dépendance.
//
// Le texte de l'admin et toutes les valeurs sont échappés. Seule cette syntaxe produit du balisage :
//   ligne vide                        sépare deux paragraphes
//   # Titre                           titre de l'e-mail (un par e-mail), seul sur sa ligne
//   **gras**                          gras
//   [texte](url)                      lien ; url = https://… ou {{lien_*}}, tout autre schéma reste du texte
//   - élément                         élément de liste
//   [[Texte du bouton|url]]           bouton, seul sur sa ligne
//   {{prochaines_dates}}              tableau de dates avec « Je viens », seul sur sa ligne (de même {{dates_annoncees}})
//
// Règle « au fur et à mesure » : une ligne (paragraphe, élément de liste, bouton) qui contient une variable
// sans valeur disparaît. Sauf {{prenom}} : la variable et l'espace qui la précède sont retirés, la ligne
// reste. Une variable inconnue est rendue vide, sans retirer la ligne. Un {{lien_*}} seul, hors d'un lien,
// affiche le nom de domaine.

import { CONSENTEMENT_ANNONCES_TEXTE, CONSENTEMENT_ANNONCES_VERSION } from './consentements.mjs';
import { jourDesSoirees, lireJour } from './fuseau-paris.mjs';

// Textes de consentement : source unique serveur/consentements.mjs (copié à l'identique dans la migration
// 20261017160000_sequence_emails.sql). Réexportés pour les appelants existants.
export { CONSENTEMENT_ANNONCES_TEXTE, CONSENTEMENT_ANNONCES_VERSION, lireJour };

/**
 * Une ligne `dates` de la RPC `emails_a_traiter` (tâche 1).
 * @typedef {{
 *   id: string,
 *   nom: string,
 *   ville: string,
 *   arenes: string | null,
 *   date_soiree: string,
 *   heure: string | null,
 *   statut: 'previsionnelle' | 'confirmee' | 'annulee',
 *   lien_billetterie: string | null,
 *   infos_pratiques: string | null,
 *   soiree: { slug: string, statut: 'brouillon' | 'publiee' | 'en_cours' | 'terminee' | 'reportee' | 'annulee' } | null,
 *   manades: string[],
 *   vainqueur: string | null,
 * }} DateEnrichie
 */

/** @typedef {DateEnrichie & { lienJeViens: string | null }} DateAnnoncee */

/**
 * Contexte du rendu. Champs ajoutés par la vague finale (facultatifs pour les appelants anciens) :
 * - `etape` : la raison de l'envoi, dans le pied, dépend du type d'e-mail (revue juridique C1) ;
 * - `annonces` : la personne a consenti aux annonces ; sans lui, {{lien_dates}} n'est fourni que pour
 *   l'annonce et les prochaines dates (revue juridique B3) ;
 * - `organisateur` : ligne d'identité du pied (revue juridique B4) ; absente si nulle.
 * @typedef {{
 *   prenom: string | null,
 *   maintenant: Date,
 *   origine: string,
 *   etape?: Etape,
 *   annonces?: boolean,
 *   organisateur?: string | null,
 *   date: DateEnrichie | null,
 *   prochaines: DateAnnoncee[],
 *   annoncees: DateAnnoncee[],
 *   encartDateProche: boolean,
 *   liens: { desinscription: string, confirmation: string | null, jeViens: string | null },
 * }} ContexteEmail
 */

/** @typedef {{ sujet: string, preheader?: string, corps: string, encart?: string | null }} ModeleEmail */

/** @typedef {{ sujet: string, html: string, texte: string }} RenduEmail */

/** @typedef {'email' | 'apercu'} CibleEmail */

export const ETAPES = Object.freeze(/** @type {const} */ ([
  'confirmation', 'bienvenue', 'j_moins_7', 'veille', 'jour_j', 'lendemain', 'prochaines_dates', 'annonce', 'message',
]));

/** @typedef {typeof ETAPES[number]} Etape */

/**
 * @typedef {{
 *   nom: string,
 *   sujet: string,
 *   preheader: string,
 *   corps: string,
 *   encart: string | null,
 *   jours_decalage: number | null,
 *   heure_envoi: string | null,
 * }} ModeleDefaut
 */

/**
 * @typedef {{
 *   cle: string,
 *   libelle: string,
 *   groupe: 'Personne' | 'Date' | 'Lieu' | 'Infos' | 'Liens',
 *   exemple: string,
 * }} VariableEmail
 */

const NB = '\u00a0';
const SITE = 'https://olympiadedesmanades.fr';
/** À partir de cette heure, le jour même s'écrit « ce soir » plutôt que « aujourd'hui ». */
const HEURE_DU_SOIR = 18;

/** @type {readonly VariableEmail[]} */
export const VARIABLES = Object.freeze(/** @type {VariableEmail[]} */ ([
  { cle: 'prenom', libelle: 'Prénom', groupe: 'Personne', exemple: 'Camille' },
  { cle: 'date', libelle: 'Date', groupe: 'Date', exemple: `samedi 31${NB}juillet 2027` },
  { cle: 'date_courte', libelle: 'Date courte', groupe: 'Date', exemple: `sam.${NB}31/07` },
  { cle: 'jour', libelle: 'Jour', groupe: 'Date', exemple: 'samedi' },
  { cle: 'heure', libelle: 'Heure', groupe: 'Date', exemple: `21${NB}h${NB}30` },
  { cle: 'compte_a_rebours', libelle: 'Compte à rebours', groupe: 'Date', exemple: `dans 7${NB}jours` },
  { cle: 'jours_restants', libelle: 'Jours restants', groupe: 'Date', exemple: '7' },
  { cle: 'annee', libelle: 'Année', groupe: 'Date', exemple: '2027' },
  { cle: 'nom_evenement', libelle: 'Nom de l’événement', groupe: 'Lieu', exemple: 'Rencontre des manades' },
  { cle: 'ville', libelle: 'Ville', groupe: 'Lieu', exemple: 'Sommières' },
  { cle: 'arenes', libelle: 'Arènes', groupe: 'Lieu', exemple: 'Arènes Gilles Arnaud' },
  { cle: 'infos_pratiques', libelle: 'Infos pratiques', groupe: 'Infos', exemple: 'Parking gratuit derrière les arènes.' },
  { cle: 'manades', libelle: 'Manades engagées', groupe: 'Infos', exemple: 'Arlatenco, Vinuesa, Bon' },
  { cle: 'vainqueur', libelle: 'Vainqueur', groupe: 'Infos', exemple: 'Manade Vinuesa' },
  { cle: 'prochaines_dates', libelle: 'Prochaines dates (liste)', groupe: 'Infos', exemple: `sam.${NB}31/07${NB}· Sommières, Arènes Gilles Arnaud${NB}· 21${NB}h${NB}30` },
  { cle: 'dates_annoncees', libelle: 'Dates annoncées (liste)', groupe: 'Infos', exemple: `ven.${NB}30/07${NB}· Marsillargues, Arènes Marcel Guillarmet${NB}· 21${NB}h${NB}30` },
  { cle: 'lien_billetterie', libelle: 'Lien de la billetterie', groupe: 'Liens', exemple: 'https://billetterie.exemple.fr' },
  { cle: 'lien_noter', libelle: 'Lien pour noter', groupe: 'Liens', exemple: `${SITE}/noter` },
  { cle: 'lien_classement', libelle: 'Lien du classement', groupe: 'Liens', exemple: `${SITE}/classements` },
  { cle: 'lien_dates', libelle: 'Lien du calendrier', groupe: 'Liens', exemple: `${SITE}/dates` },
  { cle: 'lien_je_viens', libelle: `Lien «${NB}Je viens${NB}»`, groupe: 'Liens', exemple: `${SITE}/emails/je-viens#j=…` },
  { cle: 'lien_confirmation', libelle: 'Lien de confirmation', groupe: 'Liens', exemple: `${SITE}/emails/confirmation#j=…` },
]).map((variable) => Object.freeze(variable)));

const CONNUES = new Set(VARIABLES.map((variable) => variable.cle));

// ——— Textes par défaut ———

/** Typographie du site : apostrophe courbe, espace insécable avant ; : ! ? » et après «. */
function typo(/** @type {string} */ texte) {
  return texte.replace(/'/g, '’').replace(/ ([;:!?»])/g, `${NB}$1`).replace(/« /g, `«${NB}`);
}

const lignes = (/** @type {string[]} */ ...contenu) => contenu.join('\n');

// Textes du prototype de la revue design (titres, billetterie en lien ou en bouton, pré-en-têtes), corrigés par
// la revue juridique, qui prévaut : phrase d'opposition dans la bienvenue (B1), lien vers les prochaines dates
// du lendemain réservé aux consentants par {{lien_dates}} (B3), objet du lendemain (S3).
/** @type {Record<Etape, ModeleDefaut>} */
const MODELES_BRUTS = {
  confirmation: {
    nom: 'Confirmation de l’adresse',
    sujet: 'Confirmez votre adresse email',
    preheader: 'Une dernière étape avant de recevoir les nouvelles de l’Olympiade des Manades.',
    corps: lignes(
      '# Plus qu\'une étape',
      '',
      'Bonjour {{prenom}},',
      '',
      'Merci de suivre l’Olympiade des Manades ! Confirmez votre adresse pour recevoir les rappels, les dates et les résultats.',
      '',
      '[[Confirmer mon adresse|{{lien_confirmation}}]]',
      '',
      'Ce lien reste valable 7 jours. Si vous n’avez rien demandé, ignorez ce message : vous ne recevrez rien d’autre.',
    ),
    encart: null,
    jours_decalage: null,
    heure_envoi: null,
  },
  bienvenue: {
    nom: 'Bienvenue',
    sujet: 'Bienvenue à l’Olympiade des Manades !',
    preheader: 'Rappels, notes et résultats : voici ce que vous allez recevoir.',
    corps: lignes(
      '# Le soir venu, vous notez aussi',
      '',
      'Bonjour {{prenom}},',
      '',
      'Votre adresse est confirmée : bienvenue à l’Olympiade des Manades, où le public note les manades en direct, aux côtés du jury.',
      '',
      'Avant votre soirée, vous recevrez l’heure, les arènes et la billetterie. Le lendemain, le vainqueur et le classement.',
      '',
      'Vous ne souhaitez pas recevoir ces rappels ? Le lien de désinscription, en bas de chaque email, les arrête à tout moment, sans connexion.',
      '',
      'Votre prochaine date : **{{date}}** à {{ville}}.',
      '',
      'À très vite dans les arènes !',
    ),
    encart: lignes(
      '**{{nom_evenement}} à {{ville}}, c’est {{compte_a_rebours}} !**',
      '- Heure : {{heure}}',
      '- Arènes : {{arenes}}',
      '- Billetterie : [réserver mes places]({{lien_billetterie}})',
      '{{infos_pratiques}}',
      '',
      '[[Je note les manades|{{lien_noter}}]]',
    ),
    jours_decalage: null,
    heure_envoi: null,
  },
  j_moins_7: {
    nom: 'Une semaine avant',
    sujet: 'L’Olympiade à {{ville}}, c’est {{compte_a_rebours}}',
    preheader: 'Rendez-vous {{date}} : l’heure, les arènes et les manades engagées.',
    corps: lignes(
      '# {{ville}}, {{compte_a_rebours}}',
      '',
      'Bonjour {{prenom}},',
      '',
      'L’Olympiade des Manades vous attend **{{date}}** à {{ville}}.',
      '',
      '- Heure : {{heure}}',
      '- Arènes : {{arenes}}',
      '- Manades engagées : {{manades}}',
      '',
      '[[Réserver mes places|{{lien_billetterie}}]]',
      '',
      'Un conseil : inscrivez-vous dès maintenant pour noter les manades, car le soir venu le réseau sature souvent dans les arènes. [Je m’inscris pour noter]({{lien_noter}})',
      '',
      'À bientôt à {{ville}} !',
    ),
    encart: null,
    jours_decalage: -7,
    heure_envoi: '10:00',
  },
  veille: {
    nom: 'La veille',
    sujet: 'C’est {{compte_a_rebours}} : l’Olympiade à {{ville}} !',
    preheader: 'L’heure, les arènes et les infos pratiques pour votre soirée.',
    corps: lignes(
      '# C\'est {{compte_a_rebours}}, à {{ville}}',
      '',
      'Bonjour {{prenom}},',
      '',
      'Rendez-vous **{{date}}** à {{ville}}.',
      '',
      '- Heure : {{heure}}',
      '- Arènes : {{arenes}}',
      '- Billetterie : [réserver mes places]({{lien_billetterie}})',
      '',
      '{{infos_pratiques}}',
      '',
      'Pour ne rien manquer le soir venu, ajoutez le site à votre écran d’accueil et activez les notifications. [J’ouvre le site]({{lien_noter}})',
      '',
      'À très vite dans les arènes !',
    ),
    encart: null,
    jours_decalage: -1,
    heure_envoi: '18:00',
  },
  jour_j: {
    nom: 'Le jour J',
    sujet: 'C’est {{compte_a_rebours}} à {{ville}} !',
    preheader: 'Votre lien pour noter les manades, à garder pour ce soir.',
    corps: lignes(
      '# C\'est {{compte_a_rebours}}',
      '',
      'Bonjour {{prenom}},',
      '',
      'L’Olympiade des Manades vous attend à {{ville}}.',
      '',
      '- Heure : {{heure}}',
      '- Arènes : {{arenes}}',
      '',
      '{{infos_pratiques}}',
      '',
      '[[Je note les manades|{{lien_noter}}]]',
      '',
      'Belle soirée !',
    ),
    encart: null,
    jours_decalage: 0,
    heure_envoi: '10:00',
  },
  lendemain: {
    nom: 'Le lendemain',
    sujet: 'Les résultats de la soirée à {{ville}}',
    preheader: 'Le vainqueur et le classement complet de la soirée.',
    corps: lignes(
      '# {{vainqueur}}, vainqueur à {{ville}}',
      '',
      'Bonjour {{prenom}},',
      '',
      'Merci d’avoir suivi l’Olympiade des Manades à {{ville}}, le {{date}}.',
      '',
      '[[Voir le classement complet|{{lien_classement}}]]',
      '',
      'La saison continue : [voir les prochaines dates]({{lien_dates}}).',
      '',
      'À bientôt dans les arènes !',
    ),
    encart: null,
    jours_decalage: 1,
    heure_envoi: '10:00',
  },
  prochaines_dates: {
    nom: 'Les prochaines dates',
    sujet: 'La saison continue : vos prochaines dates',
    preheader: 'Dites-nous à quelle soirée vous viendrez.',
    corps: lignes(
      '# Après {{ville}}, la suite',
      '',
      'Bonjour {{prenom}},',
      '',
      'L’Olympiade des Manades poursuit sa route. Dites-nous où vous viendrez :',
      '',
      '{{prochaines_dates}}',
      '',
      '[Voir tout le calendrier]({{lien_dates}})',
    ),
    encart: null,
    jours_decalage: 7,
    heure_envoi: '10:00',
  },
  annonce: {
    nom: 'Annonce d’une date',
    sujet: 'L’Olympiade des Manades revient {{compte_a_rebours}}',
    preheader: 'Le {{date}} à {{ville}} : serez-vous dans les arènes ?',
    corps: lignes(
      '# {{ville}}, {{compte_a_rebours}}',
      '',
      'Bonjour {{prenom}},',
      '',
      'L’Olympiade des Manades revient le **{{date}}** à {{ville}}. Dites-nous si vous venez :',
      '',
      '{{dates_annoncees}}',
      '',
      '[Voir tout le calendrier]({{lien_dates}})',
    ),
    encart: null,
    jours_decalage: -10,
    heure_envoi: '10:00',
  },
  // Inchangé : sa phrase « Écrivez ici… » sert de garde (le texte d'exemple ne part jamais tel quel).
  message: {
    nom: 'Message aux inscrits d’une date',
    sujet: 'Olympiade à {{ville}} : une information importante',
    preheader: 'À propos de la soirée du {{date}}.',
    corps: lignes(
      'Bonjour {{prenom}},',
      '',
      'Une information au sujet de l’Olympiade des Manades du {{date}} à {{ville}} :',
      '',
      'Écrivez ici votre message : changement d’horaire, report, annulation ou info de dernière minute.',
      '',
      'L’équipe de l’Olympiade des Manades',
    ),
    encart: null,
    jours_decalage: null,
    heure_envoi: null,
  },
};

/** Textes de départ, semés en base par le serveur et rétablis par « Revenir au texte d'origine ». */
export const MODELES_DEFAUT = /** @type {Readonly<Record<Etape, Readonly<ModeleDefaut>>>} */ (Object.freeze(
  Object.fromEntries(ETAPES.map((cle) => {
    const brut = MODELES_BRUTS[cle];
    return [cle, Object.freeze({
      ...brut,
      nom: typo(brut.nom),
      sujet: typo(brut.sujet),
      preheader: typo(brut.preheader),
      corps: typo(brut.corps),
      encart: brut.encart === null ? null : typo(brut.encart),
    })];
  })),
));

// ——— Dates, heure de Paris ———

const JOUR_LONG = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' });
const JOUR_COURT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' });
const MOIS_LONG = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' });

/** « 21:30:00 » → « 21 h 30 », « 10:00 » → « 10 h » (espaces insécables). */
function formaterHeure(/** @type {string | null} */ heure) {
  const morceaux = heure ? /^(\d{1,2}):(\d{2})/.exec(heure) : null;
  if (!morceaux) return null;
  const heures = Number(morceaux[1]);
  return morceaux[2] === '00' ? `${heures}${NB}h` : `${heures}${NB}h${NB}${morceaux[2]}`;
}

/**
 * Formats d'une date, avec les espaces insécables qui empêchent « 31 / juillet » ou « sam. / 31/07 ».
 * @param {string} dateIso « AAAA-MM-JJ »
 * @param {string | null} heure « HH:MM:SS » ou « HH:MM »
 * @returns {{ date: string, date_courte: string, jour: string, heure: string | null, annee: string }}
 */
export function formaterDate(dateIso, heure) {
  const { annee, mois, jour, utc } = lireJour(dateIso);
  const quantieme = Number(jour) === 1 ? '1er' : String(Number(jour));
  const jourLong = JOUR_LONG.format(utc);
  return {
    date: `${jourLong} ${quantieme}${NB}${MOIS_LONG.format(utc)} ${annee}`,
    date_courte: `${JOUR_COURT.format(utc)}${NB}${jour}/${mois}`,
    jour: jourLong,
    heure: formaterHeure(heure),
    annee,
  };
}

/**
 * Jours entre le « jour des soirées » de `maintenant` (bascule à 06:00, Paris) et la date : « dans 7 jours »,
 * « demain », « ce soir » (ou « aujourd'hui » avant 18 h), « hier ». Une inscription à 00 h 30, pendant la
 * soirée, lit donc encore « ce soir ». Au-delà de la veille passée, pas de texte. Un instant invalide lève une
 * erreur.
 * @param {string} dateIso
 * @param {string | null} heure
 * @param {Date} maintenant
 * @returns {{ texte: string | null, jours: number }}
 */
export function compteARebours(dateIso, heure, maintenant) {
  const cible = lireJour(dateIso).utc.getTime();
  const jours = Math.round((cible - lireJour(jourDesSoirees(maintenant.getTime())).utc.getTime()) / 86_400_000);
  const heures = heure ? Number(heure.split(':')[0]) : null;
  /** @type {string | null} */
  let texte = null;
  if (jours > 1) texte = `dans ${jours}${NB}jours`;
  else if (jours === 1) texte = 'demain';
  else if (jours === 0) texte = heures !== null && heures >= HEURE_DU_SOIR ? 'ce soir' : 'aujourd’hui';
  else if (jours === -1) texte = 'hier';
  return { texte, jours };
}

/** Date prévisionnelle : sa ligne le dit. */
const A_CONFIRMER = 'date à confirmer';

/** « sam. 31/07 · Sommières, Arènes Gilles Arnaud · 21 h 30 » (« · date à confirmer » si prévisionnelle). */
function libelleDate(/** @type {DateEnrichie} */ date) {
  const { date_courte, heure } = formaterDate(date.date_soiree, date.heure);
  const lieu = [nettoyer(date.ville), nettoyer(date.arenes)].filter(Boolean).join(', ');
  return [date_courte, lieu, heure, date.statut === 'previsionnelle' ? A_CONFIRMER : null].filter(Boolean).join(`${NB}· `);
}

// ——— Variables ———

const RE_VARIABLE = /\{\{\s*([^{}]*?)\s*\}\}/g;
const RE_PRENOM = /[ \t\u00a0]*\{\{\s*prenom\s*\}\}/g;
const RE_URL_ADMIN = /^https:\/\/[^\s<>"'`]+$/;
const RE_URL_VALEUR = /^https?:\/\/[^\s<>"'`]+$/i;

/**
 * Variables du texte absentes de VARIABLES, sans doublon, dans l'ordre d'apparition.
 * @param {string} texte
 * @returns {string[]}
 */
export function variablesInconnues(texte) {
  const inconnues = new Set();
  for (const [, nom] of texte.matchAll(RE_VARIABLE)) if (!CONNUES.has(nom)) inconnues.add(nom);
  return [...inconnues];
}

function nettoyer(/** @type {string | null | undefined} */ valeur) {
  const propre = typeof valeur === 'string' ? valeur.trim() : '';
  return propre === '' ? null : propre;
}

/** Une URL de valeur (base, admin, serveur) n'est retenue que si elle est en http(s). */
function urlSure(/** @type {string | null | undefined} */ valeur) {
  const propre = nettoyer(valeur);
  return propre && RE_URL_VALEUR.test(propre) ? propre : null;
}

/** Nom de domaine d'une URL sûre, sans « www. » : texte d'un {{lien_*}} seul. */
function domaine(/** @type {string} */ url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Heures des infos pratiques saisies par l'admin : « 20 h 30 » ne se coupe pas. */
function insecablesHeures(/** @type {string | null} */ texte) {
  return texte === null ? null : texte.replace(/(\d) h (\d)/g, `$1${NB}h${NB}$2`).replace(/(\d) h\b/g, `$1${NB}h`);
}

/**
 * @typedef {{
 *   cible: CibleEmail,
 *   base: string,
 *   valeurs: Map<string, string | null>,
 *   listes: Map<string, DateAnnoncee[]>,
 *   prenomAbsent: boolean,
 *   dansEncart: boolean,
 * }} Rendu
 */

/** Étapes qui, par nature, annoncent d'autres dates : {{lien_dates}} y est fourni sans condition (B3). */
const ETAPES_D_ANNONCE = new Set(['annonce', 'prochaines_dates']);

/**
 * @param {ContexteEmail} contexte
 * @param {CibleEmail} cible
 * @returns {Rendu}
 */
function preparer(contexte, cible) {
  const origine = urlSure(contexte.origine);
  if (!origine) throw new TypeError('Origine invalide : une URL http(s) absolue est attendue.');
  const base = origine.replace(/\/+$/, '');
  const date = contexte.date;
  /** @type {Map<string, string | null>} */
  const valeurs = new Map(VARIABLES.map((variable) => [variable.cle, null]));
  valeurs.set('prenom', nettoyer(contexte.prenom));
  // Revue juridique B3 : le lien vers les autres dates n'est fourni qu'à une personne qui a consenti aux
  // annonces, ou dans l'annonce et les prochaines dates (envoyées aux seuls consentants).
  const datesPermises = contexte.annonces === true || (contexte.etape !== undefined && ETAPES_D_ANNONCE.has(contexte.etape));
  valeurs.set('lien_dates', datesPermises ? urlSure(`${base}/dates`) : null);
  valeurs.set('lien_je_viens', urlSure(contexte.liens.jeViens));
  valeurs.set('lien_confirmation', urlSure(contexte.liens.confirmation));
  if (date) {
    const formats = formaterDate(date.date_soiree, date.heure);
    const rebours = compteARebours(date.date_soiree, date.heure, contexte.maintenant);
    const soiree = date.soiree;
    for (const [cle, valeur] of /** @type {[string, string | null][]} */ ([
      ['date', formats.date],
      ['date_courte', formats.date_courte],
      ['jour', formats.jour],
      ['heure', formats.heure],
      ['annee', formats.annee],
      ['compte_a_rebours', rebours.texte],
      ['jours_restants', rebours.jours >= 0 ? String(rebours.jours) : null],
      ['nom_evenement', nettoyer(date.nom)],
      ['ville', nettoyer(date.ville)],
      ['arenes', nettoyer(date.arenes)],
      ['infos_pratiques', insecablesHeures(nettoyer(date.infos_pratiques))],
      ['manades', nettoyer((date.manades ?? []).filter(Boolean).join(', '))],
      ['vainqueur', nettoyer(date.vainqueur)],
      ['lien_billetterie', urlSure(date.lien_billetterie)],
      ['lien_noter', soiree && (soiree.statut === 'publiee' || soiree.statut === 'en_cours') ? urlSure(`${base}/noter`) : null],
      ['lien_classement', soiree ? urlSure(`${base}/classements`) : null],
    ])) valeurs.set(cle, valeur);
  }
  const listes = new Map([
    ['prochaines_dates', contexte.prochaines ?? []],
    ['dates_annoncees', contexte.annoncees ?? []],
  ]);
  return { cible, base, valeurs, listes, prenomAbsent: valeurs.get('prenom') === null, dansEncart: false };
}

/** Valeur texte d'une variable, ou null si elle est inconnue ou vide. */
function valeurTexte(/** @type {string} */ nom, /** @type {Rendu} */ rendu) {
  const liste = rendu.listes.get(nom);
  if (liste) return liste.length ? liste.map(libelleDate).join(' ; ') : null;
  return rendu.valeurs.get(nom) ?? null;
}

/** Faux si la ligne contient une variable connue sans valeur ({{prenom}} excepté). */
function ligneComplete(/** @type {string} */ ligne, /** @type {Rendu} */ rendu) {
  for (const [, nom] of ligne.matchAll(RE_VARIABLE)) {
    if (nom !== 'prenom' && CONNUES.has(nom) && valeurTexte(nom, rendu) === null) return false;
  }
  return true;
}

function sansPrenom(/** @type {string} */ texte, /** @type {Rendu} */ rendu) {
  return rendu.prenomAbsent ? texte.replace(RE_PRENOM, '') : texte;
}

/**
 * URL d'un lien ou d'un bouton : une chaîne si elle est sûre, null pour une variable sans URL
 * utilisable (le texte reste, sans lien), undefined pour un autre schéma (rendu tel quel, en texte).
 * @returns {string | null | undefined}
 */
function resoudreUrl(/** @type {string} */ source, /** @type {Rendu} */ rendu) {
  if (RE_URL_ADMIN.test(source)) return source;
  const variable = /^\{\{\s*([^{}]*?)\s*\}\}$/.exec(source);
  if (!variable) return undefined;
  return variable[1].startsWith('lien_') ? urlSure(rendu.valeurs.get(variable[1])) : null;
}

// ——— Charte et styles ———

// Pile sans Roboto : Chromium tombait sur une Roboto installée sans graisse Regular (texte « tout en gras »).
const POLICE = 'Inter,-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif';
const POLICE_TITRE = '\'Playfair Display\',Georgia,\'Times New Roman\',serif';
const COULEURS = Object.freeze({
  sable: '#f7f4ed', creme: '#fcfbf7', lin: '#efe7d8', trait: '#e3dacb',
  encre: '#1c1912', encre2: '#5a5246', or: '#b78649', orInk: '#88693c',
});
/** Logo `public/email/logo.png` (PNG 2×), à sa taille d'affichage. */
const LOGO = Object.freeze({ largeur: 120, hauteur: 46 });

// Mêmes déclarations en ligne dans l'email et en classes `ee-*` dans l'aperçu : l'aperçu ne diverge pas.
// Outlook (moteur Word) : line-height en px avec mso-line-height-rule, police redéclarée dans l'encart.
const STYLES = Object.freeze({
  fond: `padding:24px 12px;background-color:${COULEURS.sable}`,
  carte: `width:100%;max-width:600px;margin:0 auto;background-color:${COULEURS.creme};border:1px solid ${COULEURS.trait};border-radius:16px;border-collapse:separate;overflow:hidden`,
  filet: `height:4px;line-height:4px;font-size:4px;mso-line-height-rule:exactly;background-color:${COULEURS.or};border-radius:16px 16px 0 0`,
  entete: 'padding:28px 24px 0',
  logo: `display:block;width:${LOGO.largeur}px;height:auto;border:0;font-family:${POLICE_TITRE};font-size:18px;font-weight:700;line-height:24px;color:${COULEURS.encre}`,
  corps: `padding:20px 24px 8px;font-family:${POLICE};font-size:16px;font-weight:400;line-height:26px;mso-line-height-rule:exactly;color:${COULEURS.encre};text-align:left`,
  titre: `margin:0 0 16px;font-family:${POLICE_TITRE};font-size:26px;font-weight:700;line-height:32px;mso-line-height-rule:exactly;color:${COULEURS.encre}`,
  p: 'margin:0 0 16px',
  liste: 'margin:0 0 16px 22px;padding:0;list-style:disc',
  element: 'margin:0 0 6px',
  lien: `color:${COULEURS.orInk};text-decoration:underline;word-break:break-word`,
  // Lien dans l'encart (fond lin) : l'encre, soulignée, atteint le contraste AA (l'or n'y faisait que 4,14:1).
  lienEncart: `color:${COULEURS.encre};text-decoration:underline;word-break:break-word`,
  boutonLigne: 'margin:8px 0 24px',
  bouton: `display:inline-block;padding:14px 26px;border-radius:12px;background-color:${COULEURS.encre};color:${COULEURS.creme};font-family:${POLICE};font-size:16px;font-weight:600;line-height:1.2;text-align:center;text-decoration:none`,
  dates: `width:100%;margin:0 0 20px;border-collapse:collapse;border-top:1px solid ${COULEURS.trait}`,
  date: `padding:14px 0;border-bottom:1px solid ${COULEURS.trait};font-family:${POLICE};font-size:16px;line-height:24px;mso-line-height-rule:exactly;color:${COULEURS.encre}`,
  dateDetail: `font-size:14px;line-height:22px;color:${COULEURS.encre2}`,
  dateAction: `padding:14px 0 14px 12px;border-bottom:1px solid ${COULEURS.trait};text-align:right;vertical-align:middle;white-space:nowrap`,
  pastille: `display:inline-block;padding:9px 16px;border-radius:999px;font-family:${POLICE};font-size:14px;font-weight:600;line-height:20px;color:${COULEURS.encre};text-decoration:none;white-space:nowrap`,
  encart: `padding:20px 22px 4px;background-color:${COULEURS.lin};border:1px solid ${COULEURS.or};border-radius:12px;font-family:${POLICE};font-size:16px;line-height:26px;mso-line-height-rule:exactly;color:${COULEURS.encre}`,
  pied: `max-width:600px;margin:0 auto;padding:20px 24px 4px;font-family:${POLICE};font-size:13px;line-height:20px;mso-line-height-rule:exactly;color:${COULEURS.encre2};text-align:center`,
});

/** Contour de la pastille « Je viens » : sur sa cellule dans l'email (Outlook), sur le lien dans l'aperçu. */
const CONTOUR_PASTILLE = `border:1px solid ${COULEURS.encre};border-radius:999px`;

/** Marge de l'encart : sur son tableau dans l'email (Outlook ignore la marge d'une cellule), sur le bloc dans l'aperçu. */
const MARGE_ENCART = 'margin:8px 0 20px';

/** @type {readonly [string, string][]} */
const REGLES_APERCU = Object.freeze([
  ['.apercu-email', STYLES.fond],
  ['.apercu-email .ee-carte', STYLES.carte],
  ['.apercu-email .ee-filet', STYLES.filet],
  ['.apercu-email .ee-entete', STYLES.entete],
  ['.apercu-email .ee-logo', STYLES.logo],
  ['.apercu-email .ee-corps', STYLES.corps],
  ['.apercu-email .ee-titre', STYLES.titre],
  ['.apercu-email .ee-p', STYLES.p],
  ['.apercu-email .ee-liste', STYLES.liste],
  ['.apercu-email .ee-element', STYLES.element],
  ['.apercu-email .ee-lien', STYLES.lien],
  ['.apercu-email .ee-encart .ee-lien', STYLES.lienEncart],
  ['.apercu-email .ee-bouton-ligne', STYLES.boutonLigne],
  ['.apercu-email .ee-bouton', STYLES.bouton],
  ['.apercu-email .ee-dates', STYLES.dates],
  ['.apercu-email .ee-date', STYLES.date],
  ['.apercu-email .ee-date-detail', STYLES.dateDetail],
  ['.apercu-email .ee-date-action', STYLES.dateAction],
  ['.apercu-email .ee-pastille', `${STYLES.pastille};${CONTOUR_PASTILLE}`],
  ['.apercu-email .ee-encart', `${MARGE_ENCART};${STYLES.encart}`],
  ['.apercu-email .ee-pied', STYLES.pied],
  ['.apercu-email .ee-identite', 'display:block;margin:6px 0 0'],
  ['.apercu-email strong', 'font-weight:700'],
]);

/**
 * Feuille de l'aperçu de l'admin, copiée dans app/composants/admin/emails/apercu-email.css (un test
 * vérifie l'égalité). Chaque règle est préfixée par `.apercu-email`.
 * @returns {string}
 */
export function cssApercu() {
  const regles = REGLES_APERCU.map(([selecteur, declarations]) => (
    `${selecteur} {\n${declarations.split(';').map((declaration) => `  ${declaration};`).join('\n')}\n}`
  ));
  return `/* Généré par cssApercu() (serveur/gabarits-emails.mjs) : ne pas modifier à la main. */\n\n${regles.join('\n\n')}\n`;
}

// ——— Rendu ———

function echapper(/** @type {string} */ texte) {
  return texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** @typedef {{ html: string, texte: string }} Morceau */

/** Apparence d'un élément : styles en ligne pour l'email, classe `ee-*` (sans style) pour l'aperçu. */
function apparence(/** @type {Rendu} */ rendu, /** @type {keyof typeof STYLES} */ style, /** @type {string} */ classe) {
  return rendu.cible === 'email' ? `style="${STYLES[style]}"` : `class="${classe}"`;
}

/**
 * @param {string} href
 * @param {string} contenuHtml
 * @param {Rendu} rendu
 * @param {keyof typeof STYLES} [style] par défaut le lien, à l'encre dans l'encart
 * @param {string} [classe]
 */
function ancre(href, contenuHtml, rendu, style, classe = 'ee-lien') {
  const choisi = style ?? (rendu.dansEncart ? 'lienEncart' : 'lien');
  return `<a href="${echapper(href)}" target="_blank" rel="noopener noreferrer" ${apparence(rendu, choisi, classe)}>${contenuHtml}</a>`;
}

/** Bouton ou lien seul sur sa ligne, dans la version texte : « texte : url ». */
const lienTexte = (/** @type {string} */ texte, /** @type {string} */ url) => `${texte}${NB}: ${url}`;

/** Lien dans une phrase, dans la version texte : « texte (url) ». */
const lienDansTexte = (/** @type {string} */ texte, /** @type {string} */ url) => `${texte} (${url})`;

/**
 * @param {string} nom
 * @param {Rendu} rendu
 * @param {boolean} dansLien vrai dans le texte d'un lien ou d'un bouton : pas de lien imbriqué
 * @returns {Morceau}
 */
function rendreVariable(nom, rendu, dansLien) {
  const valeur = valeurTexte(nom, rendu);
  if (valeur === null) return { html: '', texte: '' };
  // Filet de sécurité : un lien laissé seul affiche son domaine, pas une URL longue qui se coupe.
  if (nom.startsWith('lien_') && !dansLien) return { html: ancre(valeur, echapper(domaine(valeur)), rendu), texte: valeur };
  return { html: echapper(valeur).replace(/\r?\n/g, '<br>'), texte: valeur };
}

const RE_EN_LIGNE = /\[([^[\]\n]+)\]\(([^()\s]*)\)|\{\{\s*([^{}]*?)\s*\}\}|\*\*/g;

/**
 * Gras, liens et variables d'une ligne. Seuls les ** appariés font du gras.
 * @param {string} source
 * @param {Rendu} rendu
 * @param {boolean} [dansLien] vrai pour le texte d'un lien ou d'un bouton
 * @returns {Morceau}
 */
function rendreEnLigne(source, rendu, dansLien = false) {
  const jetons = [...source.matchAll(RE_EN_LIGNE)];
  const gras = jetons.filter((jeton) => jeton[0] === '**');
  const grasApparies = new Set(gras.slice(0, gras.length - (gras.length % 2)));
  let html = '';
  let texte = '';
  let position = 0;
  let grasOuvert = false;
  for (const jeton of jetons) {
    const avant = source.slice(position, jeton.index);
    html += echapper(avant);
    texte += avant;
    position = (jeton.index ?? 0) + jeton[0].length;
    if (jeton[0] === '**') {
      if (grasApparies.has(jeton)) {
        html += grasOuvert ? '</strong>' : '<strong>';
        grasOuvert = !grasOuvert;
      } else {
        html += '**';
        texte += '**';
      }
    } else if (jeton[3] !== undefined) {
      const morceau = rendreVariable(jeton[3], rendu, dansLien);
      html += morceau.html;
      texte += morceau.texte;
    } else {
      const url = resoudreUrl(jeton[2], rendu);
      if (url === undefined) {
        html += echapper(jeton[0]);
        texte += jeton[0];
        continue;
      }
      const contenu = rendreEnLigne(jeton[1], rendu, true);
      html += url === null ? contenu.html : ancre(url, contenu.html, rendu);
      texte += url === null ? contenu.texte : lienDansTexte(contenu.texte, url);
    }
  }
  const reste = source.slice(position);
  return { html: html + echapper(reste), texte: texte + reste };
}

/**
 * @typedef {{ type: 'p' | 'element' | 'titre', morceau: Morceau }
 *   | { type: 'bouton', libelle: Morceau, url: string }
 *   | { type: 'dates', dates: DateAnnoncee[] }} Ligne
 */

/**
 * @param {string} ligne ligne non vide, déjà débarrassée d'un {{prenom}} absent
 * @param {Rendu} rendu
 * @returns {Ligne}
 */
function lireLigne(ligne, rendu) {
  const liste = /^\{\{\s*(prochaines_dates|dates_annoncees)\s*\}\}$/.exec(ligne);
  if (liste) return { type: 'dates', dates: rendu.listes.get(liste[1]) ?? [] };
  const bouton = /^\[\[([^[\]|]+)\|([^[\]|\s]+)\]\]$/.exec(ligne);
  if (bouton) {
    const url = resoudreUrl(bouton[2], rendu);
    if (typeof url === 'string') return { type: 'bouton', libelle: rendreEnLigne(bouton[1].trim(), rendu, true), url };
    return { type: 'p', morceau: url === null ? rendreEnLigne(bouton[1].trim(), rendu) : rendreEnLigne(ligne, rendu) };
  }
  if (ligne.startsWith('# ')) return { type: 'titre', morceau: rendreEnLigne(ligne.slice(2).trim(), rendu) };
  if (ligne.startsWith('- ')) return { type: 'element', morceau: rendreEnLigne(ligne.slice(2).trim(), rendu) };
  return { type: 'p', morceau: rendreEnLigne(ligne, rendu) };
}

/**
 * Tableau de dates : date et ville en gras, arènes, heure et « date à confirmer » dessous, pastille « Je viens »
 * à droite (bouton à toute épreuve : contour sur la cellule pour Outlook).
 * @param {DateAnnoncee[]} dates @param {Rendu} rendu @returns {Morceau}
 */
function rendreDates(dates, rendu) {
  const email = rendu.cible === 'email';
  const rangs = dates.map((date) => {
    const { date_courte, heure } = formaterDate(date.date_soiree, date.heure);
    const titre = [date_courte, nettoyer(date.ville)].filter(Boolean).join(`${NB}· `);
    const detail = [nettoyer(date.arenes), heure, date.statut === 'previsionnelle' ? A_CONFIRMER : null].filter(Boolean).join(`${NB}· `);
    const jeViens = urlSure(date.lienJeViens);
    const pastille = jeViens ? ancre(jeViens, `Je${NB}viens`, rendu, 'pastille', 'ee-pastille') : '';
    const action = pastille && email
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr><td style="${CONTOUR_PASTILLE};mso-padding-alt:9px 16px">${pastille}</td></tr></table>`
      : pastille;
    const fort = email ? `<strong style="font-weight:700">${echapper(titre)}</strong>` : `<strong>${echapper(titre)}</strong>`;
    return {
      html: `<tr><td ${apparence(rendu, 'date', 'ee-date')}>${fort}${detail ? `<br><span ${apparence(rendu, 'dateDetail', 'ee-date-detail')}>${echapper(detail)}</span>` : ''}</td>`
        + `<td ${email ? 'align="right" valign="middle" ' : ''}${apparence(rendu, 'dateAction', 'ee-date-action')}>${action}</td></tr>`,
      texte: `- ${libelleDate(date)}${jeViens ? `\n  ${lienTexte('Je viens', jeViens)}` : ''}`,
    };
  });
  const tableau = email ? 'role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' : '';
  return {
    html: `<table ${tableau}${apparence(rendu, 'dates', 'ee-dates')}>${rangs.map((rang) => rang.html).join('')}</table>`,
    texte: rangs.map((rang) => rang.texte).join('\n'),
  };
}

/** @param {Ligne[]} groupe @param {Rendu} rendu @returns {Morceau} */
function rendreGroupe(groupe, rendu) {
  const email = rendu.cible === 'email';
  const premier = groupe[0];
  if (premier.type === 'titre') {
    return { html: `<h1 ${apparence(rendu, 'titre', 'ee-titre')}>${premier.morceau.html}</h1>`, texte: premier.morceau.texte };
  }
  if (premier.type === 'dates') return rendreDates(groupe.flatMap((ligne) => (ligne.type === 'dates' ? ligne.dates : [])), rendu);
  if (premier.type === 'bouton') {
    const lien = ancre(premier.url, premier.libelle.html, rendu, 'bouton', 'ee-bouton');
    return {
      html: email
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="${STYLES.boutonLigne}"><tr><td bgcolor="${COULEURS.encre}" style="border-radius:12px;background-color:${COULEURS.encre};mso-padding-alt:14px 26px">${lien}</td></tr></table>`
        : `<p class="ee-bouton-ligne">${lien}</p>`,
      texte: lienTexte(premier.libelle.texte, premier.url),
    };
  }
  /** @type {Morceau[]} */
  const elements = [];
  for (const ligne of groupe) {
    if (ligne.type === 'p' || ligne.type === 'element') elements.push(ligne.morceau);
  }
  if (premier.type === 'p') {
    return {
      html: `<p ${apparence(rendu, 'p', 'ee-p')}>${elements.map((element) => element.html).join('<br>')}</p>`,
      texte: elements.map((element) => element.texte).join('\n'),
    };
  }
  return {
    html: `<ul ${apparence(rendu, 'liste', 'ee-liste')}>${elements.map((element) => `<li ${apparence(rendu, 'element', 'ee-element')}>${element.html}</li>`).join('')}</ul>`,
    texte: elements.map((element) => `- ${element.texte}`).join('\n'),
  };
}

/** Lignes consécutives d'un même élément : paragraphe, liste, tableau de dates, titre ou bouton. */
const famille = (/** @type {Ligne} */ ligne) => (ligne.type === 'element' ? 'liste' : ligne.type);

/**
 * Corps (ou encart) en titres, paragraphes, listes, tableaux de dates et boutons.
 * @param {string} source
 * @param {Rendu} rendu
 * @returns {Morceau}
 */
function rendreCorps(source, rendu) {
  /** @type {Ligne[][]} */
  const blocs = [[]];
  for (const brute of source.replace(/\r\n?/g, '\n').split('\n')) {
    const ligne = brute.trim();
    if (ligne === '') {
      if (blocs[blocs.length - 1].length) blocs.push([]);
      continue;
    }
    if (!ligneComplete(ligne, rendu)) continue;
    const propre = sansPrenom(ligne, rendu).trim();
    if (propre !== '') blocs[blocs.length - 1].push(lireLigne(propre, rendu));
  }
  /** @type {Morceau[]} */
  const morceaux = [];
  for (const bloc of blocs) {
    /** @type {Morceau[]} */
    const parBloc = [];
    /** @type {Ligne[]} */
    let groupe = [];
    const vider = () => {
      if (groupe.length) parBloc.push(rendreGroupe(groupe, rendu));
      groupe = [];
    };
    for (const ligne of bloc) {
      if (groupe.length && (famille(groupe[0]) !== famille(ligne) || ligne.type === 'bouton' || ligne.type === 'titre')) vider();
      groupe.push(ligne);
    }
    vider();
    if (parBloc.length) {
      morceaux.push({
        html: parBloc.map((morceau) => morceau.html).join('\n'),
        texte: parBloc.map((morceau) => morceau.texte).join('\n'),
      });
    }
  }
  return {
    html: morceaux.map((morceau) => morceau.html).join('\n'),
    texte: morceaux.map((morceau) => morceau.texte).join('\n\n'),
  };
}

// Caractères de contrôle (C0, DEL, C1) et séparateurs de ligne Unicode : jamais dans un sujet.
const RE_CONTROLE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g;

/**
 * Sujet ou pré-en-tête : texte brut, variables remplies, sur une seule ligne. Défense en profondeur
 * contre l'injection d'en-tête : tout caractère de contrôle (CR, LF compris) devient une espace.
 */
function rendreTexteSimple(/** @type {string} */ source, /** @type {Rendu} */ rendu) {
  return sansPrenom(source, rendu)
    .replace(RE_VARIABLE, (_, /** @type {string} */ nom) => valeurTexte(nom, rendu) ?? '')
    .replace(RE_CONTROLE, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/**
 * Raison de l'envoi, dans le pied, selon le type d'e-mail (revue juridique C1). Sans étape (aperçu ancien),
 * le texte des rappels.
 * @param {Etape | undefined} etape
 */
export function raisonDuPied(etape) {
  if (etape === 'confirmation') {
    return 'Vous recevez cet email car votre adresse a été saisie dans le formulaire d’actualités de olympiadedesmanades.fr. Sans clic de votre part, elle sera supprimée dans 30 jours.';
  }
  if (etape === 'annonce' || etape === 'prochaines_dates') {
    return 'Vous recevez cet email car vous avez accepté de recevoir l’annonce des prochaines dates de l’Olympiade des Manades.';
  }
  return 'Vous recevez cet email car vous êtes inscrit·e au vote du public ou aux actualités de l’Olympiade des Manades.';
}

// Caractères invisibles après le pré-en-tête : la messagerie n'y accole pas le début du corps.
const REMPLISSAGE = '&#847;&zwnj;&nbsp;'.repeat(40);

/**
 * @param {ModeleEmail} modele
 * @param {ContexteEmail} contexte
 * @param {{ cible: CibleEmail }} [options]
 * @returns {RenduEmail}
 */
export function rendreEmail(modele, contexte, { cible } = { cible: 'email' }) {
  if (cible !== 'email' && cible !== 'apercu') throw new TypeError(`Cible inconnue : ${String(cible)}`);
  const rendu = preparer(contexte, cible);
  const email = cible === 'email';
  // Un email sans lien de désinscription valable ne part pas ; l'aperçu de l'admin, lui, peut s'en passer.
  const desinscription = urlSure(contexte.liens.desinscription) ?? (email ? null : `${rendu.base}/emails/desinscription`);
  if (!desinscription) throw new TypeError('Lien de désinscription invalide : une URL http(s) est obligatoire dans un email.');
  const sujet = rendreTexteSimple(modele.sujet, rendu);
  const preheader = rendreTexteSimple(modele.preheader ?? '', rendu);
  const corps = rendreCorps(modele.corps, rendu);
  const encart = contexte.encartDateProche && modele.encart ? rendreCorps(modele.encart, { ...rendu, dansEncart: true }) : null;
  const logo = `${rendu.base}/email/logo.png`;
  const dimensions = `width="${LOGO.largeur}" height="${LOGO.hauteur}"`;
  // Le logo mène au site ; si les images sont bloquées, son texte alternatif garde la charte.
  const imageLogo = email
    ? `<img src="${echapper(logo)}" ${dimensions} alt="Olympiade des Manades" style="${STYLES.logo}">`
    : `<img class="ee-logo" src="${echapper(logo)}" ${dimensions} alt="Olympiade des Manades">`;
  const lienLogo = `<a href="${echapper(rendu.base)}" target="_blank" rel="noopener noreferrer">${imageLogo}</a>`;

  const htmlEncart = encart && encart.html
    ? (email
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${MARGE_ENCART};border-collapse:separate"><tr><td bgcolor="${COULEURS.lin}" style="${STYLES.encart}">\n${encart.html}\n</td></tr></table>`
      : `<div class="ee-encart">\n${encart.html}\n</div>`)
    : '';
  const raison = raisonDuPied(contexte.etape);
  const organisateur = nettoyer(contexte.organisateur ?? null);
  const identite = organisateur
    ? (email ? `<br>${echapper(organisateur)}` : `<span class="ee-identite">${echapper(organisateur)}</span>`)
    : '';
  const pied = `${echapper(raison)}${identite}<br>${ancre(desinscription, 'Se désinscrire', rendu)} · ${ancre(SITE, 'olympiadedesmanades.fr', rendu)}`;

  const html = email
    ? [
      '<!doctype html>',
      '<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<meta name="color-scheme" content="light">',
      '<meta name="supported-color-schemes" content="light">',
      '<meta name="x-apple-disable-message-reformatting">',
      '<meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">',
      '<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><style>body,table,td,p,li,a{font-family:\'Segoe UI\',Arial,sans-serif!important}h1{font-family:Georgia,serif!important}</style><![endif]-->',
      '<style>:root{color-scheme:light;supported-color-schemes:light}a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important}</style>',
      `<title>${echapper(sujet)}</title>`,
      '</head>',
      `<body style="margin:0;padding:0;background-color:${COULEURS.sable};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">`,
      preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${COULEURS.sable}">${echapper(preheader)}${REMPLISSAGE}</div>`
        : '',
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COULEURS.sable}"><tr><td align="center" style="${STYLES.fond}">`,
      // Outlook (moteur Word) ignore max-width : un tableau fantôme cale la carte et le pied à 600 px.
      '<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->',
      `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${COULEURS.creme}" style="${STYLES.carte}">`,
      `<tr><td height="4" bgcolor="${COULEURS.or}" style="${STYLES.filet}">&nbsp;</td></tr>`,
      `<tr><td style="${STYLES.entete}">${lienLogo}</td></tr>`,
      `<tr><td style="${STYLES.corps}">`,
      corps.html,
      htmlEncart,
      '</td></tr>',
      '</table>',
      `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:0 auto"><tr><td style="${STYLES.pied}">${pied}</td></tr></table>`,
      '<!--[if mso]></td></tr></table><![endif]-->',
      '</td></tr></table>',
      '</body>',
      '</html>',
    ].filter(Boolean).join('\n')
    : [
      '<div class="ee-carte">',
      '<div class="ee-filet"></div>',
      `<div class="ee-entete">${lienLogo}</div>`,
      '<div class="ee-corps">',
      corps.html,
      htmlEncart,
      '</div>',
      '</div>',
      `<div class="ee-pied">${pied}</div>`,
    ].filter(Boolean).join('\n');

  const texte = [
    corps.texte,
    encart ? encart.texte : '',
    [raison, organisateur, lienTexte('Se désinscrire', desinscription), SITE].filter(Boolean).join('\n'),
  ].filter(Boolean).join('\n\n');

  return { sujet, html, texte: `${texte}\n` };
}
