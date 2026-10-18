/**
 * Onglet Dates : les dates à venir, leurs inscrits, leurs infos pratiques ({{infos_pratiques}}) et
 * le message aux inscrits (MessageInscrits). Les résultats passent par une région de statut
 * permanente ; le focus revient au déclencheur quand le message se ferme.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formaterDate } from '../../../../serveur/gabarits-emails.mjs';
import { BOUTON, CARTE, CHAMP } from '../CadreAdmin';
import { enregistrerInfosPratiques, type DateCalendrier, type EtatChargement, type EtatEmails, type ModeleEmailLigne } from './donnees';
import { MessageInscrits, personnes } from './MessageInscrits';
import { jourParisDe, LIBELLES_STATUT_DATE, modelesUtilisant } from './outils';
import { ALERTE, INACTIF } from './styles';

const NB = '\u00a0';
const LIMITE_INFOS = 1000;

type Retour = { etat: 'repos' } | { etat: 'encours' } | { etat: 'ok' | 'erreur'; message: string };

function InfosPratiques({ date, client, utilisateurs, onEnregistre, onModifie }: {
  date: DateCalendrier;
  client: SupabaseClient;
  /** Emails actifs qui reprennent {{infos_pratiques}}. */
  utilisateurs: readonly string[];
  onEnregistre: (infos: string | null) => void;
  /** Une saisie non enregistrée est protégée comme un brouillon (onglets, liens, retour, rechargement). */
  onModifie: (modifie: boolean) => void;
}) {
  const [valeur, setValeur] = useState(date.infos_pratiques ?? '');
  const [retour, setRetour] = useState<Retour>({ etat: 'repos' });
  const id = `infos-${date.id}`;
  const propre = valeur.trim() || null;
  const inchange = propre === (date.infos_pratiques?.trim() || null);
  const inactif = inchange || retour.etat === 'encours';

  useEffect(() => { onModifie(!inchange); }, [inchange, onModifie]);
  useEffect(() => () => onModifie(false), [onModifie]);

  // aria-disabled : après l'enregistrement, le bouton garde le focus ; la garde est ici.
  async function enregistrer() {
    if (inactif) return;
    setRetour({ etat: 'encours' });
    const resultat = await enregistrerInfosPratiques(client, date.id, propre);
    if (!resultat.ok) return setRetour({ etat: 'erreur', message: resultat.message });
    onEnregistre(resultat.valeur);
    setRetour({ etat: 'ok', message: 'Infos pratiques enregistrées. Les prochains emails de cette date les reprennent.' });
  }

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">Infos pratiques</label>
      <textarea id={id} className={`${CHAMP} min-h-24 py-2`} value={valeur} maxLength={LIMITE_INFOS} aria-describedby={`${id}-aide`}
        onChange={(evenement) => { setValeur(evenement.target.value); setRetour({ etat: 'repos' }); }} />
      <p id={`${id}-aide`} className="text-xs text-encre-2">
        Parking, accès, ouverture des portes…{' '}
        {utilisateurs.length
          ? `Reprises par {{infos_pratiques}} dans${NB}: ${utilisateurs.join(', ')}.`
          : 'Aucun email actif n’utilise {{infos_pratiques}} pour l’instant.'}
        {' '}{valeur.length}{NB}/{NB}{LIMITE_INFOS}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={`${BOUTON} ${INACTIF}`} aria-disabled={inactif || undefined} onClick={() => void enregistrer()}>
          {retour.etat === 'encours' ? 'Enregistrement…' : 'Enregistrer les infos'}
        </button>
        <p role="status" className="text-sm text-ok">{retour.etat === 'ok' ? retour.message : ''}</p>
        {retour.etat === 'erreur' ? <p role="alert" className="text-sm text-rouge-alerte">{retour.message}</p> : null}
      </div>
    </div>
  );
}

