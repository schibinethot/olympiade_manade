import type { ReactNode } from 'react';
import { isRouteErrorResponse, Link, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import type { Route } from './+types/root';
import { Entete } from './composants/Entete';
import { PiedDePage } from './composants/PiedDePage';
import { TitrePage } from './composants/TitrePage';
import './app.css';

const police = (fichier: string) =>
  ({ rel: 'preload', href: `/polices/${fichier}`, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' }) as const;

export const links: Route.LinksFunction = () => [
  // Polices du premier écran : interface, logo et titres.
  police('inter-latin-wght-normal.woff2'),
  police('kaushan-script-latin-400-normal.woff2'),
  police('playfair-display-latin-wght-normal.woff2'),
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
];

export const meta: Route.MetaFunction = () => [
  { title: 'Olympiade des Manades' },
  { name: 'description', content: 'Le public note les manades, en direct, aux côtés du jury.' },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#f7f4ed" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/** Coque commune : conteneur des container queries (`app`), en-tête, contenu, pied de page. */
function Coque({ children, generique = false }: { children: ReactNode; generique?: boolean }) {
  return (
    <div className="@container/app flex min-h-dvh flex-col">
      <a
        href="#contenu"
        className="sr-only z-30 rounded-xl bg-encre px-4 py-3 text-sable focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Aller au contenu
      </a>
      <Entete generique={generique} />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <PiedDePage />
    </div>
  );
}

export default function App() {
  return (
    <Coque>
      <Outlet />
    </Coque>
  );
}

// Affiché dans build/client/__spa-fallback.html (routes non pré-rendues) le temps de l'hydratation.
// Ce fichier est pré-rendu pour « / » mais hydraté sous d'autres adresses : l'en-tête y est générique.
export function HydrateFallback() {
  return (
    <Coque generique>
      <p role="status" className="px-4 pt-6 text-encre-2 tablette:px-7 paysage:px-10 bureau:px-14">
        Chargement…
      </p>
    </Coque>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const introuvable = isRouteErrorResponse(error) && error.status === 404;
  return (
    <Coque>
      <TitrePage surtitre={introuvable ? 'Erreur 404' : 'Erreur'} titre={introuvable ? 'Page introuvable' : 'Un problème est survenu'}>
        <p>
          {introuvable
            ? 'Cette adresse ne correspond à aucune page du site.'
            : 'La page n’a pas pu s’afficher. Réessayez dans un instant.'}{' '}
          <Link to="/" className="font-semibold text-rouge underline underline-offset-2">
            Retour à l’accueil
          </Link>
        </p>
      </TitrePage>
    </Coque>
  );
}
