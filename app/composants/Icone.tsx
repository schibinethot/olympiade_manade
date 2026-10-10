// Icônes au trait de la maquette (objet ICO de docs/maquette/src.html), toujours décoratives :
// le texte voisin porte le sens.
const TRACES = {
  fleche: <path d="M5 12h14M13 6l6 6-6 6" />,
  cadenas: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  horloge: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  calendrier: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  valide: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  alerte: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  externe: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
} as const;

type Props = {
  nom: keyof typeof TRACES;
  /** Classes de taille et de couleur ; 18 px par défaut. */
  className?: string;
};

export function Icone({ nom, className = 'size-[18px]' }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={`flex-none fill-none stroke-current stroke-[1.8] [stroke-linecap:round] [stroke-linejoin:round] ${className}`}
    >
      {TRACES[nom]}
    </svg>
  );
}
