import { EPREUVES } from '../donnees/epreuves';
import { PHOTOS_ACCUEIL } from '../donnees/photos-accueil';
import { PHOTOS_EPREUVES } from '../donnees/photos-epreuves';
import { LIEN_TEXTE } from './TexteLegal';

const LIBELLES = {
  gardian: 'Affiche de l’accueil',
  arenes: 'Arènes de Nîmes',
} as const;
const PHOTOS_AMBIANCE = ['gardian', 'arenes'] as const;

/** Crédits des images effectivement utilisées, selon leur régime de droits. */
export function CreditsPhotos() {
  return (
    <>
      <h3 className="mt-5 font-display text-xl font-bold">Photos des épreuves</h3>
      <ul aria-label="Photos des épreuves" className="!list-none !pl-0">
        {EPREUVES.map((epreuve) => {
          const photo = PHOTOS_EPREUVES[epreuve.photo];
          return (
            <li key={photo.id}>
              <a href={photo.fiche} className={LIEN_TEXTE}>
                {epreuve.nom}
              </a>
              &nbsp;: {photo.auteur}, {photo.droits}.
            </li>
          );
        })}
      </ul>
      <h3 className="mt-5 font-display text-xl font-bold">Photos d’ambiance</h3>
      <ul aria-label="Photos d’ambiance" className="!list-none !pl-0">
        {PHOTOS_AMBIANCE.map((id) => {
          const photo = PHOTOS_ACCUEIL[id];
          return (
            <li key={photo.id}>
              <a href={photo.fiche} className={LIEN_TEXTE}>
                {LIBELLES[id]}
              </a>
              &nbsp;: {photo.auteur}, <a href={photo.lienLicence} rel="license" className={LIEN_TEXTE}>{photo.licence}</a>, via
              Wikimedia Commons, {photo.modification}.
            </li>
          );
        })}
      </ul>
    </>
  );
}
