import { Link } from 'react-router';
import { EPREUVES } from '../donnees/epreuves';
import { PHOTOS_EPREUVES, type PhotoEpreuve } from '../donnees/photos-epreuves';
import { useProche } from '../lib/useProche';
import { Icone } from './Icone';

const LIEN = 'underline underline-offset-2 hover:text-encre';

/** Photo originale d'une carte, maintenue entière ; les traitements duotone et gris sont appliqués en CSS. */
function PhotoCarte({ photo }: { photo: PhotoEpreuve }) {
  return (
    <img src={photo.fichier} alt={photo.alt} width={photo.largeur} height={photo.hauteur} decoding="async" className="size-full object-contain" />
  );
}

/**
 * « Le programme · Les quatre épreuves » (maquette : .sec + .ep-grid). Sur téléphone, les cartes
 * défilent à l'horizontale ; à partir de l'iPad portrait, grille de 2 puis de 4 colonnes.
 * Hors soirée, pas d'horaire ni d'état d'épreuve : le pied de carte donne le format.
 *
 * Photos chargées quand la liste arrive à 400 px de l'écran (useProche), toutes les quatre à la fois :
 * sur téléphone, elles ne pèsent plus sur le premier affichage, et les cartes qu'on fait défiler à
 * l'horizontale sont déjà prêtes. Sans JavaScript, le <noscript> les affiche directement.
 */
export function Epreuves() {
  const [liste, photosProches] = useProche<HTMLUListElement>();
  return (
    <section aria-labelledby="titre-epreuves" className="px-4 pt-9 pb-1 tablette:px-7 tablette:pt-11 paysage:px-10 paysage:pt-14 bureau:px-14">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-[10.5px] leading-[1.25] font-bold tracking-[0.2em] text-or-ink uppercase">Le programme</p>
          <h2
            id="titre-epreuves"
            className="mt-1.5 font-display text-[28px] leading-[1.08] font-bold tracking-[-0.01em] tablette:text-[34px] paysage:text-[40px]"
          >
            Les quatre épreuves
          </h2>
        </div>
        <Link to="/classements" className="inline-flex min-h-12 items-center gap-1.5 text-[13.5px] font-semibold text-rouge hover:underline">
          Voir le classement
          <Icone nom="fleche" className="size-[15px]" />
        </Link>
      </div>

      {/* Région défilante sur téléphone : focalisable pour le défilement au clavier. Positionnée, pour
          que le texte réservé aux lecteurs d'écran (sr-only, en absolu) reste rogné par le défilement
          au lieu d'élargir la page. */}
      <ul
        ref={liste}
        tabIndex={0}
        aria-label="Les quatre épreuves"
        className="relative -mx-4 grid snap-x snap-mandatory scroll-px-4 auto-cols-[80%] grid-flow-col gap-3 overflow-x-auto rounded-[22px] px-4 pb-1 [scrollbar-width:none] tablette:mx-0 tablette:grid-flow-row tablette:grid-cols-2 tablette:overflow-visible tablette:px-0 paysage:grid-cols-4 paysage:gap-4 [&::-webkit-scrollbar]:hidden"
      >
        {EPREUVES.map((epreuve) => {
          const photo = PHOTOS_EPREUVES[epreuve.photo];
          return (
            <li
              key={epreuve.numero}
              className="relative flex snap-start flex-col overflow-hidden rounded-[22px] border border-trait bg-creme"
            >
              <div className="duo-calques duo-calques--epreuve aspect-[16/11] overflow-hidden">
                {photosProches ? (
                  <PhotoCarte photo={photo} />
                ) : (
                  <noscript>
                    <img src={photo.fichier} alt={photo.alt} width={photo.largeur} height={photo.hauteur} className="size-full object-contain" />
                  </noscript>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 px-4 pt-3.5 pb-4">
                <h3 className="flex items-baseline gap-2 font-display text-[19px] leading-[1.15] font-bold">
                  <span aria-hidden="true" className="text-[24px] leading-none text-or-ink italic">{epreuve.numero}</span>
                  <span className="sr-only">Épreuve {epreuve.numero}&nbsp;: </span>
                  {epreuve.nom}
                </h3>
                <p className="text-[13.5px] leading-[1.45] text-encre-2">{epreuve.description}</p>
                <p className="text-[11px] leading-snug text-encre-2">
                  Photo&nbsp;:{' '}
                  <a href={photo.fiche} className={LIEN}>
                    {photo.auteur}
                  </a>
                </p>
                <p className="mt-auto pt-2.5 text-[10.5px] leading-[1.2] font-bold tracking-[0.1em] text-encre-2 uppercase">
                  {epreuve.format}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11.5px] leading-snug text-encre-2">
        <Link to="/mentions-legales#credits" className={LIEN}>
          Crédits photos
        </Link>
        .
      </p>
    </section>
  );
}
