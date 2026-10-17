/**
 * Onglet Envois : état du serveur d'envoi (mode, dernier passage), destinataires, bilan par étape
 * et par date (vue bilan_envois_emails) et raisons des envois sautés ou en échec.
 */

import { useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MODELES_DEFAUT, type Etape } from '../../../../serveur/gabarits-emails.mjs';
import { BOUTON, CARTE } from '../CadreAdmin';
import { RAISONS_CONNUES, useComptesEnvois, type DateCalendrier, type EtatChargement, type EtatEmails, type LigneBilan, type ModeEnvoi, type ModeleEmailLigne } from './donnees';
import { instantEnClair, LIBELLES_RAISONS, regrouperBilan } from './outils';

const NB = '\u00a0';

const LIBELLES_MODE: Record<ModeEnvoi, { titre: string; detail: string }> = {
  smtp: { titre: 'Envoi réel (smtp)', detail: 'Les emails partent pour de vrai.' },
  log: { titre: 'Simulation (log)', detail: 'Les envois sont calculés et notés dans le journal, sans partir.' },
  off: { titre: 'Coupé (off)', detail: 'Rien n’est calculé ni envoyé.' },
};

const LIBELLES_PASSAGE: ReadonlyArray<[keyof NonNullable<EtatEmails['dernierBilan']>, string, string]> = [
  ['reserves', 'réservé', 'réservés'], ['envoyes', 'envoyé', 'envoyés'], ['simules', 'simulé', 'simulés'],
  ['echecs', 'échec', 'échecs'], ['sautes', 'sauté', 'sautés'],
];

/** 0 et 1 au singulier, comme en français. */
const accorder = (nombre: number, singulier: string, pluriel: string) => `${nombre} ${nombre >= 2 ? pluriel : singulier}`;

/** Statut, titre de colonne, mot du résumé (au singulier ; « en attente » est invariable). */
const COLONNES = [
  ['envoye', 'Envoyés', 'envoyé'], ['simule', 'Simulés', 'simulé'], ['echec', 'Échecs', 'échec'],
  ['saute', 'Sautés', 'sauté'], ['en_attente', 'En attente', 'en attente'],
] as const;

function Chiffre({ id, libelle, valeur, aide }: { id: string; libelle: string; valeur: number; aide: string }) {
  return (
    <div role="group" aria-labelledby={id} className="rounded-2xl border border-trait bg-sable p-4">
      <p id={id} className="text-xs font-bold tracking-[.14em] text-or-ink uppercase">{libelle}</p>
      <p className="mt-1 font-display text-3xl">{valeur}</p>
      <p className="mt-1 text-xs text-encre-2">{aide}</p>
    </div>
  );
}

function EtatServeur({ etat }: { etat: EtatChargement<EtatEmails> }) {
  if (etat.statut === 'chargement') return <p role="status" className="mt-3">Lecture de l’état du serveur…</p>;
  if (etat.statut === 'erreur') return <p role="alert" className="mt-3 text-rouge-alerte">{etat.message}</p>;
  const { mode, pret, cleLiens, dernierPassage, dernierBilan } = etat.valeur;
  const libelle = LIBELLES_MODE[mode] ?? LIBELLES_MODE.off;
  const passage = dernierBilan
    ? LIBELLES_PASSAGE.map(([cle, singulier, pluriel]) => accorder(dernierBilan[cle] ?? 0, singulier, pluriel)).join(' · ')
    : null;
  return (
    <dl className="mt-3 grid gap-2 text-sm tablette:grid-cols-[11rem_minmax(0,1fr)]">
      <dt className="font-semibold text-encre-2">Mode</dt>
      <dd><span className="font-semibold">{libelle.titre}</span> · {libelle.detail}</dd>
      <dt className="font-semibold text-encre-2">Planificateur</dt>
      <dd>{pret ? 'Prêt, passage chaque minute' : 'À l’arrêt (configuration incomplète)'}</dd>
      <dt className="font-semibold text-encre-2">Clé des liens</dt>
      <dd>{cleLiens ? 'Présente' : 'Absente (EMAILS_CLE_LIENS)'}</dd>
      <dt className="font-semibold text-encre-2">Dernier passage</dt>
      <dd>{dernierPassage ? instantEnClair(dernierPassage) : 'Aucun depuis le démarrage du serveur'}{passage ? ` · ${passage}` : ''}</dd>
    </dl>
  );
}

