import { Fragment } from 'react';
import { Link } from 'react-router';
import { domaine } from '../lib/accueil';
import { lireClassement } from '../lib/classements';
import { lienFicheManade } from '../lib/manades';
import type { Palmares } from '../lib/donnees';
import { PUCE_ALERTE, PUCE_OK } from './BadgeSoiree';
import { Fer, initialeManade, marqueManade } from './Fer';

type Props = {
  /** Résultat le plus récent de l'année choisie : il porte le bloc à la une. */
  resultat: Palmares;
};

const DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

function dateLongue({ date_soiree, annee }: Pick<Palmares, 'date_soiree' | 'annee'>): string {
  if (!date_soiree) return String(annee);
  const [a, m, j] = date_soiree.split('-').map(Number);
  return DATE.format(new Date(Date.UTC(a, m - 1, j))).replace(/^1 /, '1er ');
}

const SURTITRE = 'block font-sans text-[10.5px] leading-[1.25] font-bold tracking-[0.2em] text-or-clair uppercase';

/**
 * Vainqueur à la une (bloc nuit, inspiré de « Dernier vainqueur connu » de l'accueil) : la soirée
 * la plus récente de l'année choisie. Fer en filigrane, podium quand le détail porte un
 * classement (1er mis en valeur, 2e à 5e en petites lignes), suite du détail en texte sinon,
 * statut et source en pied.
 */
export function VainqueurAlaUne({ resultat }: Props) {
  const vainqueur = resultat.vainqueur.trim();
  const marque = marqueManade(vainqueur);
  const lienVainqueur = lienFicheManade(vainqueur);
  const classement = lireClassement(resultat.detail);
  const premier = classement?.rangs[0] ?? null;
  const suite = classement ? classement.rangs.slice(1) : [];
  const sourceDomaine = resultat.source_url ? domaine(resultat.source_url) : null;

  return (
    <article
      aria-labelledby="titre-vainqueur-une"
      className="fond-champion relative isolate grid gap-7 overflow-hidden rounded-[26px] px-6 py-7 text-nuit-txt tablette:p-9 paysage:gap-9 paysage:px-12 paysage:py-11"
    >
      <div aria-hidden="true" className="grain absolute inset-0" />
      {marque ? (
        <img
          aria-hidden="true"
          src={marque}
          alt=""
          width={360}
          height={360}
          className="pointer-events-none absolute -top-16 -right-10 size-[320px] object-contain opacity-[.18] invert mix-blend-screen tablette:-top-20 tablette:size-[400px] paysage:-top-24 paysage:-right-16 paysage:size-[460px]"
        />
      ) : (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-14 -right-4 font-brush text-[240px] leading-none text-[rgba(226,192,138,.1)] tablette:text-[320px] paysage:text-[400px]"
        >
          {initialeManade(vainqueur)}
        </span>
      )}

      <header className="relative">
        <p className={SURTITRE}>
          <span>Vainqueur à la une</span>
          <span aria-hidden="true" className="mx-2 text-or-ink/70">·</span>
          <span className="text-nuit-mute">
            {resultat.ville}{' '}
            <span aria-hidden="true">·</span>{' '}
            <time dateTime={resultat.date_soiree ?? String(resultat.annee)}>{dateLongue(resultat)}</time>
          </span>
        </p>
        <h2
          id="titre-vainqueur-une"
          className="mt-2.5 font-display text-[40px] leading-[.98] font-bold tablette:text-[52px] paysage:text-[64px]"
        >
          Manade{' '}
          <em className="text-or-clair italic">
            {lienVainqueur ? (
              <Link to={lienVainqueur} className="hover:underline focus-visible:outline-offset-4">
                {vainqueur}
              </Link>
            ) : (
              vainqueur
            )}
          </em>
        </h2>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-nuit-mute">{resultat.evenement}</p>
      </header>

      {classement && premier ? (
        <div className="relative grid gap-6 paysage:grid-cols-[1.1fr_1fr] paysage:items-start paysage:gap-10">
          {/* Le 1er, mis en valeur par un bloc dédié qui l'emporte en taille. */}
          <section aria-label="Vainqueur" className="relative">
            <p className="text-[10.5px] font-bold tracking-[0.2em] text-or-clair/80 uppercase">Vainqueur de la soirée</p>
            <div className="mt-3 flex items-center gap-4">
              <span className="font-display text-[64px] leading-none font-bold italic text-or-clair tablette:text-[80px] paysage:text-[96px]">
                1<sup className="text-[.42em]">er</sup>
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <Fer manade={premier.manade} clair />
                  <span className="min-w-0 truncate font-display text-[24px] leading-tight font-semibold text-or-clair tablette:text-[28px]">
                    {lienFicheManade(premier.manade) ? (
                      <Link to={lienFicheManade(premier.manade)!} className="hover:underline">
                        {premier.manade}
                      </Link>
                    ) : (
                      premier.manade
                    )}
                  </span>
                </div>
                {premier.precision ? (
                  <p className="mt-1 text-[13px] text-nuit-mute">{premier.precision}</p>
                ) : null}
              </div>
            </div>
          </section>

          {/* 2e à 5e : petites lignes serrées, filets or clair discret entre elles. */}
          {suite.length ? (
            <section aria-label="Suite du podium">
              <p className="text-[10.5px] font-bold tracking-[0.2em] text-or-clair/80 uppercase">Suite du podium</p>
              <ol className="mt-3 divide-y divide-[var(--trait-nuit)]">
                {suite.map(({ rang, manade, precision }) => {
                  const lien = lienFicheManade(manade);
                  return (
                    <li
                      key={`${rang}-${manade}`}
                      className="flex items-center gap-3 py-2.5 first:pt-0"
                    >
                      <span className="font-display text-[22px] leading-none font-bold italic tabular-nums text-nuit-txt/80">
                        {rang}
                        <sup className="text-[.45em]">e</sup>
                      </span>
                      <Fer manade={manade} clair taille="petit" />
                      <div className="min-w-0 flex-1">
                        <span className="block min-w-0 truncate text-[15px] font-semibold text-nuit-txt/95">
                          {lien ? (
                            <Link to={lien} className="hover:underline">
                              {manade}
                            </Link>
                          ) : (
                            manade
                          )}
                        </span>
                        {precision ? (
                          <span className="block text-[12px] leading-snug text-nuit-mute">{precision}</span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          {classement.suite ? (
            <p className="paysage:col-span-2 max-w-[62ch] text-[13.5px] leading-relaxed text-nuit-mute">
              {classement.suite}
            </p>
          ) : null}
        </div>
      ) : resultat.detail ? (
        <p className="relative max-w-[62ch] text-[14.5px] leading-relaxed text-nuit-txt/90">{resultat.detail}</p>
      ) : null}

      <footer className="relative mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-nuit-mute">
        {resultat.statut === 'a_confirmer' ? (
          <span className={PUCE_ALERTE}>À confirmer</span>
        ) : (
          <span className={PUCE_OK}>Confirmé</span>
        )}
        {resultat.source_url ? (
          <Fragment>
            <span className="opacity-60" aria-hidden="true">
              ·
            </span>
            <span>
              Source&nbsp;:{' '}
              <a
                href={resultat.source_url}
                className="underline underline-offset-2 hover:text-nuit-txt"
                target="_blank"
                rel="noopener noreferrer"
              >
                {sourceDomaine ?? 'article'}
              </a>
            </span>
          </Fragment>
        ) : null}
      </footer>
    </article>
  );
}
