/**
 * Mode d'affichage du bandeau de consentement cookies selon la route.
 *
 * - `aucun`   : écran géant et pages des liens d'email – jamais de bandeau (ne gêne pas les
 *               téléspectateurs, ne retarde pas une désinscription)
 * - `bandeau` : barre basse non bloquante (tunnels, comptes, admin, pages légales)
 * - `fenetre` : boîte centrée + voile bloquant (accueil, classements, dates, contact, 404…)
 *
 * @see plan-consentement-cookies.md section « Front »
 */

export type ModeConsentement = 'fenetre' | 'bandeau' | 'aucun';

/**
 * Source unique du parcours cookies : chaque mode est décrit ici (libellé,
 * explication en langage simple, préfixes d'URL concernés et chemin exemple
 * pour les captures). `modeConsentement` et l'onglet d'aide de /admin/cookies
 * consomment la même constante : si une route change ici, les deux restent
 * cohérents.
 */
export const PARCOURS_COOKIES = [
  {
    mode: 'fenetre' as const,
    libelle: 'Fenêtre bloquante',
    accroche: 'Boîte au centre, voile sombre. Le visiteur doit choisir avant de parcourir le site.',
    exemple: '/',
    prefixes: [] as readonly string[], // tout ce qui n'est ni bandeau ni aucun
    noteRoutes:
      "L'accueil, les classements, les dates, la 404 et toute page vitrine qui n'est pas listée dans un autre mode.",
  },
  {
    mode: 'bandeau' as const,
    libelle: 'Barre basse',
    accroche: 'Bandeau discret en bas de page, le visiteur peut continuer à utiliser le site.',
    exemple: '/noter',
    prefixes: [
      '/noter',
      '/inscription',
      '/jury',
      '/compte',
      '/admin',
      '/confidentialite',
      '/mentions-legales',
    ] as const,
    noteRoutes:
      "Les parcours où bloquer le visiteur casserait l'expérience : noter en direct, s'inscrire, s'authentifier, consulter les mentions légales.",
  },
  {
    mode: 'aucun' as const,
    libelle: 'Aucun bandeau',
    accroche: "Rien ne s'affiche. L'écran géant projette les classements sans jamais superposer de pop-up.",
    exemple: '/ecran/nimes-2027',
    prefixes: ['/ecran', '/emails'] as const,
    noteRoutes:
      "L'écran géant du festival, et les pages ouvertes depuis un email (confirmation, désinscription, «\u00a0Je viens\u00a0»)\u00a0: elles ne déposent aucun traceur optionnel, le consentement n'a pas lieu d'être. Une désinscription n'est jamais retardée par une fenêtre de cookies.",
  },
] as const;

/** Préfixes extraits de PARCOURS_COOKIES (source unique de vérité). */
const PREFIXES_BANDEAU = PARCOURS_COOKIES.find((p) => p.mode === 'bandeau')!.prefixes;
const PREFIXES_AUCUN = PARCOURS_COOKIES.find((p) => p.mode === 'aucun')!.prefixes;

/**
 * Retourne le mode d'affichage du consentement pour un chemin donné.
 *
 * @param chemin - Chemin URL (pathname), éventuellement suivi d'une query string.
 */
export function modeConsentement(chemin: string): ModeConsentement {
  const sansSufixe = chemin.split('?')[0] ?? '/';

  // Écran géant et liens d'email : aucun bandeau
  if (
    PREFIXES_AUCUN.some(
      (prefixe) => sansSufixe === prefixe || sansSufixe.startsWith(`${prefixe}/`),
    )
  )
    return 'aucun';

  // Bandeau non bloquant
  if (
    PREFIXES_BANDEAU.some(
      (prefixe) => sansSufixe === prefixe || sansSufixe.startsWith(`${prefixe}/`),
    )
  )
    return 'bandeau';

  // Fenêtre bloquante (accueil, classements, dates, contact, 404…)
  return 'fenetre';
}
