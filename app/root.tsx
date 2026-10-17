import type { ReactNode } from 'react';
import { isRouteErrorResponse, Link, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';
import type { Route } from './+types/root';
import { Entete } from './composants/Entete';
import { PiedDePage } from './composants/PiedDePage';
import { TitrePage } from './composants/TitrePage';
import feuilleDeStyle from './app.css?url';
import { SuiviNotes } from './composants/SuiviNotes';
import { SuiviPresence } from './composants/SuiviPresence';
import { FournisseurEtatSoiree } from './lib/contexte-etat';
import { CoqueAndroid } from './composants/CoqueAndroid';
import { BanniereDeblocage } from './composants/Notifications';
import { ServiceTravailleur } from './composants/ServiceTravailleur';

const police = (fichier: string) =>
  ({ rel: 'preload', href: `/polices/${fichier}`, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' }) as const;

export const links: Route.LinksFunction = () => [
  // Feuille de style : elle bloque le premier rendu, elle doit partir avant les modules JavaScript.
  // React 19 remonte en tête du <head> les préchargements (polices, modules) ; avec « precedence »,
  // il y remonte aussi la feuille, juste après les polices. Sans, elle arrivait en dernier.
  { rel: 'stylesheet', href: feuilleDeStyle, precedence: 'default' },
  // Polices du premier écran : interface, logo, titres, et italique des années (affiche de l'accueil,
  // titres « Classements 2026 » et « Dates 2027 »), sinon découverte tard et source d'un décalage.
  police('inter-latin-wght-normal.woff2'),
  police('kaushan-script-latin-400-normal.woff2'),
  police('playfair-display-latin-wght-normal.woff2'),
  police('playfair-display-latin-wght-italic.woff2'),
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  { rel: 'manifest', href: '/manifest.webmanifest' },
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
    <CoqueAndroid>
      <FournisseurEtatSoiree>
        <ServiceTravailleur />
        <Coque>
          <BanniereDeblocage />
          <SuiviPresence />
          <SuiviNotes />
          <Outlet />
        </Coque>
      </FournisseurEtatSoiree>
    </CoqueAndroid>
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
