import { Link } from 'react-router';
import { TitrePage } from '../composants/TitrePage';
import { momentSoiree, soireeDeReference, type AvecCalendrier } from '../lib/accueil';
import { lireCalendrier, lireOuRepli } from '../lib/donnees';
import { DELAI_LECTURE_NAVIGATEUR_MS } from '../lib/donnees-vitrine';
import { INSCRIPTION_OUVERTE, TEXTE_INSCRIPTIONS_FERMEES } from '../lib/inscription-ouverte';
import { useMaintenant } from '../lib/temps';
import { useSession } from '../lib/useSession';
import type { Route } from './+types/noter';
import { NotationPublic } from '../composants/NotationPublic';

export const meta: Route.MetaFunction = () => [
  { title: 'Noter les manades · Olympiade des Manades' },
  { name: 'robots', content: 'noindex' },
];

// Route sans pré-rendu : le calendrier est lu dans le navigateur, pour la date de la prochaine
// soirée de Nîmes (et la pastille de l'en-tête). Supabase injoignable : la page reste lisible, sans date.
export async function clientLoader(): Promise<AvecCalendrier> {
  const calendrier = await lireOuRepli(() => lireCalendrier(AbortSignal.timeout(DELAI_LECTURE_NAVIGATEUR_MS)));
  return { calendrier, lueLe: new Date().toISOString() };
}

const LIEN = 'font-semibold text-rouge underline underline-offset-2';

// Les spectateurs connectés disposent de la saisie et de la file durable ; les autres préparent leur inscription.
export default function Noter({ loaderData }: Route.ComponentProps) {
  const { calendrier, lueLe } = loaderData;
  const maintenant = useMaintenant(lueLe);
  const soiree = calendrier ? soireeDeReference(calendrier, maintenant) : null;
  const { session, prenom, chargement } = useSession();

  return (
    <><TitrePage surtitre="Notation du public" titre={session ? 'Notez les manades' : 'Les votes ouvriront le soir de l’Olympiade'}>
      <p>
        {session ? `Bonjour${prenom ? ` ${prenom}` : ''}. ` : ''}
        {soiree ? `Les votes ouvriront ${momentSoiree(soiree)}. ` : ''}
        {session ? 'Retrouvez les passages proposés et le suivi de vos notes ci-dessous.' : 'Le soir venu, vous donnerez une note de 1 à 10 à chaque manade, dès la fin de son passage.'}
      </p>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        {!session && !chargement ? (
          INSCRIPTION_OUVERTE ? (
            <Link to="/inscription" className={LIEN}>
              Inscrivez-vous dès maintenant, vous serez prêt le soir venu
            </Link>
          ) : (
            <span className="font-semibold text-encre">{TEXTE_INSCRIPTIONS_FERMEES}</span>
          )
        ) : null}
        <Link to="/dates" className={LIEN}>
          Voir les dates
        </Link>
      </p>
    </TitrePage>{session ? <NotationPublic key={session.user.id} compte={session.user.id} /> : null}</>
  );
}
