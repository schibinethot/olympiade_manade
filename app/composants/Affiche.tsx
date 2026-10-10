import { EDITION_MANADES, VILLE_AFFICHE } from '../donnees/affiche';
import { AFFICHE, PHOTOS_ACCUEIL, RETOUCHE } from '../donnees/photos-accueil';
import { formaterJourMois } from '../lib/accueil';
import { formaterHeure } from '../lib/dates';
import type { Calendrier } from '../lib/donnees';

type Props = {
  /** Prochaine soirée de Nîmes d'après le calendrier ; sans elle, l'affiche n'annonce pas de date. */
  soiree: Calendrier | null;
};

const ID_CREDIT = 'credit-photo-affiche';

/**
 * Affiche de l'accueil (maquette : .affiche, charte section 5) : grande photo en duotone,
 * « ARÈNES DE NÎMES » en Playfair capitales, date en Playfair italique, titre au pinceau incliné
 * de −5°, manades en capitales séparées par des filets. Le titre est le h1 de la page.
 *
 * La photo est une <img> du HTML pré-rendu (et non un fond CSS, découvert après la feuille de style) :
 * c'est l'élément le plus grand du premier écran (LCP), chargé en priorité haute. Le duotone est
 * celui de .duo-calques (app/app.css).
 */
export function Affiche({ soiree }: Props) {
  const heure = soiree ? formaterHeure(soiree.heure) : null;
  return (
    <div className="relative isolate flex min-h-[470px] flex-col justify-between overflow-hidden rounded-[26px] px-5 pt-[22px] pb-[26px] text-white tablette:min-h-[560px] paysage:min-h-[600px] paysage:px-9 paysage:py-[34px] bureau:min-h-[640px]">
      <div className="absolute inset-0">
        <picture className="duo-calques block size-full">
          <source
            type="image/avif"
            media={AFFICHE.telephone.media}
            srcSet={AFFICHE.telephone.avif}
            width={AFFICHE.telephone.largeur}
            height={AFFICHE.telephone.hauteur}
          />
          <source
            type="image/webp"
            media={AFFICHE.telephone.media}
            srcSet={AFFICHE.telephone.webp}
            width={AFFICHE.telephone.largeur}
            height={AFFICHE.telephone.hauteur}
          />
          <source type="image/avif" srcSet={AFFICHE.entiere.avif} />
          <img
            src={AFFICHE.entiere.webp}
            width={AFFICHE.entiere.largeur}
            height={AFFICHE.entiere.hauteur}
            alt="Un gardian à cheval traverse un pré clos de barbelés, photo en duotone orangé"
            aria-describedby={ID_CREDIT}
            fetchPriority="high"
            className="object-[38%_42%]"
          />
        </picture>
      </div>
      {/* Voile en dégradé, en haut et en bas, pour la lisibilité des textes sur la photo
          (app/app.css, .voile-affiche). */}
      <div aria-hidden="true" className="voile-affiche absolute inset-0" />
      <div aria-hidden="true" className="grain absolute inset-0 opacity-30" />

      <div className="relative z-10 flex items-start justify-between gap-3 [text-shadow:0_0_2px_rgba(60,15,5,.7),0_1px_3px_rgba(60,15,5,.5),0_2px_16px_rgba(90,20,5,.55)]">
        <p className="font-display uppercase">
          <span className="mb-2 block pl-[3px] text-[10.5px] leading-none font-semibold tracking-[0.32em] paysage:mb-3 paysage:text-[13px]">
            Arènes de
          </span>{' '}
          <span className="block text-[46px] leading-[.92] font-extrabold tracking-[0.02em] [text-shadow:0_6px_26px_rgba(90,20,5,.35)] paysage:text-[74px]">
            {VILLE_AFFICHE}
          </span>
        </p>
        {soiree ? (
          <p className="border-l-[1.5px] border-white/70 pl-3 text-[14px] leading-[1.15] font-extrabold tracking-[0.04em] uppercase paysage:text-[20px]">
            <time dateTime={soiree.date_soiree}>
              {formaterJourMois(soiree.date_soiree)}
              {heure ? ` ${heure}` : ''}
            </time>{' '}
            <span className="mt-1 block font-display text-[30px] leading-none font-medium tracking-normal text-peche normal-case italic paysage:text-[44px]">
              {soiree.annee}
            </span>
          </p>
        ) : null}
      </div>

      <div className="relative z-10">
        <h1 className="flex -rotate-5 flex-col items-center leading-[.9] font-normal [text-shadow:0_8px_30px_rgba(90,20,5,.45)]">
          <span className="ml-[12%] self-start font-brush text-[26px] paysage:text-[38px]">Les grandes</span>{' '}
          <span className="font-brush text-[70px] tracking-[-0.01em] paysage:text-[132px]">Olympiades</span>{' '}
          <span className="mr-[10%] self-end font-brush text-[30px] paysage:text-[48px]">des Manades</span>
        </h1>
        <ul
          aria-label={`Manades de l’édition ${EDITION_MANADES.annee}`}
          className="mt-[18px] flex flex-wrap justify-center gap-y-1 text-[10.5px] leading-none font-extrabold tracking-[0.1em] text-[#ffe2c2] uppercase [text-shadow:0_1px_10px_rgba(70,15,0,.55)] paysage:gap-y-2 paysage:text-[13px]"
        >
          {EDITION_MANADES.manades.map((manade) => (
            <li
              key={manade}
              className="border-l border-[rgba(255,226,194,.6)] px-2 first:border-l-0 paysage:px-3.5"
            >
              {manade}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Crédit de la photo de l'affiche, juste dessous (licence CC BY-SA : auteur, licence, retouche). */
export function CreditAffiche({ className = '' }: { className?: string }) {
  const photo = PHOTOS_ACCUEIL.gardian;
  return (
    <p id={ID_CREDIT} className={`text-[11.5px] leading-snug text-encre-2 ${className}`}>
      Photo de l’affiche&nbsp;:{' '}
      <a href={photo.fiche} className="underline underline-offset-2 hover:text-encre">
        {photo.auteur}
      </a>
      ,{' '}
      <a href={photo.lienLicence} className="underline underline-offset-2 hover:text-encre" rel="license">
        {photo.licence}
      </a>
      , via Wikimedia Commons, {RETOUCHE}.
    </p>
  );
}
