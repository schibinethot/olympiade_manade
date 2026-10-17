// @ts-check
// Rendu partagé des e-mails de la séquence (design §5) : importé par le planificateur (envoi) et par
// l'admin (aperçu en direct). Isomorphe : aucun import node:*, aucune dépendance.
//
// Le texte de l'admin et toutes les valeurs sont échappés. Seule cette syntaxe produit du balisage :
//   ligne vide                        sépare deux paragraphes
//   **gras**                          gras
//   [texte](url)                      lien ; url = https://… ou {{lien_*}}, tout autre schéma reste du texte
//   - élément                         élément de liste
//   [[Texte du bouton|url]]           bouton, seul sur sa ligne
//   {{prochaines_dates}}              liste de dates, seule sur sa ligne (de même {{dates_annoncees}})
//
// Règle « au fur et à mesure » : une ligne (élément de liste, bouton) qui contient une variable sans
// valeur disparaît. Sauf {{prenom}} : la variable et l'espace qui la précède sont retirés, la ligne
// reste. Une variable inconnue est rendue vide, sans retirer la ligne.

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
 * @typedef {{
 *   prenom: string | null,
 *   maintenant: Date,
 *   origine: string,
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

// Copié à l'identique dans la migration 20261017160000_sequence_emails.sql.
export const CONSENTEMENT_ANNONCES_TEXTE = 'J’accepte de recevoir par email l’annonce des prochaines dates de l’Olympiade des Manades.';
export const CONSENTEMENT_ANNONCES_VERSION = '2026-10-17';

const NB = '\u00a0';
const FUSEAU = 'Europe/Paris';
const SITE = 'https://olympiadedesmanades.fr';
/** À partir de cette heure, le jour même s'écrit « ce soir » plutôt que « aujourd'hui ». */
const HEURE_DU_SOIR = 18;

/** @type {readonly VariableEmail[]} */
export const VARIABLES = Object.freeze(/** @type {VariableEmail[]} */ ([
  { cle: 'prenom', libelle: 'Prénom', groupe: 'Personne', exemple: 'Camille' },
  { cle: 'date', libelle: 'Date', groupe: 'Date', exemple: 'samedi 31 juillet 2027' },
  { cle: 'date_courte', libelle: 'Date courte', groupe: 'Date', exemple: 'sam. 31/07' },
  { cle: 'jour', libelle: 'Jour', groupe: 'Date', exemple: 'samedi' },
  { cle: 'heure', libelle: 'Heure', groupe: 'Date', exemple: '21 h 30' },
  { cle: 'compte_a_rebours', libelle: 'Compte à rebours', groupe: 'Date', exemple: 'dans 7 jours' },
  { cle: 'jours_restants', libelle: 'Jours restants', groupe: 'Date', exemple: '7' },
  { cle: 'annee', libelle: 'Année', groupe: 'Date', exemple: '2027' },
  { cle: 'nom_evenement', libelle: 'Nom de l’événement', groupe: 'Lieu', exemple: 'Rencontre des manades' },
  { cle: 'ville', libelle: 'Ville', groupe: 'Lieu', exemple: 'Sommières' },
  { cle: 'arenes', libelle: 'Arènes', groupe: 'Lieu', exemple: 'Arènes Gilles Arnaud' },
  { cle: 'infos_pratiques', libelle: 'Infos pratiques', groupe: 'Infos', exemple: 'Parking gratuit derrière les arènes.' },
  { cle: 'manades', libelle: 'Manades engagées', groupe: 'Infos', exemple: 'Arlatenco, Vinuesa, Bon' },
  { cle: 'vainqueur', libelle: 'Vainqueur', groupe: 'Infos', exemple: 'Manade Vinuesa' },
  { cle: 'prochaines_dates', libelle: 'Prochaines dates (liste)', groupe: 'Infos', exemple: 'sam. 31/07 · Sommières, Arènes Gilles Arnaud · 21 h 30' },
  { cle: 'dates_annoncees', libelle: 'Dates annoncées (liste)', groupe: 'Infos', exemple: 'ven. 30/07 · Marsillargues, Arènes Marcel Guillarmet · 21 h 30' },
  { cle: 'lien_billetterie', libelle: 'Lien de la billetterie', groupe: 'Liens', exemple: 'https://billetterie.exemple.fr' },
  { cle: 'lien_noter', libelle: 'Lien pour noter', groupe: 'Liens', exemple: `${SITE}/noter` },
  { cle: 'lien_classement', libelle: 'Lien du classement', groupe: 'Liens', exemple: `${SITE}/classements` },
  { cle: 'lien_dates', libelle: 'Lien du calendrier', groupe: 'Liens', exemple: `${SITE}/dates` },
  { cle: 'lien_je_viens', libelle: `Lien «${NB}Je viens${NB}»`, groupe: 'Liens', exemple: `${SITE}/emails/je-viens?j=…` },
  { cle: 'lien_confirmation', libelle: 'Lien de confirmation', groupe: 'Liens', exemple: `${SITE}/emails/confirmation?j=…` },
]).map((variable) => Object.freeze(variable)));

const CONNUES = new Set(VARIABLES.map((variable) => variable.cle));

// ——— Textes par défaut ———

/** Typographie du site : apostrophe courbe, espace insécable avant ; : ! ? » et après «. */
function typo(/** @type {string} */ texte) {
  return texte.replace(/'/g, '’').replace(/ ([;:!?»])/g, `${NB}$1`).replace(/« /g, `«${NB}`);
}

const lignes = (/** @type {string[]} */ ...contenu) => contenu.join('\n');

/** @type {Record<Etape, ModeleDefaut>} */
const MODELES_BRUTS = {
  confirmation: {
    nom: 'Confirmation de l’adresse',
    sujet: 'Confirmez votre adresse email',
    preheader: 'Un clic, et vous recevrez les nouvelles de l’Olympiade des Manades.',
    corps: lignes(
      'Bonjour {{prenom}},',
      '',
      'Merci de suivre l’Olympiade des Manades ! Il reste une étape : confirmer votre adresse.',
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
      'Bonjour {{prenom}},',
      '',
      'Bienvenue à l’Olympiade des Manades ! Le soir venu, le public note les manades, en direct, aux côtés du jury.',
      '',
      'Avant votre soirée, vous recevrez l’heure, les arènes et la billetterie. Le lendemain, le vainqueur et le classement.',
      '',
      'Votre prochaine date : **{{date}}** à {{ville}}.',
      '',
      'À très vite dans les arènes !',
    ),
    encart: lignes(
      '**{{nom_evenement}} à {{ville}}, c’est {{compte_a_rebours}} !**',
      '- Date : {{date}}',
      '- Heure : {{heure}}',
      '- Arènes : {{arenes}}',
      '- Billetterie : {{lien_billetterie}}',
      '{{infos_pratiques}}',
      '',
      '[[Je note les manades|{{lien_noter}}]]',
      '',
      'Vous recevrez la suite au fur et à mesure.',
    ),
    jours_decalage: null,
    heure_envoi: null,
  },
  j_moins_7: {
    nom: 'Une semaine avant',
    sujet: 'L’Olympiade à {{ville}}, c’est {{compte_a_rebours}}',
    preheader: 'Tout ce qu’il faut savoir avant votre soirée.',
    corps: lignes(
      'Bonjour {{prenom}},',
      '',
      'L’Olympiade des Manades, c’est {{compte_a_rebours}} : **{{date}}** à {{ville}}.',
      '',
      '- Heure : {{heure}}',
      '- Arènes : {{arenes}}',
      '- Manades engagées : {{manades}}',
      '- Billetterie : {{lien_billetterie}}',
      '',
      'Un conseil : inscrivez-vous dès maintenant pour noter les manades, car le soir venu le réseau sature souvent dans les arènes. [Je m’inscris]({{lien_noter}})',
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
      'Bonjour {{prenom}},',
      '',
      'C’est {{compte_a_rebours}} ! Rendez-vous {{date}} à {{ville}}.',
      '',
      '- Heure : {{heure}}',
      '- Arènes : {{arenes}}',
      '- Billetterie : {{lien_billetterie}}',
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
    preheader: 'L’heure, les arènes et les infos pratiques du jour.',
    corps: lignes(
      'Bonjour {{prenom}},',
      '',
      'C’est {{compte_a_rebours}} : l’Olympiade des Manades vous attend à {{ville}}.',
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
    sujet: 'Merci pour la soirée à {{ville}} !',
    preheader: 'Merci pour cette soirée, et rendez-vous pour la suite de la saison.',
    corps: lignes(
      'Bonjour {{prenom}},',
      '',
      'Merci d’avoir suivi l’Olympiade des Manades à {{ville}}, le {{date}} !',
      '',
      'Vainqueur de la soirée : **{{vainqueur}}**',
      '',
      '[Voir le classement complet]({{lien_classement}})',
      '',
      'La saison continue ! [Voir les prochaines dates]({{lien_dates}})',
      '',
      'À bientôt dans les arènes !',
    ),
    encart: null,
    jours_decalage: 1,
    heure_envoi: '10:00',
  },
  prochaines_dates: {
    nom: 'Les prochaines dates',
    sujet: 'La saison continue : les prochaines dates de l’Olympiade',
    preheader: 'Les prochaines soirées de la saison.',
    corps: lignes(
      'Bonjour {{prenom}},',
      '',
      'Merci encore d’avoir suivi l’Olympiade des Manades à {{ville}}, le {{date}}. La saison continue !',
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
    preheader: 'Les prochaines soirées de l’Olympiade des Manades.',
    corps: lignes(
      'Bonjour {{prenom}},',
      '',
      'L’Olympiade des Manades revient {{compte_a_rebours}}, le {{date}} à {{ville}} !',
      '',
      '{{dates_annoncees}}',
      '',
      '[Voir tout le calendrier]({{lien_dates}})',
    ),
    encart: null,
    jours_decalage: -10,
    heure_envoi: '10:00',
  },
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
const JOUR_PARIS = new Intl.DateTimeFormat('en-US', { timeZone: FUSEAU, year: 'numeric', month: 'numeric', day: 'numeric' });

/** Minuit UTC du jour civil de Paris où tombe `instant`. */
function jourParis(/** @type {Date} */ instant) {
  const parties = JOUR_PARIS.formatToParts(instant);
  const lire = (/** @type {string} */ type) => Number(parties.find((partie) => partie.type === type)?.value);
  return Date.UTC(lire('year'), lire('month') - 1, lire('day'));
}

/**
 * Jour calendaire strict (le 31/02 est refusé), à minuit UTC. Partagé avec echeances-emails.mjs.
 * @param {string} dateIso « AAAA-MM-JJ »
 */
export function lireJour(dateIso) {
  const morceaux = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  const utc = morceaux ? new Date(Date.UTC(Number(morceaux[1]), Number(morceaux[2]) - 1, Number(morceaux[3]))) : null;
  if (!morceaux || !utc || utc.getUTCDate() !== Number(morceaux[3])) throw new RangeError(`Date invalide : ${dateIso}`);
  return { annee: morceaux[1], mois: morceaux[2], jour: morceaux[3], utc };
}

/** « 21:30:00 » → « 21 h 30 », « 10:00 » → « 10 h ». */
function formaterHeure(/** @type {string | null} */ heure) {
  const morceaux = heure ? /^(\d{1,2}):(\d{2})/.exec(heure) : null;
  if (!morceaux) return null;
  const heures = Number(morceaux[1]);
  return morceaux[2] === '00' ? `${heures} h` : `${heures} h ${morceaux[2]}`;
}

/**
 * @param {string} dateIso « AAAA-MM-JJ »
 * @param {string | null} heure « HH:MM:SS » ou « HH:MM »
 * @returns {{ date: string, date_courte: string, jour: string, heure: string | null, annee: string }}
 */
export function formaterDate(dateIso, heure) {
  const { annee, mois, jour, utc } = lireJour(dateIso);
  const quantieme = Number(jour) === 1 ? '1er' : String(Number(jour));
  const jourLong = JOUR_LONG.format(utc);
  return {
    date: `${jourLong} ${quantieme} ${MOIS_LONG.format(utc)} ${annee}`,
    date_courte: `${JOUR_COURT.format(utc)} ${jour}/${mois}`,
    jour: jourLong,
    heure: formaterHeure(heure),
    annee,
  };
}

/**
 * Jours de Paris entre `maintenant` et la date : « dans 7 jours », « demain », « ce soir » (ou
 * « aujourd'hui » avant 18 h), « hier ». Au-delà de la veille passée, pas de texte.
 * @param {string} dateIso
 * @param {string | null} heure
 * @param {Date} maintenant
 * @returns {{ texte: string | null, jours: number }}
 */
export function compteARebours(dateIso, heure, maintenant) {
  const cible = lireJour(dateIso).utc.getTime();
  const jours = Math.round((cible - jourParis(maintenant)) / 86_400_000);
  const heures = heure ? Number(heure.split(':')[0]) : null;
  /** @type {string | null} */
  let texte = null;
  if (jours > 1) texte = `dans ${jours} jours`;
  else if (jours === 1) texte = 'demain';
  else if (jours === 0) texte = heures !== null && heures >= HEURE_DU_SOIR ? 'ce soir' : 'aujourd’hui';
  else if (jours === -1) texte = 'hier';
  return { texte, jours };
}

/** « sam. 31/07 · Sommières, Arènes Gilles Arnaud · 21 h 30 » */
function libelleDate(/** @type {DateEnrichie} */ date) {
  const { date_courte, heure } = formaterDate(date.date_soiree, date.heure);
  const lieu = [nettoyer(date.ville), nettoyer(date.arenes)].filter(Boolean).join(', ');
  return [date_courte, lieu, heure].filter(Boolean).join(' · ');
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

/**
 * @typedef {{
 *   cible: CibleEmail,
 *   base: string,
 *   valeurs: Map<string, string | null>,
 *   listes: Map<string, DateAnnoncee[]>,
 *   prenomAbsent: boolean,
 * }} Rendu
 */

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
  valeurs.set('lien_dates', urlSure(`${base}/dates`));
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
      ['infos_pratiques', nettoyer(date.infos_pratiques)],
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
  return { cible, base, valeurs, listes, prenomAbsent: valeurs.get('prenom') === null };
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

const POLICE = 'Inter,-apple-system,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif';
const COULEURS = Object.freeze({
  sable: '#f7f4ed', creme: '#fcfbf7', lin: '#efe7d8', trait: '#e3dacb',
  encre: '#1c1912', encre2: '#5a5246', or: '#b78649', orInk: '#88693c',
});
/** Logo `public/email/logo.png` (PNG 2×), à sa taille d'affichage. */
const LOGO = Object.freeze({ largeur: 120, hauteur: 46 });

// Mêmes déclarations en ligne dans l'email et en classes `ee-*` dans l'aperçu : l'aperçu ne diverge pas.
const STYLES = Object.freeze({
  fond: `padding:24px 12px;background-color:${COULEURS.sable}`,
  carte: `width:100%;max-width:600px;margin:0 auto;background-color:${COULEURS.creme};border:1px solid ${COULEURS.trait};border-radius:16px;border-collapse:separate;overflow:hidden`,
  filet: `height:4px;line-height:4px;font-size:0;background-color:${COULEURS.or}`,
  entete: 'padding:28px 24px 0',
  logo: `display:block;width:${LOGO.largeur}px;height:auto;border:0`,
  corps: `padding:20px 24px 8px;font-family:${POLICE};font-size:16px;line-height:1.6;color:${COULEURS.encre};text-align:left`,
  p: 'margin:0 0 16px',
  liste: 'margin:0 0 16px;padding:0 0 0 22px;list-style:disc',
  element: 'margin:0 0 6px',
  lien: `color:${COULEURS.orInk};text-decoration:underline;word-break:break-word`,
  boutonLigne: 'margin:8px 0 24px',
  bouton: `display:inline-block;padding:14px 26px;border-radius:12px;background-color:${COULEURS.encre};color:${COULEURS.creme};font-family:${POLICE};font-size:16px;font-weight:600;line-height:1.2;text-align:center;text-decoration:none`,
  encart: `padding:20px 22px 4px;background-color:${COULEURS.lin};border:1px solid ${COULEURS.or};border-radius:12px`,
  pied: `max-width:600px;margin:0 auto;padding:20px 24px 4px;font-family:${POLICE};font-size:13px;line-height:1.5;color:${COULEURS.encre2};text-align:center`,
});

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
  ['.apercu-email .ee-p', STYLES.p],
  ['.apercu-email .ee-liste', STYLES.liste],
  ['.apercu-email .ee-element', STYLES.element],
  ['.apercu-email .ee-lien', STYLES.lien],
  ['.apercu-email .ee-bouton-ligne', STYLES.boutonLigne],
  ['.apercu-email .ee-bouton', STYLES.bouton],
  ['.apercu-email .ee-encart', `${MARGE_ENCART};${STYLES.encart}`],
  ['.apercu-email .ee-pied', STYLES.pied],
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
 * @param {keyof typeof STYLES} [style]
 * @param {string} [classe]
 */
function ancre(href, contenuHtml, rendu, style = 'lien', classe = 'ee-lien') {
  return `<a href="${echapper(href)}" target="_blank" rel="noopener noreferrer" ${apparence(rendu, style, classe)}>${contenuHtml}</a>`;
}

/** Texte d'un lien dans la version texte : « texte : url ». */
const lienTexte = (/** @type {string} */ texte, /** @type {string} */ url) => `${texte}${NB}: ${url}`;

/**
 * @param {string} nom
 * @param {Rendu} rendu
 * @param {boolean} dansLien vrai dans le texte d'un lien ou d'un bouton : pas de lien imbriqué
 * @returns {Morceau}
 */
function rendreVariable(nom, rendu, dansLien) {
  const valeur = valeurTexte(nom, rendu);
  if (valeur === null) return { html: '', texte: '' };
  if (nom.startsWith('lien_') && !dansLien) return { html: ancre(valeur, echapper(valeur), rendu), texte: valeur };
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
      texte += url === null ? contenu.texte : lienTexte(contenu.texte, url);
    }
  }
  const reste = source.slice(position);
  return { html: html + echapper(reste), texte: texte + reste };
}

/**
 * @typedef {{ type: 'p' | 'element', morceau: Morceau }
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
  if (ligne.startsWith('- ')) return { type: 'element', morceau: rendreEnLigne(ligne.slice(2).trim(), rendu) };
  return { type: 'p', morceau: rendreEnLigne(ligne, rendu) };
}

/** @param {Ligne[]} groupe @param {Rendu} rendu @returns {Morceau} */
function rendreGroupe(groupe, rendu) {
  const email = rendu.cible === 'email';
  const premier = groupe[0];
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
    if (ligne.type === 'dates') {
      for (const date of ligne.dates) {
        const libelle = libelleDate(date);
        const jeViens = urlSure(date.lienJeViens);
        elements.push({
          html: echapper(libelle) + (jeViens ? ` · ${ancre(jeViens, 'Je viens', rendu)}` : ''),
          texte: libelle + (jeViens ? ` · ${lienTexte('Je viens', jeViens)}` : ''),
        });
      }
    } else if (ligne.type !== 'bouton') {
      elements.push(ligne.morceau);
    }
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

/** Lignes consécutives d'un même élément : paragraphe, liste (éléments et dates) ou bouton. */
const famille = (/** @type {Ligne} */ ligne) => (ligne.type === 'dates' || ligne.type === 'element' ? 'liste' : ligne.type);

/**
 * Corps (ou encart) en paragraphes, listes et boutons.
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
      if (groupe.length && (famille(groupe[0]) !== famille(ligne) || ligne.type === 'bouton')) vider();
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

const PIED_TEXTE = 'Vous recevez cet email car vous êtes inscrit·e à l’Olympiade des Manades.';
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
  const encart = contexte.encartDateProche && modele.encart ? rendreCorps(modele.encart, rendu) : null;
  const logo = `${rendu.base}/email/logo.png`;
  const dimensions = `width="${LOGO.largeur}" height="${LOGO.hauteur}"`;

  const htmlEncart = encart && encart.html
    ? (email
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${MARGE_ENCART};border-collapse:separate"><tr><td bgcolor="${COULEURS.lin}" style="${STYLES.encart}">\n${encart.html}\n</td></tr></table>`
      : `<div class="ee-encart">\n${encart.html}\n</div>`)
    : '';
  const pied = `${echapper(PIED_TEXTE)}<br>${ancre(desinscription, 'Se désinscrire', rendu)} · ${ancre(SITE, 'olympiadedesmanades.fr', rendu)}`;

  const html = email
    ? [
      '<!doctype html>',
      '<html lang="fr">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<meta name="color-scheme" content="light">',
      '<meta name="supported-color-schemes" content="light">',
      `<title>${echapper(sujet)}</title>`,
      '</head>',
      `<body style="margin:0;padding:0;background-color:${COULEURS.sable}">`,
      preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${COULEURS.sable}">${echapper(preheader)}${REMPLISSAGE}</div>`
        : '',
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COULEURS.sable}"><tr><td align="center" style="${STYLES.fond}">`,
      // Outlook (moteur Word) ignore max-width : un tableau fantôme cale la carte et le pied à 600 px.
      '<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->',
      `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${COULEURS.creme}" style="${STYLES.carte}">`,
      `<tr><td height="4" bgcolor="${COULEURS.or}" style="${STYLES.filet}">&nbsp;</td></tr>`,
      `<tr><td style="${STYLES.entete}"><img src="${echapper(logo)}" ${dimensions} alt="Olympiade des Manades" style="${STYLES.logo}"></td></tr>`,
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
      `<div class="ee-entete"><img class="ee-logo" src="${echapper(logo)}" ${dimensions} alt="Olympiade des Manades"></div>`,
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
    `${PIED_TEXTE}\n${lienTexte('Se désinscrire', desinscription)}\n${SITE}`,
  ].filter(Boolean).join('\n\n');

  return { sujet, html, texte: `${texte}\n` };
}
