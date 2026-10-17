type Props = {
  /** Nom de la manade : le fer connu est affiché, sinon son initiale. */
  manade: string;
  taille?: 'normal' | 'petit';
  /** Sur fond sombre ou coloré : trait et initiale en blanc. */
  clair?: boolean;
  className?: string;
};

const MARQUES_MANADES = {
  vinuesa: '/marques/manades/vinuesa.jpg',
  gillet: '/marques/manades/gillet.jpg',
  'robert michel': '/marques/manades/robert-michel.jpg',
  lafon: '/marques/manades/lafon.jpg',
  arlatenco: '/marques/manades/arlatenco.jpg',
} as const;

/** Chemin local de la vraie marque, quand elle est connue. */
export function marqueManade(manade: string): string | undefined {
  const nom = manade.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr-FR').replace(/^manade\s+/, '');
  const cle = nom === 'michel robert' ? 'robert michel' : nom;
  return Object.hasOwn(MARQUES_MANADES, cle)
    ? MARQUES_MANADES[cle as keyof typeof MARQUES_MANADES]
    : undefined;
}

/** Fer décoratif : la marque locale connue remplace l'initiale, sinon le repli reste la maquette. */
export function Fer({ manade, taille = 'normal', clair = false, className = '' }: Props) {
  const marque = marqueManade(manade);
  const initiale = initialeManade(manade);
  return (
    <span
      aria-hidden="true"
      className={`inline-grid flex-none place-items-center leading-none ${
        taille === 'petit' ? 'size-8 text-[17px]' : 'size-11 text-[24px]'
      } ${
        marque
          ? `overflow-hidden ${clair ? 'mix-blend-screen' : 'mix-blend-multiply'}`
          : `rounded-full pt-[3px] pr-0.5 font-brush shadow-[inset_0_0_0_1.5px_currentColor] ${clair ? 'text-white' : 'text-or-ink'}`
      } ${className}`}
    >
      {marque ? (
        <img
          src={marque}
          alt=""
          width={237}
          height={237}
          className={`size-full object-contain ${clair ? 'invert' : ''}`}
        />
      ) : (
        initiale
      )}
    </span>
  );
}

/** Initiale du fer : celle du dernier mot (« Robert Michel » → M, comme sur la maquette). */
export function initialeManade(manade: string): string {
  const mots = manade.trim().split(/\s+/);
  return (mots.at(-1) ?? manade).charAt(0).toLocaleUpperCase('fr-FR');
}
