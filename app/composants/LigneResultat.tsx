import { Link } from 'react-router';
import { domaine } from '../lib/accueil';
import { lienFicheManade } from '../lib/manades';
import type { Palmares } from '../lib/donnees';
import { PUCE_ALERTE, PUCE_OK } from './BadgeSoiree';
import { Fer } from './Fer';

type Props = {
  resultat: Palmares;
  /** Niveau du titre de la ligne (h3 par défaut, dans un panneau de niveau 2). */
  niveau?: 3 | 4;
};

const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });
const DATE_LONGUE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function partsDate({ date_soiree, annee }: Pick<Palmares, 'date_soiree' | 'annee'>) {
  if (!date_soiree) return { jour: null, mois: null, iso: String(annee), long: String(annee) };
  const [a, m, j] = date_soiree.split('-').map(Number);
  const utc = new Date(Date.UTC(a, m - 1, j));
  return {
    jour: j,
    mois: MOIS.format(utc).replace('.', ''),
    iso: date_soiree,
    long: DATE_LONGUE.format(utc).replace(/^1 /, '1er '),
  };
}

/**
 * Une soirée du palmarès affichée en ligne (date | contenu | statut sur bureau, empilée sur
 * téléphone), à l'image des lignes de la carte « Saison » de l'accueil. Reste un <article>
 * autonome avec ville et vainqueur dans son texte, pour les tests E2E et les lecteurs d'écran.
 */
export function LigneResultat({ resultat, niveau = 3 }: Props) {
  const Titre = niveau === 3 ? 'h3' : 'h4';
  const vainqueur = resultat.vainqueur.trim();
  const lienVainqueur = lienFicheManade(vainqueur);
  const source = resultat.source_url ? domaine(resultat.source_url) : null;
  const date = partsDate(resultat);

  return (
    <article
      aria-label={`Soirée de ${resultat.ville}, vainqueur manade ${vainqueur}`}
      className="group grid grid-cols-[64px_minmax(0,1fr)] items-start gap-x-4 gap-y-2 border-t border-trait py-5 first:border-t-0 first:pt-1 paysage:grid-cols-[72px_minmax(0,1fr)_auto] paysage:items-center paysage:gap-x-6 paysage:py-6"
    >
      <time
        dateTime={date.iso}
        aria-label={date.long}
        className="row-span-2 flex flex-col items-center text-center font-display paysage:row-span-1"
      >
        {date.jour !== null ? (
          <>
            <span className="text-[30px] leading-none font-bold italic">{date.jour}</span>
            <span className="mt-1 font-sans text-[9.5px] leading-[1.3] font-bold tracking-[0.14em] text-encre-2 uppercase not-italic">
              {date.mois}
            </span>
          </>
        ) : (
          <span className="text-[20px] leading-none font-bold italic">{resultat.annee}</span>
        )}
      </time>

      <div className="min-w-0">
        <p className="text-[10.5px] leading-[1.25] font-bold tracking-[0.18em] text-or-ink uppercase">{resultat.ville}</p>
        <Titre className="mt-1 flex min-w-0 items-center gap-2.5 font-display text-[20px] leading-[1.2] font-bold tablette:text-[22px]">
          <Fer manade={vainqueur} taille="petit" />
          <span className="min-w-0">
            Manade{' '}
            {lienVainqueur ? (
              <Link to={lienVainqueur} className="hover:text-rouge hover:underline">
                {vainqueur}
              </Link>
            ) : (
              vainqueur
            )}
          </span>
        </Titre>
        <p className="mt-1 text-[13.5px] font-medium text-encre-2">{resultat.evenement}</p>
        {resultat.detail ? (
          <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-relaxed text-encre-2">{resultat.detail}</p>
        ) : null}
      </div>

      <div className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-encre-2 paysage:col-start-3 paysage:flex-col paysage:items-end paysage:gap-y-1.5 paysage:self-center paysage:text-right">
        {resultat.statut === 'a_confirmer' ? <span className={PUCE_ALERTE}>À confirmer</span> : <span className={PUCE_OK}>Confirmé</span>}
        {resultat.source_url ? (
          <span className="paysage:text-[11.5px]">
            Source&nbsp;:{' '}
            <a
              href={resultat.source_url}
              className="underline underline-offset-2 hover:text-encre"
              target="_blank"
              rel="noopener noreferrer"
            >
              {source ?? 'article'}
            </a>
          </span>
        ) : null}
      </div>
    </article>
  );
}
