import { useRef, type KeyboardEvent } from 'react';

/** Pastille des onglets de la maquette (.tabs button) : 40 px de haut dans une cible de 48 px. */
export const CLASSE_ONGLET =
  'inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition-colors';
export const ONGLET_ACTIF = 'bg-encre text-sable';
export const ONGLET_INACTIF = 'text-encre-2 shadow-[inset_0_0_0_1px_var(--color-trait)] group-hover:bg-lin';

type Props = {
  annees: number[];
  choisie: number;
  onChoisir: (annee: number) => void;
  /** id du panneau que les onglets commandent. */
  panneau: string;
  libelle: string;
};

export const idOnglet = (annee: number) => `onglet-${annee}`;

/**
 * Onglets d'années (motif « Tabs » de l'APG ARIA, activation automatique) : flèches gauche et
 * droite, Début et Fin. Seul l'onglet choisi est dans l'ordre de tabulation.
 */
export function OngletsAnnee({ annees, choisie, onChoisir, panneau, libelle }: Props) {
  const boutons = useRef(new Map<number, HTMLButtonElement>());

  function auClavier(evenement: KeyboardEvent<HTMLButtonElement>, rang: number) {
    const cible = {
      ArrowRight: annees[(rang + 1) % annees.length],
      ArrowLeft: annees[(rang - 1 + annees.length) % annees.length],
      Home: annees[0],
      End: annees.at(-1),
    }[evenement.key];
    if (cible === undefined) return;
    evenement.preventDefault();
    onChoisir(cible);
    boutons.current.get(cible)?.focus();
  }

  return (
    <div role="tablist" aria-label={libelle} className="mt-3.5 flex flex-wrap gap-x-1.5">
      {annees.map((annee, rang) => {
        const actif = annee === choisie;
        return (
          <button
            key={annee}
            ref={(bouton) => {
              if (bouton) boutons.current.set(annee, bouton);
              else boutons.current.delete(annee);
            }}
            type="button"
            role="tab"
            id={idOnglet(annee)}
            aria-selected={actif}
            aria-controls={actif ? panneau : undefined}
            tabIndex={actif ? 0 : -1}
            onClick={() => onChoisir(annee)}
            onKeyDown={(evenement) => auClavier(evenement, rang)}
            className="group inline-flex min-h-12 cursor-pointer items-center rounded-full"
          >
            <span className={`${CLASSE_ONGLET} ${actif ? ONGLET_ACTIF : ONGLET_INACTIF}`}>{annee}</span>
          </button>
        );
      })}
    </div>
  );
}
