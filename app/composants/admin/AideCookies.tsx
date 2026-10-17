/**
 * Onglet « Comment ça marche » du module de consentement cookies.
 *
 * Public visé : l'organisateur (non technicien) qui administre le site.
 * Objectif : expliquer en moins d'une minute ce que voit le visiteur,
 * où vont ses choix et ce qui se règle dans les autres onglets.
 *
 * Les captures et la vidéo proviennent de `public/aide/cookies/`,
 * générées par `scripts/aide-cookies.mjs`.
 */

import { useState, type ReactNode } from 'react';
import { CARTE } from './CadreAdmin';
import { PARCOURS_COOKIES } from '../../lib/parcours-cookies';

type ModeAide = 'fenetre' | 'bandeau' | 'aucun';
type Appareil = 'mobile' | 'ordinateur';

const APPAREILS: ReadonlyArray<{ cle: Appareil; libelle: string }> = [
  { cle: 'ordinateur', libelle: 'Ordinateur' },
  { cle: 'mobile', libelle: 'Mobile' },
];

const LIBELLES_MODE: Record<ModeAide, string> = {
  fenetre: 'Fenêtre',
  bandeau: 'Barre',
  aucun: 'Rien',
};

export function AideCookies({
  onAllerVers,
}: {
  onAllerVers: (onglet: 'reglages' | 'statistiques' | 'journal') => void;
}) {
  return (
    <div className="grid gap-6">
      <SectionVideo />
      <SectionCeQueVoitLeVisiteur />
      <SectionTroisBoutons />
      <SectionSchemaDonnees />
      <SectionReglages onAllerVers={onAllerVers} />
      <SectionBrancherGtm />
      <SectionFaq />
    </div>
  );
}

// ---------------------------------------------------------------------------
// a. En tête : la vidéo
// ---------------------------------------------------------------------------

