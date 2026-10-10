import { TitrePage } from '../composants/TitrePage';
import type { Route } from './+types/classements';

export const meta: Route.MetaFunction = () => [
  { title: 'Classements · Olympiade des Manades' },
  { name: 'description', content: 'Palmarès des Olympiades des manades : 2025, 2026 et 2027.' },
];

// Contenu (palmarès par année) en Task 4.
export default function Classements() {
  return <TitrePage surtitre="Palmarès" titre="Classements" />;
}
