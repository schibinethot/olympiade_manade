type Props = {
  /** Fond sur lequel le logo est posé : sable (en-tête) ou nuit (pied de page). */
  fond?: 'clair' | 'sombre';
};

/**
 * Logo de la charte (section 5) : « Olympiade » au pinceau en dégradé couchant,
 * puis « DES MANADES » en capitales Inter espacées, couleur or.
 * Décoratif : le lien qui l'entoure porte le nom accessible.
 */
export function Logo({ fond = 'clair' }: Props) {
  const sombre = fond === 'sombre';
  return (
    <span aria-hidden="true" className="inline-flex flex-col leading-none">
      <span
        className={`bg-clip-text pr-[0.08em] font-brush text-[27px] leading-[1.05] text-transparent ${
          sombre ? 'bg-[image:var(--couchant-nuit)]' : 'bg-couchant-logo'
        }`}
      >
        Olympiade
      </span>
      <span
        className={`mt-px pl-0.5 text-[8.5px] font-bold uppercase tracking-[0.32em] ${
          sombre ? 'text-or-clair' : 'text-or-ink'
        }`}
      >
        des Manades
      </span>
    </span>
  );
}
