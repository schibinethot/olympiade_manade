// Logique de la page Classements, sans React : années à onglets, tri du palmarès, lecture d'un
// classement complet écrit dans le détail d'un résultat, décompte des soirées gagnées.
import type { Calendrier, Palmares } from './donnees';

/**
 * Clé d'identité du vainqueur pour regrouper les victoires d'une même manade : casse, accents,
 * espaces et préfixe « Manade » gommés. Reprend la même règle que `identiteManade` dans manades.ts,
 * dupliquée ici pour éviter une boucle d'imports avec ce module (qui lit lui-même `lireClassement`).
 */
function cleManade(nom: string): string {
  const nettoye = nom
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr-FR')
    .replace(/^\s*manade\s+/i, '')
    .trim()
    .replace(/\s+/g, ' ');
  return nettoye === 'michel robert' ? 'robert michel' : nettoye;
}

export type AnneesClassements = {
  /** Années à onglets, de la plus récente à la plus ancienne. */
  onglets: number[];
  /** Onglet ouvert sans année dans l'adresse : la plus récente année qui a des résultats. */
  parDefaut: number | null;
  /** Années plus anciennes du palmarès, dans la section repliée « Éditions précédentes ». */
  precedentes: number[];
};

/**
 * Les `nombre` années les plus récentes du palmarès et du calendrier ont un onglet (2025, 2026,
 * 2027 aujourd'hui) ; les années plus anciennes du palmarès vont aux éditions précédentes.
 */
export function anneesClassements(palmares: Palmares[] | null, calendrier: Calendrier[] | null, nombre = 3): AnneesClassements {
  const annees = [...new Set([...(palmares ?? []).map((p) => p.annee), ...(calendrier ?? []).map((s) => s.annee)])].sort((a, b) => b - a);
  const onglets = annees.slice(0, nombre);
  const avecResultats = onglets.find((a) => palmares?.some((p) => p.annee === a));
  return {
    onglets,
    parDefaut: avecResultats ?? onglets[0] ?? null,
    precedentes: annees.slice(nombre).filter((a) => palmares?.some((p) => p.annee === a)),
  };
}

/** Année de l'adresse (`?annee=2025`) si elle a un onglet, sinon l'année par défaut. */
export function anneeChoisie(parametre: string | null, { onglets, parDefaut }: AnneesClassements): number | null {
  const annee = Number(parametre);
  return parametre && onglets.includes(annee) ? annee : parDefaut;
}

/** Une soirée sans date est rangée en fin d'année, donc en tête du tri décroissant. */
const ordreResultat = (p: Palmares) => p.date_soiree ?? `${p.annee}-12-31`;

/** Résultats d'une année, du plus récent au plus ancien. */
export function resultatsAnnee(palmares: Palmares[], annee: number): Palmares[] {
  return palmares.filter((p) => p.annee === annee).sort((a, b) => ordreResultat(b).localeCompare(ordreResultat(a)));
}

export type ClassementLu = {
  rangs: { rang: number; manade: string; precision: string | null }[];
  /** Reste du détail après le classement (« Saut de cheval à taureau : … »). */
  suite: string | null;
};

const RANG = /^\s*(\d+)\.\s+([^,.()]+?)\s*(?:\(([^)]*)\))?\s*([,.]|$)/;

/**
 * Lit un classement complet écrit dans le détail d'un résultat :
 * « Classement : 1. Arlatenco, 2. Vinuesa (à quelques points), 3. Robert Michel. Suite… ».
 * Renvoie null si le texte n'a pas cette forme : il s'affiche alors tel quel.
 */
export function lireClassement(detail: string | null): ClassementLu | null {
  const debut = detail ? /^\s*Classement\s*:\s*/i.exec(detail) : null;
  if (!detail || !debut) return null;
  let reste = detail.slice(debut[0].length);
  const rangs: ClassementLu['rangs'] = [];
  for (;;) {
    const m = RANG.exec(reste);
    if (!m) break;
    rangs.push({ rang: Number(m[1]), manade: m[2].trim(), precision: m[3]?.trim() || null });
    reste = reste.slice(m[0].length);
    if (m[4] !== ',') break;
  }
  if (rangs.length < 2 || rangs[0].rang !== 1) return null;
  return { rangs, suite: reste.trim() || null };
}

export type VictoiresManade = {
  /** Nom affiché de la manade, repris de la ligne de palmarès la plus récente. */
  nom: string;
  /** Soirées gagnées, uniquement les résultats dont le statut est « confirme ». */
  victoires: number;
};

/**
 * Soirées gagnées par manade pour une année, résultats confirmés uniquement. Triées par nombre
 * de victoires décroissant, puis par nom. Variantes d'écriture d'un même nom regroupées
 * (« Manade Arlatenco » et « Arlatenco », « Michel Robert » et « Robert Michel »).
 */
export function soireesGagneesParManade(palmares: Palmares[], annee: number): VictoiresManade[] {
  const groupes = new Map<string, { nom: string; victoires: number; date: string }>();
  for (const p of palmares) {
    if (p.annee !== annee || p.statut !== 'confirme') continue;
    const cle = cleManade(p.vainqueur);
    // Un vainqueur vide ne compte pour aucune manade.
    if (!cle) continue;
    const existant = groupes.get(cle);
    const dateReference = p.date_soiree ?? `${p.annee}-00-00`;
    if (!existant) {
      groupes.set(cle, { nom: p.vainqueur.trim(), victoires: 1, date: dateReference });
    } else {
      existant.victoires += 1;
      // Le nom affiché retient l'écriture de la ligne la plus récente, pour l'esthétique.
      if (dateReference > existant.date) {
        existant.nom = p.vainqueur.trim();
        existant.date = dateReference;
      }
    }
  }
  return [...groupes.values()]
    .map(({ nom, victoires }) => ({ nom, victoires }))
    .sort((a, b) => b.victoires - a.victoires || a.nom.localeCompare(b.nom, 'fr-FR'));
}

/** Nombre de résultats confirmés d'une année, pour décider de masquer la rangée des victoires. */
export function nombreResultatsConfirmes(palmares: Palmares[], annee: number): number {
  return palmares.filter((p) => p.annee === annee && p.statut === 'confirme').length;
}
