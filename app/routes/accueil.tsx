import { Link } from 'react-router';
import { TitrePage } from '../composants/TitrePage';
import type { Route } from './+types/accueil';

export const meta: Route.MetaFunction = () => [
  { title: 'Olympiade des Manades' },
  {
    name: 'description',
    content: 'Les Olympiades camarguaises : le public note les manades, en direct, aux côtés du jury. Saison 2027.',
  },
];

// Version minimale : la page d'accueil complète (Notez les Olympiades, prochaine soirée,
// épreuves, dernier vainqueur) arrive en Task 3.
export default function Accueil() {
  return (
    <TitrePage surtitre="Saison 2027 des Olympiades camarguaises" titre={<>Olympiade des <em>Manades</em></>}>
      <p>Le public note les manades, en direct, aux côtés du jury.</p>
      <p className="mt-4 flex flex-wrap gap-x-5">
        <Link to="/dates" className="inline-flex min-h-12 items-center font-semibold text-rouge underline-offset-2 hover:underline">
          Les dates de la saison
        </Link>
        <Link to="/classements" className="inline-flex min-h-12 items-center font-semibold text-rouge underline-offset-2 hover:underline">
          Les classements
        </Link>
      </p>
    </TitrePage>
  );
}
