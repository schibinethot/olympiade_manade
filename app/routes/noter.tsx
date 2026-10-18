import { useState } from 'react';
import { Link } from 'react-router';
import { Epreuves } from '../composants/Epreuves';
import { Fer } from '../composants/Fer';
import { Icone } from '../composants/Icone';
import { NotationPublic } from '../composants/NotationPublic';
import { ProchaineSoiree } from '../composants/ProchaineSoiree';
import { momentSoiree, soireeDeReference, type AvecCalendrier } from '../lib/accueil';
import { useInstantanePublic } from '../lib/contexte-etat';
import { lireCalendrier, lireOuRepli, type Calendrier } from '../lib/donnees';
import { DELAI_LECTURE_NAVIGATEUR_MS } from '../lib/donnees-vitrine';
import { INSCRIPTION_OUVERTE, TEXTE_INSCRIPTIONS_FERMEES } from '../lib/inscription-ouverte';
import { useMaintenant } from '../lib/temps';
import { useSession } from '../lib/useSession';
import type { Route } from './+types/noter';

export const meta: Route.MetaFunction = () => [
  { title: 'Noter les manades · Olympiade des Manades' },
  { name: 'robots', content: 'noindex' },
];

// Route sans pré-rendu : le calendrier est lu dans le navigateur, pour la date de la prochaine
// soirée de Nîmes (et la pastille de l'en-tête). Supabase injoignable : la page reste lisible, sans date.
export async function clientLoader(): Promise<AvecCalendrier> {
  const calendrier = await lireOuRepli(() => lireCalendrier(AbortSignal.timeout(DELAI_LECTURE_NAVIGATEUR_MS)));
  return { calendrier, lueLe: new Date().toISOString() };
}

/* ============================================================
   Aperçu interactif du vote : état local uniquement, aucun appel réseau
   ============================================================ */