function CarteDate({ date, dates, inscrits, modeleMessage, utilisateurs, client, jeton, simulation, ouvrirMessage, onInfos, onModifie }: {
  date: DateCalendrier;
  dates: readonly DateCalendrier[];
  inscrits: number | null;
  modeleMessage: ModeleEmailLigne | undefined;
  utilisateurs: readonly string[];
  client: SupabaseClient;
  jeton: string | null;
  simulation: boolean;
  /** Arrivée depuis l'alerte « Écrire aux inscrits de cette date » : le message s'ouvre tout de suite. */
  ouvrirMessage: boolean;
  onInfos: (infos: string | null) => void;
  onModifie: (cle: string, modifie: boolean) => void;
}) {
  const peutEcrire = Boolean(jeton && inscrits);
  const [ecrire, setEcrire] = useState(() => ouvrirMessage && peutEcrire);
  const [annonce, setAnnonce] = useState('');
  const titre = useRef<HTMLHeadingElement>(null);
  const boutonEcrire = useRef<HTMLButtonElement>(null);
  const formats = formaterDate(date.date_soiree, date.heure);
  const idTitre = `date-${date.id}`;
  const suspendue = date.statut === 'confirmee' && (date.soiree?.statut === 'annulee' || date.soiree?.statut === 'reportee');
  const pastille = date.statut === 'confirmee' ? 'border-ok/50 bg-ok/10 text-encre'
    : date.statut === 'annulee' ? 'border-rouge-alerte/40 bg-rouge/10 text-rouge-alerte' : 'border-trait bg-lin text-encre-2';
  const point = date.statut === 'confirmee' ? 'bg-ok' : date.statut === 'annulee' ? 'bg-rouge-alerte' : 'bg-encre-3';
  const signaler = useCallback((modifie: boolean) => onModifie(`message-${date.id}`, modifie), [onModifie, date.id]);
  const signalerInfos = useCallback((modifie: boolean) => onModifie(`infos-${date.id}`, modifie), [onModifie, date.id]);

  // Arrivée depuis l'alerte sans personne à prévenir : la carte vient à l'écran, titre focalisé.
  useEffect(() => { if (ouvrirMessage && !peutEcrire) titre.current?.focus(); }, [ouvrirMessage, peutEcrire]);

  function fermer(message = '') {
    setEcrire(false);
    setAnnonce(message);
    requestAnimationFrame(() => boutonEcrire.current?.focus());
  }

  return (
    <article aria-labelledby={idTitre} className={`${CARTE} grid min-w-0 gap-4`}>
      <div className="grid gap-2">
        <h2 id={idTitre} ref={titre} tabIndex={-1} className="font-display text-2xl">{date.ville}, {formats.date}</h2>
        <p className="text-sm text-encre-2">{date.nom}{formats.heure ? ` · ${formats.heure}` : ''}{date.arenes ? ` · ${date.arenes}` : ''}</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${pastille}`}>
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${point}`} />
            Date {LIBELLES_STATUT_DATE[date.statut]}
          </span>
          <span className="font-semibold">
            {inscrits === null ? 'Inscrits inconnus' : inscrits === 0 ? 'Aucun inscrit pour l’instant' : `${inscrits} inscrit${inscrits > 1 ? 's' : ''}`}
          </span>
        </div>
        {suspendue ? <p className={`${ALERTE} text-sm`}>La soirée liée est {date.soiree?.statut === 'annulee' ? 'annulée' : 'reportée'}{NB}: les rappels de cette date sont suspendus. Prévenez les inscrits.</p> : null}
        {date.statut === 'annulee' ? <p className={`${ALERTE} text-sm`}>Date annulée{NB}: les rappels sont arrêtés. Prévenez les inscrits, et proposez-leur les autres dates avec {'{{prochaines_dates}}'}.</p> : null}
      </div>

      <InfosPratiques date={date} client={client} utilisateurs={utilisateurs} onEnregistre={onInfos} onModifie={signalerInfos} />

      {ecrire && jeton && inscrits ? (
        <MessageInscrits date={date} dates={dates} inscrits={inscrits} modeleMessage={modeleMessage} jeton={jeton} onModifie={signaler}
          onFermer={() => fermer()}
          onEnvoye={(nombre) => fermer(`Message enregistré pour ${personnes(nombre)}${NB}: il part au prochain passage du planificateur, dans la minute.${
            simulation ? ` Mode simulation${NB}: rien ne part réellement.` : ''}`)} />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button ref={boutonEcrire} type="button" className={BOUTON} disabled={!peutEcrire} aria-describedby={idTitre}
            onClick={() => { setAnnonce(''); setEcrire(true); }}>
            Écrire aux inscrits
          </button>
          {inscrits === 0 ? <p className="text-sm text-encre-2">Personne à prévenir pour l’instant.</p> : null}
        </div>
      )}
      {/* Région permanente : le résultat de l'envoi est annoncé sans déplacer le focus. */}
      <p role="status" className="text-ok">{annonce}</p>
    </article>
  );
}

export function Dates({ dates, rattaches, modeles, client, jeton, etat, ecrireA, onInfos, onModifie }: {
  dates: readonly DateCalendrier[];
  rattaches: Record<string, number> | null;
  modeles: readonly ModeleEmailLigne[];
  client: SupabaseClient;
  jeton: string | null;
  etat: EtatChargement<EtatEmails>;
  /** Date dont le message s'ouvre à l'arrivée (alerte de la séquence). */
  ecrireA: string | null;
  onInfos: (id: string, infos: string | null) => void;
  onModifie: (cle: string, modifie: boolean) => void;
}) {
  const [aujourdhui] = useState(() => jourParisDe(new Date()));
  const avenir = dates.filter((date) => date.date_soiree >= aujourdhui);
  const simulation = etat.statut === 'ok' && etat.valeur.mode !== 'smtp';
  const utilisateurs = modelesUtilisant(modeles.filter((modele) => modele.actif), 'infos_pratiques');
  const modeleMessage = modeles.find((modele) => modele.cle === 'message');

  return (
    <div className="grid min-w-0 gap-5">
      <p className="text-sm text-encre-2">
        Les inscrits d’une date sont les personnes rattachées à elle, adresse confirmée, désinscrits exclus. Les infos pratiques complètent les emails au fur et à mesure.
      </p>
      {avenir.length === 0 ? <p className={CARTE}>Aucune date à venir au calendrier. Ajoutez-en depuis l’admin Vitrine.</p> : null}
      {avenir.map((date) => (
        <CarteDate key={date.id} date={date} dates={dates} inscrits={rattaches ? rattaches[date.id] ?? 0 : null}
          modeleMessage={modeleMessage} utilisateurs={utilisateurs} client={client} jeton={jeton} simulation={simulation}
          ouvrirMessage={ecrireA === date.id} onInfos={(infos) => onInfos(date.id, infos)} onModifie={onModifie} />
      ))}
    </div>
  );
}
