/**
 * Onglet Dates : les dates à venir, leurs inscrits, leurs infos pratiques ({{infos_pratiques}}) et
 * le message aux inscrits (n° 8) : saisie, aperçu, confirmation du nombre de destinataires, envoi.
 */

import { useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formaterDate, MODELES_DEFAUT, variablesInconnues } from '../../../../serveur/gabarits-emails.mjs';
import { BOUTON, BOUTON_PLEIN, CARTE, CHAMP } from '../CadreAdmin';
import { ApercuEmail, type LargeurApercu } from './ApercuEmail';
import { appelerApiAdmin, enregistrerInfosPratiques, type DateCalendrier, type EtatChargement, type EtatEmails, type ModeleEmailLigne } from './donnees';
import { AlerteVariables, BarreInsertion, useInsertion } from './Editeur';
import { jourParisDe, LIBELLES_STATUT_DATE, messageAEcrire, preparerApercu } from './outils';
import { ALERTE } from './Sequence';

const NB = '\u00a0';
const LIMITE_INFOS = 1000;

const personnes = (nombre: number) => `${nombre} personne${nombre > 1 ? 's' : ''}`;

type Retour = { etat: 'repos' } | { etat: 'encours' } | { etat: 'ok' | 'erreur'; message: string };

function InfosPratiques({ date, client, onEnregistre }: {
  date: DateCalendrier;
  client: SupabaseClient;
  onEnregistre: (infos: string | null) => void;
}) {
  const [valeur, setValeur] = useState(date.infos_pratiques ?? '');
  const [retour, setRetour] = useState<Retour>({ etat: 'repos' });
  const id = `infos-${date.id}`;
  const propre = valeur.trim() || null;
  const inchange = propre === (date.infos_pratiques?.trim() || null);

  async function enregistrer() {
    if (retour.etat === 'encours') return;
    setRetour({ etat: 'encours' });
    const resultat = await enregistrerInfosPratiques(client, date.id, propre);
    if (!resultat.ok) {
      setRetour({ etat: 'erreur', message: resultat.message });
      return;
    }
    onEnregistre(resultat.valeur);
    setRetour({ etat: 'ok', message: 'Infos pratiques enregistrées. Les prochains emails de cette date les reprennent.' });
  }

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">Infos pratiques</label>
      <textarea id={id} className={`${CHAMP} min-h-24 py-2`} value={valeur} maxLength={LIMITE_INFOS} aria-describedby={`${id}-aide`}
        onChange={(evenement) => { setValeur(evenement.target.value); setRetour({ etat: 'repos' }); }} />
      <p id={`${id}-aide`} className="text-xs text-encre-2">
        Parking, accès, ouverture des portes… Repris par {'{{infos_pratiques}}'} dans la veille, le jour J et l’encart de bienvenue. {valeur.length}{NB}/{NB}{LIMITE_INFOS}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BOUTON} disabled={inchange || retour.etat === 'encours'} onClick={() => void enregistrer()}>
          {retour.etat === 'encours' ? 'Enregistrement…' : 'Enregistrer les infos'}
        </button>
        {retour.etat === 'ok' ? <p role="status" className="text-sm text-ok">{retour.message}</p> : null}
        {retour.etat === 'erreur' ? <p role="alert" className="text-sm text-rouge-alerte">{retour.message}</p> : null}
      </div>
    </div>
  );
}

type ChampMessage = 'sujet' | 'corps';

