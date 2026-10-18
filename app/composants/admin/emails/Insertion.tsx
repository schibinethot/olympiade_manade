/**
 * Insertion au curseur, partagée par l'éditeur des modèles et le message aux inscrits : barre d'une
 * ligne (Gras, Lien, Liste, Bouton, « Insérer une info »), panneau des variables, alerte des
 * variables inconnues ou sans valeur dans l'email.
 */

import { useId, useRef, useState } from 'react';
import { VARIABLES, variablesInconnues, type Etape, type VariableEmail } from '../../../../serveur/gabarits-emails.mjs';
import { BOUTON } from '../CadreAdmin';
import {
  insererBouton,
  insererGras,
  insererLien,
  insererListe,
  insererVariable,
  variableDisponible,
  variablesEmployees,
  type Insertion,
} from './outils';
import { CIBLE } from './styles';

const NB = '\u00a0';

type Champ = HTMLInputElement | HTMLTextAreaElement;
export type Transformation = (valeur: string, debut: number, fin: number) => Insertion;

/** Le dernier champ touché reçoit les insertions, à l'endroit du curseur (gardé après la perte du focus). */
export function useInsertion<K extends string>(valeurs: Record<K, string>, changer: (cle: K, valeur: string) => void, initiale: K) {
  const refs = useRef<Partial<Record<K, Champ | null>>>({});
  const [cible, setCible] = useState<K>(initiale);

  function brancher(cle: K) {
    return {
      ref: (element: Champ | null) => { refs.current[cle] = element; },
      onFocus: () => setCible(cle),
    };
  }

  function appliquer(transformer: Transformation) {
    const champ = refs.current[cible];
    const valeur = valeurs[cible];
    const debut = champ?.selectionStart ?? valeur.length;
    const fin = champ?.selectionEnd ?? debut;
    const resultat = transformer(valeur, debut, fin);
    changer(cible, resultat.valeur);
    requestAnimationFrame(() => {
      const element = refs.current[cible];
      if (!element) return;
      element.focus();
      element.setSelectionRange(resultat.debut, resultat.fin);
    });
  }

  return { cible, brancher, appliquer };
}

export const GROUPES: ReadonlyArray<VariableEmail['groupe']> = ['Personne', 'Date', 'Lieu', 'Infos', 'Liens'];
export const OUTILS: ReadonlyArray<{ libelle: string; aide: string; transformer: Transformation }> = [
  { libelle: 'Gras', aide: `Met la sélection en gras${NB}: **texte**`, transformer: insererGras },
  { libelle: 'Lien', aide: `Fait un lien de la sélection${NB}: [texte](https://…)`, transformer: insererLien },
  { libelle: 'Liste', aide: `Met la ligne en liste à puces${NB}: - élément`, transformer: insererListe },
  { libelle: 'Bouton', aide: `Ajoute un bouton seul sur sa ligne${NB}: [[Texte|https://…]]`, transformer: insererBouton },
];

/** Un clic n'enlève pas le focus du champ : la sélection reste celle de l'admin. */
const garderLeFocus = (evenement: { preventDefault: () => void }) => evenement.preventDefault();

