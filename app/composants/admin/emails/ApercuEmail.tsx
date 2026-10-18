/**
 * Aperçu en direct d'un e-mail : le rendu partagé (serveur/gabarits-emails.mjs, cible « apercu »)
 * posé dans un div.apercu-email. Pas d'iframe ni de style en ligne : la feuille apercu-email.css,
 * générée par cssApercu(), suffit, et la CSP (style-src 'self') reste intacte.
 */

import { useMemo } from 'react';
import { rendreEmail, type ContexteEmail, type ModeleEmail } from '../../../../serveur/gabarits-emails.mjs';
import { CIBLE } from './styles';
import './apercu-email.css';

export type LargeurApercu = 'mobile' | 'ordinateur';

const LARGEURS: ReadonlyArray<{ valeur: LargeurApercu; libelle: string }> = [
  { valeur: 'mobile', libelle: 'Mobile (375 px)' },
  { valeur: 'ordinateur', libelle: 'Ordinateur (600 px)' },
];

type Rendu =
  | { ok: true; sujet: string; preheader: string; html: string }
  | { ok: false; message: string };

function rendre(modele: ModeleEmail, contexte: ContexteEmail | null, erreur: string | null): Rendu {
  if (!contexte) return { ok: false, message: erreur ?? 'contexte indisponible' };
  try {
    const { sujet, html } = rendreEmail(modele, contexte, { cible: 'apercu' });
    // Le pré-en-tête n'est pas dans le HTML : il est rendu comme un objet, variables remplies.
    const preheader = modele.preheader?.trim()
      ? rendreEmail({ sujet: modele.preheader, corps: '.' }, contexte, { cible: 'apercu' }).sujet
      : '';
    return { ok: true, sujet, preheader, html };
  } catch (exception) {
    return { ok: false, message: exception instanceof Error ? exception.message : 'erreur inconnue' };
  }
}

export function ApercuEmail({ id, niveauTitre, modele, contexte, erreurContexte = null, largeur, onLargeur, legende }: {
  id: string;
  /** Niveau du titre « Aperçu de l'email » dans le plan de la page. */
  niveauTitre: 3 | 4;
  modele: ModeleEmail;
  /** Null si le contexte n'a pas pu être préparé (`erreurContexte` dit pourquoi). */
  contexte: ContexteEmail | null;
  erreurContexte?: string | null;
  largeur: LargeurApercu;
  onLargeur: (largeur: LargeurApercu) => void;
  legende?: string;
}) {
  const rendu = useMemo(() => rendre(modele, contexte, erreurContexte), [modele, contexte, erreurContexte]);
  const Titre = niveauTitre === 3 ? 'h3' : 'h4';

  return (
    <section aria-labelledby={`${id}-titre`} className="grid min-w-0 content-start gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Titre id={`${id}-titre`} className="font-display text-xl">Aperçu de l’email</Titre>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Largeur de l’aperçu</legend>
          {LARGEURS.map((option) => (
            <label key={option.valeur}
              className={`inline-flex ${CIBLE} cursor-pointer items-center gap-2 rounded-xl border border-trait px-3 font-semibold has-[:checked]:border-encre has-[:checked]:bg-lin`}>
              <input type="radio" name={`${id}-largeur`} value={option.valeur} checked={largeur === option.valeur}
                onChange={() => onLargeur(option.valeur)} className="h-4 w-4 accent-encre" />
              {option.libelle}
            </label>
          ))}
        </fieldset>
      </div>
      {legende ? (
        <p className="text-sm text-encre-2">
          {legende}
          {largeur === 'ordinateur' ? <span className="hidden paysage:inline"> Affiché à 60&nbsp;% pour tenir à côté du texte.</span> : null}
        </p>
      ) : null}

      {rendu.ok ? (
        <>
          <div className="grid gap-1 rounded-xl border border-trait bg-sable px-3 py-2 text-sm">
            <p><span className="font-semibold">Objet&nbsp;:</span> {rendu.sujet || <em className="text-encre-2">(vide)</em>}</p>
            {rendu.preheader ? <p className="text-encre-2"><span className="font-semibold text-encre">Texte d’aperçu&nbsp;:</span> {rendu.preheader}</p> : null}
          </div>
          <div className="overflow-x-auto rounded-xl border border-trait">
            <div
              // Ordinateur : 600 px réels, réduits (zoom) au bureau pour ne pas écraser la colonne de saisie.
              className={`apercu-email mx-auto ${largeur === 'mobile' ? 'w-full max-w-[375px]' : 'w-[624px] paysage:[zoom:0.6]'}`}
              // HTML produit par rendreEmail : texte de l'admin et valeurs déjà échappés (tâche 2).
              dangerouslySetInnerHTML={{ __html: rendu.html }}
            />
          </div>
        </>
      ) : (
        <p role="alert" className="rounded-xl border border-rouge-alerte/40 bg-rouge/5 px-3 py-2 text-rouge-alerte">
          L’aperçu n’a pas pu être rendu&nbsp;: {rendu.message}
        </p>
      )}
    </section>
  );
}
