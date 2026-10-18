import { Link, useSearchParams, type ShouldRevalidateFunctionArgs } from 'react-router';
import { Icone } from '../composants/Icone';
import { LigneResultat } from '../composants/LigneResultat';
import { OngletsAnnee, idOnglet } from '../composants/OngletsAnnee';
import { SoireesGagnees } from '../composants/SoireesGagnees';
import { TitrePage } from '../composants/TitrePage';
import { ClassementCalcule } from '../composants/ClassementCalcule';
import { VainqueurAlaUne } from '../composants/VainqueurAlaUne';
import {
  anneeChoisie,
  anneesClassements,
  nombreResultatsConfirmes,
  resultatsAnnee,
  soireesGagneesParManade,
} from '../lib/classements';
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

/** Année sans résultat mais avec des soirées à venir : les classements viendront du direct. */
function AnneeEnDirect({ annee, soirees }: { annee: number; soirees: number }) {
  return (
    <section
      aria-labelledby="titre-direct"
      className="carte-saison relative isolate overflow-hidden rounded-[22px] p-6 text-white tablette:p-8 paysage:p-10"
    >
      <div aria-hidden="true" className="grain absolute inset-0" />
      <p className="relative text-[10.5px] leading-[1.25] font-bold tracking-[0.2em] uppercase text-white/80">
        En direct
      </p>
      <h2
        id="titre-direct"
        className="relative mt-2 max-w-[32ch] font-display text-[26px] leading-[1.15] font-bold tablette:text-[32px] paysage:text-[36px]"
      >
        Les classements {annee} s’afficheront en direct pendant les soirées&nbsp;: jury et prix du public.
      </h2>
      {soirees ? (
        <Link
          to={`/dates#saison-${annee}`}
          className="relative mt-5 inline-flex min-h-12 items-center gap-1.5 rounded-full bg-white/15 px-5 text-[14px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/25"
        >
          Les {soirees} dates {annee}
          <Icone nom="fleche" className="size-[15px]" />
        </Link>
      ) : null}
    </section>
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
  const soirDirect = annee !== null && anneeDirect === annee ? instantane.soiree : null;
  const classementDirect = soirDirect?.classements ?? null;
  const aujourdhui = jourParis(maintenant);
  const soireesAnnee = calendrier?.filter((s) => s.annee === annee && s.statut !== 'annulee') ?? [];
  const aVenir = soireesAnnee.some((s) => s.date_soiree >= aujourdhui);

  // Vainqueur à la une : premier résultat de l'année, hors période de classement en direct.
  const aLaUne = !classementDirect && resultats.length ? resultats[0] : null;
  const autresResultats = aLaUne ? resultats.slice(1) : resultats;
  // Rangée des victoires de l'année (masquée s'il y a moins de 2 résultats confirmés).
  const victoires = palmares && annee !== null ? soireesGagneesParManade(palmares, annee) : [];
  const afficherVictoires =
    palmares !== null && annee !== null && nombreResultatsConfirmes(palmares, annee) >= 2 && victoires.length > 0;

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
        className={`${MARGES} mt-[18px] space-y-10 rounded-sm tablette:mt-[22px] tablette:space-y-12 paysage:mt-[26px] paysage:space-y-14`}
      >
        {annee !== null ? <h2 className="sr-only">Palmarès {annee}</h2> : null}

        {classementDirect ? (
          <section aria-labelledby="titre-direct-calcule">
            <h2 id="titre-direct-calcule" className="font-display text-[26px] leading-tight font-bold tablette:text-[30px]">
              Classement calculé <span className="text-encre-2">·</span> {soirDirect?.nom}
            </h2>
            <p className="mt-2 max-w-[62ch] text-[14px] text-encre-2">
              Relecture de l’instantané public, selon le réglage de visibilité de la soirée.
            </p>
            <div className="mt-5">
              <ClassementCalcule classements={classementDirect} />
            </div>
          </section>
        ) : null}

        {!palmares ? (
          <p className="text-encre-2">Informations momentanément indisponibles. Réessayez dans un instant.</p>
        ) : aLaUne ? (
          <VainqueurAlaUne resultat={aLaUne} />
        ) : null}

        {afficherVictoires ? <SoireesGagnees annee={annee!} victoires={victoires} /> : null}

        {palmares && autresResultats.length ? (
          <section aria-labelledby="titre-soirees">
            <div className="mb-2 flex items-end justify-between gap-4">
              <h2
                id="titre-soirees"
                className="font-display text-[22px] leading-[1.2] font-bold tablette:text-[26px]"
              >
                Soirée par soirée
              </h2>
              <span className="hidden text-[12px] text-encre-2 tablette:inline">
                {autresResultats.length} {autresResultats.length > 1 ? 'soirées' : 'soirée'}
              </span>
            </div>
            <ul className="divide-y divide-trait rounded-[22px] border border-trait bg-creme px-5 py-1 tablette:px-7 paysage:px-9">
              {autresResultats.map((resultat) => (
                <li key={resultat.id}>
                  <LigneResultat resultat={resultat} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {palmares && !aLaUne && !autresResultats.length && !classementDirect ? (
          annee !== null && aVenir ? (
            <AnneeEnDirect annee={annee} soirees={soireesAnnee.length} />
          ) : (
            <p className="text-encre-2">Aucun résultat publié pour {annee ?? 'cette année'}.</p>
          )
        ) : null}
      </div>

      {palmares && annees.precedentes.length ? (
        <div className={`${MARGES} pt-10 paysage:pt-14`}>
          <details className="group rounded-[22px] border border-trait bg-creme/60">
            <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-[22px] px-5 py-3 [&::-webkit-details-marker]:hidden">
              <h2 className="font-display text-[21px] leading-[1.2] font-bold">Éditions précédentes</h2>
              <span className="text-[13.5px] text-encre-2">{annees.precedentes.join(', ')}</span>
              <Icone nom="chevron" className="ml-auto size-5 text-encre-2 transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <ul className="divide-y divide-trait px-5 pt-1 pb-3 tablette:px-7">
              {annees.precedentes
                .flatMap((precedente) => resultatsAnnee(palmares, precedente))
                .map((resultat) => (
                  <li key={resultat.id}>
                    <LigneResultat resultat={resultat} niveau={4} />
                  </li>
                ))}
            </ul>
          </details>
        </div>
      ) : null}
    </>
  );
}