export function BarreInsertion({ cle, jours = null, libelleCible, riche, appliquer }: {
  /** L'email édité : les variables sans valeur pour lui sont grisées. */
  cle: Etape;
  /** Décalage en cours de saisie (le vainqueur n'existe qu'après la soirée). */
  jours?: number | null;
  libelleCible: string;
  riche: boolean;
  appliquer: (transformer: Transformation) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const idPanneau = `${useId()}-infos`;
  // BOUTON donne déjà 48 px de haut et un texte de 14 px.
  const bouton = `${BOUTON} bg-creme`;

  return (
    // Conteneur de requête : le code {{…}} des variables ne s'affiche que si le panneau a la place.
    <div className="@container grid gap-2">
      <div role="group" aria-label="Mise en forme" className="flex flex-wrap items-center gap-2">
        {OUTILS.map((outil) => (
          <button key={outil.libelle} type="button" title={riche ? outil.aide : 'Mise en forme réservée au corps du message'}
            disabled={!riche} onMouseDown={garderLeFocus} onClick={() => appliquer(outil.transformer)} className={bouton}>
            {outil.libelle}
          </button>
        ))}
        <button type="button" aria-expanded={ouvert} aria-controls={idPanneau} onMouseDown={garderLeFocus}
          onClick={() => setOuvert((avant) => !avant)} className={bouton}>
          Insérer une info <span aria-hidden="true" className="ml-1.5">{ouvert ? '▴' : '▾'}</span>
        </button>
      </div>
      {ouvert ? (
        <div id={idPanneau} className="grid gap-2.5 rounded-2xl border border-trait bg-sable p-3">
          <p className="text-sm text-encre-2">
            Un clic insère l’info dans «{NB}<span className="font-semibold text-encre">{libelleCible}</span>{NB}», à l’endroit du curseur.
            Elle se remplit seule à l’envoi. En pointillés{NB}: pas disponible dans cet email.
          </p>
          {GROUPES.map((groupe) => (
            <div key={groupe} role="group" aria-label={`Infos${NB}: ${groupe}`} className="flex flex-wrap items-center gap-1.5">
              <span aria-hidden="true" className="mr-1 text-xs font-bold tracking-[.14em] text-or-ink uppercase">{groupe}</span>
              {VARIABLES.filter((variable) => variable.groupe === groupe).map((variable) => {
                const disponible = variableDisponible(cle, variable.cle, jours);
                return (
                  <button
                    key={variable.cle}
                    type="button"
                    aria-disabled={disponible ? undefined : true}
                    title={disponible ? `{{${variable.cle}}} · exemple${NB}: ${variable.exemple}` : 'Pas disponible dans cet email : elle resterait vide.'}
                    onMouseDown={garderLeFocus}
                    onClick={disponible ? () => appliquer((valeur, debut, fin) => insererVariable(valeur, debut, fin, variable.cle)) : undefined}
                    className={`inline-flex ${CIBLE} items-center gap-1.5 rounded-lg border px-3 text-left ${disponible
                      ? 'border-trait bg-creme hover:border-or' : 'cursor-not-allowed border-dashed border-encre-3 text-encre-2'}`}
                  >
                    <span>{variable.libelle}</span>{' '}
                    <code className="sr-only font-mono text-xs text-encre-2 @lg:not-sr-only">{`{{${variable.cle}}}`}</code>
                    {disponible ? null : <span className="sr-only"> (pas disponible dans cet email)</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Variables absentes de VARIABLES (rendues vides), et variables connues sans valeur dans cet email. */
export function AlerteVariables({ cle, jours = null, textes }: { cle: Etape; jours?: number | null; textes: readonly string[] }) {
  const inconnues = variablesInconnues(textes.join('\n'));
  const sansValeur = variablesEmployees(textes).filter((variable) => !variableDisponible(cle, variable, jours));
  if (!inconnues.length && !sansValeur.length) return null;
  const liste = (noms: readonly string[]) => noms.map((nom) => `{{${nom}}}`).join(', ');
  return (
    <div role="alert" className="grid gap-1 rounded-xl border border-alerte bg-ambre/15 px-3 py-2 text-sm">
      {inconnues.length ? (
        <p>
          <span className="font-semibold">Variable inconnue{NB}:</span> {liste(inconnues)}. Elle serait remplacée par un vide dans
          l’email. Choisissez une info dans la liste.
        </p>
      ) : null}
      {sansValeur.length ? (
        <p>
          <span className="font-semibold">Pas disponible dans cet email{NB}:</span> {liste(sansValeur)}. La ligne qui la contient
          n’apparaîtra pas.
        </p>
      ) : null}
    </div>
  );
}
