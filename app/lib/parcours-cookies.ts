/**
 * Mode d'affichage du bandeau de consentement cookies selon la route.
 *
 * - `aucun`   : écran géant – jamais de bandeau (ne gêne pas les téléspectateurs)
 * - `bandeau` : barre basse non bloquante (tunnels, comptes, admin, pages légales)
 * - `fenetre` : boîte centrée + voile bloquant (accueil, classements, dates, contact, 404…)
 *
 * @see plan-consentement-cookies.md section « Front »
 */

export type ModeConsentement = 'fenetre' | 'bandeau' | 'aucun';

/** Chemins qui déclenchent un bandeau non bloquant (bas de page, page accessible). */
const PREFIXES_BANDEAU = [
  '/noter',
  '/inscription',
  '/jury',
  '/compte',
  '/admin',
  '/confidentialite',
  '/mentions-legales',
] as const;

/**
 * Retourne le mode d'affichage du consentement pour un chemin donné.
 *
 * @param chemin - Chemin URL (pathname), éventuellement suivi d'une query string.
 */
export function modeConsentement(chemin: string): ModeConsentement {
  const sansSufixe = chemin.split('?')[0] ?? '/';

  // Écran géant : aucun bandeau
  if (sansSufixe === '/ecran' || sansSufixe.startsWith('/ecran/')) return 'aucun';

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
