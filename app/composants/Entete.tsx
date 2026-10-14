import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useMatches } from 'react-router';
import { aCalendrier, formaterJourMois, soireeDeReference } from '../lib/accueil';
import { seDeconnecter, traduireErreurAuth } from '../lib/auth';
import { type EtatSoiree } from '../lib/etat-soiree';
import { useInstantanePublic } from '../lib/contexte-etat';
import { useMaintenant } from '../lib/temps';
import { useSession } from '../lib/useSession';
import { Icone } from './Icone';
import { Logo } from './Logo';

// Navigation de la maquette (pubHeader) : Contact est dans le pied de page.
const LIENS = [
  { vers: '/', libelle: 'Accueil' },
  { vers: '/classements', libelle: 'Classements' },
  { vers: '/dates', libelle: 'Dates' },
  { vers: '/noter', libelle: 'Noter en direct' },
] as const;

const ID_MENU = 'menu-principal';
const ID_RAISON_NOTER = 'raison-noter-entete';
const CLASSE_PASTILLE_SOIREE =
  'hidden items-center gap-[7px] rounded-full py-1.5 pr-2.5 pl-[9px] text-[10.5px] leading-none font-bold tracking-[0.14em] whitespace-nowrap uppercase tablette:inline-flex';
const CLASSE_NOTER =
  'inline-flex min-h-12 items-center justify-center gap-1.5 rounded-[14px] px-[18px] text-[14.5px] font-semibold whitespace-nowrap';
const CLASSE_LIEN = 'group flex min-h-12 items-center rounded-full';
const CLASSE_PASTILLE =
  'flex-1 rounded-2xl px-4 py-3 text-base font-medium text-encre-2 transition-colors group-hover:bg-lin group-aria-[current=page]:bg-encre group-aria-[current=page]:text-sable paysage:flex-none paysage:rounded-full paysage:px-[15px] paysage:py-[9px] paysage:text-[14.5px] paysage:leading-[1.3]';

type Props = {
  /**
   * Rendu indépendant de l'adresse (aucun lien actif, bouton « Noter » toujours présent).
   * Pour le HydrateFallback : __spa-fallback.html est pré-rendu une seule fois, pour « / »,
   * puis hydraté sous d'autres adresses (/noter, adresse inconnue).
   */
  generique?: boolean;
  /** Hors soirée, le bouton « Noter » est grisé ; soirée ouverte (lot 2), il mène au vote. */
  etat?: EtatSoiree;
};

/**
 * En-tête du site public (maquette : écran public, bloc .ph).
 * Sous 1000 px de large, la navigation est un popover natif ouvert par le bouton « Menu » :
 * il fonctionne sans JavaScript (pages pré-rendues), se ferme avec Échap ou un clic à côté.
 * À partir de 1000 px, la même navigation s'affiche en ligne.
 *
 * Spectateur connecté : son prénom et « Se déconnecter », dans le menu sous 1000 px, à droite de
 * l'en-tête au-delà. Le bouton « Noter » reste grisé tant que les votes sont fermés.
 */
