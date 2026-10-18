import type { InstantanePublic } from '../lib/contexte-etat';
import { Fer } from './Fer';

type Classements = NonNullable<NonNullable<InstantanePublic['soiree']>['classements']>;
type Ligne = NonNullable<Classements['parEpreuve'][number]['public']>[number];
type LigneGeneral = NonNullable<Classements['general']['public']>[number];

const LIBELLES = { public: 'Prix du public', jury: 'Jury', combine: 'Combiné' } as const;

function Tableau({ lignes, score }: { lignes: Ligne[] | LigneGeneral[]; score: (ligne: Ligne | LigneGeneral) => string }) {
  if (!lignes.length) return <p className="text-sm text-encre-2">Aucune note pour ce classement.</p>;
  return (
    <ol className="grid gap-1.5">
      {lignes.map((ligne) => (
        <li
          key={ligne.manadeId}
          className="grid min-h-12 grid-cols-[2.25rem_auto_minmax(0,1fr)_auto] items-center gap-x-3 rounded-xl bg-sable px-3 py-1.5"
        >
          <span
            className={`font-display text-[22px] leading-none font-bold italic tabular-nums ${
              ligne.rang === 1 ? 'text-rouge' : 'text-encre'
            }`}
          >
            {ligne.rang}
            <sup className="text-[.45em]">{ligne.rang === 1 ? 'er' : 'e'}</sup>
          </span>
          <Fer manade={ligne.manadeNom} taille="petit" />
          <span className="truncate text-[14.5px] font-semibold">{ligne.manadeNom}</span>
          <span className="text-sm tabular-nums text-encre-2">{score(ligne)}</span>
        </li>
      ))}
    </ol>
  );
}

function scoreEpreuve(ligne: Ligne) {
  return `${ligne.score.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} · ${ligne.points} pts`;
}

function scoreGeneral(ligne: LigneGeneral, methode: Classements['methode']) {
  const valeur = ligne.total.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  return methode === 'points' ? `${valeur} pts` : `moyenne ${valeur}`;
}

/** Affiche les classements calculés selon le mode officiel, le détail restant consultable. */
export function ClassementCalcule({ classements }: { classements: Classements }) {
  const canaux = classements.officiel === 'combine'
    ? (['combine', 'jury', 'public'] as const)
    : classements.officiel === 'jury'
      ? (['jury', 'public'] as const)
      : (['jury', 'public'] as const);
  return (
    <div className="grid gap-5">
      {classements.provisoire ? <p className="rounded-xl border border-trait bg-lin p-4 text-sm">Classement provisoire : un passage est encore ouvert, ou une note de jury manque.</p> : null}
      <p className="text-sm text-encre-2">
        {classements.officiel === 'separe' ? 'Deux classements officiels : jury et prix du public.'
          : classements.officiel === 'combine' ? 'Classement officiel combiné. Le détail jury et public reste lisible.'
            : 'Le jury est le classement officiel. Le prix du public est indicatif.'}
        {' '}Méthode du général : {classements.methode === 'points' ? 'cumul de points par place' : 'moyenne des notes'}.
      </p>
      <section className="rounded-[22px] border border-trait bg-creme p-5" aria-labelledby="general-calcule">
        <h2 id="general-calcule" className="font-display text-2xl">Général</h2>
        <div className="mt-4 grid gap-4 paysage:grid-cols-2">
          {canaux.map((canal) => (
            <div key={canal}>
              <h3 className="mb-2 font-semibold">{LIBELLES[canal]}{classements.officiel === 'jury' && canal === 'public' ? ' (indicatif)' : ''}</h3>
              <Tableau lignes={classements.general[canal] ?? []} score={(ligne) => scoreGeneral(ligne as LigneGeneral, classements.methode)} />
            </div>
          ))}
        </div>
      </section>
      {classements.parEpreuve.map((epreuve) => (
        <section key={epreuve.epreuveId} className="rounded-[22px] border border-trait bg-creme p-5">
          <h2 className="font-display text-2xl">{epreuve.nom}</h2>
          <div className="mt-4 grid gap-4 paysage:grid-cols-2">
            {canaux.map((canal) => (
              <div key={canal}>
                <h3 className="mb-2 font-semibold">{LIBELLES[canal]}</h3>
                <Tableau lignes={epreuve[canal] ?? []} score={(ligne) => scoreEpreuve(ligne as Ligne)} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
