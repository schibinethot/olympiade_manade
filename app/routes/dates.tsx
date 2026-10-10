import { TitrePage } from '../composants/TitrePage';
import type { Route } from './+types/dates';

export const meta: Route.MetaFunction = () => [
  { title: 'Dates · Olympiade des Manades' },
  { name: 'description', content: 'Le calendrier des soirées d’Olympiades des manades, saison 2027 et archives.' },
];

// Contenu (calendrier 2027 et archives) en Task 4.
export default function Dates() {
  return (
    <TitrePage surtitre="Calendrier" titre={<>Dates <em>2027</em></>}>
      <p>Les soirées d’Olympiades dans le Gard, l’Hérault et les Bouches-du-Rhône.</p>
    </TitrePage>
  );
}
