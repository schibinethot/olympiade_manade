/**
 * Message aux inscrits d'une date (n° 8) : objet et corps avec la barre d'insertion, aperçu, refus du
 * texte de départ, confirmation du nombre de destinataires, envoi (POST /api/admin/emails/message).
 * Le focus suit chaque étape ; « Annuler » demande confirmation si le message a été commencé.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { MODELES_DEFAUT, variablesInconnues } from '../../../../serveur/gabarits-emails.mjs';
import { BOUTON, BOUTON_PLEIN, CHAMP } from '../CadreAdmin';
import { appelerApiAdmin, type DateCalendrier, type ModeleEmailLigne } from './donnees';
import { AlerteVariables, BarreInsertion, useInsertion } from './Insertion';
import { messageAEcrire } from './outils';
import { PanneauApercu } from './PanneauApercu';
import { ALERTE } from './styles';

const NB = ' ';
const REGLAGE_VIDE = { jours_decalage: null, heure_envoi: null };

export const personnes = (nombre: number) => `${nombre} personne${nombre > 1 ? 's' : ''}`;

type Champ = 'sujet' | 'corps';
type Envoi = { etat: 'repos' } | { etat: 'encours' } | { etat: 'erreur'; message: string };

export function MessageInscrits({ date, dates, inscrits, modeleMessage, jeton, onModifie, onEnvoye, onFermer }: {
  date: DateCalendrier;
  dates: readonly DateCalendrier[];
  inscrits: number;
  modeleMessage: ModeleEmailLigne | undefined;
  jeton: string;
  /** Signale à la page un message commencé (onglets, liens, retour, rechargement). */
  onModifie: (modifie: boolean) => void;
  onEnvoye: (destinataires: number) => void;
  onFermer: () => void;
}) {
  const [depart] = useState(() => ({
    sujet: modeleMessage?.sujet ?? MODELES_DEFAUT.message.sujet,
    corps: modeleMessage?.corps ?? MODELES_DEFAUT.message.corps,
  }));
  const [textes, setTextes] = useState<Record<Champ, string>>(depart);
  const [etape, setEtape] = useState<'saisie' | 'confirmation' | 'abandon'>('saisie');
  const [envoi, setEnvoi] = useState<Envoi>({ etat: 'repos' });
  const [refus, setRefus] = useState<string | null>(null);
  const titre = useRef<HTMLHeadingElement>(null);
  const question = useRef<HTMLParagraphElement>(null);
  const boutonVerifier = useRef<HTMLButtonElement>(null);
  const boutonAnnuler = useRef<HTMLButtonElement>(null);
  const modifie = textes.sujet !== depart.sujet || textes.corps !== depart.corps;
  const prefixe = `message-${date.id}`;

  useEffect(() => { titre.current?.focus(); }, []);
  useEffect(() => { onModifie(modifie); }, [modifie, onModifie]);
  useEffect(() => () => onModifie(false), [onModifie]);
  useEffect(() => { if (etape !== 'saisie') question.current?.focus(); }, [etape]);

  const changer = (champ: Champ, valeur: string) => {
    setTextes((avant) => ({ ...avant, [champ]: valeur }));
    setRefus(null);
    setEtape('saisie');
  };
  const insertion = useInsertion<Champ>(textes, changer, 'corps');
  // À l'envoi, le serveur reprend le pré-en-tête du modèle « message » (serveur/emails.mjs).
  const preheader = modeleMessage?.preheader ?? MODELES_DEFAUT.message.preheader;
  const modele = useMemo(() => ({ sujet: textes.sujet, preheader, corps: textes.corps }), [textes, preheader]);

  function revenirSaisie(focus: 'verifier' | 'annuler') {
    setEtape('saisie');
    requestAnimationFrame(() => (focus === 'verifier' ? boutonVerifier : boutonAnnuler).current?.focus());
  }

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
    // En cas d'échec, le formulaire reste ouvert : le même texte peut être renvoyé (« Réessayer »).
    if (!reponse.ok) setEnvoi({ etat: 'erreur', message: reponse.message });
    else onEnvoye(typeof reponse.donnees.destinataires === 'number' ? reponse.donnees.destinataires : inscrits);
  }

  return (
    <section aria-labelledby={`${prefixe}-titre`} className="grid gap-4 rounded-2xl border border-trait bg-sable p-3 tablette:p-4">
      <h3 id={`${prefixe}-titre`} ref={titre} tabIndex={-1} className="font-display text-xl">Message aux inscrits</h3>
      <div className="grid gap-4 paysage:grid-cols-[minmax(0,1fr)_402px]">
        <div className="grid min-w-0 content-start gap-3">
          <div className="grid gap-1.5">
            <label htmlFor={`${prefixe}-sujet`} className="text-sm font-semibold">Objet</label>
            <input id={`${prefixe}-sujet`} className={CHAMP} value={textes.sujet} maxLength={200} {...insertion.brancher('sujet')}
              onChange={(evenement) => changer('sujet', evenement.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={`${prefixe}-corps`} className="text-sm font-semibold">Corps du message</label>
            <BarreInsertion cle="message" libelleCible={insertion.cible === 'sujet' ? 'Objet' : 'Corps du message'}
              riche={insertion.cible === 'corps'} appliquer={insertion.appliquer} />
            <textarea id={`${prefixe}-corps`} rows={10} className={`${CHAMP} py-2 font-mono text-sm leading-relaxed`} value={textes.corps} maxLength={8000}
              aria-describedby={`${prefixe}-aide`} {...insertion.brancher('corps')} onChange={(evenement) => changer('corps', evenement.target.value)} />
            <p id={`${prefixe}-aide`} className="text-xs text-encre-2">
              Changement d’horaire, report, annulation, info de dernière minute. {'{{prochaines_dates}}'} liste les autres dates avec leur lien «{NB}Je viens{NB}».
            </p>
          </div>
          <AlerteVariables cle="message" textes={[textes.sujet, textes.corps]} />
        </div>
        <PanneauApercu id={`${prefixe}-apercu`} cle="message" modele={modele} reglage={REGLAGE_VIDE} dates={dates} dateId={date.id} niveauTitre={4} />
      </div>

      {refus ? <p role="alert" className="text-rouge-alerte">{refus}</p> : null}
      {etape === 'saisie' ? (
        <div className="flex flex-wrap gap-3">
          <button ref={boutonVerifier} type="button" className={BOUTON_PLEIN} onClick={verifier}>Vérifier et envoyer</button>
          <button ref={boutonAnnuler} type="button" className={BOUTON} onClick={() => (modifie ? setEtape('abandon') : onFermer())}>Annuler</button>
        </div>
      ) : etape === 'abandon' ? (
        <div role="group" aria-labelledby={`${prefixe}-question`} className={`${ALERTE} grid gap-3`}>
          <p id={`${prefixe}-question`} ref={question} tabIndex={-1} className="font-semibold">Abandonner ce message{NB}?</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={BOUTON_PLEIN} onClick={onFermer}>Abandonner le message</button>
            <button type="button" className={`${BOUTON} bg-creme`} onClick={() => revenirSaisie('annuler')}>Continuer le message</button>
          </div>
        </div>
      ) : (
        <div role="group" aria-labelledby={`${prefixe}-question`} className={`${ALERTE} grid gap-3`}>
          <p id={`${prefixe}-question`} ref={question} tabIndex={-1} className="font-semibold">Envoyer à {personnes(inscrits)}{NB}?</p>
          <p className="text-sm">Le message part aux inscrits confirmés de cette date, désinscrits exclus. Il ne peut pas être rappelé.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={BOUTON_PLEIN} disabled={envoi.etat === 'encours'} onClick={() => void envoyer()}>
              {envoi.etat === 'encours' ? 'Envoi…' : envoi.etat === 'erreur' ? 'Réessayer' : 'Oui, envoyer'}
            </button>
            <button type="button" className={`${BOUTON} bg-creme`} disabled={envoi.etat === 'encours'} onClick={() => revenirSaisie('verifier')}>Modifier</button>
          </div>
          {envoi.etat === 'erreur' ? <p role="alert" className="text-sm text-rouge-alerte">{envoi.message}</p> : null}
        </div>
      )}
    </section>
  );
}
