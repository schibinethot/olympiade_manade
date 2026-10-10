import { Affiche, CreditAffiche } from '../composants/Affiche';
import { BlocNoter } from '../composants/BlocNoter';
import { DernierVainqueur } from '../composants/DernierVainqueur';
import { Epreuves } from '../composants/Epreuves';
import { FormulaireContact } from '../composants/FormulaireContact';
import { ManadesEdition } from '../composants/ManadesEdition';
import { SaisonAccueil } from '../composants/SaisonAccueil';
import { VILLE_AFFICHE } from '../donnees/affiche';
import { prochaineSoireeA, type AvecCalendrier } from '../lib/accueil';
import { prochaineSoiree } from '../lib/dates';
import { lireCalendrier, lireOuRepli, lirePalmares, type Palmares } from '../lib/donnees';
import { ETAT_SOIREE } from '../lib/etat-soiree';
import { useMaintenant } from '../lib/temps';
import type { Route } from './+types/accueil';

export const meta: Route.MetaFunction = () => [
  { title: 'Olympiade des Manades' },
  {
    name: 'description',
    content: 'Les Olympiades camarguaises : le public note les manades, en direct, aux côtés du jury. Saison 2027.',
  },
];

type DonneesAccueil = AvecCalendrier & { palmares: Palmares[] | null };

async function lireDonneesAccueil(): Promise<DonneesAccueil> {
  const [calendrier, palmares] = await Promise.all([lireOuRepli(lireCalendrier), lireOuRepli(lirePalmares)]);
  return { calendrier, palmares, lueLe: new Date().toISOString() };
}

// Au build : données inscrites dans la page pré-rendue (lisible sans JavaScript). Une lecture qui
// échoue donne le repli, jamais un build en échec.
export async function loader(): Promise<DonneesAccueil> {
  return lireDonneesAccueil();
}

// Au chargement dans le navigateur, puis à chaque retour sur l'accueil : données fraîches (un palmarès
// complété apparaît sans redéploiement). Si Supabase ne répond pas, on garde celles du pré-rendu.
export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs): Promise<DonneesAccueil> {
  const frais = await lireDonneesAccueil();
  if (frais.calendrier && frais.palmares) return frais;
  const archive = await serverLoader().catch(() => null);
  return {
    calendrier: frais.calendrier ?? archive?.calendrier ?? null,
    palmares: frais.palmares ?? archive?.palmares ?? null,
    lueLe: frais.lueLe,
  };
}
clientLoader.hydrate = true as const;

export default function Accueil({ loaderData }: Route.ComponentProps) {
  const { calendrier, palmares, lueLe } = loaderData;
  const maintenant = useMaintenant(lueLe);
  const soiree = calendrier ? prochaineSoiree(calendrier, maintenant) : null;
  const soireeAffiche = calendrier ? prochaineSoireeA(calendrier, VILLE_AFFICHE, maintenant) : null;

  return (
    <>
      <section
        aria-label="À l’affiche"
        className="grid gap-x-[18px] gap-y-3.5 px-4 pt-3.5 tablette:grid-cols-[1.12fr_1fr] tablette:px-7 tablette:pt-[22px] paysage:grid-cols-[1.5fr_1fr] paysage:gap-x-[22px] paysage:px-10 paysage:pt-[26px] bureau:px-14 bureau:pt-[30px]"
      >
        <Affiche soiree={soireeAffiche} />
        <BlocNoter etat={ETAT_SOIREE} soiree={soiree} calendrierDisponible={calendrier !== null} maintenant={maintenant} />
        <CreditAffiche className="-mt-2 px-1 tablette:-mt-2.5" />
      </section>

      <ManadesEdition />
      <Epreuves />
      <DernierVainqueur palmares={palmares} />

      <div className="grid gap-3.5 px-4 pt-9 pb-1 tablette:grid-cols-[1.25fr_1fr] tablette:gap-[18px] tablette:px-7 tablette:pt-11 paysage:px-10 paysage:pt-14 bureau:px-14">
        <SaisonAccueil calendrier={calendrier} maintenant={maintenant} />
        <section aria-labelledby="titre-contact" className="rounded-[22px] border border-trait bg-creme p-5">
          <h2 id="titre-contact" className="font-display text-[21px] leading-[1.2] font-bold">
            Une question&nbsp;?
          </h2>
          <p className="mt-1.5 text-[14px] text-encre-2">
            Une manade à inscrire, une photo à proposer&nbsp;: l’organisation vous répond.
          </p>
          <FormulaireContact />
        </section>
      </div>
    </>
  );
}
