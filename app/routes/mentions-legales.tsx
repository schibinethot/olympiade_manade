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
              Ces informations seront fournies par l’organisateur&nbsp;: nom ou raison sociale, forme juridique, siège ou
              adresse, téléphone, email, numéro d’immatriculation, capital le cas échéant, numéro de TVA, directeur de la
              publication.
            </p>
          </EncadreOrganisateur>
        </SectionLegale>

        <SectionLegale id="hebergement" titre="Hébergement">
          <ul>
            <li>
              <strong>Railway Corp.</strong>, 548 Market St PMB 68956, San Francisco, California 94104, États-Unis. Contact&nbsp;:
              privacy@railway.com, site{' '}
              <a href="https://railway.com" target="_blank" rel="noopener noreferrer" className={LIEN_TEXTE}>
                railway.com
              </a>
              . Héberge le site. Aucun téléphone n’est publié par l’hébergeur.
            </li>
            <li>
              <strong>Supabase</strong>, exploité par Supabase Pte. Ltd., 65 Chulia Street #38-02/03, OCBC Centre, Singapore
              049513, et, pour certains contrats, par Supabase, Inc., 3500 S. DuPont Highway, Dover, Kent County, DE 19901,
              États-Unis. Contact&nbsp;: legal@supabase.io, site{' '}
              <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className={LIEN_TEXTE}>
                supabase.com
              </a>
              . Héberge la base de données, dans l’Union européenne (Paris). Aucun téléphone n’est publié par l’hébergeur.
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
          <p>Les versions retouchées de ces photographies sont mises à disposition sous la même licence que l’original.</p>
        </SectionLegale>

        <SectionLegale id="propriete" titre="Propriété intellectuelle">
          <p>
            Les textes, logos et éléments graphiques du site sont protégés (CPI L.111-1 et L.335-2). Toute reproduction sans
            autorisation est interdite, à l’exception des photographies sous licence libre mentionnées ci-dessus. L’usage du
            nom et du logo de l’Olympiade des Manades et de ceux d’Atch Élevage reste soumis à l’accord de leurs titulaires.
          </p>
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
