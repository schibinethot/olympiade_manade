import { Link } from 'react-router';
import { CarteDate } from '../composants/CarteDate';
import { Icone } from '../composants/Icone';
import { CLASSE_ONGLET, ONGLET_ACTIF, ONGLET_INACTIF } from '../composants/OngletsAnnee';
import { TitrePage } from '../composants/TitrePage';
import { VILLE_AFFICHE } from '../donnees/affiche';
import { EPREUVES } from '../donnees/epreuves';
import { formaterJourMois } from '../lib/accueil';
import { noteProjections, sectionsDates, type LigneDate, type SectionDates } from '../lib/calendrier';
import { lireDonneesVitrine, lireDonneesVitrineNavigateur, type DonneesVitrine } from '../lib/donnees-vitrine';
import { useRelectureApresInteraction } from '../lib/relecture';
import { useMaintenant } from '../lib/temps';
import type { Route } from './+types/dates';

export const meta: Route.MetaFunction = () => [
  { title: 'Dates · Olympiade des Manades' },
  { name: 'description', content: 'Toutes les soirées d’Olympiades des manades : la saison à venir et les archives des années passées.' },
];

// Au build : calendrier inscrit dans la page pré-rendue (lisible sans JavaScript). Une lecture qui
// échoue donne le repli, jamais un build en échec.
export async function loader(): Promise<DonneesVitrine> {
  return lireDonneesVitrine();
}

// Dans le navigateur, à la première interaction puis à chaque navigation vers la page : calendrier
// frais, sinon celui du pré-rendu, sinon le message de repli. Pas de lecture à l'hydratation.
export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs): Promise<DonneesVitrine> {
  return lireDonneesVitrineNavigateur(serverLoader);
}

const lignesDe = (section: SectionDates): LigneDate[] => [...section.ceSoir, ...section.mois.flatMap((m) => m.lignes)];
const CLASSE_SECTION =
  'grid scroll-mt-[calc(env(safe-area-inset-top)+84px)] gap-[18px] px-4 tablette:px-7 paysage:grid-cols-[320px_minmax(0,1fr)] paysage:items-start paysage:gap-7 paysage:px-10 bureau:grid-cols-[360px_minmax(0,1fr)] bureau:px-14';
const CLASSE_ENTETE_SECTION = 'rounded-[24px] p-[22px] paysage:sticky paysage:top-[calc(env(safe-area-inset-top)+88px)]';
const CLASSE_MOIS = 'mb-2.5 text-[11px] leading-none font-bold tracking-[0.2em] text-or-ink uppercase';