function SectionVideo() {
  return (
    <section className={CARTE} aria-labelledby="aide-video-titre">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[52ch]">
          <p className="text-xs font-bold tracking-[.18em] text-or-ink uppercase">Visite guidée</p>
          <h2 id="aide-video-titre" className="mt-1 font-display text-2xl">
            Tout le parcours cookies en 30 secondes
          </h2>
          <p className="mt-2 text-sm text-encre-2">
            Du premier choix du visiteur jusqu'au journal de preuve, filmé sur le site réel.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-trait bg-sable px-3 py-1 text-xs font-semibold text-encre-2">
          <span className="inline-block h-2 w-2 rounded-full bg-ok" aria-hidden="true" /> 30 s
        </span>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-trait bg-encre">
        <video
          className="block aspect-video w-full"
          controls
          muted
          playsInline
          preload="metadata"
          poster="/aide/cookies/parcours-affiche.webp"
        >
          <source src="/aide/cookies/parcours.mp4" type="video/mp4" />
          Votre navigateur ne lit pas la vidéo. Les étapes sont décrites en-dessous.
        </video>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// b. Ce que voit le visiteur
// ---------------------------------------------------------------------------

function SectionCeQueVoitLeVisiteur() {
  const [mode, setMode] = useState<ModeAide>('fenetre');
  const [appareil, setAppareil] = useState<Appareil>('ordinateur');

  const details = PARCOURS_COOKIES.find((p) => p.mode === mode)!;

  return (
    <section className={CARTE} aria-labelledby="aide-visiteur-titre">
      <p className="text-xs font-bold tracking-[.18em] text-or-ink uppercase">Côté visiteur</p>
      <h2 id="aide-visiteur-titre" className="mt-1 font-display text-2xl">
        Ce qui s'affiche selon la page
      </h2>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-xl border border-trait bg-sable p-1"
          role="radiogroup"
          aria-label="Choisir le mode à afficher"
        >
          {(['fenetre', 'bandeau', 'aucun'] as const).map((cle) => {
            const actif = mode === cle;
            return (
              <button
                key={cle}
                type="button"
                role="radio"
                aria-checked={actif}
                onClick={() => setMode(cle)}
                className={`inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold ${
                  actif ? 'bg-encre text-sable' : 'text-encre'
                }`}
              >
                {LIBELLES_MODE[cle]}
              </button>
            );
          })}
        </div>

        <div
          className="inline-flex rounded-xl border border-trait bg-sable p-1"
          role="radiogroup"
          aria-label="Choisir l'appareil"
        >
          {APPAREILS.map(({ cle, libelle }) => {
            const actif = appareil === cle;
            return (
              <button
                key={cle}
                type="button"
                role="radio"
                aria-checked={actif}
                onClick={() => setAppareil(cle)}
                className={`inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold ${
                  actif ? 'bg-encre text-sable' : 'text-encre'
                }`}
              >
                {libelle}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-4 paysage:grid-cols-[1.1fr_1fr]">
        <figure
          className="overflow-hidden rounded-2xl border border-trait bg-sable"
          aria-label={`Capture ${LIBELLES_MODE[mode]} sur ${appareil}`}
        >
          <picture>
            <source
              type="image/avif"
              srcSet={`/aide/cookies/${appareil}-${mode}.avif`}
            />
            <source
              type="image/webp"
              srcSet={`/aide/cookies/${appareil}-${mode}.webp`}
            />
            <img
              src={`/aide/cookies/${appareil}-${mode}.webp`}
              alt={`${LIBELLES_MODE[mode]} du bandeau cookies sur ${appareil}`}
              className="block w-full"
              loading="lazy"
              decoding="async"
            />
          </picture>
        </figure>

        <div className="grid content-start gap-3">
          <h3 className="font-display text-xl">{details.libelle}</h3>
          <p className="text-sm text-encre-2">{details.accroche}</p>
          <div>
            <p className="text-xs font-bold tracking-[.14em] text-or-ink uppercase">Pages concernées</p>
            <p className="mt-1 text-sm text-encre-2">{details.noteRoutes}</p>
            {details.prefixes.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {details.prefixes.map((p) => (
                  <li
                    key={p}
                    className="inline-flex items-center rounded-full border border-trait bg-sable px-2.5 py-1 text-xs font-semibold text-encre"
                  >
                    <code className="font-mono">{p}</code>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// c. Trois boutons, même poids
// ---------------------------------------------------------------------------

function SectionTroisBoutons() {
  const boutons = [
    {
      cle: 'refuser',
      libelle: 'Tout refuser',
      role: 'Égalité CNIL',
      texte: "Aucun traceur optionnel n'est déposé. Le visiteur peut continuer, le site fonctionne.",
      style: 'bg-encre text-sable border-encre',
    },
    {
      cle: 'accepter',
      libelle: 'Tout accepter',
      role: 'Égalité CNIL',
      texte: 'Mesure d\'audience et publicité activées pour cette visite.',
      style: 'bg-encre text-sable border-encre',
    },
    {
      cle: 'personnaliser',
      libelle: 'Personnaliser',
      role: 'Au choix',
      texte: 'Ouvre les préférences pour activer catégorie par catégorie.',
      style: 'bg-creme text-encre border-trait',
    },
  ];
  return (
    <section className={CARTE} aria-labelledby="aide-boutons-titre">
      <p className="text-xs font-bold tracking-[.18em] text-or-ink uppercase">Les boutons</p>
      <h2 id="aide-boutons-titre" className="mt-1 font-display text-2xl">
        Trois actions, un seul poids pour les deux décisives
      </h2>
      <p className="mt-2 max-w-[62ch] text-sm text-encre-2">
        La CNIL exige que refuser soit aussi simple qu'accepter. Les deux boutons portent donc exactement
        le même style, la même taille et la même ligne de base.
      </p>
      <ul className="mt-4 grid gap-3 tablette:grid-cols-3">
        {boutons.map((b) => (
          <li key={b.cle} className="rounded-2xl border border-trait bg-sable p-4">
            <div
              className={`inline-flex min-h-12 items-center rounded-xl border-2 px-4 text-sm font-semibold ${b.style}`}
            >
              {b.libelle}
            </div>
            <p className="mt-3 text-xs font-bold tracking-[.14em] text-or-ink uppercase">{b.role}</p>
            <p className="mt-1.5 text-sm text-encre-2">{b.texte}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// d. Où vont les choix (schéma HTML)
// ---------------------------------------------------------------------------

function SectionSchemaDonnees() {
  const etapes: Array<{ titre: string; detail: string }> = [
    { titre: 'Visiteur', detail: "Choisit depuis le bandeau du site." },
    { titre: 'Cookie cc_cookie', detail: 'Stocké dans son navigateur, mémorise le choix (365 jours).' },
    { titre: 'Journal (preuve)', detail: 'Entrée horodatée côté serveur, IP pseudonymisée.' },
    { titre: 'Vous', detail: 'Lecture via les onglets Statistiques et Journal.' },
  ];
  return (
    <section className={CARTE} aria-labelledby="aide-schema-titre">
      <p className="text-xs font-bold tracking-[.18em] text-or-ink uppercase">Où vont les choix</p>
      <h2 id="aide-schema-titre" className="mt-1 font-display text-2xl">
        Du clic du visiteur jusqu'à votre tableau de bord
      </h2>
      <ol className="mt-4 flex flex-col items-stretch gap-3 paysage:flex-row paysage:items-stretch">
        {etapes.map((e, i) => (
          <li key={e.titre} className="flex flex-1 items-stretch gap-3 paysage:items-center">
            <div className="flex-1 rounded-2xl border border-trait bg-sable p-4">
              <span className="inline-flex min-h-6 items-center rounded-full bg-encre px-2 text-[11px] font-bold tracking-[.1em] text-sable uppercase">
                Étape {i + 1}
              </span>
              <p className="mt-2 font-display text-lg">{e.titre}</p>
              <p className="mt-1 text-sm text-encre-2">{e.detail}</p>
            </div>
            {i < etapes.length - 1 ? (
              <FlecheEtape />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function FlecheEtape() {
  // Horizontal (bureau) : chevron à droite · Vertical (mobile) : chevron en bas.
  return (
    <span
      aria-hidden="true"
      className="relative flex shrink-0 items-center justify-center text-or-ink"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 rotate-90 paysage:rotate-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14M13 5l7 7-7 7" />
      </svg>
    </span>
  );
}

// ---------------------------------------------------------------------------
// e. Ce que vous réglez ici
// ---------------------------------------------------------------------------

function SectionReglages({
  onAllerVers,
}: {
  onAllerVers: (onglet: 'reglages' | 'statistiques' | 'journal') => void;
}) {
  const cartes: Array<{
    cle: 'reglages' | 'statistiques' | 'journal';
    titre: string;
    accroche: string;
  }> = [
    {
      cle: 'reglages',
      titre: 'Réglages',
      accroche: 'Textes du bandeau, catégories, durée de validité du choix.',
    },
    {
      cle: 'statistiques',
      titre: 'Statistiques',
      accroche: 'Taux d\'acceptation sur 7, 30, 90 ou 365 jours.',
    },
    {
      cle: 'journal',
      titre: 'Journal',
      accroche: '50 entrées par page, purge automatique au-delà de 365 jours.',
    },
  ];
  return (
    <section className={CARTE} aria-labelledby="aide-reglages-titre">
      <p className="text-xs font-bold tracking-[.18em] text-or-ink uppercase">Vos commandes</p>
      <h2 id="aide-reglages-titre" className="mt-1 font-display text-2xl">
        Les trois autres onglets, d'un coup d'œil
      </h2>
      <ul className="mt-4 grid gap-3 tablette:grid-cols-3">
        {cartes.map((c) => (
          <li key={c.cle}>
            <button
              type="button"
              onClick={() => onAllerVers(c.cle)}
              className="group block h-full w-full rounded-2xl border border-trait bg-sable p-4 text-left transition-colors hover:bg-lin focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encre"
            >
              <p className="font-display text-lg">{c.titre}</p>
              <p className="mt-1 text-sm text-encre-2">{c.accroche}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-or-ink underline underline-offset-4">
                Ouvrir cet onglet
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// f. Brancher Google Analytics ou Meta
// ---------------------------------------------------------------------------

function SectionBrancherGtm() {
  const etapes = [
    {
      titre: 'Créer un conteneur GTM',
      detail:
        'Ouvrez tagmanager.google.com, créez un conteneur « Web » pour le site, récupérez son identifiant (de la forme GTM-XXXXXX).',
    },
    {
      titre: 'Renseigner VITE_GTM_ID sur Railway',
      detail: 'Ajoutez la variable VITE_GTM_ID (valeur = identifiant copié), puis redéployez.',
    },
    {
      titre: 'Choisir des balises compatibles',
      detail:
        "La sécurité du site n'autorise que les balises qui chargent des scripts externes (Google Analytics 4, Meta Pixel). Les balises « HTML personnalisé » sont bloquées : utiliser plutôt les modèles officiels.",
    },
  ];
  return (
    <section className={CARTE} aria-labelledby="aide-gtm-titre">
      <p className="text-xs font-bold tracking-[.18em] text-or-ink uppercase">Brancher la mesure</p>
      <h2 id="aide-gtm-titre" className="mt-1 font-display text-2xl">
        Google Analytics ou Meta Pixel via Google Tag Manager
      </h2>
      <ol className="mt-4 grid gap-3 tablette:grid-cols-3">
        {etapes.map((e, i) => (
          <li key={e.titre} className="rounded-2xl border border-trait bg-sable p-4">
            <span className="inline-flex min-h-6 items-center rounded-full bg-encre px-2 text-[11px] font-bold tracking-[.1em] text-sable uppercase">
              {i + 1}
            </span>
            <p className="mt-2 font-display text-lg">{e.titre}</p>
            <p className="mt-1 text-sm text-encre-2">{e.detail}</p>
          </li>
        ))}
      </ol>
      <p className="mt-4 rounded-xl border border-trait bg-sable p-3 text-xs text-encre-2">
        La variable <code className="font-mono text-encre">CONSENTEMENT_COOKIES_CLE_IP</code>{' '}
        pseudonymise les adresses IP enregistrées dans le journal (préserve la vie privée des visiteurs).
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// g. FAQ
// ---------------------------------------------------------------------------

function SectionFaq() {
  const items: Array<{ question: string; reponse: ReactNode }> = [
    {
      question: 'Refuser empêche-t-il de noter les manades ?',
      reponse:
        "Non. Le vote et la mémorisation de la session utilisent des traceurs classés nécessaires, ils fonctionnent sans consentement.",
    },
    {
      question: "Pourquoi l'écran géant n'affiche jamais de bandeau ?",
      reponse:
        "L'écran géant ne dépose aucun traceur optionnel (ni mesure, ni publicité) : il n'y a rien à autoriser, donc rien à demander.",
    },
    {
      question: 'Combien de temps le choix est-il conservé ?',
      reponse: (
        <>
          Par défaut 365 jours, modifiable dans l'onglet{' '}
          <strong className="font-semibold text-encre">Réglages</strong> (la CNIL recommande 13 mois maximum,
          soit 395 jours).
        </>
      ),
    },
    {
      question: 'Que contient le journal ?',
      reponse:
        "L'action du visiteur (accepter, refuser, personnaliser), les catégories choisies, l'URL de la page, l'horodatage et son adresse IP pseudonymisée (chaîne irréversible).",
    },
    {
      question: 'Comment purger le journal ?',
      reponse: (
        <>
          Depuis l'onglet <strong className="font-semibold text-encre">Journal</strong>, le bouton{' '}
          <em>Purger les entrées anciennes</em> supprime toutes les lignes de plus de 365 jours.
        </>
      ),
    },
  ];
  return (
    <section className={CARTE} aria-labelledby="aide-faq-titre">
      <p className="text-xs font-bold tracking-[.18em] text-or-ink uppercase">Les questions courantes</p>
      <h2 id="aide-faq-titre" className="mt-1 font-display text-2xl">
        En cinq questions
      </h2>
      <ul className="mt-4 grid gap-2">
        {items.map((it) => (
          <li key={it.question}>
            <details className="group rounded-2xl border border-trait bg-sable px-4 py-3 open:bg-lin">
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-encre focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encre">
                <span>{it.question}</span>
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <div className="mt-2 text-sm text-encre-2">{it.reponse}</div>
            </details>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-encre-2">
        Besoin d'aller plus loin ? <a className="underline underline-offset-4" href="/confidentialite">Lire la page Confidentialité du site</a>.
      </p>
    </section>
  );
}

