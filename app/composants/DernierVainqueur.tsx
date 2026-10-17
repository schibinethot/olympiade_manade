import { Fragment } from 'react';
import { Link } from 'react-router';
import { dernierVainqueur } from '../lib/accueil';
import { lienFicheManade } from '../lib/manades';
import type { Palmares } from '../lib/donnees';
import { initialeManade, marqueManade } from './Fer';
import { Icone } from './Icone';

type Props = {
  /** Palmarès lu en base, ou null s'il n'a pas pu être lu : message de repli. */
  palmares: Palmares[] | null;
};

const SURTITRE = 'block font-sans text-[10.5px] leading-[1.25] font-bold tracking-[0.2em] text-or-clair uppercase';

/**
 * « Dernier vainqueur connu » (maquette : .champion). Tout vient du palmarès : la ligne confirmée
 * la plus récente, la frise des victoires confirmées de la manade et leurs sources.
 */
export function DernierVainqueur({ palmares }: Props) {
  const v = palmares ? dernierVainqueur(palmares) : null;
  const marque = v ? marqueManade(v.vainqueur) : undefined;
  const lienVainqueur = v ? lienFicheManade(v.vainqueur) : null;

  return (
    <section
      aria-labelledby="titre-vainqueur"
      className="fond-champion relative isolate mx-4 mt-9 grid gap-[22px] overflow-hidden rounded-[26px] px-[22px] py-[26px] text-nuit-txt tablette:mx-7 tablette:mt-11 tablette:grid-cols-[1.4fr_1fr] tablette:items-end tablette:p-[34px] paysage:mx-10 paysage:mt-14 paysage:px-12 paysage:py-11 bureau:mx-14"
    >
      <div aria-hidden="true" className="grain absolute inset-0" />
      {v ? (
        marque ? (
          <img
            aria-hidden="true"
            src={marque}
            alt=""
            width={320}
            height={320}
            className="pointer-events-none absolute -top-10 -right-2.5 size-[320px] object-contain opacity-[.12] invert mix-blend-screen"
          />
        ) : (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-10 -right-2.5 font-brush text-[280px] leading-none text-[rgba(226,192,138,.07)]"
          >
            {initialeManade(v.vainqueur)}
          </span>
        )
      ) : null}

      <div className="relative">
        <h2 id="titre-vainqueur">
          <span className={SURTITRE}>Dernier vainqueur connu</span>{' '}
          {v ? (
            <span className="mt-2.5 mb-3 block font-display text-[42px] leading-[.98] font-bold paysage:text-[60px]">
              Manade <em className="text-or-clair italic">{lienVainqueur ? <Link to={lienVainqueur} className="hover:underline">{v.vainqueur}</Link> : v.vainqueur}</em>
            </span>
          ) : null}
        </h2>
        <p className="mt-2 max-w-[44ch] text-nuit-mute">
          {!palmares
            ? 'Informations momentanément indisponibles'
            : !v
              ? 'Aucun résultat confirmé pour l’instant.'
              : `Vainqueur à ${v.resultat.ville} en ${v.resultat.annee}.${v.resultat.detail ? ` ${v.resultat.detail}` : ''}`}
        </p>
      </div>

      {v ? (
        <div className="relative grid gap-3.5">
          <ul aria-label={`Victoires confirmées de la manade ${v.vainqueur}`} className="flex flex-wrap gap-3">
            {v.victoires.map((victoire) => (
              <li
                key={`${victoire.annee}-${victoire.ville}`}
                className="max-w-[50%] min-w-[76px] flex-1 border-t border-[rgba(226,192,138,.35)] pt-2.5 text-[10px] leading-[1.3] font-bold tracking-[0.14em] text-nuit-mute uppercase"
              >
                <span className="block font-display text-[28px] leading-[1.1] font-semibold tracking-normal text-or-clair normal-case italic">
                  {victoire.annee}
                </span>{' '}
                {victoire.ville}
              </li>
            ))}
          </ul>
          {v.sources.length ? (
            <p className="text-[11px] text-nuit-mute">
              {v.sources.length > 1 ? 'Sources' : 'Source'}&nbsp;:{' '}
              {v.sources.map((source, i) => (
                <Fragment key={source.domaine}>
                  {i > 0 ? ', ' : ''}
                  <a href={source.url} className="underline underline-offset-2 hover:text-nuit-txt">
                    {source.domaine}
                  </a>
                </Fragment>
              ))}
            </p>
          ) : null}
          <Link
            to="/classements"
            className="inline-flex min-h-12 items-center gap-1.5 justify-self-start text-[13.5px] font-semibold text-or-clair hover:underline"
          >
            Tout le palmarès
            <Icone nom="fleche" className="size-[15px]" />
          </Link>
        </div>
      ) : null}
    </section>
  );
}
