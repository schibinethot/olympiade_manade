import { Link } from 'react-router';
import { CorpsLegal, EncadreOrganisateur, LIEN_TEXTE, SectionLegale } from '../composants/TexteLegal';
import { TitrePage } from '../composants/TitrePage';
import type { Route } from './+types/confidentialite';

export const meta: Route.MetaFunction = () => [
  { title: 'Confidentialité · Olympiade des Manades' },
  { name: 'description', content: 'Données collectées, finalités, durée de conservation et droits RGPD.' },
];

const LIEN_CONTACT = (
  <Link to="/contact" className={LIEN_TEXTE}>
    formulaire de contact
  </Link>
);

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
              <strong>Visiteurs du site</strong>&nbsp;: nos hébergeurs traitent des données techniques de connexion (adresse
              IP, date et heure, pages demandées, type de navigateur) pour assurer le fonctionnement et la sécurité du site.
              Le serveur conserve aussi des compteurs techniques agrégés (requêtes, erreurs, volume de données et temps
              de réponse), sans adresse IP ni historique individuel de navigation dans ces compteurs.
              Nous n’utilisons aucun outil de mesure d’audience publicitaire. Base légale&nbsp;: intérêt légitime à sécuriser le service (art. 6(1)(f) RGPD).
              Durée&nbsp;: celle fixée par chaque hébergeur pour ses journaux techniques.
            </li>
            <li>
              <strong>Formulaire de contact</strong>&nbsp;: prénom, email, message et date d’envoi. Les trois champs du
              formulaire sont obligatoires pour que nous puissions vous répondre.
            </li>
            <li>
              <strong>Inscription au vote</strong>&nbsp;: prénom et email, puis un code reçu par email pour vous connecter.
            </li>
            <li>
              <strong>Disponibilité du service</strong>&nbsp;: lorsque vous êtes connecté et que l’application est visible,
              un signal périodique met à jour la dernière activité de votre compte pour estimer le nombre de comptes actifs.
              Il ne contient ni la page visitée, ni l’adresse IP, ni le contenu de vos notes. Seuls les administrateurs
              peuvent consulter les statistiques agrégées.
            </li>
          </ul>
        </SectionLegale>

        <SectionLegale id="finalites" titre="Finalités et bases légales">
          <ul>
            <li>
              Répondre à votre message&nbsp;: intérêt légitime de l’organisation à répondre aux demandes qui lui sont
              adressées (art. 6(1)(f) RGPD).
            </li>
            <li>
              Donner accès au vote et envoyer les notifications liées à la soirée&nbsp;: votre consentement, recueilli par une
              case à cocher à l’inscription (art. 6(1)(a) RGPD). Vous pouvez le retirer à tout moment.
            </li>
          </ul>
          <p>Aucune newsletter sans case dédiée, décochée par défaut.</p>
          <p>Aucune décision fondée exclusivement sur un traitement automatisé ne vous concerne.</p>
        </SectionLegale>

        <SectionLegale id="destinataires" titre="Destinataires">
          <p>
            Vos données sont accessibles à l’organisateur et aux personnes habilitées à répondre, ainsi qu’à nos
            sous-traitants listés plus bas.
          </p>
        </SectionLegale>

        <SectionLegale id="duree" titre="Durée de conservation">
          <ul>
            <li>Comptes spectateurs inactifs&nbsp;: supprimés après 24 mois d’inactivité.</li>
            <li>Mesures techniques agrégées et derniers signaux d’activité&nbsp;: conservation de 30 jours.</li>
            <li>
              Messages de contact&nbsp;: conservés le temps nécessaire pour vous répondre, puis supprimés. La durée exacte
              sera fixée avec l’organisateur.
            </li>
          </ul>
        </SectionLegale>

        <SectionLegale id="traceurs" titre="Traceurs et stockage local">
          <p>Aucun traceur tiers, aucun cookie publicitaire, aucun outil de mesure d’audience.</p>
          <p>
            Lorsque vous vous inscrivez, une donnée de session est enregistrée dans votre navigateur pour vous reconnaître.
            Elle est strictement nécessaire au service, ne sert à aucun suivi et est supprimée à votre déconnexion.
          </p>
          <p>
            Vos notes en attente d’envoi sont conservées sur cet appareil pour reprendre en cas de coupure, séparément pour
            chaque compte. Elles sont envoyées lorsque vous revenez sur le site avec le même compte et une connexion.
            Les confirmations locales sont conservées au plus 7 jours et les refus au plus 30 jours, avec nettoyage à
            l’utilisation. Les reçus serveur restent associés à votre compte pour éviter les doublons lors des reprises.
            Effacer les données du navigateur supprime les notes qui n’ont pas encore été reçues par le serveur.
          </p>
        </SectionLegale>

        <SectionLegale id="soustraitants" titre="Sous-traitants et transferts">
          <ul>
            <li>
              <strong>Supabase</strong>&nbsp;: base de données (région de l’Union européenne, Paris) et, pour l’instant,
              envoi des emails de connexion.
            </li>
            <li>
              <strong>Railway</strong>&nbsp;: hébergement du site.
            </li>
            <li>
              <strong>Brevo</strong>&nbsp;: envoi des emails, prévu pour remplacer le service d’email de Supabase.
            </li>
          </ul>
          <p>
            Railway Corp. est établie aux États-Unis. Supabase est exploitée par Supabase Pte. Ltd. (Singapour) et
            Supabase, Inc. (États-Unis). La base de données est hébergée dans l’Union européenne (Paris) et le site est servi
            depuis l’Europe. Tout accès depuis un pays hors de l’Union européenne est encadré par les clauses contractuelles
            types de la Commission européenne, prévues dans l’accord de traitement des données de chaque prestataire (art. 28
            et 46 RGPD). Une copie des garanties peut être demandée via le {LIEN_CONTACT}.
          </p>
        </SectionLegale>

        <SectionLegale id="droits" titre="Vos droits">
          <p>
            Vous disposez des droits d’accès, de rectification, d’effacement, d’opposition, de limitation et de portabilité
            de vos données, et du droit de retirer votre consentement à tout moment (vote et notifications). Vous pouvez
            aussi définir des directives sur le sort de vos données après votre décès (loi Informatique et Libertés,
            art. 85).
          </p>
          <p>
            Pour exercer ces droits, écrivez-nous via le {LIEN_CONTACT}. Nous répondons dans un délai d’un mois (art. 12(3)
            RGPD). Une pièce d’identité n’est demandée qu’en cas de doute raisonnable sur votre identité.
          </p>
          <p>
            Vous pouvez introduire une réclamation auprès de la CNIL, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07,
            ou en ligne&nbsp;:{' '}
            <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener noreferrer" className={LIEN_TEXTE}>
              formulaire de plainte de la CNIL
            </a>
            .
          </p>
        </SectionLegale>
      </CorpsLegal>
    </>
  );
}
