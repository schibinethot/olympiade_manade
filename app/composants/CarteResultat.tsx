import { domaine } from '../lib/accueil';
import { lireClassement } from '../lib/classements';
import type { Palmares } from '../lib/donnees';
import { PUCE_ALERTE, PUCE_OK } from './BadgeSoiree';
import { Fer } from './Fer';

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function dateResultat({ date_soiree, annee }: Pick<Palmares, 'date_soiree' | 'annee'>): string {
  if (!date_soiree) return String(annee);
  const [a, m, j] = date_soiree.split('-').map(Number);
  return DATE.format(new Date(Date.UTC(a, m - 1, j))).replace(/^1 /, '1er ');
}

type Props = {
  resultat: Palmares;
  /** Niveau du titre de la carte : 3 sous le titre du panneau, 4 dans une section de niveau 3. */
  niveau?: 3 | 4;
  /**
   * Carte à la une (première du panneau) : si le détail donne le classement complet, il s'affiche
   * en rangs, sur toute la largeur de la grille.
   */
  aLaUne?: boolean;
};

/**
 * Un résultat du palmarès (maquette : .palm-c) : fer, lieu et date, manade gagnante, soirée,
 * détail, statut et source. Rien n'est écrit en dur : tout vient de la ligne du palmarès.
 */
export function CarteResultat({ resultat, niveau = 3, aLaUne = false }: Props) {
  const Titre = niveau === 3 ? 'h3' : 'h4';
  const classement = aLaUne ? lireClassement(resultat.detail) : null;
  const source = resultat.source_url ? domaine(resultat.source_url) : null;
  const vainqueur = resultat.vainqueur.trim();

  return (
    <article
      className={`flex flex-col gap-3.5 rounded-[22px] border border-trait bg-creme p-[18px] ${
        classement ? 'col-span-full paysage:p-6' : ''
      }`}
    >
      <div className={`grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 ${classement ? 'items-center paysage:gap-x-6' : 'items-start'}`}>
        <Fer manade={vainqueur} className={classement ? 'paysage:size-[62px] paysage:text-[34px]' : 'mt-0.5'} />
        <div className="min-w-0">
          <p className="text-[10.5px] leading-[1.25] font-bold tracking-[0.2em] text-or-ink uppercase">
            {resultat.ville} · <time dateTime={resultat.date_soiree ?? String(resultat.annee)}>{dateResultat(resultat)}</time>
          </p>
          <Titre className={`mt-1 font-display leading-[1.2] font-bold ${classement ? 'text-[24px] paysage:text-[30px]' : 'text-[20px]'}`}>
            Manade {vainqueur}
          </Titre>
          <p className="mt-0.5 text-[13px] font-medium text-encre-2">{resultat.evenement}</p>
          {!classement && resultat.detail ? <p className="mt-1.5 text-[13.5px] text-encre-2">{resultat.detail}</p> : null}
        </div>
      </div>

      {classement ? (
        <>
          <ol aria-label={`Classement de la soirée de ${resultat.ville}`} className="grid gap-x-4 tablette:grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))]">
            {classement.rangs.map(({ rang, manade, precision }) => (
              <li
                key={`${rang}-${manade}`}
                className="grid grid-cols-[3rem_minmax(0,1fr)] items-baseline border-t border-trait py-2 tablette:block tablette:pt-2.5"
              >
                <span className={`font-display text-[26px] leading-none font-bold italic ${rang === 1 ? 'text-rouge' : 'text-encre'}`}>
                  {rang}
                  <sup className="text-[.45em]">{rang === 1 ? 'er' : 'e'}</sup>
                </span>
                <span className="text-[14.5px] leading-snug font-semibold tablette:mt-1.5 tablette:block">
                  {manade}
                  {precision ? <span className="block text-[12.5px] font-normal text-encre-2">{precision}</span> : null}
                </span>
              </li>
            ))}
          </ol>
          {classement.suite ? <p className="-mt-1 text-[13.5px] text-encre-2">{classement.suite}</p> : null}
        </>
      ) : null}

      {/* Statut et source en pied de carte : alignés d'une carte à l'autre sur une même rangée. */}
      <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-encre-2">
        {resultat.statut === 'a_confirmer' ? <span className={PUCE_ALERTE}>À confirmer</span> : <span className={PUCE_OK}>Confirmé</span>}
        {resultat.source_url ? (
          <span>
            Source&nbsp;:{' '}
            <a href={resultat.source_url} className="underline underline-offset-2 hover:text-encre">
              {source ?? 'article'}
            </a>
          </span>
        ) : null}
      </p>
    </article>
  );
}
