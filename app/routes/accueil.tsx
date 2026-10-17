import { PrecisionAccueil } from '../composants/PrecisionAccueil';
import { Affiche, CreditAffiche } from '../composants/Affiche';
import { BlocNoter } from '../composants/BlocNoter';
import { DernierVainqueur } from '../composants/DernierVainqueur';
import { Epreuves } from '../composants/Epreuves';
import { FormulaireContact } from '../composants/FormulaireContact';
import { ManadesEdition } from '../composants/ManadesEdition';
import { SaisonAccueil } from '../composants/SaisonAccueil';
import { VILLE_AFFICHE } from '../donnees/affiche';
import { prochaineSoireeA, soireeDeReference } from '../lib/accueil';
import { useInstantanePublic } from '../lib/contexte-etat';
import { lireDonneesVitrine, lireDonneesVitrineNavigateur, type DonneesVitrine } from '../lib/donnees-vitrine';
import { useRelectureApresInteraction } from '../lib/relecture';
import { useMaintenant } from '../lib/temps';
import type { Route } from './+types/accueil';

export const meta: Route.MetaFunction = () => [
  { title: 'Olympiade des Manades' },
  {
    name: 'description',
    content: 'Les Olympiades camarguaises : le public note les manades, en direct, aux côtés du jury. Saison 2027.',
  },
];

// Au build : données inscrites dans la page pré-rendue (lisible sans JavaScript). Une lecture qui
// échoue donne le repli, jamais un build en échec.
export async function loader(): Promise<DonneesVitrine> {
  return lireDonneesVitrine();
}

// Dans le navigateur, à la première interaction puis à chaque retour sur l'accueil : données fraîches
// (un palmarès complété apparaît sans redéploiement). Si Supabase ne répond pas, on garde celles du
// pré-rendu. Pas de lecture à l'hydratation si le pré-rendu est complet : la page s'affiche sans
// charger supabase-js (app/lib/relecture.ts).
export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs): Promise<DonneesVitrine> {
  return lireDonneesVitrineNavigateur(serverLoader);
}

export default function Accueil({ loaderData }: Route.ComponentProps) {
  const { calendrier, palmares, lueLe } = loaderData;
  const maintenant = useMaintenant(lueLe);
  const instantane = useInstantanePublic();
  useRelectureApresInteraction(loaderData);
  // Carte et pastille : la prochaine soirée du calendrier. L'affiche reste celle de Nîmes.
  const soiree = calendrier ? soireeDeReference(calendrier, maintenant) : null;
  const soireeAffiche = calendrier ? prochaineSoireeA(calendrier, VILLE_AFFICHE, maintenant) : null;

  return (
    <>
      <section
        aria-label="À l’affiche"
        className="grid gap-x-[18px] gap-y-3.5 px-4 pt-3.5 tablette:grid-cols-[1.12fr_1fr] tablette:px-7 tablette:pt-[22px] paysage:grid-cols-[1.5fr_1fr] paysage:gap-x-[22px] paysage:px-10 paysage:pt-[26px] bureau:px-14 bureau:pt-[30px]"
      >
        <Affiche soiree={soireeAffiche} />
        <BlocNoter
          etat={instantane.etat}
          soiree={soiree}
          calendrierDisponible={calendrier !== null}
          maintenant={maintenant}
          direct={instantane.etat === 'ouvert' && instantane.soiree ? {
            epreuve: instantane.soiree.epreuveEnCours ?? undefined,
            manadeEnPiste: instantane.soiree.manadeEnPiste ?? undefined,
          } : undefined}
        />
        <CreditAffiche className="-mt-2 px-1 tablette:-mt-2.5" />
      </section>

      <PrecisionAccueil />
      <ManadesEdition />
      <Epreuves />
      <DernierVainqueur palmares={palmares} />

      <div className="grid gap-3.5 px-4 pt-9 pb-1 tablette:grid-cols-[1.25fr_1fr] tablette:gap-[18px] tablette:px-7 tablette:pt-11 paysage:px-10 paysage:pt-14 bureau:px-14">
        <SaisonAccueil calendrier={calendrier} maintenant={maintenant} />
        <section aria-labelledby="titre-contact" className="rounded-[22px] border border-trait bg-creme p-5">
          <h2 id="titre-contact" className="font-display text-[21px] leading-[1.2] font-bold">
            Infos &amp; dates
          </h2>
          <p className="mt-1.5 text-[14px] text-encre-2">
            Infos, dates, une manade à inscrire, une photo à proposer&nbsp;: écrivez à l’organisation, elle vous répond.
          </p>
          <FormulaireContact />
        </section>
      </div>
    </>
  );
}
