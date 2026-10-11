import type { LigneDate } from '../lib/calendrier';
import { formaterDateLongue, formaterHeure } from '../lib/dates';
import { BadgeSoiree } from './BadgeSoiree';
import { Icone } from './Icone';

const MOIS = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });

/**
 * Une soirée du calendrier (maquette : .dr). Le pavé de gauche (jour en Playfair italique, mois)
 * sert au survol de la liste ; la date complète est écrite dans la carte.
 * - Soirée du jour : fond couchant et bouton « Billetterie » blanc (maquette : .dr.now).
 * - Prochaine soirée : teinte couchant légère, comme sur l'accueil.
 * - Soirée passée : carte à plat, sans fond (la maquette l'estompait à 62 %, ce qui faisait tomber
 *   le texte sous 4,5:1).
 * La carte est son propre conteneur : badge et billetterie passent à droite dès qu'elle a la place.
 */
export function CarteDate({ ligne }: { ligne: LigneDate }) {
  const { soiree, etat, vainqueur } = ligne;
  const ceSoir = etat === 'ce-soir';
  const prochaine = etat === 'prochaine';
  const passee = etat === 'terminee' || etat === 'annulee';
  const [, mois, jour] = soiree.date_soiree.split('-').map(Number);
  const heure = formaterHeure(soiree.heure);
  const billetterie = !passee ? soiree.lien_billetterie : null;

  const fond = ceSoir
    ? 'carte-saison border-transparent text-white shadow-[0_18px_40px_-20px_rgba(169,46,23,.8)]'
    : prochaine
      ? 'border-[rgba(194,59,29,.3)] bg-creme bg-[linear-gradient(90deg,rgba(236,116,51,.12),transparent_70%)]'
      : passee
        ? 'border-trait'
        : 'border-trait bg-creme';
  // Sur le fond couchant, blanc plein : à 90 %, le texte tombait à 3,98:1.
  const secondaire = ceSoir ? 'text-white' : 'text-encre-2';

  return (
    <article className={`@container h-full rounded-[18px] border ${fond}`}>
      <div className="grid h-full grid-cols-[56px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2.5 py-3 pr-3.5 pl-2.5 @min-[30rem]:grid-cols-[64px_minmax(0,1fr)_auto]">
        <p
          aria-hidden="true"
          className={`row-span-2 self-stretch border-r pr-2.5 text-center @min-[30rem]:row-span-1 ${ceSoir ? 'border-white/35' : 'border-trait'}`}
        >
          <span className="flex h-full flex-col items-center justify-center">
            <span className={`font-display text-[30px] leading-none font-bold italic ${passee ? 'text-encre-2' : ''}`}>
              {jour}
              {jour === 1 ? <sup className="text-[.45em]">er</sup> : null}
            </span>
            <span className={`mt-1.5 text-[9.5px] leading-[1.2] font-bold tracking-[0.14em] uppercase ${secondaire}`}>
              {MOIS.format(new Date(Date.UTC(2000, mois - 1, 1)))}
            </span>
          </span>
        </p>

        <div className="min-w-0">
          {prochaine ? (
            <p className="mb-0.5 text-[10.5px] leading-tight font-bold tracking-[0.14em] text-rouge uppercase">Prochaine soirée</p>
          ) : null}
          <h4 className="text-[15px] leading-[1.25] font-bold">{soiree.ville}</h4>
          <p className={`mt-0.5 text-[13px] leading-snug font-medium ${ceSoir ? 'text-white' : 'text-encre'}`}>
            <time dateTime={soiree.date_soiree}>{formaterDateLongue(soiree.date_soiree)}</time>
            {heure ? <> · {heure}</> : null}
          </p>
          <p className={`mt-0.5 text-[12.5px] leading-snug ${secondaire}`}>{[soiree.nom, soiree.arenes].filter(Boolean).join(' · ')}</p>
          {vainqueur ? (
            <p className="mt-1.5 text-[13px] leading-snug">
              <span className={secondaire}>Vainqueur&nbsp;:</span> <span className="font-semibold">{vainqueur.nom}</span>
              {vainqueur.aConfirmer ? <span className={secondaire}> (à confirmer)</span> : null}
            </p>
          ) : null}
        </div>

        <div className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-1 @min-[30rem]:col-start-auto @min-[30rem]:flex-col @min-[30rem]:items-end">
          <BadgeSoiree soiree={soiree} etat={etat} />
          {billetterie ? (
            <a
              href={billetterie}
              target="_blank"
              rel="noopener noreferrer"
              className={
                ceSoir
                  ? 'inline-flex min-h-12 items-center gap-1.5 rounded-[11px] bg-[#fffaf2] px-3.5 text-[13.5px] font-semibold text-[#9a2c12] shadow-[0_14px_30px_-14px_rgba(60,10,0,.7)]'
                  : 'inline-flex min-h-12 items-center gap-1.5 text-[13.5px] font-semibold text-rouge hover:underline'
              }
            >
              Billetterie
              <span className="sr-only"> pour {soiree.ville} (nouvel onglet)</span>
              <Icone nom="externe" className="size-[14px]" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
