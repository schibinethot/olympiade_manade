import { Link } from 'react-router';
import { CreditsPhotos } from '../composants/CreditsPhotos';
import { CorpsLegal, EncadreOrganisateur, LIEN_TEXTE, SectionLegale } from '../composants/TexteLegal';
import { TitrePage } from '../composants/TitrePage';
import type { Route } from './+types/mentions-legales';

export const meta: Route.MetaFunction = () => [
  { title: 'Mentions légales · Olympiade des Manades' },
  { name: 'description', content: 'Éditeur, hébergeurs et crédits du site de l’Olympiade des Manades.' },
];

export default function MentionsLegales() {
  return (
    <>
      <TitrePage surtitre="Informations" titre="Mentions légales" />
      <CorpsLegal>
        <SectionLegale id="editeur" titre="Éditeur du site">
          <EncadreOrganisateur>
            <p>
              Ces informations seront fournies par l’organisateur&nbsp;: nom ou raison sociale, forme juridique, adresse,
              numéro d’immatriculation, responsable de la publication, email de contact.
            </p>
          </EncadreOrganisateur>
        </SectionLegale>

        <SectionLegale id="hebergement" titre="Hébergement">
          <ul>
            <li>
              <strong>Railway</strong> héberge le site.
            </li>
            <li>
              <strong>Supabase</strong> héberge la base de données, dans une région de l’Union européenne (Paris).
            </li>
          </ul>
        </SectionLegale>

        <SectionLegale id="conception" titre="Conception et réalisation">
          <p>
            Site conçu et réalisé par{' '}
            <a href="https://tpmge.com/#olympiade-des-manades" target="_blank" rel="noopener noreferrer" className={LIEN_TEXTE}>
              TPMGE
            </a>
            , en collaboration avec Atch Élevage, partenaire officiel de l’Olympiade des Manades.
          </p>
        </SectionLegale>

        <SectionLegale id="credits" titre="Crédits photos">
          <p>Photographies sous licence libre, retouchées pour le site&nbsp;:</p>
          <CreditsPhotos />
        </SectionLegale>

        <SectionLegale id="donnees" titre="Données personnelles">
          <p>
            Le traitement des données est décrit dans la{' '}
            <Link to="/confidentialite" className={LIEN_TEXTE}>
              politique de confidentialité
            </Link>
            . Pour toute demande, utilisez le{' '}
            <Link to="/contact" className={LIEN_TEXTE}>
              formulaire de contact
            </Link>
            .
          </p>
        </SectionLegale>
      </CorpsLegal>
    </>
  );
}
