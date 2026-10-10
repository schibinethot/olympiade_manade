import { TitrePage } from '../composants/TitrePage';
import type { Route } from './+types/mentions-legales';

export const meta: Route.MetaFunction = () => [
  { title: 'Mentions légales · Olympiade des Manades' },
  { name: 'description', content: 'Éditeur, hébergeurs et crédits du site de l’Olympiade des Manades.' },
];

// Contenu en Task 5.
export default function MentionsLegales() {
  return <TitrePage surtitre="Informations" titre="Mentions légales" />;
}
