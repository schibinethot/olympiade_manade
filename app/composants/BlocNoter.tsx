import { useId } from 'react';
import { Link } from 'react-router';
import { momentSoiree } from '../lib/accueil';
import type { Calendrier } from '../lib/donnees';
import type { EtatSoiree } from '../lib/etat-soiree';
import { useSession } from '../lib/useSession';
import { Fer } from './Fer';
import { Icone } from './Icone';
import { ProchaineSoiree } from './ProchaineSoiree';

type Props = {
  etat: EtatSoiree;
  /** Prochaine soirée du calendrier, ou null s'il n'y en a plus. */
  soiree: Calendrier | null;
  /** Faux quand le calendrier n'a pas pu être lu. */
  calendrierDisponible: boolean;
  maintenant: Date;
  /** État « ouvert » (lot 2) : épreuve en cours et manade en piste, si elles sont connues. */
  direct?: { epreuve?: string; manadeEnPiste?: string; notes?: number };
};

const PASTILLE =
  'inline-flex items-center gap-[7px] rounded-full bg-white/16 py-1.5 pr-2.5 pl-[9px] text-[10.5px] leading-none font-bold tracking-[0.14em] whitespace-nowrap uppercase';
const BOUTON =
  'relative z-10 inline-flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[17px] bg-[#fffaf2] px-6 text-[16.5px] leading-none font-semibold whitespace-nowrap text-[#9a2c12] shadow-[0_14px_30px_-14px_rgba(60,10,0,.7)]';

/**
 * Carte « Notez les Olympiades » (maquette : .notez), premier bloc de l'accueil sur téléphone.
 *
 * Hors soirée, le bouton reste à sa place mais grisé (aria-disabled, sans navigation) et l'info
 * dessous dit pourquoi : date, heure et lieu de la prochaine soirée du calendrier.
 * Soirée ouverte (lot 2) : le bouton mène au vote, avec la pastille « En direct ».
 *
 * Inscription (Task 6) : possible avant la soirée (CDC 4.4). Sous la raison du bouton grisé, un lien
 * vers /inscription, ou, pour un spectateur déjà connecté, « Vous êtes inscrit… ». Le pré-rendu et
 * l'hydratation affichent le lien : la session n'est connue qu'ensuite, dans le navigateur.
 */
