import type { ReactNode } from 'react';
import { Icone } from './Icone';

const ETAPES = ['Prénom et email', 'Code reçu'] as const;

type Props = {
  /** Étape en cours : 1 (prénom et email) ou 2 (code reçu). */
  etape: 1 | 2;
  children: ReactNode;
};

/**
 * Mise en page des deux pages d'inscription (maquette : écran spect:inscription, bloc .ins) :
 * photo des arènes en duotone, puis carte du formulaire qui la chevauche sur téléphone et tablette,
 * côte à côte à partir de 1000 px. L'étape 3 de la maquette (notifications) viendra avec le lot 2.
 */
export function CadreInscription({ etape, children }: Props) {
  return (
    <div className="grid paysage:min-h-[640px] paysage:grid-cols-[1.05fr_1fr]">
      <div className="duo photo-arenes relative isolate flex min-h-[230px] flex-col justify-end gap-2.5 overflow-hidden px-5 pt-7 pb-11 text-white [--position:50%_40%] tablette:min-h-[380px] tablette:px-10 tablette:pt-14 tablette:pb-[90px] paysage:min-h-full paysage:justify-center paysage:px-14 paysage:py-14">
        <div aria-hidden="true" className="voile-inscription absolute inset-0 -z-10" />
        <p className="text-[10.5px] leading-tight font-bold tracking-[0.2em] text-[#ffe2c2] uppercase">Notation du public</p>
        <p className="font-brush text-[40px] leading-[.98] tablette:text-[58px] paysage:text-[76px]">Le public note aussi</p>
        <p className="max-w-[34ch] text-[14px] leading-[1.45]">
          Donnez votre note à chaque manade, de 1 à 10, depuis les gradins.
        </p>
        <ul className="mt-2.5 hidden gap-2.5 text-[14px] paysage:grid">
          <Point icone="mail">Un code par email, pas de mot de passe</Point>
          <Point icone="calendrier">Inscription possible dès maintenant, avant la soirée</Point>
          <Point icone="trophee">Votre voix compte pour le Prix du public</Point>
        </ul>
      </div>

      <div className="relative z-10 -mt-[22px] flex flex-col gap-[18px] rounded-t-[26px] bg-sable px-[18px] pt-[22px] pb-[18px] tablette:mx-10 tablette:-mt-10 tablette:mb-10 tablette:rounded-[28px] tablette:p-[30px] tablette:shadow-[0_30px_70px_-30px_rgba(60,30,10,.35)] paysage:m-0 paysage:w-full paysage:max-w-[620px] paysage:justify-center paysage:justify-self-center paysage:rounded-none paysage:px-16 paysage:py-14 paysage:shadow-none">
        <ol aria-label="Étapes de l’inscription" className="grid grid-cols-2 gap-2">
          {ETAPES.map((libelle, index) => {
            const numero = index + 1;
            const etat = numero < etape ? 'faite' : numero === etape ? 'en-cours' : 'a-venir';
            return (
              <li
                key={libelle}
                aria-current={etat === 'en-cours' ? 'step' : undefined}
                className={`flex flex-col gap-[7px] text-[11.5px] leading-[1.25] font-semibold ${
                  etat === 'en-cours' ? 'text-encre' : 'text-encre-2'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`block h-1 w-full rounded-sm ${
                    etat === 'faite' ? 'bg-or' : etat === 'en-cours' ? 'bg-couchant-bouton' : 'bg-trait'
                  }`}
                />
                <span>
                  {numero}. {libelle}
                  {etat === 'faite' ? <span className="sr-only"> (faite)</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
        {children}
      </div>
    </div>
  );
}

function Point({ icone, children }: { icone: 'mail' | 'calendrier' | 'trophee'; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="grid size-[30px] place-items-center rounded-full bg-white/18">
        <Icone nom={icone} className="size-[18px]" />
      </span>
      {children}
    </li>
  );
}

/** Titre et texte d'introduction d'une étape (maquette : .ins-card h3 et .lead). */
export function TitreEtape({ titre, children }: { titre: string; children?: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <h1 className="font-display text-[26px] leading-[1.12] font-bold tablette:text-[30px]">{titre}</h1>
      {children ? <div className="text-[14.5px] leading-normal text-encre-2">{children}</div> : null}
    </div>
  );
}
