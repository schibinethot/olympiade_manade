import { useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Logo } from './Logo';

const LIENS = [
  { vers: '/', libelle: 'Accueil' },
  { vers: '/classements', libelle: 'Classements' },
  { vers: '/dates', libelle: 'Dates' },
  { vers: '/contact', libelle: 'Contact' },
] as const;

const ID_MENU = 'menu-principal';
const CLASSE_LIEN = 'group flex min-h-12 items-center rounded-full';
const CLASSE_PASTILLE =
  'flex-1 rounded-2xl px-4 py-3 text-base font-medium text-encre-2 transition-colors group-hover:bg-lin group-aria-[current=page]:bg-encre group-aria-[current=page]:text-sable paysage:flex-none paysage:rounded-full paysage:px-[15px] paysage:py-[9px] paysage:text-[14.5px] paysage:leading-[1.3]';

type Props = {
  /** Prénom du spectateur connecté (branché en Task 6). Rien n'est affiché sans prénom. */
  prenom?: string | null;
  /**
   * Rendu indépendant de l'adresse (aucun lien actif, bouton « Noter » toujours présent).
   * Pour le HydrateFallback : __spa-fallback.html est pré-rendu une seule fois, pour « / »,
   * puis hydraté sous d'autres adresses (/noter, adresse inconnue).
   */
  generique?: boolean;
};

/**
 * En-tête du site public (maquette : écran public, bloc .ph).
 * Sous 1000 px de large, la navigation est un popover natif ouvert par le bouton « Menu » :
 * il fonctionne sans JavaScript (pages pré-rendues), se ferme avec Échap ou un clic à côté.
 * À partir de 1000 px, la même navigation s'affiche en ligne.
 */
export function Entete({ prenom = null, generique = false }: Props) {
  const menu = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // Le popover reste ouvert après une navigation côté client : on le referme.
  useEffect(() => {
    const nav = menu.current;
    if (nav?.matches(':popover-open')) nav.hidePopover();
  }, [pathname]);

  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-trait bg-sable/86 px-4 pt-[calc(env(safe-area-inset-top)+8px)] pb-2.5 backdrop-blur-[14px] backdrop-saturate-[1.4] tablette:px-7 paysage:gap-[30px] paysage:px-10 bureau:px-14">
      <Link to="/" aria-label="Olympiade des Manades, accueil" className="inline-flex min-h-12 items-center rounded-lg">
        <Logo />
      </Link>

      <nav
        id={ID_MENU}
        ref={menu}
        popover="auto"
        aria-label="Navigation principale"
        className="fixed inset-x-4 top-[calc(env(safe-area-inset-top)+76px)] bottom-auto m-0 h-auto w-auto rounded-[22px] border border-trait bg-creme p-2 text-encre shadow-[0_24px_50px_-24px_rgba(28,25,18,0.45)] paysage:static paysage:flex paysage:overflow-visible paysage:border-0 paysage:bg-transparent paysage:p-0 paysage:shadow-none"
      >
        <ul className="flex flex-col gap-1 paysage:flex-row paysage:gap-0.5">
          {LIENS.map((lien) => (
            <li key={lien.vers}>
              {generique ? (
                <Link to={lien.vers} className={CLASSE_LIEN}>
                  <span className={CLASSE_PASTILLE}>{lien.libelle}</span>
                </Link>
              ) : (
                <NavLink to={lien.vers} end className={CLASSE_LIEN}>
                  <span className={CLASSE_PASTILLE}>{lien.libelle}</span>
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="ml-auto flex items-center gap-2.5">
        {prenom ? (
          <span className="max-w-[9rem] truncate text-sm font-semibold text-encre-2">{prenom}</span>
        ) : null}
        {!generique && pathname === '/noter' ? null : (
          <Link
            to="/noter"
            className="inline-flex min-h-12 items-center justify-center rounded-[14px] bg-couchant-bouton px-[18px] text-[14.5px] font-semibold whitespace-nowrap text-white shadow-[0_10px_24px_-10px_rgba(194,59,29,0.75),inset_0_1px_0_rgba(255,255,255,0.25)] transition-[filter,transform] hover:brightness-105 active:scale-[0.97]"
          >
            Noter
          </Link>
        )}
        <button
          type="button"
          popoverTarget={ID_MENU}
          aria-controls={ID_MENU}
          aria-label="Menu"
          className="grid size-12 cursor-pointer place-content-center gap-[5px] rounded-[13px] text-encre shadow-[inset_0_0_0_1px_var(--color-trait)] paysage:hidden"
        >
          <span aria-hidden="true" className="block h-[1.6px] w-[17px] rounded-sm bg-current" />
          <span aria-hidden="true" className="block h-[1.6px] w-[17px] rounded-sm bg-current" />
          <span aria-hidden="true" className="block h-[1.6px] w-[17px] rounded-sm bg-current" />
        </button>
      </div>
    </header>
  );
}
