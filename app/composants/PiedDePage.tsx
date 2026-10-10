import { Link } from 'react-router';
import { Logo } from './Logo';
import { SignatureTpmge } from './SignatureTpmge';

// Liens hors landmark <nav> : la navigation principale reste la seule
// région « navigation » de la page.
const LIENS = [
  { vers: '/mentions-legales', libelle: 'Mentions légales' },
  { vers: '/confidentialite', libelle: 'Confidentialité' },
  { vers: '/contact', libelle: 'Contact' },
] as const;

const CARTE =
  'flex flex-col gap-2.5 rounded-[18px] bg-[rgba(255,240,220,0.05)] px-[18px] py-4 shadow-[inset_0_0_0_1px_var(--trait-nuit)]';
const SURTITRE = 'text-[9.5px] leading-none font-bold tracking-[0.2em] text-or-clair uppercase';

/**
 * Pied de page du site (maquette : bloc .pf, fond nuit). Ordre imposé par la charte, section 8 :
 * partenaire officiel Atch Élevage, mention de collaboration, liens, puis signature TPMGE.
 */
export function PiedDePage() {
  return (
    <footer className="mt-12 grid gap-6 bg-nuit px-4 pt-9 pb-[calc(28px+env(safe-area-inset-bottom))] text-nuit-txt tablette:grid-cols-[1.2fr_1fr] tablette:px-7 tablette:pt-11 paysage:grid-cols-[1.3fr_1fr_1fr] paysage:px-10 paysage:pt-14 paysage:pb-8 bureau:px-14">
      <div className="tablette:col-span-full paysage:col-span-1">
        <Logo fond="sombre" />
        <p className="mt-2.5 max-w-[34ch] text-[13.5px] text-nuit-mute">
          Le public note les manades, en direct, aux côtés du jury. Saison 2027 des Olympiades camarguaises.
        </p>
      </div>

      <div className={CARTE}>
        <p className={SURTITRE}>Partenaire officiel</p>
        <p className="inline-flex items-center gap-1.5 text-[11px] leading-none font-bold tracking-[0.16em] uppercase">
          <img
            src="/marques/atch-ecru.svg"
            alt="Atch"
            width={50}
            height={20}
            loading="lazy"
            decoding="async"
            className="h-5 w-auto"
          />
          Élevage
        </p>
        <p className="text-[12.5px] leading-[1.45] text-nuit-mute">
          Atch Élevage, sponsor de l’Olympiade des Manades&nbsp;: cheptel, filiation et génétique des chevaux et des
          bovins.
        </p>
      </div>

      <div className={CARTE}>
        <p className={SURTITRE}>Application</p>
        <p className="text-[12.5px] leading-[1.45] text-nuit-mute">Conçue en collaboration avec Atch Élevage et TPMGE.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-[var(--trait-nuit)] pt-3 tablette:col-span-full">
        <ul className="flex flex-wrap gap-x-[18px] text-[13.5px] text-nuit-mute">
          {LIENS.map((lien) => (
            <li key={lien.vers}>
              <Link
                to={lien.vers}
                className="inline-flex min-h-12 items-center underline-offset-4 transition-colors hover:text-nuit-txt hover:underline"
              >
                {lien.libelle}
              </Link>
            </li>
          ))}
        </ul>
        <SignatureTpmge />
      </div>

      <p className="-mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[11.5px] text-nuit-mute tablette:col-span-full">
        <span>© {__ANNEE_PUBLICATION__} Olympiade des Manades</span>
        <span>Aucun traceur publicitaire</span>
      </p>
    </footer>
  );
}
