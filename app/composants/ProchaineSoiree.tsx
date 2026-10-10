import { Link } from 'react-router';
import { instantSoiree, texteCompteARebours } from '../lib/accueil';
import { compteARebours } from '../lib/dates';
import type { Calendrier } from '../lib/donnees';
import { Icone } from './Icone';

type Props = {
  /** Prochaine soirée du calendrier, ou null s'il n'y en a plus. */
  soiree: Calendrier | null;
  /** Faux quand le calendrier n'a pas pu être lu : message de repli. */
  disponible: boolean;
  maintenant: Date;
};

const CERCLE =
  'inline-grid size-11 flex-none place-items-center rounded-full text-white shadow-[inset_0_0_0_1.5px_currentColor]';

/**
 * Encart du compte à rebours, dans la carte « Notez les Olympiades » (à la place de l'encart
 * « En piste » de la maquette, réservé à la soirée en cours) : « Dans 313 jours », puis le nom de
 * la soirée, avec la billetterie quand elle existe.
 */
export function ProchaineSoiree({ soiree, disponible, maintenant }: Props) {
  if (!disponible) {
    return (
      <div className="relative z-10 flex items-center gap-3 rounded-[18px] bg-[rgba(50,10,0,.24)] p-3">
        <span aria-hidden="true" className={CERCLE}>
          <Icone nom="calendrier" />
        </span>
        <p className="text-[14px] leading-snug font-semibold">Informations momentanément indisponibles</p>
      </div>
    );
  }

  if (!soiree) {
    return (
      <div className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[18px] bg-[rgba(50,10,0,.24)] p-3">
        <span aria-hidden="true" className={CERCLE}>
          <Icone nom="calendrier" />
        </span>
        <p className="min-w-0 flex-1 font-display text-[17px] leading-tight font-bold">Prochaines dates bientôt annoncées</p>
        <Link
          to="/dates"
          className="ml-auto inline-flex min-h-12 items-center gap-1 text-[13px] font-semibold underline underline-offset-2"
        >
          Voir les dates
        </Link>
      </div>
    );
  }

  const debut = instantSoiree(soiree.date_soiree, soiree.heure);
  const texte = texteCompteARebours(compteARebours(debut, maintenant));
  const nom = (
    <span className="block text-[12.5px] leading-[1.25] font-semibold text-balance">{soiree.nom}</span>
  );

  return (
    <div className="relative z-10 flex items-center gap-3 rounded-[18px] bg-[rgba(50,10,0,.24)] p-3">
      <span aria-hidden="true" className={CERCLE}>
        <Icone nom="horloge" />
      </span>
      <p className="flex-none">
        <span className="block text-[9.5px] leading-[1.2] font-bold tracking-[0.16em] uppercase">
          {texte ? 'Dans' : 'C’est'}
        </span>{' '}
        <time dateTime={debut.toISOString()} className="block font-display text-[22px] leading-[1.05] font-bold whitespace-nowrap italic">
          {texte ?? 'ce soir'}
        </time>
      </p>
      <div className="ml-auto min-w-0 max-w-[20ch] text-right">
        {soiree.lien_billetterie ? (
          <a
            href={soiree.lien_billetterie}
            className="group inline-flex min-h-12 flex-col items-end justify-center"
          >
            {nom}
            <span className="inline-flex items-center gap-1 text-[12px] underline underline-offset-2 group-hover:no-underline">
              Billetterie
              <Icone nom="externe" className="size-3" />
            </span>
          </a>
        ) : (
          nom
        )}
      </div>
    </div>
  );
}