/** Barre d'ancres vers chaque année, au style des onglets de la maquette. Rien n'y est masqué. */
function BarreAnnees({ sections }: { sections: SectionDates[] }) {
  return (
    <nav aria-label="Années du calendrier" className="mt-3.5">
      <ul className="flex flex-wrap gap-x-1.5">
        {sections.map((section, rang) => (
          <li key={section.id}>
            <a href={`#${section.id}`} className="group inline-flex min-h-12 items-center rounded-full">
              <span className={`${CLASSE_ONGLET} ${rang === 0 ? ONGLET_ACTIF : ONGLET_INACTIF}`}>
                {section.titre}
                <span className="font-medium tabular-nums">
                  ({section.total}
                  <span className="sr-only"> soirée{section.total > 1 ? 's' : ''}</span>)
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Statistique({ nombre, libelle }: { nombre: number; libelle: string }) {
  return (
    <li>
      <span className="block font-display text-[32px] leading-none font-bold italic">{nombre}</span>
      <span className="text-[11px]">{libelle}</span>
    </li>
  );
}

/** Carte de la saison (maquette : .season) : période, frise des mois, chiffres, dates prévisionnelles. */
function EnteteSaison({ section }: { section: SectionDates }) {
  const nimes = lignesDe(section).find((l) => l.soiree.ville === VILLE_AFFICHE && l.soiree.statut !== 'annulee')?.soiree;
  const note = noteProjections(section);
  return (
    <div className={`carte-saison text-white ${CLASSE_ENTETE_SECTION}`}>
      <h2 id={`titre-${section.id}`} className="font-brush text-[38px] leading-none font-normal">
        {section.titre}
      </h2>
      {section.premiere && section.derniere ? (
        <p className="mt-2 text-[13.5px]">
          Du {formaterJourMois(section.premiere.date_soiree)} au {formaterJourMois(section.derniere.date_soiree)}, au fil des fêtes
          votives.
          {nimes ? ` La plus grande soirée se tient aux arènes de Nîmes, le ${formaterJourMois(nimes.date_soiree)}.` : ''}
        </p>
      ) : null}

      <ul aria-label="Soirées par mois" className="mt-[18px] grid auto-cols-fr grid-flow-col gap-1.5">
        {section.frise.map((m) => (
          <li key={m.mois} className="flex flex-col gap-1.5 text-[10px] leading-none font-bold tracking-[0.14em] uppercase">
            <span
              aria-hidden="true"
              className={`flex h-11 items-end rounded-[10px] bg-[rgba(60,10,0,.22)] p-1.5 ${m.nombre > 6 ? 'gap-[2px]' : 'gap-[3px]'}`}
            >
              {Array.from({ length: m.nombre }, (_, i) => (
                <i key={i} className="h-full flex-1 rounded-[3px] bg-[#ffe2c2] opacity-90" />
              ))}
            </span>
            <span>
              {m.court}
              <span className="sr-only">
                {' '}
                : {m.nombre} soirée{m.nombre > 1 ? 's' : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <ul className="mt-[18px] flex flex-wrap gap-x-[18px] gap-y-2">
        <Statistique nombre={section.total} libelle={section.total > 1 ? 'soirées' : 'soirée'} />
        <Statistique nombre={section.confirmees} libelle={section.confirmees > 1 ? 'confirmées' : 'confirmée'} />
        <Statistique nombre={EPREUVES.length} libelle="épreuves par soirée" />
      </ul>

      {note ? (
        <p className="mt-[18px] flex gap-2.5 rounded-[14px] bg-[rgba(60,10,0,.22)] p-3 text-[13px] leading-snug">
          <Icone nom="horloge" className="mt-px size-4" />
          {note}
        </p>
      ) : null}
    </div>
  );
}

/** Carte d'une année passée : plus sobre que la saison, avec le lien vers son palmarès. */
function EnteteArchives({ section }: { section: SectionDates }) {
  // Soirées dont le palmarès donne un vainqueur, « à confirmer » compris.
  const resultats = lignesDe(section).filter((l) => l.vainqueur).length;
  return (
    // Lin à 50 % sur sable (#f3eee2) : le lien rouge y tient 4,61:1 (4,34:1 sur lin plein).
    <div className={`border border-trait bg-lin/50 ${CLASSE_ENTETE_SECTION}`}>
      <h2 id={`titre-${section.id}`} className="font-display text-[30px] leading-[1.05] font-bold">
        Archives <em className="text-rouge">{section.annee}</em>
      </h2>
      {section.premiere && section.derniere ? (
        <p className="mt-2 text-[13.5px] text-encre-2">
          Du {formaterJourMois(section.premiere.date_soiree)} au {formaterJourMois(section.derniere.date_soiree)} {section.annee}.
        </p>
      ) : null}
      <ul className="mt-4 flex flex-wrap gap-x-[18px] gap-y-2">
        <Statistique nombre={section.total} libelle={section.total > 1 ? 'soirées' : 'soirée'} />
        {resultats ? <Statistique nombre={resultats} libelle={resultats > 1 ? 'résultats connus' : 'résultat connu'} /> : null}
      </ul>
      {resultats ? (
        <Link
          to={`/classements?annee=${section.annee}`}
          className="mt-2 inline-flex min-h-12 items-center gap-1.5 text-[13.5px] font-semibold text-rouge hover:underline"
        >
          Le palmarès {section.annee}
          <Icone nom="fleche" className="size-[15px]" />
        </Link>
      ) : null}
    </div>
  );
}

function Groupe({ titre, lignes, pleineLargeur = false }: { titre: string; lignes: LigneDate[]; pleineLargeur?: boolean }) {
  return (
    <div>
      <h3 className={CLASSE_MOIS}>{titre}</h3>
      <ul className={`grid gap-2 ${pleineLargeur ? '' : 'paysage:grid-cols-2'}`}>
        {lignes.map((ligne) => (
          <li key={ligne.soiree.id}>
            <CarteDate ligne={ligne} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionAnnee({ section, premiere }: { section: SectionDates; premiere: boolean }) {
  return (
    <section
      id={section.id}
      aria-labelledby={`titre-${section.id}`}
      // Écart en marge, pas en remplissage : une ancre (#archives-2026) pose ainsi le haut de la carte
      // juste sous l'en-tête collant, et non 48 à 64 px plus bas.
      className={`${CLASSE_SECTION} ${premiere ? 'mt-[18px] tablette:mt-[22px] paysage:mt-[26px]' : 'mt-12 paysage:mt-16'}`}
    >
      {section.type === 'saison' ? <EnteteSaison section={section} /> : <EnteteArchives section={section} />}
      <div className="grid gap-[22px]">
        {section.ceSoir.length ? <Groupe titre="Ce soir" lignes={section.ceSoir} pleineLargeur /> : null}
        {section.mois.map((m) => (
          <Groupe key={m.mois} titre={m.libelle} lignes={m.lignes} />
        ))}
      </div>
    </section>
  );
}

export default function Dates({ loaderData }: Route.ComponentProps) {
  const { calendrier, palmares, lueLe } = loaderData;
  const maintenant = useMaintenant(lueLe);
  useRelectureApresInteraction(loaderData);
  const sections = calendrier ? sectionsDates(calendrier, palmares, maintenant) : [];
  const saison = sections.find((s) => s.type === 'saison');

  return (
    <>
      <TitrePage
        surtitre="Calendrier"
        titre={saison ? <>Dates <em>{saison.annee}</em></> : 'Dates'}
        bas={sections.length > 1 ? <BarreAnnees sections={sections} /> : null}
      >
        <p>Les soirées d’Olympiades dans le Gard, l’Hérault et les Bouches-du-Rhône, de la saison à venir aux années passées.</p>
      </TitrePage>

      {!calendrier ? (
        <p className="px-4 pt-6 text-encre-2 tablette:px-7 paysage:px-10 bureau:px-14">
          Informations momentanément indisponibles. Réessayez dans un instant.
        </p>
      ) : sections.length === 0 ? (
        <p className="px-4 pt-6 text-encre-2 tablette:px-7 paysage:px-10 bureau:px-14">Les dates de la saison seront bientôt publiées.</p>
      ) : (
        sections.map((section, rang) => <SectionAnnee key={section.id} section={section} premiere={rang === 0} />)
      )}
    </>
  );
}
