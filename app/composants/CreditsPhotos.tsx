import { PHOTOS_ACCUEIL } from '../donnees/photos-accueil';
import { LIEN_TEXTE } from './TexteLegal';

const LIBELLES = {
  gardian: 'Affiche de l’accueil',
  arenes: 'Arènes de Nîmes',
  manade: 'Manade et gardian',
  chevaux: 'Chevaux de Camargue',
} as const;

/** Liste des crédits, générée depuis app/donnees/photos-accueil.ts (jamais écrite à la main). */
export function CreditsPhotos() {
  return (
    <ul aria-label="Crédits photos" className="!list-none !pl-0">
      {Object.values(PHOTOS_ACCUEIL).map((photo) => (
        <li key={photo.id}>
          <a href={photo.fiche} className={LIEN_TEXTE}>
            {LIBELLES[photo.id]}
          </a>
          &nbsp;: {photo.auteur}, <a href={photo.lienLicence} rel="license" className={LIEN_TEXTE}>{photo.licence}</a>, via
          Wikimedia Commons, {photo.modification}.
        </li>
      ))}
    </ul>
  );
}