export function Envois({ bilan, modeles, dates, etat, client, onActualiser }: {
  bilan: readonly LigneBilan[];
  modeles: readonly ModeleEmailLigne[];
  dates: readonly DateCalendrier[];
  etat: EtatChargement<EtatEmails>;
  client: SupabaseClient;
  onActualiser: () => void;
}) {
  const [revision, setRevision] = useState(0);
  const lignes = useMemo(() => regrouperBilan(bilan), [bilan]);
  const ids = useMemo(() => [...new Set(lignes.map((ligne) => ligne.calendrierId).filter((id): id is string => id !== null))].sort(), [lignes]);
  const comptes = useComptesEnvois(client, ids, revision);
  const noms = new Map<string, string>(modeles.map((modele) => [modele.cle, modele.nom]));
  const nomEtape = (cle: Etape) => noms.get(cle) ?? MODELES_DEFAUT[cle]?.nom ?? cle;
  const connues = new Map<string, Pick<DateCalendrier, 'ville' | 'date_soiree'>>(dates.map((date) => [date.id, date]));
  if (comptes.statut === 'ok') for (const [id, date] of Object.entries(comptes.valeur.dates)) connues.set(id, date);
  const nomDate = (id: string | null) => {
    if (!id) return '—';
    const date = connues.get(id);
    return date ? `${date.ville}, ${date.date_soiree.slice(8, 10)}/${date.date_soiree.slice(5, 7)}/${date.date_soiree.slice(0, 4)}` : 'Date supprimée';
  };
  const totalSautesEchecs = lignes.reduce((total, ligne) => total + ligne.saute + ligne.echec, 0);

  function actualiser() {
    setRevision((valeur) => valeur + 1);
    onActualiser();
  }

  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-encre-2">Aucune statistique d’ouverture ni de clic n’est mesurée.</p>
        <button type="button" className={BOUTON} onClick={actualiser}>Actualiser</button>
      </div>

      <section className={`${CARTE} min-w-0`} aria-labelledby="titre-serveur-envoi">
        <h2 id="titre-serveur-envoi" className="font-display text-2xl">Serveur d’envoi</h2>
        <EtatServeur etat={etat} />
      </section>

      <section className={`${CARTE} min-w-0`} aria-labelledby="titre-destinataires">
        <h2 id="titre-destinataires" className="font-display text-2xl">Destinataires</h2>
        {comptes.statut === 'chargement' ? <p role="status" className="mt-3">Comptage…</p> : null}
        {comptes.statut === 'erreur' ? <p role="alert" className="mt-3 text-rouge-alerte">{comptes.message}</p> : null}
        {comptes.statut === 'ok' ? (
          <div className="mt-4 grid gap-3 tablette:grid-cols-2 paysage:grid-cols-4">
            <Chiffre id="compte-abonnes" libelle="Abonnés confirmés" valeur={comptes.valeur.abonnes} aide="Abonnés aux actualités qui ont cliqué sur le lien de confirmation." />
            <Chiffre id="compte-a-confirmer" libelle="En attente de confirmation" valeur={comptes.valeur.aConfirmer} aide="Ils ne reçoivent rien d’autre que la demande de confirmation." />
            <Chiffre id="compte-annonces" libelle="Acceptent les annonces" valeur={comptes.valeur.annonces} aide="Ils reçoivent l’annonce des autres dates." />
            <Chiffre id="compte-desinscrits" libelle="Désinscrits" valeur={comptes.valeur.desinscrits} aide="Plus aucun email ne leur part." />
          </div>
        ) : null}
      </section>

      <section className={`${CARTE} min-w-0`} aria-labelledby="titre-bilan">
        <h2 id="titre-bilan" className="font-display text-2xl">Bilan par étape et par date</h2>
        {lignes.length === 0 ? (
          <p className="mt-3">Aucun envoi pour le moment. Les envois apparaissent ici dès le premier passage du planificateur.</p>
        ) : (
          // Zone défilante sur petit écran : atteignable au clavier pour faire défiler le tableau.
          <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-labelledby="titre-bilan">
            <table className="w-full text-sm" aria-label="Bilan des envois">
              <thead>
                <tr className="border-b border-trait text-left text-xs font-bold tracking-[.12em] text-encre-2 uppercase">
                  <th scope="col" className="pr-4 pb-2">Étape</th>
                  <th scope="col" className="pr-4 pb-2">Date</th>
                  {/* Téléphone : une colonne résumée ; à partir de la tablette, un chiffre par statut. */}
                  <th scope="col" className="pb-2 tablette:hidden">Résultat</th>
                  {COLONNES.map(([, titre]) => <th key={titre} scope="col" className="hidden pr-4 pb-2 text-right whitespace-nowrap tablette:table-cell">{titre}</th>)}
                  <th scope="col" className="hidden pb-2 whitespace-nowrap tablette:table-cell">Dernier envoi</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne) => (
                  <tr key={`${ligne.etape} ${ligne.calendrierId ?? ''}`} className="border-b border-trait align-top last:border-0">
                    <th scope="row" className="py-3 pr-4 text-left font-semibold">{nomEtape(ligne.etape)}</th>
                    <td className="py-3 pr-4 tablette:whitespace-nowrap">{nomDate(ligne.calendrierId)}</td>
                    <td className="py-3 tablette:hidden">
                      {COLONNES.filter(([statut]) => ligne[statut] > 0).map(([statut, , singulier]) => accorder(ligne[statut], singulier, statut === 'en_attente' ? singulier : `${singulier}s`)).join(' · ')}
                    </td>
                    {COLONNES.map(([statut, titre]) => (
                      <td key={titre} className={`hidden py-3 pr-4 text-right tabular-nums tablette:table-cell ${ligne[statut] ? '' : 'text-encre-2'}`}>{ligne[statut]}</td>
                    ))}
                    <td className="hidden py-3 whitespace-nowrap text-encre-2 tablette:table-cell">{ligne.dernierEnvoi ? instantEnClair(ligne.dernierEnvoi) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-encre-2">Envoyés{NB}: partis en mode smtp. Simulés{NB}: notés en mode log. Sautés{NB}: volontairement non envoyés (raisons ci-dessous).</p>
      </section>

      <section className={`${CARTE} min-w-0`} aria-labelledby="titre-raisons">
        <h2 id="titre-raisons" className="font-display text-2xl">Pourquoi des emails n’ont pas été envoyés</h2>
        {comptes.statut === 'ok' ? (() => {
          const raisons = RAISONS_CONNUES.filter((raison) => comptes.valeur.raisons[raison] > 0);
          const autres = totalSautesEchecs - raisons.reduce((total, raison) => total + comptes.valeur.raisons[raison], 0);
          if (!raisons.length && autres <= 0) return <p className="mt-3">Aucun email sauté ni en échec.</p>;
          return (
            <ul className="mt-3 divide-y divide-trait">
              {raisons.map((raison) => (
                <li key={raison} className="flex items-center justify-between gap-3 py-2.5">
                  <span>{LIBELLES_RAISONS[raison] ?? raison}</span>
                  <span className="font-semibold tabular-nums">{comptes.valeur.raisons[raison]}</span>
                </li>
              ))}
              {autres > 0 ? (
                <li className="flex items-center justify-between gap-3 py-2.5">
                  <span>Autre raison (échec du serveur d’envoi après 3 essais…)</span>
                  <span className="font-semibold tabular-nums">{autres}</span>
                </li>
              ) : null}
            </ul>
          );
        })() : null}
        {comptes.statut === 'chargement' ? <p role="status" className="mt-3">Comptage…</p> : null}
      </section>
    </div>
  );
}
