import { Fragment } from 'react';
import { Link } from 'react-router';
import { Fer } from '../composants/Fer';
import { Icone } from '../composants/Icone';
import { TitrePage } from '../composants/TitrePage';
import { FICHES_MANADES, type FicheManade, type SourceManade } from '../donnees/manades';
import { domaine } from '../lib/accueil';
import { lireDonneesVitrine, lireDonneesVitrineNavigateur, type DonneesVitrine } from '../lib/donnees-vitrine';
import { ficheManadeParSlug, lienFicheManade, resultatsManade, type ResultatManade, victoiresConfirmees } from '../lib/manades';
import { useRelectureApresInteraction } from '../lib/relecture';
import type { Palmares } from '../lib/donnees';
import type { Route } from './+types/manade';

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function dateResultat({ date_soiree, annee }: Pick<Palmares, 'date_soiree' | 'annee'>): string {
  if (!date_soiree) return String(annee);
  const [a, m, j] = date_soiree.split('-').map(Number);
  return DATE.format(new Date(Date.UTC(a, m - 1, j))).replace(/^1 /, '1er ');
}

function sourcesParId(fiche: FicheManade, ids: string[]): SourceManade[] {
  return ids.flatMap((id) => fiche.sources.filter((source) => source.id === id));
}

function LiensSources({ fiche, ids }: { fiche: FicheManade; ids: string[] }) {
  const sources = sourcesParId(fiche, ids);
  if (!sources.length) return null;
  return (
    <span className="ml-1 text-[11.5px] font-medium text-encre-2">
      ({sources.map((source, index) => (
        <Fragment key={source.id}>
          {index ? ', ' : ''}
          <a href={source.url} aria-label={`Source : ${source.titre}`} title={source.titre} className="underline underline-offset-2 hover:text-encre">source</a>
        </Fragment>
      ))})
    </span>
  );
}

function LibelleResultat({ resultat, victoire, rang, citation }: ResultatManade) {
  const { statut } = resultat;
  if (victoire) return <span className={statut === 'confirme' ? 'text-rouge' : 'text-rouge-alerte'}>{statut === 'confirme' ? 'Victoire confirmée' : 'Victoire à confirmer'}</span>;
  if (rang !== null) return <span className={statut === 'confirme' ? 'text-encre' : 'text-rouge-alerte'}>{rang === 1 ? '1re place' : `${rang}e place`}{statut === 'a_confirmer' ? ' · à confirmer' : ''}</span>;
  return citation ? <span className={statut === 'a_confirmer' ? 'text-rouge-alerte' : ''}>Citée dans le compte rendu{statut === 'a_confirmer' ? ' · à confirmer' : ''}</span> : null;
}

