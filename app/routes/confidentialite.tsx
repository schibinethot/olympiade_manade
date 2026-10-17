import { Link } from 'react-router';
import { IdentitePublique } from '../composants/IdentitePublique';
import { CorpsLegal, LIEN_TEXTE, SectionLegale } from '../composants/TexteLegal';
import { TitrePage } from '../composants/TitrePage';
import type { Route } from './+types/confidentialite';
import { useConsentementCookies } from '../composants/ConsentementCookies';

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
  const { afficherPreferences } = useConsentementCookies();
  return (
    <>
      <TitrePage surtitre="Vos données" titre="Confidentialité" />
      <CorpsLegal>
        <SectionLegale id="responsable" titre="Responsable du traitement">
          <IdentitePublique repli={<p>L’identité et les coordonnées du responsable du traitement seront fournies par l’organisateur.</p>} />
        </SectionLegale>

        <SectionLegale id="donnees" titre="Données collectées">
          <ul>
            <li>
              <strong>Visiteurs du site</strong>&nbsp;: nos hébergeurs traitent des données techniques de connexion (adresse
              IP, date et heure, pages demandées, type de navigateur) pour assurer le fonctionnement et la sécurité du site.
              Le serveur conserve aussi des compteurs techniques agrégés (requêtes, erreurs, volume de données et temps
              de réponse), sans adresse IP ni historique individuel de navigation dans ces compteurs.
              Base légale&nbsp;: intérêt légitime à sécuriser le service (art. 6(1)(f) RGPD).
              Durée&nbsp;: celle fixée par chaque hébergeur pour ses journaux techniques.
            </li>
            <li>
              <strong>Choix relatifs aux cookies</strong>&nbsp;: à chaque choix, nous enregistrons un identifiant
              pseudonyme du navigateur, l’adresse IP pseudonymisée, le type de navigateur, la page et la date, ainsi que
              les catégories acceptées. Ces données servent à prouver votre consentement (art. 7(1) et 6(1)(c) RGPD).
            </li>
            <li>
              <strong>Formulaire de contact</strong>&nbsp;: prénom, email, message et date d’envoi. Les trois champs du
              formulaire sont obligatoires pour que nous puissions vous répondre.
              Une vérification anti-robot protège le dépôt. Le serveur utilise temporairement l’adresse de connexion
              pour limiter les tentatives, sans l’enregistrer avec votre message.
            </li>
            <li>
              <strong>Inscription au vote</strong>&nbsp;: prénom et email, puis un code reçu par email pour vous connecter.
            </li>
            <li>
              <strong>Abonnement aux actualités</strong>&nbsp;: adresse email, date et texte du consentement, recueillis
              dans l’encart de l’accueil. La case d’accord est décochée par défaut et une vérification anti-robot protège
              l’inscription. Un email de confirmation vous est envoyé&nbsp;: vous devez cliquer sur son bouton pour valider
              votre adresse. Sans confirmation, l’adresse est supprimée 30 jours après l’envoi de cet email. Une même
              adresse inscrite comme spectatrice ou spectateur et abonnée aux actualités n’a qu’une seule fiche d’envoi.
            </li>
            <li>
              <strong>Emails de la séquence</strong>&nbsp;: la ou les dates que vous suivez, l’accord horodaté (date et
              texte) pour les annonces des prochaines dates, et un journal des envois (date, type d’email, résultat),
              conservé 12 mois.
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
              Donner accès au vote et envoyer les notifications push de la soirée (alertes du navigateur)&nbsp;: votre
              consentement, recueilli par une case à cocher à l’inscription (art. 6(1)(a) RGPD). Vous pouvez le retirer à
              tout moment. Ces notifications sont distinctes des rappels par email décrits ci-dessous.
            </li>
            <li>
              <strong>Emails liés à votre date et annonces des prochaines dates</strong>&nbsp;: l’email qui vous
              demande de confirmer votre adresse (il part avant la confirmation, à la suite de votre demande
              d’inscription), un email de bienvenue, les rappels de la date que vous suivez (une semaine avant, la veille,
              le jour même, le lendemain), les messages de l’organisateur aux inscrits d’une date et, si vous l’avez
              demandé, l’annonce des prochaines dates. Base légale&nbsp;: votre consentement pour les
              annonces (art. 6(1)(a) RGPD) et l’exécution du service que vous avez demandé pour les rappels de la date
              suivie (art. 6(1)(b) RGPD). Chaque email contient un lien de désinscription&nbsp;: un clic suffit, sans
              connexion, pour arrêter seulement les annonces ou ne plus rien recevoir. Les rappels et
              messages ne sont envoyés qu’une fois votre adresse confirmée.
            </li>
          </ul>
          <p>Aucune newsletter sans case dédiée, décochée par défaut.</p>
          <p>Avec votre accord, l’organisation peut vous adresser les actualités, dates, informations pratiques,
            ouverture des votes, notations et résultats de l’Olympiade des Manades. Vous pouvez retirer cet accord à tout moment, par le lien de désinscription présent dans chaque email ou via le {LIEN_CONTACT}.</p>
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
            <li>Abonnement aux actualités&nbsp;: adresse et consentement conservés jusqu’à votre demande de retrait ou l’arrêt de la liste d’information.</li>
            <li>
              Adresse désinscrite&nbsp;: conservée sans limite de durée, réduite à l’adresse et à la date de désinscription,
              dans une liste d’opposition qui sert uniquement à ne plus vous écrire. Elle est supprimée sur demande d’effacement.
            </li>
            <li>Journal des emails envoyés (date, type d’email, résultat)&nbsp;: 12 mois, puis supprimé.</li>
            <li>Adresses jamais confirmées&nbsp;: supprimées 30 jours après l’envoi de l’email de confirmation.</li>
            <li>Comptes spectateurs inactifs&nbsp;: supprimés après 24 mois d’inactivité.</li>
            <li>Mesures techniques agrégées et derniers signaux d’activité&nbsp;: conservation de 30 jours.</li>
            <li>Preuves de vos choix relatifs aux cookies&nbsp;: conservées 12 mois, puis supprimées.</li>
            <li>
              Messages de contact&nbsp;: conservés le temps nécessaire pour vous répondre, puis supprimés. La durée exacte
              sera fixée avec l’organisateur.
            </li>
          </ul>
        </SectionLegale>

        <SectionLegale id="traceurs" titre="Traceurs et stockage local">
          <p>
            Les formulaires utilisent Cloudflare Turnstile pour la vérification anti-robot.
          </p>

          <p>
            <strong>Traceurs nécessaires</strong>&nbsp;: le cookie <code>cc_cookie</code> conserve votre choix de
            consentement, au plus 13&nbsp;mois. Le cookie <code>olympiade_acces</code> ouvre l’accès à la préversion
            du site. L’identifiant <code>cc_visitor_id</code>, conservé dans le stockage local, relie votre choix à sa
            preuve sans vous identifier.
          </p>

          <p>
            <strong>Mesure d’audience</strong>&nbsp;: avec votre accord, des traceurs Google Analytics
            (<code>_ga</code>, <code>_ga_*</code>, <code>_gid</code>) mesurent la fréquentation du site.
            Aucun cookie de mesure n’est déposé sans votre consentement explicite.
          </p>

          <p>
            <strong>Publicité et réseaux sociaux</strong>&nbsp;: avec votre accord, des traceurs publicitaires
            (Meta Pixel, Google Ads) permettent de mesurer l’efficacité de nos campagnes.
            Aucun cookie publicitaire n’est déposé sans votre consentement explicite.
          </p>

          <p>
            Vous pouvez modifier votre choix à tout moment en cliquant sur «&nbsp;
            <button type="button" onClick={afficherPreferences} className={LIEN_TEXTE}>
              Gérer les cookies
            </button>
            &nbsp;». Refuser est aussi simple qu’accepter et ne limite pas l’accès au site. À l’expiration de votre
            choix, il vous est demandé à nouveau.
          </p>

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
              <strong>Cloudflare Turnstile</strong>&nbsp;: vérification anti-robot des formulaires de connexion et de contact.
              Pour le contact, le serveur lui transmet le résultat de la vérification et l’adresse de connexion,
              sans le prénom, l’email ni le contenu du message.
            </li>
            <li>
              <strong>Brevo</strong>&nbsp;: envoi des emails lorsque le SMTP est activé.
            </li>
            <li>
              <strong>Anthropic</strong>&nbsp;: lecture du planning déposé par l’organisateur, seulement si une clé est configurée.
              Le fichier est traité pour préparer un brouillon et n’est pas conservé après la demande. Le tableau validé reste lié à la soirée.
            </li>
            <li>
              <strong>Services de notification du navigateur</strong> (Apple, Google, Mozilla, Microsoft)&nbsp;: envoi des alertes de soirée si vous les acceptez.
              L’application Android, si elle est installée, utilise le même site. Elle n’est pas ouverte au public par défaut.
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
            Pour supprimer votre compte spectateur, ouvrez la page{' '}
            <Link to="/compte" className={LIEN_TEXTE}>Supprimer mon compte</Link>
            {' '}une fois connecté. Pour les autres droits, écrivez-nous via le {LIEN_CONTACT}. Nous répondons dans un délai d’un mois (art. 12(3)
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
