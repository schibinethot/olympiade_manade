/**
 * État du serveur d'envoi (GET /api/admin/emails/etat) : bandeaux partagés par la séquence et l'onglet
 * Envois (envoi réel ou non, raison par raison, planificateur en panne), et détail de l'onglet Envois.
 * Les bandeaux sont persistants : pas de rôle d'alerte, qui les ferait annoncer à chaque affichage.
 */

import { useState } from 'react';
import type { EtatChargement, EtatEmails, ModeEnvoi } from './donnees';
import { bandeauxEnvoi, instantEnClair, raisonInactifEnClair } from './outils';
import { ALERTE } from './styles';

const NB = '\u00a0';

export function BandeauxServeur({ etat }: { etat: EtatChargement<EtatEmails> }) {
  // Instant figé à l'affichage : « Actualiser » relit l'état et recalcule.
  const [maintenant] = useState(() => new Date());
  if (etat.statut === 'chargement') return null;
  if (etat.statut === 'erreur') {
    return (
      <div className={ALERTE}>
        <p className="font-semibold">État du serveur d’envoi inconnu.</p>
        <p className="text-sm">{etat.message}</p>
      </div>
    );
  }
  return (
    <>
      {bandeauxEnvoi(etat.valeur, maintenant).map((bandeau) => (
        <div key={bandeau.titre} className={ALERTE}>
          <p className="font-semibold">{bandeau.titre}</p>
          {bandeau.lignes.length === 1 ? <p className="text-sm">{bandeau.lignes[0]}</p> : (
            <ul className="mt-1 grid list-disc gap-1 pl-5 text-sm">
              {bandeau.lignes.map((ligne) => <li key={ligne}>{ligne}</li>)}
            </ul>
          )}
        </div>
      ))}
    </>
  );
}

const LIBELLES_MODE: Record<ModeEnvoi, string> = {
  smtp: 'Envoi réel (smtp)',
  log: 'Simulation (log)',
  off: 'Coupé (off)',
};

function detailMode({ mode, pret }: EtatEmails): string {
  if (mode === 'smtp') return pret ? 'Les emails partent pour de vrai.' : 'Demandé, mais rien ne part tant que les raisons ci-dessous ne sont pas réglées.';
  if (mode === 'log') return 'Les envois sont calculés et notés dans le journal, sans partir.';
  return 'Rien n’est calculé ni envoyé.';
}

const LIBELLES_PASSAGE: ReadonlyArray<[keyof NonNullable<EtatEmails['dernierBilan']>, string, string]> = [
  ['reserves', 'réservé', 'réservés'], ['envoyes', 'envoyé', 'envoyés'], ['simules', 'simulé', 'simulés'],
  ['echecs', 'échec', 'échecs'], ['sautes', 'sauté', 'sautés'],
];

/** 0 et 1 au singulier, comme en français. */
export const accorder = (nombre: number, singulier: string, pluriel: string) => `${nombre} ${nombre >= 2 ? pluriel : singulier}`;

export function DetailServeur({ etat }: { etat: EtatChargement<EtatEmails> }) {
  if (etat.statut === 'chargement') return <p role="status" className="mt-3">Lecture de l’état du serveur…</p>;
  if (etat.statut === 'erreur') return <p role="alert" className="mt-3 text-rouge-alerte">{etat.message}</p>;
  const valeur = etat.valeur;
  const { mode, pret, raisonsInactif, cleLiens, barriereActive, dernierPassage, dernierBilan, derniereErreur } = valeur;
  const passage = dernierBilan
    ? LIBELLES_PASSAGE.map(([cle, singulier, pluriel]) => accorder(dernierBilan[cle] ?? 0, singulier, pluriel)).join(' · ')
    : null;
  return (
    <dl className="mt-3 grid gap-2 text-sm tablette:grid-cols-[11rem_minmax(0,1fr)]">
      <dt className="font-semibold text-encre-2">Mode</dt>
      <dd><span className="font-semibold">{LIBELLES_MODE[mode]}</span> · {detailMode(valeur)}</dd>
      <dt className="font-semibold text-encre-2">Planificateur</dt>
      <dd>
        {pret ? 'Prêt, passage chaque minute' : 'À l’arrêt'}
        {!pret && raisonsInactif.length ? (
          <ul className="mt-1 grid list-disc gap-1 pl-5">
            {raisonsInactif.map((code) => <li key={code}>{raisonInactifEnClair(code)}</li>)}
          </ul>
        ) : null}
      </dd>
      <dt className="font-semibold text-encre-2">Barrière d’accès</dt>
      <dd>{barriereActive ? `Active${NB}: le site est privé, aucun email réel ne peut partir` : 'Levée'}</dd>
      <dt className="font-semibold text-encre-2">Clé des liens</dt>
      <dd>{cleLiens ? 'Présente' : 'Absente (EMAILS_CLE_LIENS)'}</dd>
      <dt className="font-semibold text-encre-2">Dernier passage réussi</dt>
      <dd>{dernierPassage ? instantEnClair(dernierPassage) : 'Aucun depuis le démarrage du serveur'}{passage ? ` · ${passage}` : ''}</dd>
      <dt className="font-semibold text-encre-2">Dernière erreur</dt>
      <dd>{derniereErreur ? `${instantEnClair(derniereErreur.instant)} · ${derniereErreur.message}` : 'Aucune'}</dd>
    </dl>
  );
}