function Resultats({ fiche, palmares }: { fiche: FicheManade; palmares: Palmares[] | null }) {
  if (!palmares) return <p className="text-encre-2">Les résultats sont momentanément indisponibles. Réessayez dans un instant.</p>;
  const resultats = resultatsManade(palmares, fiche.nom);
  if (!resultats.length) return <p className="text-encre-2">Aucun résultat connu dans le palmarès publié.</p>;
  const victoires = victoiresConfirmees(palmares, fiche.nom);
  return (
    <>
      <p className="mb-4 text-[13.5px] text-encre-2">{victoires ? `${victoires} victoire${victoires > 1 ? 's' : ''} confirmée${victoires > 1 ? 's' : ''} dans le palmarès publié.` : 'Les rangs et comptes rendus publiés sont réunis ici.'}</p>
      <ol className="grid gap-3">
        {resultats.map(({ resultat, victoire, rang, citation }) => {
          const vainqueur = lienFicheManade(resultat.vainqueur);
          return (
            <li key={resultat.id} className="rounded-[18px] border border-trait bg-creme p-4">
              <div className="grid gap-3 tablette:grid-cols-[auto_minmax(0,1fr)] tablette:gap-4">
                <Fer manade={fiche.nom} taille="petit" />
                <div>
                  <p className="text-[10.5px] font-bold tracking-[.18em] text-or-ink uppercase">
                    {resultat.ville} · <time dateTime={resultat.date_soiree ?? String(resultat.annee)}>{dateResultat(resultat)}</time>
                  </p>
                  <h3 className="mt-1 font-display text-[20px] leading-tight font-bold">{resultat.evenement}</h3>
                  <p className="mt-1 text-[13.5px] font-semibold"><LibelleResultat resultat={resultat} victoire={victoire} rang={rang} citation={citation} /></p>
                  {citation ? (
                    <p className="mt-2 text-[13.5px] text-encre-2">
                      {resultat.statut === 'a_confirmer' ? 'Résultat à confirmer. ' : ''}Vainqueur global&nbsp;: {vainqueur ? <Link to={vainqueur} className="font-medium underline underline-offset-2">Manade {resultat.vainqueur}</Link> : `Manade ${resultat.vainqueur}`}.
                    </p>
                  ) : null}
                  {resultat.detail ? <p className="mt-2 text-[13.5px] text-encre-2">{resultat.detail}</p> : null}
                  <p className="mt-2 text-[12px] text-encre-2">
                    {resultat.source_url ? <a href={resultat.source_url} className="underline underline-offset-2 hover:text-encre">Source&nbsp;: {domaine(resultat.source_url) ?? 'article'}</a> : 'Source non renseignée'}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

export async function loader({ params }: Route.LoaderArgs): Promise<{ fiche: FicheManade; donnees: DonneesVitrine }> {
  const fiche = ficheManadeParSlug(params.slug ?? '');
  if (!fiche) throw new Response('Fiche introuvable', { status: 404 });
  return { fiche, donnees: await lireDonneesVitrine() };
}

export async function clientLoader({ params, serverLoader }: Route.ClientLoaderArgs): Promise<{ fiche: FicheManade; donnees: DonneesVitrine }> {
  const fiche = ficheManadeParSlug(params.slug ?? '');
  if (!fiche) throw new Response('Fiche introuvable', { status: 404 });
  return { fiche, donnees: await lireDonneesVitrineNavigateur(async () => (await serverLoader()).donnees) };
}

export const meta: Route.MetaFunction = ({ loaderData }) => {
  const fiche = loaderData?.fiche ?? null;
  if (!fiche) return [{ title: 'Page introuvable · Olympiade des Manades' }, { name: 'robots', content: 'noindex' }];
  const url = `https://olympiadedesmanades.fr/manades/${fiche.slug}`;
  return [
    { title: `Manade ${fiche.nom} · Olympiade des Manades` },
    { name: 'description', content: `${fiche.accroche} Découvrez la manade ${fiche.nom}, ses activités et ses résultats publiés.` },
    { tagName: 'link', rel: 'canonical', href: url },
    { property: 'og:url', content: url },
  ];
};

export default function Manade({ loaderData }: Route.ComponentProps) {
  const { fiche, donnees } = loaderData;
  useRelectureApresInteraction(donnees);
  return (
    <>
      <TitrePage surtitre={fiche.localisation} titre={<>Manade <em>{fiche.nom}</em></>}>
        <p>{fiche.accroche}</p>
      </TitrePage>
      <article className="px-4 pt-5 tablette:px-7 paysage:px-10 bureau:px-14">
        <section className="relative grid gap-5 overflow-hidden rounded-[26px] border border-trait bg-creme p-5 tablette:p-7 paysage:grid-cols-[auto_minmax(0,1fr)] paysage:items-start" aria-labelledby="presentation-manade">
          <Fer manade={fiche.nom} className="size-28 text-[58px] tablette:size-36 tablette:text-[72px]" />
          <div className="relative max-w-[66ch]">
            <h2 id="presentation-manade" className="font-display text-[26px] leading-tight font-bold">Qui sont-ils&nbsp;?</h2>
            <div className="mt-3 grid gap-3 text-[15px] leading-relaxed text-encre-2">
              {fiche.presentation.map((paragraphe) => <p key={paragraphe.texte}>{paragraphe.texte}<LiensSources fiche={fiche} ids={paragraphe.sources} /></p>)}
            </div>
            {fiche.siteOfficiel ? <a href={fiche.siteOfficiel.url} className="mt-5 inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-trait px-4 text-[13.5px] font-semibold hover:bg-lin">{fiche.siteOfficiel.libelle}<Icone nom="fleche" className="size-4" /></a> : null}
          </div>
        </section>

        <div className="mt-8 grid gap-8 paysage:grid-cols-2 paysage:items-start">
          <div>
            <section aria-labelledby="activites-manade">
              <h2 id="activites-manade" className="font-display text-[28px] leading-tight font-bold">Ce qu’ils font</h2>
              <div className="mt-4 grid gap-3">
                {fiche.activites.map((activite) => <article key={activite.titre} className="rounded-[18px] border border-trait bg-creme p-4"><h3 className="font-display text-[20px] font-bold">{activite.titre}</h3><p className="mt-1.5 text-[14px] leading-relaxed text-encre-2">{activite.texte}<LiensSources fiche={fiche} ids={activite.sources} /></p></article>)}
              </div>
            </section>
            {fiche.reperes.length ? (
              <section className="mt-8" aria-labelledby="reperes-manade">
                <h2 id="reperes-manade" className="font-display text-[28px] leading-tight font-bold">Repères</h2>
                <dl className="mt-4 grid gap-3">
                  {fiche.reperes.map((repere) => (
                    <div key={repere.libelle} className="rounded-[18px] border border-trait bg-lin p-4">
                      <dt className="text-[10.5px] font-bold tracking-[.18em] text-encre-2 uppercase">{repere.libelle}</dt>
                      <dd className="mt-1 font-semibold">{repere.valeur}<LiensSources fiche={fiche} ids={repere.sources} /></dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </div>
          <section aria-labelledby="resultats-manade"><h2 id="resultats-manade" className="font-display text-[28px] leading-tight font-bold">Résultats par événement</h2><div className="mt-4"><Resultats fiche={fiche} palmares={donnees.palmares} /></div></section>
        </div>

        <section className="mt-10 border-t border-trait pt-6" aria-labelledby="sources-manade"><h2 id="sources-manade" className="font-display text-[22px] font-bold">Sources</h2><p className="mt-1 text-[12.5px] text-encre-2">Consultées le {dateResultat({ date_soiree: fiche.verifieLe, annee: 0 })}.</p><ul className="mt-3 grid gap-2 text-[13.5px]">{fiche.sources.map((source) => <li key={source.id}><a href={source.url} className="underline underline-offset-2 hover:text-rouge">{source.titre}</a></li>)}</ul></section>
        <nav className="mt-8 pb-2" aria-label="Autres fiches de manades">
          <Link to="/manades" className="inline-flex min-h-12 items-center gap-1.5 text-[13.5px] font-semibold text-rouge hover:underline"><Icone nom="fleche" className="size-4 rotate-180" />Toutes les manades</Link>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] font-medium">
            {FICHES_MANADES.filter((autre) => autre.slug !== fiche.slug).map((autre) => <li key={autre.slug}><Link to={`/manades/${autre.slug}`} className="underline underline-offset-2 hover:text-rouge">{autre.nom}</Link></li>)}
          </ul>
        </nav>
      </article>
    </>
  );
}

export function ErrorBoundary() {
  return <TitrePage surtitre="Erreur 404" titre="Page introuvable"><p>Cette fiche de manade n’existe pas. <Link to="/manades" className="font-semibold text-rouge underline underline-offset-2">Voir les manades de l’édition</Link></p></TitrePage>;
}
