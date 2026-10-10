import { TitrePage } from '../composants/TitrePage';
import type { Route } from './+types/confidentialite';

export const meta: Route.MetaFunction = () => [
  { title: 'Confidentialité · Olympiade des Manades' },
  { name: 'description', content: 'Données collectées, finalités, durée de conservation et droits RGPD.' },
];

// Contenu en Task 5.
export default function Confidentialite() {
  return <TitrePage surtitre="Vos données" titre="Confidentialité" />;
}