function AperçuVote() {
  const [choix, setChoix] = useState<number | null>(null);

  return (
    <fieldset
      aria-label="Exemple de vote : cet aperçu n'envoie rien"
      className="relative rounded-[22px] border border-white/20 bg-nuit-2 p-4 tablette:p-5"
    >
      {/* La légende doit être le premier enfant direct du fieldset. Flottante, elle reste dans la
          carte au lieu de se poser sur la bordure (rendu natif d'une légende). */}
      <legend className="float-left mb-4 flex w-full items-center justify-between">
        <span className="font-semibold text-[11px] tracking-[0.16em] text-or-clair uppercase">
          Exemple
        </span>
        <span className="text-[11px] text-nuit-mute">Aucun envoi réel</span>
      </legend>

      {/* En-tête épreuve */}
      <div className="clear-both mb-4">
        <p className="text-[10.5px] font-bold tracking-[0.2em] text-or-clair uppercase">
          Épreuve 1 · Ferrade en piste
        </p>
        <div className="mt-2 flex items-center gap-3">
          <Fer manade="Vinuesa" clair />
          <p className="font-display text-[20px] font-bold text-nuit-txt leading-tight">
            Manade Vinuesa
          </p>
        </div>
      </div>

      {/* Grille de notes */}
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} sur 10`}
            aria-pressed={choix === n}
            onClick={() => setChoix(n === choix ? null : n)}
            className={[
              'min-h-12 rounded-xl border text-lg font-display font-bold italic tabular-nums transition-colors',
              choix === n
                ? 'bg-couchant-bouton border-transparent text-white shadow-[0_6px_16px_-6px_rgba(170,46,23,.6)]'
                : 'border-white/20 bg-white/8 text-nuit-txt hover:border-white/40 hover:bg-white/14',
            ].join(' ')}
          >
            {n}
          </button>
        ))}
      </div>

      {/* Ligne d'état */}
      <p
        role="status"
        className={[
          'mt-4 min-h-5 text-[12.5px] leading-[1.3]',
          choix ? 'text-nuit-txt' : 'text-nuit-mute',
        ].join(' ')}
      >
        {choix
          ? `Exemple : ${choix}/10. Le soir venu, ce choix sera envoyé.`
          : 'Choisissez une note pour la tester.'}
      </p>
    </fieldset>
  );
}

/* ============================================================
   Section « Comment ça se passe » : 4 étapes numérotées
   ============================================================ */

const ETAPES = [
  {
    num: '1',
    titre: 'Inscrivez-vous',
    texte:
      'Donnez votre prénom et votre email. Vous recevez un code à 6 chiffres. Vous restez connecté sur cet appareil pour toute la saison.',
  },
  {
    num: '2',
    titre: 'Activez les notifications',
    texte:
      "Le site vous prévient quand une manade peut être notée. Sur iPhone, ajoutez d’abord le site à votre écran d’accueil.",
  },
  {
    num: '3',
    titre: 'Notez à chaud',
    texte:
      'Dès la fin de chaque passage, donnez une note de 1 à 10. Vous pouvez la corriger tant que le vote est ouvert ; il se ferme automatiquement quelques minutes après.',
  },
  {
    num: '4',
    titre: 'Prix du public',
    texte:
      'Vos notes forment le Prix du public, affiché à côté du classement du jury.',
  },
] as const;

function CommentCaSePasseSec() {
  return (
    <section
      aria-labelledby="titre-comment"
      className="px-4 pt-12 pb-4 tablette:px-7 tablette:pt-16 paysage:px-10 bureau:px-14"
    >
      <p className="text-[10.5px] font-bold tracking-[0.2em] text-or-ink uppercase">
        Le vote du public
      </p>
      <h2
        id="titre-comment"
        className="mt-1.5 font-display text-[28px] font-bold leading-[1.08] tracking-[-0.01em] tablette:text-[34px] paysage:text-[40px]"
      >
        Comment ça se passe
      </h2>

      <ol className="mt-8 grid gap-0 tablette:grid-cols-2 paysage:grid-cols-4">
        {ETAPES.map((etape, i) => (
          <li
            key={etape.num}
            className={[
              'relative pt-3 pb-6 pr-4',
              // filet gauche à partir de la 2e étape sur mobile, filet haut pour toutes sur bureau
              i > 0
                ? 'border-t border-trait paysage:border-t-0 paysage:border-l paysage:pl-8 paysage:pr-0 tablette:border-t-0 tablette:border-l tablette:pl-8 tablette:pr-4'
                : 'paysage:pr-8',
            ].join(' ')}
          >
            <span
              aria-hidden="true"
              className="block font-display text-[56px] font-bold italic leading-none text-or-ink tabular-nums paysage:text-[72px]"
            >
              {etape.num}
            </span>
            <h3 className="mt-1 font-display text-[19px] font-bold leading-[1.15]">
              {etape.titre}
            </h3>
            <p className="mt-2 text-[14px] leading-[1.5] text-encre-2">{etape.texte}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ============================================================
   Hero principal
   ============================================================ */

const PASTILLE =
  'inline-flex items-center gap-[7px] rounded-full bg-white/16 py-1.5 pr-2.5 pl-[9px] text-[10.5px] leading-none font-bold tracking-[0.14em] whitespace-nowrap uppercase text-white';

const BOUTON_PRINCIPAL =
  'inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-[#fffaf2] px-5 text-[15px] font-semibold text-[#9a2c12] shadow-[0_10px_24px_-10px_rgba(60,10,0,.5)] transition-[filter,transform] hover:brightness-105 active:scale-[0.97]';

type HeroProps = {
  etat: 'ouvert' | 'hors-soiree';
  soiree: Calendrier | null;
  calendrierDisponible: boolean;
  maintenant: Date;
  session: boolean;
  prenom: string | null;
  chargement: boolean;
  epreuveEnCours?: string | null;
  manadeEnPiste?: string | null;
};

function Hero({
  etat,
  soiree,
  calendrierDisponible,
  maintenant,
  session,
  prenom,
  chargement,
  epreuveEnCours,
  manadeEnPiste,
}: HeroProps) {
  const ouvert = etat === 'ouvert';

  return (
    <section
      aria-labelledby="hero-noter-titre"
      className="carte-notez relative isolate overflow-hidden"
    >
      {/* Calque grain optionnel désactivé sur la carte : maintenu ici pour le hero pleine largeur */}

      <div className="relative z-10 mx-auto px-4 pt-8 pb-8 tablette:px-7 tablette:pt-10 paysage:px-10 paysage:pt-12 bureau:px-14">
        <div className="grid gap-8 paysage:grid-cols-[1fr_400px] bureau:grid-cols-[1fr_460px]">

          {/* Colonne gauche */}
          <div className="flex flex-col gap-4">

            {/* Pastille */}
            <div>
              {ouvert ? (
                <p className={PASTILLE}>
                  <span aria-hidden="true" className="point-direct size-[7px] rounded-full bg-current" />
                  En direct
                  {epreuveEnCours ? (
                    <span className="ml-1 font-normal normal-case opacity-80">
                      · {epreuveEnCours}
                    </span>
                  ) : null}
                </p>
              ) : (
                <p className={PASTILLE}>
                  <Icone nom="calendrier" className="size-3" />
                  Prochaine soirée
                  {soiree ? (
                    <span className="ml-1 font-normal normal-case opacity-80">
                      · {soiree.ville}
                      {soiree.statut === 'previsionnelle' ? ' · prévisionnelle' : ''}
                    </span>
                  ) : null}
                </p>
              )}
            </div>

            {/* Titre pinceau : le h1 visible de la page */}
            <h1
              id="hero-noter-titre"
              className="font-brush text-[52px] leading-[.92] font-normal text-white tablette:text-[64px] paysage:text-[72px]"
            >
              Notez les Olympiades
            </h1>

            {/* Phrase d'ouverture */}
            <p className="max-w-[40ch] text-[15px] leading-[1.5] text-white/90">
              {ouvert
                ? 'Ce soir, le public note aussi. Donnez une note de 1 à 10 à chaque manade, dès la fin de son passage.'
                : session
                  ? `Bonjour${prenom ? ` ${prenom}` : ''} : vous êtes inscrit. Les votes ouvriront${soiree ? ` ${momentSoiree(soiree)}` : ' le soir de l’Olympiade'}.`
                  : soiree
                    ? `Les votes ouvriront ${momentSoiree(soiree)}. ${INSCRIPTION_OUVERTE ? 'Inscrivez-vous dès maintenant pour être prêt le soir venu.' : 'Vous noterez chaque manade de 1 à 10, dès la fin de son passage.'}`
                    : 'Le soir de l’Olympiade, notez chaque manade de 1 à 10, dès la fin de son passage.'}
            </p>

            {/* Actions */}
            {!ouvert && !chargement ? (
              <div className="flex flex-wrap items-center gap-3">
                {session ? (
                  <Link
                    to="/compte"
                    className="text-[13.5px] font-semibold text-white/70 underline underline-offset-2 hover:text-white"
                  >
                    Supprimer mon compte
                  </Link>
                ) : INSCRIPTION_OUVERTE ? (
                  <Link to="/inscription" className={BOUTON_PRINCIPAL}>
                    Je m'inscris
                    <Icone nom="fleche" className="size-4" />
                  </Link>
                ) : (
                  <p className="text-[13.5px] font-semibold text-white/80">
                    {TEXTE_INSCRIPTIONS_FERMEES}
                  </p>
                )}
                <Link
                  to="/dates"
                  className="inline-flex min-h-[52px] items-center gap-1 text-[13.5px] font-semibold text-white underline underline-offset-2 hover:no-underline"
                >
                  Voir les dates
                  <Icone nom="fleche" className="size-4" />
                </Link>
              </div>
            ) : ouvert && !session ? (
              <div>
                {INSCRIPTION_OUVERTE ? (
                  <Link to="/inscription" className={BOUTON_PRINCIPAL}>
                    Je m'inscris pour noter
                    <Icone nom="fleche" className="size-4" />
                  </Link>
                ) : (
                  <p className="text-[13.5px] font-semibold text-white/80">{TEXTE_INSCRIPTIONS_FERMEES}</p>
                )}
              </div>
            ) : null}

            {/* Manade en piste (soirée ouverte) */}
            {ouvert && manadeEnPiste ? (
              <div className="flex items-center gap-3 rounded-[18px] bg-[rgba(50,10,0,.28)] p-3">
                <Fer manade={manadeEnPiste} clair />
                <p>
                  <span className="block text-[9.5px] font-bold tracking-[0.16em] text-white/70 uppercase">
                    En piste
                  </span>
                  <span className="font-display text-[17px] font-bold text-white">
                    Manade {manadeEnPiste}
                  </span>
                </p>
              </div>
            ) : null}

            {/* Compte à rebours (hors soirée) */}
            {!ouvert ? (
              <ProchaineSoiree
                soiree={soiree}
                disponible={calendrierDisponible}
                maintenant={maintenant}
              />
            ) : null}
          </div>

          {/* Colonne droite : aperçu interactif, visible à partir de paysage */}
          <div className="hidden paysage:flex paysage:flex-col paysage:justify-center">
            <AperçuVote />
          </div>
        </div>

        {/* Aperçu interactif : mobile et tablette, sous la colonne gauche */}
        <div className="mt-6 paysage:hidden">
          <AperçuVote />
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Page principale
   ============================================================ */

export default function Noter({ loaderData }: Route.ComponentProps) {
  const { calendrier, lueLe } = loaderData;
  const maintenant = useMaintenant(lueLe);
  const soiree = calendrier ? soireeDeReference(calendrier, maintenant) : null;
  const { session, prenom, chargement } = useSession();
  const instantane = useInstantanePublic();
  const etat = instantane.etat;
  const ouvert = etat === 'ouvert';

  return (
    <>
      <Hero
        etat={etat}
        soiree={soiree}
        calendrierDisponible={calendrier !== null}
        maintenant={maintenant}
        session={session !== null}
        prenom={prenom}
        chargement={chargement}
        epreuveEnCours={instantane.soiree?.epreuveEnCours}
        manadeEnPiste={instantane.soiree?.manadeEnPiste}
      />

      {/* Notation en direct (spectateur connecté) */}
      {session ? <NotationPublic key={session.user.id} compte={session.user.id} /> : null}

      {/* Contenu d'attente : affiché seulement hors soirée */}
      {!ouvert ? (
        <>
          <CommentCaSePasseSec />
          <Epreuves />
        </>
      ) : null}
    </>
  );
}