export function BlocNoter({ etat, soiree, calendrierDisponible, maintenant, direct }: Props) {
  const idTitre = useId();
  const idRaison = useId();
  const ouvert = etat === 'ouvert';
  const { session, prenom } = useSession();
  const inscrit = session !== null;

  return (
    <section
      aria-labelledby={idTitre}
      className="carte-notez relative isolate order-first flex flex-col gap-3 overflow-hidden rounded-[26px] px-5 pt-5 pb-[18px] text-white shadow-[0_24px_50px_-24px_rgba(170,46,23,.75)] tablette:order-none tablette:justify-between tablette:px-6 tablette:pt-[26px] tablette:pb-[22px] paysage:px-[30px] paysage:pt-8 paysage:pb-[26px]"
    >
      {/* Pas de grain ici : son « soft-light » éclaircit le fond et ferait passer le texte blanc sous
          4,5:1 (mesuré à 4,2:1 avec le grain). */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
        {ouvert ? (
          <p className={PASTILLE}>
            <span aria-hidden="true" className="point-direct size-[7px] rounded-full bg-current" />
            En direct
          </p>
        ) : (
          <p className={PASTILLE}>
            <Icone nom="calendrier" className="size-3" />
            Prochaine soirée
          </p>
        )}
        {ouvert && direct?.epreuve ? <p className="text-[12px] leading-[1.3] font-semibold">{direct.epreuve}</p> : null}
        {!ouvert && soiree ? (
          <p className="text-[12px] leading-[1.3] font-semibold">
            {soiree.ville}
            {soiree.statut === 'previsionnelle' ? ' · date prévisionnelle' : ''}
          </p>
        ) : null}
      </div>

      <div className="relative z-10">
        <h2 id={idTitre} className="mt-1 font-brush text-[46px] leading-[.95] font-normal paysage:text-[60px]">
          Notez les Olympiades
        </h2>
        <p className="mt-2.5 max-w-[36ch] text-[15px] leading-[1.45]">
          {ouvert
            ? 'Ce soir, le public note aussi. Donnez une note de 1 à 10 à chaque manade, dès la fin de son passage.'
            : 'Le soir de l’Olympiade, le public note aussi, aux côtés du jury.'}
        </p>
      </div>

      {ouvert ? (
        <>
          {/* Lien et non bouton : il navigue. Vers le vote une fois connecté, sinon vers l'inscription
              (le même parcours sert à se reconnecter). */}
          <Link
            to={inscrit ? '/noter' : '/inscription'}
            className={`${BOUTON} transition-[filter,transform] hover:brightness-105 active:scale-[0.97]`}
          >
            Je note les manades
            <Icone nom="fleche" />
          </Link>
          {inscrit ? null : (
            <p className="relative z-10 text-[13px] leading-[1.4]">
              Inscription en 30 secondes&nbsp;: prénom, email, code reçu.{' '}
              <Link to="/inscription" className="font-semibold underline underline-offset-2">
                Déjà inscrit&nbsp;?
              </Link>
            </p>
          )}
          {direct?.manadeEnPiste ? (
            <div className="relative z-10 flex items-center gap-3 rounded-[18px] bg-[rgba(50,10,0,.24)] p-3">
              <Fer manade={direct.manadeEnPiste} clair />
              <p>
                <span className="block text-[9.5px] leading-[1.2] font-bold tracking-[0.16em] uppercase">En piste</span>{' '}
                <span className="font-display text-[17px] leading-[1.2] font-bold">Manade {direct.manadeEnPiste}</span>
              </p>
              {direct.notes != null ? (
                <p className="ml-auto text-right text-[11.5px] leading-[1.1]">
                  <span className="block font-display text-[22px] leading-none font-bold italic tabular-nums">
                    {direct.notes.toLocaleString('fr-FR')}
                  </span>{' '}
                  notes
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <>
          {/* Grisé sans l'attribut disabled : le bouton reste atteignable au clavier, et sa
              description (aria-describedby) dit pourquoi il est inactif. Aucun effet au clic. */}
          <button
            type="button"
            aria-disabled="true"
            aria-describedby={idRaison}
            className={`${BOUTON} cursor-not-allowed opacity-[.62] shadow-none`}
          >
            Je note les manades
            <Icone nom="cadenas" className="size-[17px]" />
          </button>
          <p id={idRaison} className="relative z-10 text-[13.5px] leading-[1.45]">
            {raisonVotesFermes(soiree)}
          </p>
          {/* Texte blanc sur le fond de la carte : 4,5:1 au moins (tests/unit/contrastes.test.ts). */}
          {inscrit ? (
            <p className="relative z-10 flex items-center gap-1.5 text-[13.5px] leading-[1.45] font-semibold">
              <Icone nom="valide" className="size-4" />
              Vous êtes inscrit, à bientôt dans les arènes{prenom ? `, ${prenom}` : ''}
            </p>
          ) : (
            <Link
              to="/inscription"
              className="relative z-10 self-start py-2.5 text-[13.5px] leading-[1.45] font-semibold underline underline-offset-2"
            >
              Inscrivez-vous dès maintenant, vous serez prêt le soir venu
              <Icone nom="fleche" className="ml-1 inline size-4 align-[-3px]" />
            </Link>
          )}
          <ProchaineSoiree soiree={soiree} disponible={calendrierDisponible} maintenant={maintenant} />
        </>
      )}
    </section>
  );
}

/** « Les votes ouvriront le soir de l’Olympiade, le vendredi 20 août 2027 à 21h, aux arènes de Nîmes. … » */
function raisonVotesFermes(soiree: Calendrier | null): string {
  const suite = 'Vous noterez chaque manade de 1 à 10, dès la fin de son passage.';
  if (!soiree) return `Les votes ouvriront le soir de l’Olympiade. ${suite}`;
  return `Les votes ouvriront le soir de l’Olympiade, ${momentSoiree(soiree)}. ${suite}`;
}
