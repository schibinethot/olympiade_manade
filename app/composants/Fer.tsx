type Props = {
  /** Nom de la manade : le fer porte son initiale. */
  manade: string;
  taille?: 'normal' | 'petit';
  /** Sur fond sombre ou coloré : trait et initiale en blanc. */
  clair?: boolean;
  className?: string;
};

/**
 * Fer de manade provisoire (charte, section 5) : cercle fin et initiale au pinceau. Les vrais fers
 * ne s'affichent qu'avec l'accord de chaque manade. Décoratif : le nom est écrit à côté.
 */
export function Fer({ manade, taille = 'normal', clair = false, className = '' }: Props) {
  const initiale = initialeManade(manade);
  return (
    <span
      aria-hidden="true"
      className={`inline-grid flex-none place-items-center rounded-full pt-[3px] pr-0.5 font-brush leading-none shadow-[inset_0_0_0_1.5px_currentColor] ${
        taille === 'petit' ? 'size-8 text-[17px]' : 'size-11 text-[24px]'
      } ${clair ? 'text-white' : 'text-or-ink'} ${className}`}
    >
      {initiale}
    </span>
  );
}

/** Initiale du fer : celle du dernier mot (« Robert Michel » → M, comme sur la maquette). */
export function initialeManade(manade: string): string {
  const mots = manade.trim().split(/\s+/);
  return (mots.at(-1) ?? manade).charAt(0).toLocaleUpperCase('fr-FR');
}
