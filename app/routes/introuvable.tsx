import { Link } from 'react-router';
import { TitrePage } from '../composants/TitrePage';
import type { Route } from './+types/introuvable';

export const meta: Route.MetaFunction = () => [
  { title: 'Page introuvable · Olympiade des Manades' },
  { name: 'robots', content: 'noindex' },
];

// Route « * » : une adresse inconnue s'hydrate depuis __spa-fallback.html comme /noter,
// sans écart d'hydratation (l'ErrorBoundary racine serait rendu d'emblée côté client).
export default function Introuvable() {
  return (
    <TitrePage surtitre="Erreur 404" titre="Page introuvable">
      <p>
        Cette adresse ne correspond à aucune page du site.{' '}
        <Link to="/" className="font-semibold text-rouge underline underline-offset-2">
          Retour à l’accueil
        </Link>
      </p>
    </TitrePage>
  );
}
