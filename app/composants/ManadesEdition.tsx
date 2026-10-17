import { EDITION_MANADES } from '../donnees/affiche';
import { Link } from 'react-router';
import { lienFicheManade } from '../lib/manades';
import { Fer } from './Fer';

/**
 * « Les manades de l’édition 2026 » (maquette : .engagees, « Les manades engagées ce soir »),
 * avec leurs marques locales ou l'initiale en repli. Sur téléphone, les cinq noms tiennent sur
 * une ligne de cinq colonnes au lieu de défiler à l'horizontale.
 */
export function ManadesEdition() {
  return (
    <section aria-labelledby="titre-manades" className="px-4 pt-[30px] pb-1 text-center paysage:pt-11">
      <h2
        id="titre-manades"
        className="text-[10.5px] leading-[1.25] font-bold tracking-[0.2em] text-or-ink uppercase"
      >
        Les manades de l’édition {EDITION_MANADES.annee}
      </h2>
      <ul className="mt-4 grid grid-cols-5 gap-1 tablette:flex tablette:justify-center tablette:gap-0">
        {EDITION_MANADES.manades.map((manade) => {
          const lien = lienFicheManade(manade);
          const contenu = <><Fer manade={manade} /><span className="text-balance break-words">{manade}</span></>;
          return (
          <li
            key={manade}
            className="flex min-w-0 flex-col items-center gap-[9px] text-[10px] leading-[1.15] font-extrabold tracking-[.02em] text-encre uppercase min-[360px]:text-[11px] min-[360px]:tracking-[.1em] tablette:border-l tablette:border-trait tablette:px-5 tablette:first:border-l-0 paysage:px-[34px] paysage:text-[12.5px]"
          >
            {lien ? <Link to={lien} className="flex min-h-20 flex-col items-center gap-[9px] rounded-lg hover:text-rouge focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-encre">{contenu}</Link> : contenu}
          </li>
          );
        })}
      </ul>
      <Link to="/manades" className="mt-4 inline-flex min-h-12 items-center text-[13px] font-semibold text-rouge hover:underline">
        Découvrir les manades
      </Link>
    </section>
  );
}
