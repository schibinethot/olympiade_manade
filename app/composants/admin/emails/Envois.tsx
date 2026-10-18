/**
 * Onglet Envois : état du serveur d'envoi (mode, raisons d'inactivité, dernier passage, dernière
 * erreur), destinataires, bilan par étape et par date, et raisons des envois sautés ou en échec. Bilan
 * et raisons viennent d'une seule lecture de la vue bilan_envois_emails (contrat C-0.4).
 */

import { useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MODELES_DEFAUT, type Etape } from '../../../../serveur/gabarits-emails.mjs';
import { BOUTON, CARTE } from '../CadreAdmin';
import { INACTIF } from './styles';
import { useComptesEnvois, type DateCalendrier, type EtatChargement, type EtatEmails, type LigneBilan, type ModeleEmailLigne } from './donnees';
import { accorder, BandeauxServeur, DetailServeur } from './EtatServeur';
import { instantEnClair, raisonsDuBilan, regrouperBilan } from './outils';

const NB = '\u00a0';

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

export function Envois({ bilan, modeles, dates, etat, client, onActualiser, actualisation }: {
  bilan: readonly LigneBilan[];
  modeles: readonly ModeleEmailLigne[];
  dates: readonly DateCalendrier[];
  etat: EtatChargement<EtatEmails>;
  client: SupabaseClient;
  /** Relecture des données partagées, sans repasser par le chargement de tout l'écran. */
  onActualiser: () => void;
  actualisation: boolean;
}) {
  const [revision, setRevision] = useState(0);
  const lignes = useMemo(() => regrouperBilan(bilan), [bilan]);
  const raisons = useMemo(() => raisonsDuBilan(bilan), [bilan]);
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

  // aria-disabled pendant la relecture : le bouton garde le focus ; la garde est ici.
  function actualiser() {
    if (actualisation) return;
    setRevision((valeur) => valeur + 1);
    onActualiser();
  }

  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-encre-2">Aucune statistique d’ouverture ni de clic n’est mesurée.</p>
        <div className="flex items-center gap-3">
          <p role="status" className="text-sm text-encre-2">{actualisation ? 'Actualisation…' : ''}</p>
          <button type="button" className={`${BOUTON} ${INACTIF}`} aria-disabled={actualisation || undefined} onClick={actualiser}>Actualiser</button>
        </div>
      </div>

      <BandeauxServeur etat={etat} />

      <section className={`${CARTE} min-w-0`} aria-labelledby="titre-serveur-envoi">
        <h2 id="titre-serveur-envoi" className="font-display text-2xl">Serveur d’envoi</h2>
        <DetailServeur etat={etat} />
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
                      {ligne.derniereTentative ? <span className="block text-xs text-encre-2">Dernière tentative{NB}: {instantEnClair(ligne.derniereTentative)}</span> : null}
                    </td>
                    {COLONNES.map(([statut, titre]) => (
                      <td key={titre} className={`hidden py-3 pr-4 text-right tabular-nums tablette:table-cell ${ligne[statut] ? '' : 'text-encre-2'}`}>{ligne[statut]}</td>
                    ))}
                    <td className="hidden py-3 whitespace-nowrap text-encre-2 tablette:table-cell">
                      {ligne.dernierEnvoi ? instantEnClair(ligne.dernierEnvoi) : '—'}
                      {/* En attente ou en échec, la vue donne l'heure de la dernière tentative, pas d'un envoi. */}
                      {ligne.derniereTentative ? <span className="block text-xs">Dernière tentative{NB}: {instantEnClair(ligne.derniereTentative)}</span> : null}
                    </td>
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
        {raisons.length === 0 ? <p className="mt-3">Aucun email sauté ni en échec.</p> : (
          <ul className="mt-3 divide-y divide-trait">
            {raisons.map(({ raison, libelle, nombre }) => (
              <li key={raison ?? 'sans-raison'} className="flex items-center justify-between gap-3 py-2.5">
                <span>{libelle}</span>
                <span className="font-semibold tabular-nums">{nombre}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