function MessageInscrits({ date, dates, inscrits, modeleMessage, jeton, onEnvoye, onAnnuler }: {
  date: DateCalendrier;
  dates: readonly DateCalendrier[];
  inscrits: number;
  modeleMessage: ModeleEmailLigne | undefined;
  jeton: string;
  onEnvoye: (destinataires: number) => void;
  onAnnuler: () => void;
}) {
  const [textes, setTextes] = useState<Record<ChampMessage, string>>({
    sujet: modeleMessage?.sujet ?? MODELES_DEFAUT.message.sujet,
    corps: modeleMessage?.corps ?? MODELES_DEFAUT.message.corps,
  });
  const [etape, setEtape] = useState<'saisie' | 'confirmation'>('saisie');
  const [envoi, setEnvoi] = useState<Retour>({ etat: 'repos' });
  const [refus, setRefus] = useState<string | null>(null);
  const [largeur, setLargeur] = useState<LargeurApercu>('mobile');
  const [maintenant] = useState(() => new Date());
  const [origine] = useState(() => (typeof window === 'undefined' ? 'https://olympiadedesmanades.fr' : window.location.origin));
  const changer = (champ: ChampMessage, valeur: string) => {
    setTextes((avant) => ({ ...avant, [champ]: valeur }));
    setRefus(null);
    setEtape('saisie');
  };
  const insertion = useInsertion<ChampMessage>(textes, changer, 'corps');
  const prefixe = `message-${date.id}`;

  // À l'envoi, le serveur reprend le pré-en-tête du modèle « message » (serveur/emails.mjs).
  const preheader = modeleMessage?.preheader ?? MODELES_DEFAUT.message.preheader;
  const modele = useMemo(() => ({ sujet: textes.sujet, preheader, corps: textes.corps }), [textes, preheader]);
  const { contexte } = useMemo(() => preparerApercu({
    cle: 'message', reglage: { jours_decalage: null, heure_envoi: null }, date, dates,
    prenom: 'Camille', origine, maintenant, exemples: false, encart: false,
  }), [date, dates, origine, maintenant]);

  function verifier() {
    if (!textes.sujet.trim()) return setRefus('Écrivez l’objet du message.');
    if (messageAEcrire(textes.corps)) return setRefus(`Écrivez votre message avant d’envoyer${NB}: remplacez la phrase «${NB}Écrivez ici votre message…${NB}».`);
    if (!textes.corps.trim()) return setRefus('Écrivez votre message avant d’envoyer.');
    if (variablesInconnues(`${textes.sujet}\n${textes.corps}`).length) return setRefus('Retirez les variables inconnues avant d’envoyer.');
    setRefus(null);
    setEnvoi({ etat: 'repos' });
    setEtape('confirmation');
  }

  async function envoyer() {
    if (envoi.etat === 'encours') return;
    setEnvoi({ etat: 'encours' });
    const reponse = await appelerApiAdmin<{ ok: boolean; destinataires: number }>('/api/admin/emails/message', jeton, {
      calendrierId: date.id, sujet: textes.sujet, corps: textes.corps,
    });
    // En cas d'échec, le formulaire reste ouvert : le même texte peut être renvoyé.
    if (!reponse.ok) setEnvoi({ etat: 'erreur', message: reponse.message });
    else onEnvoye(typeof reponse.donnees.destinataires === 'number' ? reponse.donnees.destinataires : inscrits);
  }

  return (
    <section aria-labelledby={`${prefixe}-titre`} className="grid gap-4 rounded-2xl border border-trait bg-sable p-3 tablette:p-4">
      <h3 id={`${prefixe}-titre`} className="font-display text-xl">Message aux inscrits</h3>
      <div className="grid gap-4 paysage:grid-cols-[minmax(0,1fr)_402px]">
        <div className="grid min-w-0 content-start gap-3">
          <div className="grid gap-1.5">
            <label htmlFor={`${prefixe}-sujet`} className="text-sm font-semibold">Objet</label>
            <input id={`${prefixe}-sujet`} className={CHAMP} value={textes.sujet} maxLength={200} {...insertion.brancher('sujet')}
              onChange={(evenement) => changer('sujet', evenement.target.value)} />
          </div>
          <BarreInsertion libelleCible={insertion.cible === 'sujet' ? 'Objet' : 'Corps du message'} riche={insertion.cible === 'corps'} appliquer={insertion.appliquer} />
          <div className="grid gap-1.5">
            <label htmlFor={`${prefixe}-corps`} className="text-sm font-semibold">Corps du message</label>
            <textarea id={`${prefixe}-corps`} rows={10} className={`${CHAMP} py-2 font-mono text-sm leading-relaxed`} value={textes.corps} maxLength={8000}
              {...insertion.brancher('corps')} onChange={(evenement) => changer('corps', evenement.target.value)} />
            <p className="text-xs text-encre-2">Changement d’horaire, report, annulation, info de dernière minute. {'{{prochaines_dates}}'} liste les autres dates avec leur lien «{NB}Je viens{NB}».</p>
          </div>
          <AlerteVariables textes={[textes.sujet, textes.corps]} />
        </div>
        <ApercuEmail id={`${prefixe}-apercu`} modele={modele} contexte={contexte} largeur={largeur} onLargeur={setLargeur} legende="Pour Camille, tel qu’il partirait maintenant." />
      </div>

      {refus ? <p role="alert" className="text-rouge-alerte">{refus}</p> : null}
      {etape === 'saisie' ? (
        <div className="flex flex-wrap gap-3">
          <button type="button" className={BOUTON_PLEIN} onClick={verifier}>Vérifier et envoyer</button>
          <button type="button" className={BOUTON} onClick={onAnnuler}>Annuler</button>
        </div>
      ) : (
        <div role="group" aria-label="Confirmer l’envoi" className={`${ALERTE} grid gap-3`}>
          <p className="font-semibold">Envoyer à {personnes(inscrits)}{NB}?</p>
          <p className="text-sm">Le message part aux inscrits confirmés de cette date, désinscrits exclus. Il ne peut pas être rappelé.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={BOUTON_PLEIN} disabled={envoi.etat === 'encours'} onClick={() => void envoyer()}>
              {envoi.etat === 'encours' ? 'Envoi…' : envoi.etat === 'erreur' ? 'Réessayer' : 'Oui, envoyer'}
            </button>
            <button type="button" className={`${BOUTON} bg-creme`} disabled={envoi.etat === 'encours'} onClick={() => setEtape('saisie')}>Modifier</button>
          </div>
          {envoi.etat === 'erreur' ? <p role="alert" className="text-sm text-rouge-alerte">{envoi.message}</p> : null}
        </div>
      )}
    </section>
  );
}

