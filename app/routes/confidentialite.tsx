import { Link } from 'react-router';
import { CorpsLegal, EncadreOrganisateur, LIEN_TEXTE, SectionLegale } from '../composants/TexteLegal';
import { TitrePage } from '../composants/TitrePage';
import type { Route } from './+types/confidentialite';

export const meta: Route.MetaFunction = () => [
  { title: 'Confidentialité · Olympiade des Manades' },
  { name: 'description', content: 'Données collectées, finalités, durée de conservation et droits RGPD.' },
];

export default function Confidentialite() {
  return (
    <>
      <TitrePage surtitre="Vos données" titre="Confidentialité" />
      <CorpsLegal>
        <SectionLegale id="responsable" titre="Responsable du traitement">
          <EncadreOrganisateur>
            <p>L’identité et les coordonnées du responsable du traitement seront fournies par l’organisateur.</p>
          </EncadreOrganisateur>
        </SectionLegale>

        <SectionLegale id="donnees" titre="Données collectées">
          <ul>
            <li>
              <strong>Visiteurs du site</strong>&nbsp;: aucune donnée personnelle n’est collectée tant que vous ne vous
              inscrivez pas pour voter.
            </li>
            <li>
              <strong>Formulaire de contact</strong>&nbsp;: prénom, email et message.
            </li>
            <li>
              <strong>Inscription au vote</strong> (prévue)&nbsp;: prénom et email. Ce traitement sera ouvert avec le vote
              du public.
            </li>
          </ul>
        </SectionLegale>

        <SectionLegale id="finalites" titre="Finalités et bases légales">
          <ul>
            <li>Répondre à votre message&nbsp;: votre consentement, donné en envoyant le formulaire, ou notre intérêt légitime à répondre.</li>
            <li>Donner accès au vote et envoyer les notifications liées à la soirée&nbsp;: votre consentement, recueilli à l’inscription.</li>
          </ul>
          <p>Aucune newsletter sans case dédiée, décochée par défaut.</p>
        </SectionLegale>

        <SectionLegale id="duree" titre="Durée de conservation">
          <ul>
            <li>Comptes spectateurs inactifs&nbsp;: supprimés après 24 mois d’inactivité.</li>
            <li>
              Messages de contact&nbsp;: conservés le temps nécessaire pour vous répondre, puis supprimés. La durée exacte
              sera fixée avec l’organisateur.
            </li>
          </ul>
        </SectionLegale>

        <SectionLegale id="traceurs" titre="Traceurs">
          <p>Aucun traceur tiers, aucun cookie publicitaire, aucun outil de mesure d’audience externe.</p>
        </SectionLegale>

        <SectionLegale id="soustraitants" titre="Sous-traitants">
          <ul>
            <li>
              <strong>Supabase</strong>&nbsp;: base de données, région de l’Union européenne (Paris).
            </li>
            <li>
              <strong>Railway</strong>&nbsp;: hébergement du site.
            </li>
            <li>
              <strong>Brevo</strong>&nbsp;: envoi des emails (prévu avec le vote du public).
            </li>
          </ul>
        </SectionLegale>

        <SectionLegale id="droits" titre="Vos droits">
          <p>
            Vous disposez d’un droit d’accès, de rectification, d’effacement, d’opposition et de portabilité de vos
            données. Pour l’exercer, écrivez-nous via le{' '}
            <Link to="/contact" className={LIEN_TEXTE}>
              formulaire de contact
            </Link>
            .
          </p>
          <p>
            Vous pouvez aussi introduire une réclamation auprès de la CNIL (
            <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className={LIEN_TEXTE}>
              cnil.fr
            </a>
            ).
          </p>
        </SectionLegale>
      </CorpsLegal>
    </>
  );
}
