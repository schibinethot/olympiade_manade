// Logique de la page Dates, sans React : toutes les soirées du calendrier, par année et par mois.
import type { EtatLigneSaison } from './accueil';
import { jourParis, prochaineSoiree } from './dates';
import type { Calendrier, Palmares } from './donnees';

/** État d'une soirée sur la page Dates : celui de l'accueil, plus la soirée du jour. */
export type EtatDate = EtatLigneSaison | 'ce-soir';

export type LigneDate = {
  soiree: Calendrier;
  etat: EtatDate;
  /** Vainqueur connu au palmarès (même ville, même année), sinon null. */
  vainqueur: { nom: string; aConfirmer: boolean } | null;
};

export type SectionDates = {
  annee: number;
  /** La saison en cours ou à venir, ou une année passée. */
  type: 'saison' | 'archives';
  /** Ancre de la section : saison-2027, archives-2026. */
  id: string;
  titre: string;
  total: number;
  confirmees: number;
  previsionnelles: number;
  premiere: Calendrier | null;
  derniere: Calendrier | null;
  /** Soirées du jour, remontées en tête de la section (et retirées de leur mois). */
  ceSoir: LigneDate[];
  mois: { mois: number; libelle: string; lignes: LigneDate[] }[];
  /** Nombre de soirées par mois, de mai à août au moins, pour la frise de la saison. */
  frise: { mois: number; court: string; nombre: number }[];
};

const MOIS_LONG = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' });
const MOIS_COURT = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });
const majuscule = (texte: string) => texte.charAt(0).toLocaleUpperCase('fr-FR') + texte.slice(1);
const libelleMois = (mois: number, format: Intl.DateTimeFormat) => majuscule(format.format(new Date(Date.UTC(2000, mois - 1, 1))));
const moisDe = (s: Calendrier) => Number(s.date_soiree.slice(5, 7));
const normaliser = (ville: string) => ville.trim().toLocaleLowerCase('fr-FR');

/** Ordre du calendrier : la date, puis l'heure (inconnue en dernier), puis la ville. */
function ordre(a: Calendrier, b: Calendrier): number {
  return (
    a.date_soiree.localeCompare(b.date_soiree) ||
    (a.heure ?? '99').localeCompare(b.heure ?? '99') ||
    a.ville.localeCompare(b.ville, 'fr')
  );
}

/** Saison de la page : l'année de la prochaine soirée, sinon la dernière année du calendrier. */
function anneeSaison(calendrier: Calendrier[], maintenant: Date): number {
  return prochaineSoiree(calendrier, maintenant)?.annee ?? Math.max(...calendrier.map((s) => s.annee));
}

function trouverVainqueur(soiree: Calendrier, palmares: Palmares[] | null): LigneDate['vainqueur'] {
  const ligne = palmares?.find((p) => p.annee === soiree.annee && normaliser(p.ville) === normaliser(soiree.ville));
  return ligne ? { nom: ligne.vainqueur.trim(), aConfirmer: ligne.statut === 'a_confirmer' } : null;
}

/**
 * Toutes les soirées du calendrier, une section par année : la saison en cours ou à venir d'abord
 * (et les suivantes si elles sont déjà annoncées), puis les archives de la plus récente à la plus
 * ancienne. Rien n'est compté en dur : totaux, mois et vainqueurs viennent des données.
 */
export function sectionsDates(calendrier: Calendrier[], palmares: Palmares[] | null, maintenant: Date): SectionDates[] {
  if (calendrier.length === 0) return [];
  const aujourdhui = jourParis(maintenant);
  const prochaine = prochaineSoiree(calendrier, maintenant);
  const saison = anneeSaison(calendrier, maintenant);
  const annees = [...new Set(calendrier.map((s) => s.annee))];
  const ordreAnnees = [...annees.filter((a) => a >= saison).sort((a, b) => a - b), ...annees.filter((a) => a < saison).sort((a, b) => b - a)];

  return ordreAnnees.map((annee) => {
    const soirees = calendrier.filter((s) => s.annee === annee).sort(ordre);
    const lignes: LigneDate[] = soirees.map((soiree) => ({
      soiree,
      etat:
        soiree.statut === 'annulee'
          ? 'annulee'
          : soiree.date_soiree === aujourdhui
            ? 'ce-soir'
            : soiree.date_soiree < aujourdhui
              ? 'terminee'
              : soiree.id === prochaine?.id
                ? 'prochaine'
                : 'a-venir',
      vainqueur: trouverVainqueur(soiree, palmares),
    }));

    const mois: SectionDates['mois'] = [];
    for (const ligne of lignes.filter((l) => l.etat !== 'ce-soir')) {
      const numero = moisDe(ligne.soiree);
      const groupe = mois.at(-1)?.mois === numero ? mois.at(-1) : undefined;
      if (groupe) groupe.lignes.push(ligne);
      else mois.push({ mois: numero, libelle: libelleMois(numero, MOIS_LONG), lignes: [ligne] });
    }

    const numeros = soirees.map(moisDe);
    const frise: SectionDates['frise'] = [];
    for (let m = Math.min(5, ...numeros); m <= Math.max(8, ...numeros); m++) {
      frise.push({ mois: m, court: libelleMois(m, MOIS_COURT), nombre: numeros.filter((n) => n === m).length });
    }

    const type = annee >= saison ? 'saison' : 'archives';
    return {
      annee,
      type,
      id: `${type}-${annee}`,
      titre: `${type === 'saison' ? 'Saison' : 'Archives'} ${annee}`,
      total: soirees.length,
      confirmees: soirees.filter((s) => s.statut === 'confirmee').length,
      previsionnelles: soirees.filter((s) => s.statut === 'previsionnelle').length,
      premiere: soirees[0] ?? null,
      derniere: soirees.at(-1) ?? null,
      ceSoir: lignes.filter((l) => l.etat === 'ce-soir'),
      mois,
      frise,
    };
  });
}

/**
 * Note sur les dates prévisionnelles d'une saison. La phrase suit le nombre de dates confirmées ;
 * null quand plus aucune date n'est prévisionnelle.
 */
export function noteProjections({ annee, confirmees, previsionnelles }: Pick<SectionDates, 'annee' | 'confirmees' | 'previsionnelles'>): string | null {
  if (previsionnelles === 0) return null;
  if (confirmees > previsionnelles) {
    return previsionnelles === 1
      ? `Une date ${annee} est encore prévisionnelle, à confirmer par son organisateur.`
      : `${previsionnelles} dates ${annee} sont encore prévisionnelles, à confirmer par chaque organisateur.`;
  }
  const debut = `Les dates ${annee} sont des projections, à confirmer par chaque organisateur.`;
  if (confirmees === 0) return `${debut} Aucune n’est encore confirmée.`;
  if (confirmees === 1) return `${debut} Une seule est déjà confirmée.`;
  return `${debut} ${confirmees} sont déjà confirmées.`;
}
