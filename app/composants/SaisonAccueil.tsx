import { Link } from 'react-router';
import { saisonAccueil, type EtatLigneSaison } from '../lib/accueil';
import { formaterHeure } from '../lib/dates';
import type { Calendrier } from '../lib/donnees';
import { Icone } from './Icone';

type Props = {
  /** Calendrier lu en base, ou null s'il n'a pas pu être lu : message de repli. */
  calendrier: Calendrier[] | null;
  maintenant: Date;
};

const PUCE = 'inline-flex items-center rounded-full px-2.5 py-1.5 text-[10px] leading-none font-bold tracking-[0.12em] whitespace-nowrap uppercase';

/**
 * Badge d'une soirée. Couleurs d'état de la charte (ok, alerte), assombries pour tenir 4,5:1 sur
 * leur fond teinté : #286b44 sur vert pâle 5,3:1, #985512 sur orangé pâle 4,87:1.
 */
function Badge({ soiree, etat }: { soiree: Calendrier; etat: EtatLigneSaison }) {
  if (etat === 'terminee') return <span className={`${PUCE} bg-lin text-encre-2`}>Terminée</span>;
  if (etat === 'annulee') return <span className={`${PUCE} bg-[rgba(194,59,29,.1)] text-rouge`}>Annulée</span>;
  return soiree.statut === 'confirmee' ? (
    <span className={`${PUCE} bg-[rgba(47,122,79,.12)] text-[#286b44]`}>Confirmée</span>
  ) : (
    <span className={`${PUCE} bg-[rgba(217,130,43,.14)] text-[#985512]`}>Date prévisionnelle</span>
  );
}

const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });

/**
 * Carte « Saison 2027 » de l'accueil (maquette : .card + .saison) : quatre soirées à partir de la
 * prochaine, mise en avant, et le lien vers toutes les dates.
 */
export function SaisonAccueil({ calendrier, maintenant }: Props) {
  const saison = calendrier ? saisonAccueil(calendrier, maintenant) : null;

  return (
    <section aria-labelledby="titre-saison" className="rounded-[22px] border border-trait bg-creme p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <h2 id="titre-saison" className="font-display text-[21px] leading-[1.2] font-bold">
          {saison ? `Saison ${saison.annee}` : 'Saison'}
        </h2>
        <Link to="/dates" className="inline-flex min-h-12 items-center gap-1.5 text-[13.5px] font-semibold text-rouge hover:underline">
          {saison ? `Les ${saison.total} dates` : 'Toutes les dates'}
          <Icone nom="fleche" className="size-[15px]" />
        </Link>
      </div>

      {!saison ? (
        <p className="mt-3 text-encre-2">
          {calendrier ? 'Les dates de la saison seront bientôt publiées.' : 'Informations momentanément indisponibles'}
        </p>
      ) : (
        <ul className="mt-1 grid gap-0.5">
          {saison.lignes.map(({ soiree, etat }) => {
            const [, mois, jour] = soiree.date_soiree.split('-').map(Number);
            const heure = formaterHeure(soiree.heure);
            const prochaine = etat === 'prochaine';
            return (
              <li
                key={soiree.id}
                className={`grid grid-cols-[56px_1fr] items-center gap-x-3 gap-y-1.5 border-t py-2.5 first:border-t-0 paysage:grid-cols-[56px_1fr_auto] ${
                  prochaine
                    ? '-mx-2 rounded-[14px] border-transparent bg-[linear-gradient(90deg,rgba(236,116,51,.12),transparent)] px-2'
                    : 'border-trait'
                }`}
              >
                <time
                  dateTime={soiree.date_soiree}
                  className="row-span-2 text-center font-display text-[24px] leading-none font-bold italic paysage:row-span-1"
                >
                  {jour}
                  <span className="block font-sans text-[9.5px] leading-[1.3] font-bold tracking-[0.14em] text-encre-2 uppercase not-italic">
                    {MOIS.format(new Date(Date.UTC(2000, mois - 1, 1)))}
                  </span>
                </time>
                <div className="min-w-0">
                  <p className="text-[14.5px] leading-snug font-semibold">
                    {soiree.ville}
                    {prochaine ? <span className="sr-only"> (prochaine soirée)</span> : null}
                  </p>
                  <p className="text-[12.5px] leading-snug text-encre-2">
                    {[soiree.arenes, heure].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="col-start-2 paysage:col-start-auto">
                  <Badge soiree={soiree} etat={etat} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
