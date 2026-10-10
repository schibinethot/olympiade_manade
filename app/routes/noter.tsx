import { Link } from 'react-router';
import { TitrePage } from '../composants/TitrePage';
import type { Route } from './+types/noter';

export const meta: Route.MetaFunction = () => [
  { title: 'Noter les manades · Olympiade des Manades' },
  { name: 'robots', content: 'noindex' },
];

// Notation : lot 2. Ici, seulement l'annonce de l'ouverture des votes.
export default function Noter() {
  return (
    <TitrePage surtitre="Notation du public" titre="Les votes ouvriront le soir de l’Olympiade">
      <p>
        Le soir venu, vous donnerez une note de 1 à 10 à chaque manade, dès la fin de son passage.{' '}
        <Link to="/dates" className="font-semibold text-rouge underline underline-offset-2">
          Voir les dates
        </Link>
      </p>
    </TitrePage>
  );
}
