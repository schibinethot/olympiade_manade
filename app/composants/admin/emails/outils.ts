/**
 * Logique pure de l'admin des e-mails : textes en clair, bornes, insertion de la syntaxe des
 * modèles, regroupement du bilan et contexte de l'aperçu. Sans React ni réseau (tests unitaires).
 */

import { echeance, type EnvoiEstime } from '../../../../serveur/echeances-emails.mjs';
import {
  ETAPES,
  formaterDate,
  MODELES_DEFAUT,
  VARIABLES,
  type ContexteEmail,
  type DateAnnoncee,
  type DateEnrichie,
  type Etape,
} from '../../../../serveur/gabarits-emails.mjs';
import type { DateCalendrier, LigneBilan, ModeleEmailLigne, StatutEnvoi } from './donnees';

const FUSEAU = 'Europe/Paris';
const NB = '\u00a0';

// ---------------------------------------------------------------------------
// Jours et heures de Paris
// ---------------------------------------------------------------------------

const JOUR_PARIS = new Intl.DateTimeFormat('en-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' });
const INSTANT_PARIS = new Intl.DateTimeFormat('fr-FR', {
  timeZone: FUSEAU, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** Jour civil de Paris d'un instant : « AAAA-MM-JJ ». */
export function jourParisDe(instant: Date): string {
  return JOUR_PARIS.format(instant);
}

/** « AAAA-MM-JJ » décalé de `jours`. */
export function decalerJour(jour: string, jours: number): string {
  const [annee, mois, quantieme] = jour.split('-').map(Number);
  return new Date(Date.UTC(annee, mois - 1, quantieme + jours)).toISOString().slice(0, 10);
}

/** « 10:00:00 » → « 10 h », « 07:05 » → « 7 h 05 ». */
export function heureCourte(heure: string | null): string | null {
  const morceaux = heure ? /^(\d{1,2}):(\d{2})/.exec(heure) : null;
  if (!morceaux) return null;
  const heures = Number(morceaux[1]);
  return morceaux[2] === '00' ? `${heures} h` : `${heures} h ${morceaux[2]}`;
}

/** Valeur d'un champ `<input type="time">` : « 10:00:00 » → « 10:00 ». */
export function heureSaisie(heure: string | null): string {
  return heure ? heure.slice(0, 5) : '';
}

/** « sam. 24/07 à 10 h », à l'heure de Paris. */
export function instantEnClair(instant: string | Date): string {
  const parties = INSTANT_PARIS.formatToParts(typeof instant === 'string' ? new Date(instant) : instant);
  const lire = (type: Intl.DateTimeFormatPartTypes) => parties.find((partie) => partie.type === type)?.value ?? '';
  return `${lire('weekday')} ${lire('day')}/${lire('month')} à ${heureCourte(`${lire('hour')}:${lire('minute')}`)}`;
}

// ---------------------------------------------------------------------------
// Réglage « quand », bornes de la base
// ---------------------------------------------------------------------------

/** Étapes calées sur une date : jours et heure réglables. */
export const ETAPES_DATEES: readonly Etape[] = ['j_moins_7', 'veille', 'jour_j', 'lendemain', 'prochaines_dates', 'annonce'];
export const aUneEcheance = (cle: Etape) => ETAPES_DATEES.includes(cle);

/** Bornes des contraintes modeles_emails_jours_bornes et modeles_emails_heure_bornee. */
export const JOURS_MIN = -14;
export const JOURS_MAX = 7;
export const HEURE_MIN = '07:00';
export const HEURE_MAX = '21:00';

export const joursValides = (jours: number) => Number.isInteger(jours) && jours >= JOURS_MIN && jours <= JOURS_MAX;
export const heureValide = (heure: string) => /^\d{2}:\d{2}$/.test(heure) && heure >= HEURE_MIN && heure <= HEURE_MAX;

/** « 7 jours avant », « La veille », « Le jour même », « Le lendemain », « 7 jours après ». */
export function libelleJours(jours: number): string {
  if (jours === -1) return 'La veille';
  if (jours === 0) return 'Le jour même';
  if (jours === 1) return 'Le lendemain';
  return jours < 0 ? `${-jours} jours avant` : `${jours} jours après`;
}

/** Choix du jour d'envoi : « 7 jours avant la date », « La veille de la date », « Le jour même »… */
export function libelleChoixJours(jours: number, annonce: boolean): string {
  const cible = annonce ? 'chaque autre date' : 'la date';
  if (jours === 0 && !annonce) return 'Le jour même';
  return Math.abs(jours) <= 1 ? `${libelleJours(jours)} de ${cible}` : `${libelleJours(jours)} ${cible}`;
}

/** Le moment d'envoi d'une étape, dit comme l'organisateur le dirait. */
export function quandEnClair(cle: Etape, jours: number | null, heure: string | null): string {
  if (cle === 'confirmation') return 'Dès le dépôt du formulaire des actualités';
  if (cle === 'bienvenue') return 'Dès que l’adresse est confirmée';
  if (cle === 'message') return 'Quand vous l’envoyez, depuis l’onglet Dates';
  const a = heureCourte(heure);
  if (jours === null || a === null) return 'Moment d’envoi à régler';
  return cle === 'annonce' ? `${libelleChoixJours(jours, true)}, à ${a}` : `${libelleJours(jours)}, à ${a}`;
}

export const POUR_QUI: Readonly<Record<Etape, string>> = {
  confirmation: 'Les abonnés aux actualités qui n’ont pas encore confirmé leur adresse',
  bienvenue: 'Chaque nouvelle personne, une fois son adresse confirmée',
  j_moins_7: 'Les inscrits de la date',
  veille: 'Les inscrits de la date',
  jour_j: 'Les inscrits de la date',
  lendemain: 'Les inscrits de la date',
  prochaines_dates: 'Les inscrits de la date qui acceptent les annonces',
  annonce: 'Les personnes qui acceptent les annonces, sauf les inscrits de la date',
  message: 'Les inscrits de la date que vous choisissez',
};

/**
 * Prochain envoi estimé par envoisAVenir, avec la date concernée : une estimation haute, d'où
 * « environ ». « environ 132 inscrits de Lunel (jeu. 22/10), mer. 21/10 à 18 h ».
 */
export function prochainEnvoiEnClair(
  estime: EnvoiEstime | undefined,
  date?: Pick<DateCalendrier, 'ville' | 'date_soiree' | 'heure'>,
): string | null {
  if (!estime) return null;
  const quand = instantEnClair(estime.prevuLe);
  const laDate = date ? `${date.ville} (${dateCourte(date)})` : 'la date';
  if (estime.destinataires === 0) return `${quand}, ${laDate}${NB}: aucun inscrit pour l’instant`;
  return `environ ${estime.destinataires} inscrit${estime.destinataires > 1 ? 's' : ''} de ${laDate}, ${quand}`;
}

/** « jeu. 22/10 », ou la date brute si elle est illisible. */
function dateCourte(date: Pick<DateCalendrier, 'date_soiree' | 'heure'>): string {
  try {
    return formaterDate(date.date_soiree, date.heure).date_courte;
  } catch {
    return date.date_soiree;
  }
}

/**
 * Pour l'estimation : une date confirmée dont la soirée liée est annulée ou reportée garde seulement
 * ses « prochaines dates », comme une date annulée (étapes 2 à 5 suspendues, tâche 3).
 */
export function datesPourEstimation(dates: readonly DateCalendrier[]): DateCalendrier[] {
  return dates.map((date) => (
    date.statut === 'confirmee' && (date.soiree?.statut === 'annulee' || date.soiree?.statut === 'reportee')
      ? { ...date, statut: 'annulee' as const }
      : date
  ));
}

// ---------------------------------------------------------------------------
// Variables disponibles selon l'email (contexte posé par serveur/emails.mjs)
// ---------------------------------------------------------------------------

/** Variables qui ont une valeur sans date : la confirmation n'en a pas d'autre. */
const SANS_DATE = new Set(['prenom', 'lien_dates', 'lien_confirmation']);

/**
 * Vrai si la variable peut avoir une valeur dans cet email. À l'envoi :
 * - la confirmation n'a ni date ni prochaines dates ;
 * - le lien de confirmation n'existe que dans la confirmation ;
 * - « Je viens » et les dates annoncées n'existent que dans l'annonce ;
 * - le vainqueur (palmarès confirmé) n'est connu qu'après la soirée : une étape réglée à J+1 ou après
 *   (`jours`, son décalage en cours de saisie), ou le message. L'annonce porte sur une date à venir.
 */
export function variableDisponible(cle: Etape, variable: string, jours: number | null = null): boolean {
  if (variable === 'lien_confirmation') return cle === 'confirmation';
  if (variable === 'lien_je_viens' || variable === 'dates_annoncees') return cle === 'annonce';
  if (cle === 'confirmation') return SANS_DATE.has(variable);
  if (variable === 'vainqueur') return cle === 'message' || (aUneEcheance(cle) && cle !== 'annonce' && jours !== null && jours >= 1);
  return true;
}

/** Variables connues employées dans les textes, sans doublon, dans l'ordre d'apparition. */
export function variablesEmployees(textes: readonly string[]): string[] {
  const connues = new Set(VARIABLES.map((variable) => variable.cle));
  const employees = new Set<string>();
  for (const [, nom] of textes.join('\n').matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)) if (connues.has(nom)) employees.add(nom);
  return [...employees];
}

/** Date proposée pour l'aperçu : la prochaine date confirmée, sinon la prochaine, sinon la dernière connue. */
export function dateParDefaut(dates: readonly Pick<DateCalendrier, 'id' | 'date_soiree' | 'statut'>[], maintenant: Date): string {
  const aujourdhui = jourParisDe(maintenant);
  const avenir = dates.filter((date) => date.date_soiree >= aujourdhui);
  return (avenir.find((date) => date.statut === 'confirmee') ?? avenir[0] ?? dates[dates.length - 1])?.id ?? '';
}

/** Noms des modèles dont un texte utilise la variable, dans l'ordre de la séquence. */
export function modelesUtilisant(
  modeles: readonly Pick<ModeleEmailLigne, 'cle' | 'nom' | 'sujet' | 'preheader' | 'corps' | 'encart'>[],
  variable: string,
): string[] {
  const motif = new RegExp(`\\{\\{\\s*${variable}\\s*\\}\\}`);
  return modeles
    .filter((modele) => [modele.sujet, modele.preheader, modele.corps, modele.encart ?? ''].some((texte) => motif.test(texte)))
    .map((modele) => modele.nom);
}

// ---------------------------------------------------------------------------
// Calendrier et bilan
// ---------------------------------------------------------------------------

export const LIBELLES_STATUT_DATE: Readonly<Record<DateCalendrier['statut'], string>> = {
  previsionnelle: 'prévisionnelle',
  confirmee: 'confirmée',
  annulee: 'annulée',
};

/** « sam. 31/07/2027 · Sommières », suivi du statut s'il n'est pas « confirmée ». */
export function libelleOptionDate(date: Pick<DateCalendrier, 'date_soiree' | 'heure' | 'ville' | 'statut'>): string {
  const statut = date.statut === 'confirmee' ? '' : ` (${LIBELLES_STATUT_DATE[date.statut]})`;
  try {
    const { date_courte, annee } = formaterDate(date.date_soiree, date.heure);
    return `${date_courte}/${annee} · ${date.ville}${statut}`;
  } catch {
    // Date illisible : la liste reste utilisable, l'aperçu signale l'erreur.
    return `${date.date_soiree} · ${date.ville}${statut}`;
  }
}

/** Garde-fou du design (§2) : date confirmée dont la soirée liée est annulée ou reportée. */
export function soireesSuspendues(dates: readonly DateCalendrier[], aujourdhui: string): DateCalendrier[] {
  return dates.filter((date) => (
    date.statut === 'confirmee' && date.date_soiree >= aujourdhui
    && (date.soiree?.statut === 'annulee' || date.soiree?.statut === 'reportee')
  ));
}

export const LIBELLES_RAISONS: Readonly<Record<string, string>> = {
  deja_passe_a_l_inscription: 'Moment déjà passé lors de l’inscription',
  meme_jour_que_bienvenue: `Même jour que la bienvenue (l’encart «${NB}date proche${NB}» la remplace)`,
  date_annulee: 'Date annulée',
  soiree_suspendue: 'Soirée liée annulée ou reportée',
  aucune_date: 'Aucune prochaine date à annoncer',
  fenetre_depassee: 'Fenêtre d’envoi dépassée (plus de 12 h de retard)',
  plafond_jour: 'Plafond d’un email automatique par jour atteint',
  prochaines_dates_recent: 'Prochaines dates déjà envoyées dans les 7 derniers jours',
  rendu_invalide: 'Rendu impossible (texte ou lien invalide)',
  // Raisons relevées au moment de l'envoi par le serveur (serveur/emails.mjs).
  date_absente: 'Date retirée du calendrier',
  date_non_confirmee: 'Date redevenue prévisionnelle',
  date_passee: 'Date déjà passée au moment de l’envoi',
  sans_consentement: 'Annonces refusées entre-temps',
  desinscrit: 'Personne désinscrite entre-temps',
  non_confirme: 'Adresse pas encore confirmée',
  deja_confirme: 'Adresse déjà confirmée',
  destinataire_absent: 'Destinataire effacé entre-temps',
  modele_inactif: 'Email désactivé entre-temps',
  message_absent: 'Message introuvable',
  envoi_impossible: 'Refus du serveur d’envoi après trois essais',
  interrompu: 'Envoi interrompu (serveur arrêté pendant l’envoi)',
};

export type LigneBilanRegroupee = {
  etape: Etape;
  calendrierId: string | null;
  /** Dernier envoi parti (envoyé ou simulé). */
  dernierEnvoi: string | null;
  /** Pour en_attente et echec, la vue donne l'heure de la dernière tentative, pas d'un envoi. */
  derniereTentative: string | null;
} & Record<StatutEnvoi, number>;

const plusRecent = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

/** Une ligne par étape et par date, modes réel et simulé additionnés, dans l'ordre de la séquence. */
export function regrouperBilan(bilan: readonly LigneBilan[]): LigneBilanRegroupee[] {
  const lignes = new Map<string, LigneBilanRegroupee>();
  for (const ligne of bilan) {
    const cle = `${ligne.etape} ${ligne.calendrier_id ?? ''}`;
    const groupe = lignes.get(cle) ?? {
      etape: ligne.etape, calendrierId: ligne.calendrier_id, dernierEnvoi: null, derniereTentative: null,
      en_attente: 0, envoye: 0, simule: 0, echec: 0, saute: 0,
    };
    groupe[ligne.statut] += ligne.nombre;
    if (ligne.statut === 'envoye' || ligne.statut === 'simule') groupe.dernierEnvoi = plusRecent(groupe.dernierEnvoi, ligne.dernier_envoi);
    else if (ligne.statut === 'en_attente' || ligne.statut === 'echec') {
      groupe.derniereTentative = plusRecent(groupe.derniereTentative, ligne.dernier_envoi);
    }
    lignes.set(cle, groupe);
  }
  return [...lignes.values()].sort((a, b) => (
    ETAPES.indexOf(a.etape) - ETAPES.indexOf(b.etape) || (a.calendrierId ?? '').localeCompare(b.calendrierId ?? '')
  ));
}

// ---------------------------------------------------------------------------
// Insertion de la syntaxe des modèles (serveur/gabarits-emails.mjs)
// ---------------------------------------------------------------------------

/** Nouvelle valeur du champ et sélection à poser ensuite. */
export type Insertion = { valeur: string; debut: number; fin: number };

function remplacer(valeur: string, debut: number, fin: number, texte: string) {
  return valeur.slice(0, debut) + texte + valeur.slice(fin);
}

/** `{{cle}}` au curseur, à la place de la sélection. */
export function insererVariable(valeur: string, debut: number, fin: number, cle: string): Insertion {
  const code = `{{${cle}}}`;
  const position = debut + code.length;
  return { valeur: remplacer(valeur, debut, fin, code), debut: position, fin: position };
}

/** `**sélection**`, ou un texte à remplacer, sélectionné. */
export function insererGras(valeur: string, debut: number, fin: number): Insertion {
  const texte = valeur.slice(debut, fin).replace(/\*\*/g, '') || 'texte en gras';
  return { valeur: remplacer(valeur, debut, fin, `**${texte}**`), debut: debut + 2, fin: debut + 2 + texte.length };
}

/** `[sélection](https://)` : l'adresse est sélectionnée pour être tapée, ou le texte s'il manque. */
export function insererLien(valeur: string, debut: number, fin: number): Insertion {
  const selection = valeur.slice(debut, fin).replace(/[[\]\n]/g, '').trim();
  const texte = selection || 'texte du lien';
  const code = `[${texte}](https://)`;
  const adresse = debut + texte.length + 3;
  return selection
    ? { valeur: remplacer(valeur, debut, fin, code), debut: adresse, fin: adresse + 'https://'.length }
    : { valeur: remplacer(valeur, debut, fin, code), debut: debut + 1, fin: debut + 1 + texte.length };
}

/** Met « - » devant la ligne courante, ou devant chaque ligne sélectionnée. */
export function insererListe(valeur: string, debut: number, fin: number): Insertion {
  const debutLigne = valeur.lastIndexOf('\n', debut - 1) + 1;
  const finLigne = valeur.indexOf('\n', fin) === -1 ? valeur.length : valeur.indexOf('\n', fin);
  const lignes = valeur.slice(debutLigne, finLigne).split('\n');
  const bloc = lignes
    .map((ligne) => (ligne.startsWith('- ') || (lignes.length > 1 && ligne.trim() === '') ? ligne : `- ${ligne}`))
    .join('\n');
  const nouvelle = remplacer(valeur, debutLigne, finLigne, bloc);
  const finBloc = debutLigne + bloc.length;
  return lignes.length > 1 ? { valeur: nouvelle, debut: debutLigne, fin: finBloc } : { valeur: nouvelle, debut: finBloc, fin: finBloc };
}

/** `[[Texte du bouton|https://]]`, seul sur sa ligne. */
export function insererBouton(valeur: string, debut: number, fin: number): Insertion {
  const selection = valeur.slice(debut, fin).replace(/[[\]|\n]/g, '').trim();
  const texte = selection || 'Texte du bouton';
  const avant = debut > 0 && valeur[debut - 1] !== '\n' ? '\n' : '';
  const apres = fin < valeur.length && valeur[fin] !== '\n' ? '\n' : '';
  const departTexte = debut + avant.length + 2;
  const adresse = departTexte + texte.length + 1;
  const nouvelle = remplacer(valeur, debut, fin, `${avant}[[${texte}|https://]]${apres}`);
  return selection
    ? { valeur: nouvelle, debut: adresse, fin: adresse + 'https://'.length }
    : { valeur: nouvelle, debut: departTexte, fin: departTexte + texte.length };
}

// ---------------------------------------------------------------------------
// Message aux inscrits
// ---------------------------------------------------------------------------

const normaliser = (texte: string) => texte.replace(/\r\n?/g, '\n').trim();
const PHRASE_A_REMPLACER = MODELES_DEFAUT.message.corps.split('\n').find((ligne) => ligne.startsWith('Écrivez ici')) ?? '';

/** Vrai si le corps est encore le texte de départ, ou en garde la phrase « Écrivez ici… ». */
export function messageAEcrire(corps: string): boolean {
  if (normaliser(corps) === normaliser(MODELES_DEFAUT.message.corps)) return true;
  return PHRASE_A_REMPLACER !== '' && corps.includes(PHRASE_A_REMPLACER);
}

// ---------------------------------------------------------------------------
// Contexte de l'aperçu
// ---------------------------------------------------------------------------

const exemple = (cle: string) => VARIABLES.find((variable) => variable.cle === cle)?.exemple ?? null;

/** Ligne du calendrier vers la forme de la RPC (vainqueur inconnu avant la soirée). */
function enrichir(date: DateCalendrier, exemples: boolean): DateEnrichie {
  const manades = [...(date.soiree?.soiree_manades ?? [])]
    .sort((a, b) => a.ordre - b.ordre)
    .map((ligne) => ligne.manades?.nom ?? '')
    .filter(Boolean);
  const soiree = date.soiree ? { slug: date.soiree.slug, statut: date.soiree.statut } : null;
  const reelle: DateEnrichie = {
    id: date.id, nom: date.nom, ville: date.ville, arenes: date.arenes, date_soiree: date.date_soiree, heure: date.heure,
    statut: date.statut, lien_billetterie: date.lien_billetterie, infos_pratiques: date.infos_pratiques,
    soiree, manades, vainqueur: null,
  };
  if (!exemples) return reelle;
  return {
    ...reelle,
    arenes: reelle.arenes ?? exemple('arenes'),
    heure: reelle.heure ?? '21:30:00',
    lien_billetterie: reelle.lien_billetterie ?? exemple('lien_billetterie'),
    infos_pratiques: reelle.infos_pratiques ?? exemple('infos_pratiques'),
    manades: manades.length ? manades : (exemple('manades') ?? '').split(', '),
    vainqueur: exemple('vainqueur'),
    // Le lien pour noter n'existe que pour une soirée ouverte : l'exemple la suppose publiée.
    soiree: { slug: soiree?.slug ?? 'exemple', statut: 'publiee' },
  };
}

/** Une date fictive, faite des exemples des variables, quand le calendrier n'en a aucune. */
function dateExemple(): DateCalendrier {
  return {
    id: 'exemple', nom: exemple('nom_evenement') ?? 'Olympiade des Manades', ville: exemple('ville') ?? 'Sommières',
    arenes: exemple('arenes'), date_soiree: '2027-07-31', heure: '21:30:00', statut: 'confirmee',
    lien_billetterie: null, infos_pratiques: null, soiree_id: null, soiree: null,
  };
}

const lundiDe = (jour: string) => decalerJour(jour, -((new Date(`${jour}T00:00:00Z`).getUTCDay() + 6) % 7));

export type OptionsApercu = {
  cle: Etape;
  /** Réglage en cours de saisie (il place l'aperçu à l'échéance de l'étape). */
  reglage: { jours_decalage: number | null; heure_envoi: string | null };
  date: DateCalendrier | null;
  /** Toutes les dates connues : prochaines dates et dates annoncées. */
  dates: readonly DateCalendrier[];
  prenom: string;
  origine: string;
  maintenant: Date;
  /** Complète les infos encore inconnues avec les exemples des variables. */
  exemples: boolean;
  /** Bienvenue : montrer l'encart « date proche ». */
  encart: boolean;
};

/**
 * Contexte de rendreEmail pour l'aperçu, et l'instant simulé : l'échéance de l'étape pour la date
 * choisie (une étape datée), trois jours avant la date (bienvenue avec encart), sinon maintenant.
 */
export function preparerApercu(options: OptionsApercu): { contexte: ContexteEmail; instant: Date } {
  const { cle, origine, exemples } = options;
  // Comme à l'envoi : la confirmation ne porte sur aucune date, et le vainqueur n'existe qu'après la soirée.
  const source = cle === 'confirmation' ? null : options.date ?? (exemples ? dateExemple() : null);
  const enrichie = source ? enrichir(source, exemples) : null;
  const date = enrichie && !variableDisponible(cle, 'vainqueur', options.reglage.jours_decalage) ? { ...enrichie, vainqueur: null } : enrichie;
  const encartDateProche = cle === 'bienvenue' && options.encart && date !== null;

  let instant = options.maintenant;
  try {
    const simule = !date ? null
      : aUneEcheance(cle) ? echeance({ cle, ...options.reglage }, date)
        : encartDateProche ? echeance({ cle: 'apercu', jours_decalage: -3, heure_envoi: '10:00' }, date)
          : null;
    if (simule) instant = simule;
  } catch {
    // Réglage en cours de saisie (heure incomplète) : l'aperçu reste au moment présent.
  }

  const jeViens = `${origine}/emails/je-viens`;
  const annoncer = (ligne: DateCalendrier): DateAnnoncee => ({ ...enrichir(ligne, exemples), lienJeViens: jeViens });
  const jour = jourParisDe(instant);
  const confirmees = options.dates.filter((ligne) => ligne.statut === 'confirmee');
  // Comme l'envoi (serveur/emails.mjs) : les 3 prochaines dates confirmées, sans celle de l'email, aucune pour la confirmation.
  let prochaines = cle === 'confirmation' ? []
    : confirmees.filter((ligne) => ligne.date_soiree > jour && ligne.id !== source?.id).slice(0, 3).map(annoncer);
  if (!prochaines.length && exemples && cle !== 'confirmation') {
    prochaines = [annoncer({ ...dateExemple(), id: 'exemple-prochaine', date_soiree: '2027-08-14' })];
  }
  const annoncees = cle === 'annonce' && source
    ? [source, ...confirmees.filter((ligne) => ligne.id !== source.id && lundiDe(ligne.date_soiree) === lundiDe(source.date_soiree))]
      .sort((a, b) => a.date_soiree.localeCompare(b.date_soiree))
      .map(annoncer)
    : [];

  return {
    instant,
    contexte: {
      prenom: options.prenom.trim() || null,
      maintenant: instant,
      origine,
      date,
      prochaines,
      annoncees,
      encartDateProche,
      // Liens sans jeton : l'aperçu montre où ils mènent, sans rien signer. Comme à l'envoi, le lien de
      // confirmation n'existe que dans la confirmation, et « Je viens » que dans l'annonce.
      liens: {
        desinscription: `${origine}/emails/desinscription`,
        confirmation: cle === 'confirmation' ? `${origine}/emails/confirmation` : null,
        jeViens: cle === 'annonce' && source ? jeViens : null,
      },
    },
  };
}