function CarteDate({ date, dates, inscrits, modeleMessage, client, jeton, simulation, onInfos }: {
  date: DateCalendrier;
  dates: readonly DateCalendrier[];
  inscrits: number | null;
  modeleMessage: ModeleEmailLigne | undefined;
  client: SupabaseClient;
  jeton: string | null;
  simulation: boolean;
  onInfos: (infos: string | null) => void;
}) {
  const [ecrire, setEcrire] = useState(false);
  const [envoye, setEnvoye] = useState<number | null>(null);
  const formats = formaterDate(date.date_soiree, date.heure);
  const idTitre = `date-${date.id}`;
  const suspendue = date.statut === 'confirmee' && (date.soiree?.statut === 'annulee' || date.soiree?.statut === 'reportee');
  const pastille = date.statut === 'confirmee' ? 'border-ok/50 bg-ok/10 text-encre'
    : date.statut === 'annulee' ? 'border-rouge-alerte/40 bg-rouge/10 text-rouge-alerte' : 'border-trait bg-lin text-encre-2';
  const point = date.statut === 'confirmee' ? 'bg-ok' : date.statut === 'annulee' ? 'bg-rouge-alerte' : 'bg-encre-3';

  return (
    <article aria-labelledby={idTitre} className={`${CARTE} grid min-w-0 gap-4`}>
      <div className="grid gap-2">
        <h2 id={idTitre} className="font-display text-2xl">{date.ville}, {formats.date}</h2>
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

      <InfosPratiques date={date} client={client} onEnregistre={onInfos} />

      {envoye !== null ? (
        <p role="status" className="text-ok">
          Message enregistré pour {personnes(envoye)}{NB}: il part au prochain passage du planificateur, dans la minute.
          {simulation ? ` Mode simulation${NB}: rien ne part réellement.` : ''}
        </p>
      ) : null}
      {ecrire && jeton && inscrits ? (
        <MessageInscrits date={date} dates={dates} inscrits={inscrits} modeleMessage={modeleMessage} jeton={jeton}
          onEnvoye={(nombre) => { setEnvoye(nombre); setEcrire(false); }} onAnnuler={() => setEcrire(false)} />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={BOUTON} disabled={!jeton || !inscrits} aria-describedby={idTitre}
            onClick={() => { setEnvoye(null); setEcrire(true); }}>
            Écrire aux inscrits
          </button>
          {inscrits === 0 ? <p className="text-sm text-encre-2">Personne à prévenir pour l’instant.</p> : null}
        </div>
      )}
    </article>
  );
}

export function Dates({ dates, rattaches, modeleMessage, client, jeton, etat, onInfos }: {
  dates: readonly DateCalendrier[];
  rattaches: Record<string, number> | null;
  modeleMessage: ModeleEmailLigne | undefined;
  client: SupabaseClient;
  jeton: string | null;
  etat: EtatChargement<EtatEmails>;
  onInfos: (id: string, infos: string | null) => void;
}) {
  const [aujourdhui] = useState(() => jourParisDe(new Date()));
  const avenir = dates.filter((date) => date.date_soiree >= aujourdhui);
  const simulation = etat.statut === 'ok' && etat.valeur.mode !== 'smtp';

  return (
    <div className="grid min-w-0 gap-5">
      <p className="text-sm text-encre-2">
        Les inscrits d’une date sont les personnes rattachées à elle, adresse confirmée, désinscrits exclus. Les infos pratiques complètent les emails au fur et à mesure.
      </p>
      {avenir.length === 0 ? <p className={CARTE}>Aucune date à venir au calendrier. Ajoutez-en depuis l’admin Vitrine.</p> : null}
      {avenir.map((date) => (
        <CarteDate key={date.id} date={date} dates={dates} inscrits={rattaches ? rattaches[date.id] ?? 0 : null}
          modeleMessage={modeleMessage} client={client} jeton={jeton} simulation={simulation}
          onInfos={(infos) => onInfos(date.id, infos)} />
      ))}
    </div>
  );
}
