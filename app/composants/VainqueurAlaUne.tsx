import { Fragment } from 'react';
import { Link } from 'react-router';
import { domaine } from '../lib/accueil';
import { lireClassement } from '../lib/classements';
import { lienFicheManade } from '../lib/manades';
import type { Palmares } from '../lib/donnees';
import { Fer, initialeManade, marqueManade } from './Fer';

type Props = {
  /** Résultat le plus récent de l'année choisie : il porte le bloc à la une. */
  resultat: Palmares;
};

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function dateLongue({ date_soiree, annee }: Pick<Palmares, 'date_soiree' | 'annee'>): string {
  if (!date_soiree) return String(annee);
  const [a, m, j] = date_soiree.split('-').map(Number);
  return DATE.format(new Date(Date.UTC(a, m - 1, j))).replace(/^1 /, '1er ');
}

/** Pastille de statut lisible sur fond nuit : or-clair ou ambre, contraste élevé sur nuit. */
function PastilleNuit({ statut }: { statut: Palmares['statut'] }) {
  if (statut === 'a_confirmer') {
    return (
      <span className="inline-flex items-center rounded-full border border-ambre/40 bg-ambre/10 px-2.5 py-1 text-[10.5px] font-bold tracking-[0.14em] text-ambre uppercase">
        À confirmer
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-or-clair/35 bg-or-clair/10 px-2.5 py-1 text-[10.5px] font-bold tracking-[0.14em] text-or-clair uppercase">
      Confirmé
    </span>
  );
}

/**
 * Vainqueur à la une (bloc nuit, inspiré de « Dernier vainqueur connu » de l'accueil) : la soirée
 * la plus récente de l'année choisie. Surtitre unique ville · date (or-clair), titre « Manade X »
 * en or clair italique, nom de la soirée, fer en filigrane. Si le détail contient un classement
 * lisible, podium en frise pleine largeur sous le titre (5 colonnes sur bureau, lignes sur
 * téléphone), à l'image de la frise des victoires de l'accueil. Sinon, détail en texte.
 * Pied sur une ligne : suite du détail à gauche, statut et source à droite.
 */
export function VainqueurAlaUne({ resultat }: Props) {
  const vainqueur = resultat.vainqueur.trim();
  const marque = marqueManade(vainqueur);
  const lienVainqueur = lienFicheManade(vainqueur);
  const classement = lireClassement(resultat.detail);
  const sourceDomaine = resultat.source_url ? domaine(resultat.source_url) : null;

  return (
    <article
      aria-labelledby="titre-vainqueur-une"
      className="fond-champion relative isolate overflow-hidden rounded-[26px] px-6 py-7 text-nuit-txt tablette:p-9 paysage:px-12 paysage:py-11"
    >
      <div aria-hidden="true" className="grain absolute inset-0" />
      {marque ? (
        <img
          aria-hidden="true"
          src={marque}
          alt=""
          width={360}
          height={360}
          className="pointer-events-none absolute -top-16 -right-10 size-[320px] object-contain opacity-[.18] invert mix-blend-screen tablette:-top-20 tablette:size-[400px] paysage:-top-24 paysage:-right-16 paysage:size-[460px]"
        />
      ) : (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-14 -right-4 font-brush text-[240px] leading-none text-[rgba(226,192,138,.1)] tablette:text-[320px] paysage:text-[400px]"
        >
          {initialeManade(vainqueur)}
        </span>
      )}

      <header className="relative">
        <p className="block font-sans text-[10.5px] leading-[1.25] font-bold tracking-[0.2em] text-or-clair uppercase">
          {resultat.ville}{' '}
          <span aria-hidden="true" className="mx-1 text-or-ink/70">·</span>{' '}
          <time dateTime={resultat.date_soiree ?? String(resultat.annee)}>{dateLongue(resultat)}</time>
        </p>
        <h2
          id="titre-vainqueur-une"
          className="mt-2.5 font-display text-[40px] leading-[.98] font-bold tablette:text-[52px] paysage:text-[64px]"
        >
          Manade{' '}
          <em className="text-or-clair italic">
            {lienVainqueur ? (
              <Link to={lienVainqueur} className="hover:underline focus-visible:outline-offset-4">
                {vainqueur}
              </Link>
            ) : (
              vainqueur
            )}
          </em>
        </h2>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-nuit-mute">{resultat.evenement}</p>
      </header>

      {classement ? (
        <ol
          aria-label={`Classement de la soirée de ${resultat.ville}`}
          className="relative mt-7 grid gap-x-5 gap-y-4 paysage:mt-9 paysage:grid-cols-5"
        >
          {classement.rangs.map(({ rang, manade, precision }) => {
            const lien = lienFicheManade(manade);
            const premier = rang === 1;
            return (
              <li
                key={`${rang}-${manade}`}
                className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-start gap-x-3 border-t border-[rgba(226,192,138,.35)] pt-3 paysage:grid-cols-1 paysage:gap-y-2 paysage:pt-3.5"
              >
                <span
                  className={`font-display leading-none font-bold italic tabular-nums ${
                    premier
                      ? 'text-[36px] text-or-clair paysage:text-[44px]'
                      : 'text-[26px] text-nuit-txt/80 paysage:text-[30px]'
                  }`}
                >
                  {rang}
                  <sup className="text-[.42em]">{premier ? 'er' : 'e'}</sup>
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <Fer manade={manade} clair taille={premier ? 'normal' : 'petit'} />
                    <span
                      className={`min-w-0 truncate font-semibold ${
                        premier ? 'text-[17px] text-or-clair tablette:text-[18px]' : 'text-[14.5px] text-nuit-txt/95'
                      }`}
                    >
                      {lien ? (
                        <Link to={lien} className="hover:underline">
                          {manade}
                        </Link>
                      ) : (
                        manade
                      )}
                    </span>
                  </div>
                  {precision ? (
                    <span className="mt-1 block text-[12.5px] leading-snug text-nuit-mute">{precision}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : resultat.detail ? (
        <p className="relative mt-5 max-w-[62ch] text-[14.5px] leading-relaxed text-nuit-txt/90">{resultat.detail}</p>
      ) : null}

      <footer className="relative mt-7 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 paysage:mt-9 paysage:items-center">
        <p className="min-w-0 max-w-[62ch] text-[13px] leading-relaxed text-nuit-mute">
          {classement?.suite ?? ''}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-nuit-mute paysage:justify-end">
          <PastilleNuit statut={resultat.statut} />
          {resultat.source_url ? (
            <Fragment>
              <span className="opacity-60" aria-hidden="true">
                ·
              </span>
              <span>
                Source&nbsp;:{' '}
                <a
                  href={resultat.source_url}
                  className="underline underline-offset-2 hover:text-nuit-txt"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {sourceDomaine ?? 'article'}
                </a>
              </span>
            </Fragment>
          ) : null}
        </div>
      </footer>
    </article>
  );
}
