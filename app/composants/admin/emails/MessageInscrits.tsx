/**
 * Message aux inscrits d'une date (n° 8) : objet et corps avec la barre d'insertion, aperçu, refus du
 * texte de départ, confirmation du nombre de destinataires, envoi (POST /api/admin/emails/message).
 * Le focus suit chaque étape ; « Annuler » demande confirmation si le message a été commencé.
 *
 * Idempotence (contrat C-0.7) : une clé uuid est tirée à l'ouverture du formulaire et part avec chaque
 * essai. Un « Réessayer » après une réponse perdue ne fait donc pas partir le message deux fois.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { MODELES_DEFAUT, variablesInconnues } from '../../../../serveur/gabarits-emails.mjs';
import { BOUTON, BOUTON_PLEIN, CHAMP } from '../CadreAdmin';
import { appelerApiAdmin, type DateCalendrier, type MessageEnvoye, type ModeleEmailLigne } from './donnees';
import { AlerteVariables, BarreInsertion, useInsertion } from './Insertion';
import { messageAEcrire } from './outils';
import { PanneauApercu } from './PanneauApercu';
import { ALERTE, INACTIF } from './styles';

const NB = '\u00a0';
const REGLAGE_VIDE = { jours_decalage: null, heure_envoi: null };

export const personnes = (nombre: number) => `${nombre} personne${nombre > 1 ? 's' : ''}`;

/** Clé d'idempotence : uuid v4 (crypto.randomUUID, ou tiré de getRandomValues hors contexte sécurisé). */
export function nouvelleCle(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const octets = crypto.getRandomValues(new Uint8Array(16));
  octets[6] = (octets[6] & 0x0f) | 0x40;
  octets[8] = (octets[8] & 0x3f) | 0x80;
  const hexa = [...octets].map((octet) => octet.toString(16).padStart(2, '0')).join('');
  return `${hexa.slice(0, 8)}-${hexa.slice(8, 12)}-${hexa.slice(12, 16)}-${hexa.slice(16, 20)}-${hexa.slice(20)}`;
}

type Champ = 'sujet' | 'corps';
/**
 * `deja_parti` : le serveur refuse la clé (409 `cle_deja_utilisee`), un premier essai a donc été
 * enregistré. Une nouvelle clé risquerait un doublon : le formulaire ne propose plus que de se fermer.
 */
type Envoi = { etat: 'repos' } | { etat: 'encours' } | { etat: 'erreur'; message: string } | { etat: 'deja_parti' };

