import { Link } from 'react-router';
import { Fer } from '../composants/Fer';
import { TitrePage } from '../composants/TitrePage';
import { FICHES_MANADES } from '../donnees/manades';

export const meta = () => [
  { title: 'Les manades · Olympiade des Manades' },
  { name: 'description', content: 'Découvrez les manades de l’édition 2026 : leurs élevages, leurs activités et leurs résultats publiés.' },
  { tagName: 'link', rel: 'canonical', href: 'https://olympiadedesmanades.fr/manades' },
];

/** Annuaire des manades documentées de l’édition, également accessible sans JavaScript. */
export default function Manades() {
  return (
    <>
      <TitrePage surtitre="Édition 2026" titre={<>Les <em>manades</em></>}>
        <p>Leurs histoires, leurs activités et les résultats publiés lors des Olympiades.</p>
      </TitrePage>
      <section aria-label="Fiches des manades" className="grid gap-3 px-4 pt-5 tablette:grid-cols-2 tablette:px-7 paysage:grid-cols-3 paysage:px-10 bureau:px-14">
        {FICHES_MANADES.map((fiche) => (
          <Link
            key={fiche.slug}
            to={`/manades/${fiche.slug}`}
            className="group grid min-h-52 content-between rounded-[22px] border border-trait bg-creme p-5 transition-colors hover:bg-lin focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-encre"
          >
            <Fer manade={fiche.nom} className="size-[72px] text-[38px] transition-transform group-hover:scale-105" />
            <div>
              <p className="text-[10.5px] font-bold tracking-[.2em] text-or-ink uppercase group-hover:text-encre-2">{fiche.localisation}</p>
              <h2 className="mt-1 font-display text-[27px] leading-[1.08] font-bold">Manade {fiche.nom}</h2>
              <p className="mt-2 text-[13.5px] text-encre-2">{fiche.accroche}</p>
              <span className="mt-3 inline-flex min-h-8 items-center text-[13px] font-semibold text-rouge group-hover:text-encre group-hover:underline">Voir la fiche</span>
            </div>
          </Link>
        ))}
      </section>
    </>
  );
}