export function Entete({ generique = false, etat }: Props) {
  const publie = useInstantanePublic();
  const effectif = etat ?? publie.etat;
  const menu = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  // React Router pré-rend /classements à l'adresse « /classements/ » : sans la barre finale, la page
  // courante est reconnue dès le HTML pré-rendu (NavLink, option end, ne la reconnaissait pas, et
  // l'hydratation ne corrige pas un attribut).
  const chemin = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const { session, prenom } = useSession();
  const connecte = session !== null && !generique;
  // Connecté, de 1000 à 1300 px : la barre porte aussi le prénom et « Se déconnecter », la pastille de
  // la soirée n'y tient plus (débordement mesuré à 1000 px). La date reste sur la carte de l'accueil.
  const pastilleConnecte = connecte ? 'paysage:hidden bureau:inline-flex' : '';

  // Soirée de référence (la prochaine soirée du calendrier), quand la page affichée porte le
  // calendrier (accueil, puis Dates) : la pastille suit ainsi les mêmes données que la page.
  const donnees = useMatches()
    .map((m) => m.loaderData)
    .find(aCalendrier);
  const maintenant = useMaintenant(donnees?.lueLe ?? null);
  const soiree = donnees?.calendrier && maintenant ? soireeDeReference(donnees.calendrier, maintenant) : null;
  const ouvert = effectif === 'ouvert';

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
              <Link
                to={lien.vers}
                aria-current={!generique && chemin === lien.vers ? 'page' : undefined}
                className={CLASSE_LIEN}
              >
                <span className={CLASSE_PASTILLE}>{lien.libelle}</span>
              </Link>
            </li>
          ))}
        </ul>
        {connecte ? <CompteSpectateur prenom={prenom} variante="menu" /> : null}
      </nav>

      <div className="ml-auto flex items-center gap-2.5">
        {connecte ? <CompteSpectateur prenom={prenom} variante="barre" /> : null}
        {soiree && !generique ? (
          ouvert ? (
            <span className={`${CLASSE_PASTILLE_SOIREE} ${pastilleConnecte} bg-[rgba(194,59,29,.1)] text-rouge-alerte`}>
              <span aria-hidden="true" className="point-direct size-[7px] rounded-full bg-current" />
              Ce soir · {soiree.ville}
            </span>
          ) : (
            <span className={`${CLASSE_PASTILLE_SOIREE} ${pastilleConnecte} bg-lin text-encre-2`}>
              <Icone nom="calendrier" className="size-3" />
              Prochaine soirée · {formaterJourMois(soiree.date_soiree)}
            </span>
          )
        ) : null}
        {!generique && chemin === '/noter' ? null : ouvert ? (
          <Link
            to="/noter"
            className={`${CLASSE_NOTER} bg-couchant-bouton text-white shadow-[0_10px_24px_-10px_rgba(194,59,29,0.75),inset_0_1px_0_rgba(255,255,255,0.25)] transition-[filter,transform] hover:brightness-105 active:scale-[0.97]`}
          >
            Noter
          </Link>
        ) : (
          <>
            {/* Grisé hors soirée : atteignable au clavier, sans effet, avec sa raison en description. */}
            <button
              type="button"
              aria-disabled="true"
              aria-describedby={ID_RAISON_NOTER}
              className={`${CLASSE_NOTER} cursor-not-allowed bg-lin text-encre-2 shadow-[inset_0_0_0_1px_var(--color-trait)]`}
            >
              <Icone nom="cadenas" className="size-[15px]" />
              Noter
            </button>
            <span id={ID_RAISON_NOTER} hidden>
              Les votes ne sont pas encore ouverts : ils ouvriront le soir de l’Olympiade.
            </span>
          </>
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

/**
 * Prénom du spectateur connecté et « Se déconnecter » (session de cet appareil seulement).
 * Deux emplacements, un seul affiché à la fois : dans le menu sous 1000 px (« menu »), à droite de
 * l'en-tête au-delà (« barre »).
 */
function CompteSpectateur({ prenom, variante }: { prenom: string | null; variante: 'menu' | 'barre' }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const verrou = useRef(false);

  async function deconnecter() {
    if (verrou.current) return;
    verrou.current = true;
    setEnCours(true);
    setErreur(null);
    try {
      await seDeconnecter();
    } catch (echec) {
      setErreur(traduireErreurAuth(echec, 'demande'));
    } finally {
      verrou.current = false;
      setEnCours(false);
    }
  }

  const menu = variante === 'menu';
  return (
    <div
      className={
        menu
          ? 'mt-1 grid gap-1 border-t border-trait px-4 pt-2 paysage:hidden'
          : 'hidden max-w-[16rem] shrink-0 flex-col items-end paysage:flex'
      }
    >
      <div className={`flex items-center whitespace-nowrap ${menu ? 'justify-between gap-3' : 'gap-1'}`}>
        <span className={`truncate font-semibold text-encre ${menu ? 'text-base' : 'max-w-[9rem] text-sm'}`}>
          <span className="sr-only">Connecté : </span>
          {prenom}
        </span>
        <button
          type="button"
          onClick={deconnecter}
          disabled={enCours}
          className={`inline-flex min-h-12 items-center rounded-full font-medium text-encre-2 underline underline-offset-2 transition-colors hover:text-encre disabled:cursor-wait disabled:opacity-70 ${
            menu ? 'px-2 text-base' : 'px-2.5 text-[13.5px]'
          }`}
        >
          Se déconnecter
        </button>
      </div>
      <div role="alert">
        {erreur ? <p className="pb-1 text-[12.5px] leading-snug text-rouge">{erreur}</p> : null}
      </div>
    </div>
  );
}