export function MessageInscrits({ date, dates, inscrits, modeleMessage, jeton, onModifie, onEnvoye, onDejaParti, onFermer }: {
  date: DateCalendrier;
  dates: readonly DateCalendrier[];
  inscrits: number;
  modeleMessage: ModeleEmailLigne | undefined;
  jeton: string;
  /** Signale à la page un message commencé (onglets, liens, retour, rechargement). */
  onModifie: (modifie: boolean) => void;
  /** Le message est parti : il rejoint l'historique de la date. */
  onEnvoye: (message: MessageEnvoye) => void;
  /** Le serveur a déjà le message (409) : l'historique est relu, le texte enregistré n'étant connu que de lui. */
  onDejaParti: () => void;
  onFermer: () => void;
}) {
  // Tirée une fois à l'ouverture, gardée pour tous les essais de ce formulaire.
  const [cle] = useState(nouvelleCle);
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
  const boutonFermer = useRef<HTMLButtonElement>(null);
  const modifie = textes.sujet !== depart.sujet || textes.corps !== depart.corps;
  const prefixe = `message-${date.id}`;
  const dejaParti = envoi.etat === 'deja_parti';

  useEffect(() => { titre.current?.focus(); }, []);
  useEffect(() => { onModifie(modifie); }, [modifie, onModifie]);
  useEffect(() => () => onModifie(false), [onModifie]);
  useEffect(() => { if (etape !== 'saisie') question.current?.focus(); }, [etape]);
  // Le bouton d'envoi disparaît : le focus passe à la seule action restante.
  useEffect(() => { if (dejaParti) boutonFermer.current?.focus(); }, [dejaParti]);

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
    if (dejaParti) return;
    if (!textes.sujet.trim()) return setRefus('Écrivez l’objet du message.');
    if (messageAEcrire(textes.corps)) return setRefus(`Écrivez votre message avant d’envoyer${NB}: remplacez la phrase «${NB}Écrivez ici votre message…${NB}».`);
    if (!textes.corps.trim()) return setRefus('Écrivez votre message avant d’envoyer.');
    if (variablesInconnues(`${textes.sujet}\n${textes.corps}`).length) return setRefus('Retirez les variables inconnues avant d’envoyer.');
    setRefus(null);
    setEnvoi({ etat: 'repos' });
    setEtape('confirmation');
  }

  async function envoyer() {
    if (envoi.etat === 'encours' || dejaParti) return;
    setEnvoi({ etat: 'encours' });
    const reponse = await appelerApiAdmin<{ ok: boolean; destinataires?: unknown; id?: unknown }>('/api/admin/emails/message', jeton, {
      calendrierId: date.id, sujet: textes.sujet, corps: textes.corps, cle,
    });
    // Clé déjà enregistrée avec un autre texte (premier essai parti, réponse perdue, puis texte corrigé) :
    // le message est parti, jamais de nouvelle clé.
    if (!reponse.ok && reponse.statut === 409 && reponse.code === 'cle_deja_utilisee') {
      setEnvoi({ etat: 'deja_parti' });
      return onDejaParti();
    }
    // En cas d'échec, le formulaire reste ouvert : le même texte peut être renvoyé (« Réessayer »), avec la même clé.
    if (!reponse.ok) return setEnvoi({ etat: 'erreur', message: reponse.message });
    const { destinataires, id } = reponse.donnees;
    onEnvoye({
      id: typeof id === 'string' ? id : cle,
      calendrier_id: date.id,
      sujet: textes.sujet,
      cree_le: new Date().toISOString(),
      destinataires: typeof destinataires === 'number' ? destinataires : inscrits,
    });
  }

  return (
    <section aria-labelledby={`${prefixe}-titre`} className="grid gap-4 rounded-2xl border border-trait bg-sable p-3 tablette:p-4">
      <h3 id={`${prefixe}-titre`} ref={titre} tabIndex={-1} className="font-display text-xl">Message aux inscrits</h3>
      {/* Garde-fou juridique (S2) : le message part à des personnes qui n'ont pas toutes accepté les annonces. */}
      <p className={`${ALERTE} text-sm`}>Réservé aux informations pratiques (horaire, report, annulation). Une autre date s’annonce par l’annonce.</p>
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
              Changement d’horaire, report, annulation, info de dernière minute. {'{{prochaines_dates}}'} ne liste les autres dates qu’aux personnes qui ont accepté les annonces.
            </p>
          </div>
          <AlerteVariables cle="message" textes={[textes.sujet, textes.corps]} />
        </div>
        <PanneauApercu id={`${prefixe}-apercu`} cle="message" modele={modele} reglage={REGLAGE_VIDE} dates={dates} dateId={date.id} niveauTitre={4} />
      </div>

      {refus ? <p role="alert" className="text-rouge-alerte">{refus}</p> : null}
      {dejaParti ? (
        <div className={`${ALERTE} grid gap-3`}>
          <p role="alert" className="font-semibold">Ce message est déjà parti.</p>
          <div className="flex flex-wrap gap-3">
            <button ref={boutonFermer} type="button" className={BOUTON_PLEIN} onClick={onFermer}>Fermer le formulaire</button>
          </div>
        </div>
      ) : etape === 'saisie' ? (
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
            {/* aria-disabled pendant l'envoi : le bouton garde le focus ; envoyer() ignore le second clic. */}
            <button type="button" className={`${BOUTON_PLEIN} ${INACTIF}`} aria-disabled={envoi.etat === 'encours' || undefined} onClick={() => void envoyer()}>
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
