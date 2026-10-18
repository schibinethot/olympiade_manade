import { Link } from 'react-router';
import type { VictoiresManade } from '../lib/classements';
import { lienFicheManade } from '../lib/manades';
import { Fer } from './Fer';

type Props = {
  annee: number;
  victoires: VictoiresManade[];
};

/**
 * Rangée des manades victorieuses de l'année, dans l'esprit de « Les manades de l'édition » de
 * l'accueil : fer, nom, nombre de soirées gagnées en Playfair italique. Les résultats « à
 * confirmer » n'y entrent pas, pour éviter d'afficher un chiffre qui bougerait.
 */
export function SoireesGagnees({ annee, victoires }: Props) {
  return (
    <section aria-labelledby="titre-victoires" className="text-center">
      <h2
        id="titre-victoires"
        className="text-[10.5px] leading-[1.25] font-bold tracking-[0.2em] text-or-ink uppercase"
      >
        Soirées gagnées en {annee}
      </h2>
      <ul className="mx-auto mt-5 flex max-w-[62rem] flex-wrap justify-center gap-x-6 gap-y-6 tablette:gap-x-9 paysage:gap-x-12">
        {victoires.map(({ nom, victoires: nombre }) => {
          const lien = lienFicheManade(nom);
          const chiffre = (
            <span className="font-display text-[40px] leading-none font-bold italic text-rouge tablette:text-[44px]">
              {nombre}
            </span>
          );
          const contenu = (
            <>
              <Fer manade={nom} />
              <span className="mt-1 block text-[11px] leading-[1.2] font-extrabold tracking-[0.14em] text-encre uppercase tablette:text-[12px]">
                {nom}
              </span>
              <span className="mt-2.5 inline-flex items-baseline gap-1.5">
                {chiffre}
                <span className="text-[11.5px] font-medium text-encre-2 lowercase">
                  {nombre > 1 ? 'soirées' : 'soirée'}
                </span>
              </span>
            </>
          );
          return (
            <li key={nom} className="flex min-w-[6.5rem] flex-col items-center">
              {lien ? (
                <Link
                  to={lien}
                  className="flex min-h-20 flex-col items-center rounded-lg hover:text-rouge focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-encre"
                >
                  {contenu}
                </Link>
              ) : (
                contenu
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
