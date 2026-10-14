import { Link, useSearchParams, type ShouldRevalidateFunctionArgs } from 'react-router';
import { CarteResultat } from '../composants/CarteResultat';
import { Icone } from '../composants/Icone';
import { OngletsAnnee, idOnglet } from '../composants/OngletsAnnee';
import { TitrePage } from '../composants/TitrePage';
import { ClassementCalcule } from '../composants/ClassementCalcule';
import { anneeChoisie, anneesClassements, resultatsAnnee } from '../lib/classements';
import { useInstantanePublic } from '../lib/contexte-etat';
import { jourParis } from '../lib/dates';
import { lireDonneesVitrine, lireDonneesVitrineNavigateur, type DonneesVitrine } from '../lib/donnees-vitrine';
import { useHydrate } from '../lib/hydratation';
import { donneesRelues, useRelectureApresInteraction } from '../lib/relecture';
import { useMaintenant } from '../lib/temps';
import type { Route } from './+types/classements';

export const meta: Route.MetaFunction = () => [
  { title: 'Classements · Olympiade des Manades' },
  { name: 'description', content: 'Palmarès des Olympiades des manades : le vainqueur de chaque soirée, avec sa source.' },
];

// Au build : palmarès inscrit dans la page pré-rendue (lisible sans JavaScript, onglet par défaut).
export async function loader(): Promise<DonneesVitrine> {
  return lireDonneesVitrine();
}

// Dans le navigateur, à la première interaction puis à chaque navigation vers la page : palmarès
// frais, sinon celui du pré-rendu, sinon le message de repli. Pas de lecture à l'hydratation si le
// pré-rendu est complet (app/lib/relecture.ts).
export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs): Promise<DonneesVitrine> {
  return lireDonneesVitrineNavigateur(serverLoader);
}

// Changer d'onglet ne change que `?annee=` : les données déjà relues suffisent. Tant qu'elles ne
// le sont pas (premier clic de la visite sur un onglet, qui interrompt la relecture différée), le
// changement d'onglet les relit. La relecture elle-même (même adresse) passe toujours.
export function shouldRevalidate({ currentUrl, nextUrl, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  const changementOnglet = currentUrl.pathname === nextUrl.pathname && currentUrl.search !== nextUrl.search;
  return changementOnglet && donneesRelues() ? false : defaultShouldRevalidate;
}

const PANNEAU = 'panneau-classements';
const MARGES = 'px-4 tablette:px-7 paysage:px-10 bureau:px-14';
const GRILLE = 'grid gap-3 paysage:grid-cols-3';

/** Année sans résultat mais avec des soirées à venir : les classements viendront du direct. */
function AnneeEnDirect({ annee, soirees }: { annee: number; soirees: number }) {
  return (
    <div className="flex max-w-[44rem] gap-4 rounded-[22px] border border-trait bg-creme p-5 tablette:p-6">
      <span aria-hidden="true" className="grid size-11 flex-none place-items-center rounded-full bg-[rgba(194,59,29,.1)] text-rouge">
        <Icone nom="horloge" className="size-5" />
      </span>
      <div>
        <p className="font-display text-[20px] leading-[1.25] font-bold tablette:text-[22px]">
          Les classements {annee} s’afficheront en direct pendant les soirées&nbsp;: jury et prix du public.
        </p>
        {soirees ? (
          <Link
            to={`/dates#saison-${annee}`}
            className="mt-1 inline-flex min-h-12 items-center gap-1.5 text-[13.5px] font-semibold text-rouge hover:underline"
          >
            Les {soirees} dates {annee}
            <Icone nom="fleche" className="size-[15px]" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function Classements({ loaderData }: Route.ComponentProps) {
  const { calendrier, palmares, lueLe } = loaderData;
  const maintenant = useMaintenant(lueLe);
  useRelectureApresInteraction(loaderData);
  const hydrate = useHydrate();
  const [parametres, setParametres] = useSearchParams();

  const annees = anneesClassements(palmares, calendrier);
  const instantane = useInstantanePublic();
  const anneeDirect = instantane.soiree?.dateSoiree ? Number(instantane.soiree.dateSoiree.slice(0, 4)) : null;
  // La page pré-rendue ne connaît pas `?annee=` : l'hydratation reprend l'onglet par défaut, puis
  // l'adresse prend le relais.
  const annee = anneeChoisie(hydrate ? parametres.get('annee') : null, annees);
  const avecOnglets = annee !== null && annees.onglets.length > 1;
  const choisir = (choix: number) => setParametres({ annee: String(choix) }, { replace: true, preventScrollReset: true });

  const resultats = palmares && annee !== null ? resultatsAnnee(palmares, annee) : [];
  const aujourdhui = jourParis(maintenant);
  const soireesAnnee = calendrier?.filter((s) => s.annee === annee && s.statut !== 'annulee') ?? [];
  const aVenir = soireesAnnee.some((s) => s.date_soiree >= aujourdhui);

  return (
    <>
      <TitrePage
        surtitre="Palmarès"
        titre={annee !== null ? <>Classements <em>{annee}</em></> : 'Classements'}
        bas={
          avecOnglets ? <OngletsAnnee annees={annees.onglets} choisie={annee} onChoisir={choisir} panneau={PANNEAU} libelle="Année du palmarès" /> : null
        }
      >
        <p>Le vainqueur de chaque soirée, avec sa source. «&nbsp;À&nbsp;confirmer&nbsp;»&nbsp;: le résultat n’est pas encore vérifié.</p>
      </TitrePage>

      <div
        id={PANNEAU}
        role={avecOnglets ? 'tabpanel' : undefined}
        aria-labelledby={avecOnglets ? idOnglet(annee) : undefined}
        tabIndex={avecOnglets ? 0 : undefined}
        className={`${MARGES} mt-[18px] rounded-sm tablette:mt-[22px] paysage:mt-[26px]`}
      >
        {annee !== null ? <h2 className="sr-only">Palmarès {annee}</h2> : null}
        {!palmares ? (
          <p className="text-encre-2">Informations momentanément indisponibles. Réessayez dans un instant.</p>
        ) : resultats.length ? (
          <div className={GRILLE}>
            {resultats.map((resultat, rang) => (
              <CarteResultat key={resultat.id} resultat={resultat} aLaUne={rang === 0} />
            ))}
          </div>
        ) : annee !== null && instantane.soiree?.classements && anneeDirect === annee ? (
          <ClassementCalcule classements={instantane.soiree.classements} />
        ) : annee !== null && aVenir ? (
          <AnneeEnDirect annee={annee} soirees={soireesAnnee.length} />
        ) : (
          <p className="text-encre-2">Aucun résultat publié pour {annee ?? 'cette année'}.</p>
        )}
      </div>

      {palmares && annees.precedentes.length ? (
        <div className={`${MARGES} pt-10 paysage:pt-14`}>
          <details className="group rounded-[22px] border border-trait">
            <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-[22px] px-5 py-3 [&::-webkit-details-marker]:hidden">
              <h2 className="font-display text-[21px] leading-[1.2] font-bold">Éditions précédentes</h2>
              <span className="text-[13.5px] text-encre-2">{annees.precedentes.join(', ')}</span>
              <Icone nom="chevron" className="ml-auto size-5 text-encre-2 transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className={`${GRILLE} px-3 pb-3 tablette:px-4 tablette:pb-4`}>
              {annees.precedentes
                .flatMap((precedente) => resultatsAnnee(palmares, precedente))
                .map((resultat) => (
                  <CarteResultat key={resultat.id} resultat={resultat} />
                ))}
            </div>
          </details>
        </div>
      ) : null}
    </>
  );
}
