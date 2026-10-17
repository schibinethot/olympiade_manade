import { FICHES_MANADES, type FicheManade } from '../donnees/manades';
import { lireClassement } from './classements';
import type { Palmares } from './donnees';

/**
 * Clé d'identité d'une manade dans les contenus publics. Elle absorbe seulement les variantes
 * éditoriales attendues (casse, espaces, « Manade », Robert/Michel) : aucune recherche partielle
 * ne peut donc attribuer un résultat à une autre manade.
 */
export function identiteManade(nom: string): string {
  const nettoye = nom
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/^\s*manade\s+/i, '')
    .trim()
    .replace(/\s+/g, ' ');
  return nettoye === 'michel robert' ? 'robert michel' : nettoye;
}

export function ficheManade(nom: string, fiches: readonly FicheManade[] = FICHES_MANADES): FicheManade | undefined {
  const identite = identiteManade(nom);
  return fiches.find((fiche) => identiteManade(fiche.nom) === identite);
}

export function ficheManadeParSlug(slug: string, fiches: readonly FicheManade[] = FICHES_MANADES): FicheManade | undefined {
  return fiches.find((fiche) => fiche.slug === slug);
}

/** Adresse locale d'une fiche quand le nom correspond exactement à une manade documentée. */
export function lienFicheManade(nom: string, fiches: readonly FicheManade[] = FICHES_MANADES): string | null {
  const fiche = ficheManade(nom, fiches);
  return fiche ? `/manades/${fiche.slug}` : null;
}

function ordre(palmares: Palmares): string {
  return palmares.date_soiree ?? `${palmares.annee}-12-31`;
}

function contientNomEntier(texte: string, manade: string): boolean {
  const mots = identiteManade(manade).split(' ').map((mot) => mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const expression = new RegExp(`(?:^|[^\\p{L}\\p{N}])${mots.join('\\s+')}(?=$|[^\\p{L}\\p{N}])`, 'iu');
  const normalise = texte.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  if (expression.test(normalise)) return true;
  // L'alias historique inverse les deux mots ; les autres noms n'ont qu'une identité exacte.
  return identiteManade(manade) === 'robert michel'
    ? contientNomEntierSansAlias(normalise, 'michel robert')
    : false;
}

function contientNomEntierSansAlias(texte: string, nom: string): boolean {
  const mots = nom.split(' ').map((mot) => mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${mots.join('\\s+')}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(texte);
}

export type ResultatManade = {
  resultat: Palmares;
  /** Le résultat en base désigne explicitement cette manade comme vainqueur. */
  victoire: boolean;
  /** Rang lu uniquement dans la syntaxe de classement complet validée par `lireClassement`. */
  rang: number | null;
  /** Le détail cite la manade, sans lui attribuer de rang ou de victoire. */
  citation: boolean;
};

/**
 * Lignes du palmarès utiles à une fiche. Une mention textuelle reste une mention : elle ne devient
 * jamais une participation, un rang ou une victoire par déduction.
 */
export function resultatsManade(palmares: Palmares[], manade: string): ResultatManade[] {
  const identite = identiteManade(manade);
  return palmares
    .flatMap((resultat) => {
      const victoire = identiteManade(resultat.vainqueur) === identite;
      const rang = lireClassement(resultat.detail)?.rangs.find((ligne) => identiteManade(ligne.manade) === identite)?.rang ?? null;
      const citation = !!resultat.detail && contientNomEntier(resultat.detail, manade);
      return victoire || rang !== null || citation ? [{ resultat, victoire, rang, citation: citation && !victoire && rang === null }] : [];
    })
    .sort((a, b) => ordre(b.resultat).localeCompare(ordre(a.resultat)));
}

/** Compteur réservé aux victoires explicitement publiées et confirmées. */
export function victoiresConfirmees(palmares: Palmares[], manade: string): number {
  const identite = identiteManade(manade);
  return palmares.filter((resultat) => resultat.statut === 'confirme' && identiteManade(resultat.vainqueur) === identite).length;
}
