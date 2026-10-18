/**
 * Administration des e-mails de la séquence (design §6).
 *
 * Onglets (?onglet=) : Séquence (frise, éditeur d'un modèle en ?modele=<cle>), Dates (infos
 * pratiques, message aux inscrits, ?ecrire=<date> à l'arrivée), Envois (bilan, mode SMTP,
 * désinscrits). Même schéma ARIA que /admin/cookies : seul le panneau actif est rendu, seul l'onglet
 * actif porte aria-controls.
 *
 * Un brouillon modifié (modèle ou message) n'est jamais perdu sans confirmation : onglets, liens et
 * retour du navigateur passent par useBlocker, le rechargement par beforeunload.
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useBlocker, useSearchParams, type BlockerFunction } from 'react-router';
import { ETAPES, type Etape } from '../../serveur/gabarits-emails.mjs';
import { BOUTON, BOUTON_PLEIN, CadreAdmin } from '../composants/admin/CadreAdmin';
import { Dates } from '../composants/admin/emails/Dates';
import { useDonneesEmails } from '../composants/admin/emails/donnees';
import { Editeur } from '../composants/admin/emails/Editeur';
import { Envois } from '../composants/admin/emails/Envois';
import { Sequence } from '../composants/admin/emails/Sequence';
import { ALERTE } from '../composants/admin/emails/styles';

const NB = '\u00a0';

export function meta() {
  return [{ title: 'E-mails · Administration' }, { name: 'robots', content: 'noindex' }];
}

export default function AdminEmails() {
  return (
    <CadreAdmin surtitre="Communication" titre="E-mails">
      <Contenu />
    </CadreAdmin>
  );
}

type Onglet = 'sequence' | 'dates' | 'envois';

const ONGLETS: ReadonlyArray<{ cle: Onglet; libelle: string }> = [
  { cle: 'sequence', libelle: 'Séquence' },
  { cle: 'dates', libelle: 'Dates' },
  { cle: 'envois', libelle: 'Envois' },
];

const estOnglet = (valeur: string | null): valeur is Onglet => ONGLETS.some((onglet) => onglet.cle === valeur);
const estEtape = (valeur: string | null): valeur is Etape => (ETAPES as readonly string[]).includes(valeur ?? '');

/**
 * Question focalisée à l'ouverture ; « Rester » rend le focus à l'élément qui l'avait. « Quitter »
 * transmet cet élément, pour placer le focus sur l'onglet de destination si la sortie venait d'un onglet.
 */
function ConfirmationSortie({ onQuitter, onRester }: { onQuitter: (avant: Element | null) => void; onRester: () => void }) {
  const question = useRef<HTMLParagraphElement>(null);
  const avant = useRef<Element | null>(null);
  useEffect(() => {
    avant.current = document.activeElement;
    question.current?.focus();
  }, []);
  function rester() {
    onRester();
    const element = avant.current;
    requestAnimationFrame(() => { if (element instanceof HTMLElement) element.focus(); });
  }
  return (
    <div role="group" aria-labelledby="question-sortie" className={`${ALERTE} grid gap-3`}>
      <p id="question-sortie" ref={question} tabIndex={-1} className="font-semibold">
        Vos modifications ne sont pas enregistrées. Quitter quand même{NB}?
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BOUTON_PLEIN} onClick={rester}>Rester</button>
        <button type="button" className={`${BOUTON} bg-creme`} onClick={() => onQuitter(avant.current)}>Quitter sans enregistrer</button>
      </div>
    </div>
  );
}

function Contenu() {
  const [params, setParams] = useSearchParams();
  const demande = params.get('onglet');
  const onglet: Onglet = estOnglet(demande) ? demande : 'sequence';
  const demandeModele = params.get('modele');
  const cleModele = onglet === 'sequence' && estEtape(demandeModele) ? demandeModele : null;
  const ecrireA = onglet === 'dates' ? params.get('ecrire') : null;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  // Vrai quand l'éditeur est ouvert depuis la frise (et non par l'adresse) : il prend alors le focus.
  const ouvertDepuisLaFrise = useRef(false);
  const {
    client, jeton, emailAdmin, erreurClient, donnees, etat, actualisation, recharger, remplacerModele, remplacerInfos,
  } = useDonneesEmails();

  // Brouillons à protéger : l'éditeur et chaque message aux inscrits commencé.
  const [brouillons, setBrouillons] = useState<Record<string, boolean>>({});
  const signalerBrouillon = useCallback((cle: string, modifie: boolean) => {
    setBrouillons((avant) => (Boolean(avant[cle]) === modifie ? avant : { ...avant, [cle]: modifie }));
  }, []);
  const signalerEditeur = useCallback((modifie: boolean) => signalerBrouillon('modele', modifie), [signalerBrouillon]);
  const aProteger = Object.values(brouillons).some(Boolean);
  const bloquer = useCallback<BlockerFunction>(({ currentLocation, nextLocation }) => (
    aProteger && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search)
  ), [aProteger]);
  const blocker = useBlocker(bloquer);

  useEffect(() => {
    if (!aProteger) return;
    const avertir = (evenement: BeforeUnloadEvent) => { evenement.preventDefault(); };
    window.addEventListener('beforeunload', avertir);
    return () => window.removeEventListener('beforeunload', avertir);
  }, [aProteger]);

  // Sortie confirmée depuis un onglet : le focus ira sur l'onglet de destination.
  const ongletApresSortie = useRef<Onglet | null>(null);
  function quitter(avant: Element | null) {
    if (blocker.state !== 'blocked') return;
    if (avant instanceof HTMLElement && avant.getAttribute('role') === 'tab' && blocker.location.pathname === window.location.pathname) {
      const destination = new URLSearchParams(blocker.location.search).get('onglet');
      ongletApresSortie.current = estOnglet(destination) ? destination : 'sequence';
    }
    blocker.proceed();
  }

  // Éditeur refermé (lien, retour) : le focus revient sur « Modifier l'email » de l'étape ; après une
  // sortie confirmée depuis un onglet, sur l'onglet de destination.
  const modelePrecedent = useRef<Etape | null>(cleModele);
  useEffect(() => {
    const precedent = modelePrecedent.current;
    modelePrecedent.current = cleModele;
    const ongletVise = ongletApresSortie.current;
    if (ongletVise) {
      ongletApresSortie.current = null;
      requestAnimationFrame(() => document.getElementById(`onglet-emails-${ongletVise}`)?.focus());
    } else if (precedent && !cleModele && onglet === 'sequence') {
      requestAnimationFrame(() => document.getElementById(`modifier-${precedent}`)?.focus());
    }
  }, [cleModele, onglet]);

  // ?ecrire= ne sert qu'à l'arrivée : la carte l'a lu à son montage.
  useEffect(() => {
    if (!ecrireA || donnees.statut !== 'ok') return;
    setParams((avant) => {
      const copie = new URLSearchParams(avant);
      copie.delete('ecrire');
      return copie;
    }, { replace: true });
  }, [ecrireA, donnees.statut, setParams]);

  function activer(cle: Onglet, focalise = false) {
    setParams((avant) => {
      const copie = new URLSearchParams(avant);
      copie.delete('modele');
      copie.delete('ecrire');
      if (cle === 'sequence') copie.delete('onglet');
      else copie.set('onglet', cle);
      return copie;
    }, { replace: true });
    if (focalise && !aProteger) {
      const index = ONGLETS.findIndex((element) => element.cle === cle);
      // Laisser React peindre le nouvel aria-selected avant de déplacer le focus.
      setTimeout(() => refs.current[index]?.focus(), 0);
    }
  }

  function ouvrirModele(cle: Etape | null) {
    ouvertDepuisLaFrise.current = cle !== null;
    setParams((avant) => {
      const copie = new URLSearchParams(avant);
      copie.delete('onglet');
      if (cle) copie.set('modele', cle);
      else copie.delete('modele');
      return copie;
    });
  }

  function ecrireAuxInscrits(calendrierId: string) {
    setParams((avant) => {
      const copie = new URLSearchParams(avant);
      copie.delete('modele');
      copie.set('onglet', 'dates');
      copie.set('ecrire', calendrierId);
      return copie;
    });
  }

  function onTouche(evenement: KeyboardEvent<HTMLButtonElement>, index: number) {
    const dernier = ONGLETS.length - 1;
    let suivant: number | null = null;
    if (evenement.key === 'ArrowRight') suivant = index === dernier ? 0 : index + 1;
    else if (evenement.key === 'ArrowLeft') suivant = index === 0 ? dernier : index - 1;
    else if (evenement.key === 'Home') suivant = 0;
    else if (evenement.key === 'End') suivant = dernier;
    if (suivant === null) return;
    evenement.preventDefault();
    activer(ONGLETS[suivant].cle, true);
  }

  function panneau() {
    if (erreurClient) return <p role="alert" className="text-rouge-alerte">{erreurClient}</p>;
    if (donnees.statut === 'chargement' || !client) return <p role="status">Lecture des emails…</p>;
    if (donnees.statut === 'erreur') {
      return (
        <div className="grid justify-items-start gap-3">
          <p role="alert" className="text-rouge-alerte">{donnees.message}</p>
          {donnees.code ? <p className="text-xs text-encre-2">Code technique{NB}: {donnees.code}</p> : null}
          <button type="button" className={BOUTON} onClick={() => recharger()}>Réessayer</button>
        </div>
      );
    }
    const { modeles, dates, bilan, rattaches } = donnees.valeur;
    if (onglet === 'dates') {
      return <Dates dates={dates} rattaches={rattaches} modeles={modeles} client={client} jeton={jeton} etat={etat}
        ecrireA={ecrireA} onInfos={remplacerInfos} onModifie={signalerBrouillon} />;
    }
    if (onglet === 'envois') {
      return <Envois bilan={bilan} modeles={modeles} dates={dates} etat={etat} client={client}
        actualisation={actualisation} onActualiser={() => recharger(true)} />;
    }
    const modele = cleModele ? modeles.find((ligne) => ligne.cle === cleModele) : undefined;
    if (cleModele && !modele) {
      return (
        <div className="grid justify-items-start gap-3">
          <p>Ce modèle n’est pas encore en base. Les textes de départ sont créés au démarrage du serveur.</p>
          <button type="button" className={BOUTON} onClick={() => ouvrirModele(null)}>← Toute la séquence</button>
        </div>
      );
    }
    if (modele) {
      return <Editeur key={modele.cle} modele={modele} dates={dates} client={client} jeton={jeton} emailAdmin={emailAdmin}
        focaliser={ouvertDepuisLaFrise.current} onEnregistre={remplacerModele} onModifie={signalerEditeur} onFermer={() => ouvrirModele(null)} />;
    }
    return <Sequence modeles={modeles} dates={dates} bilan={bilan} rattaches={rattaches} etat={etat} client={client}
      onModele={remplacerModele} onOuvrir={ouvrirModele} onEcrire={ecrireAuxInscrits} />;
  }

  // min-w-0 sur chaque élément de grille : un tableau large défile dans sa carte, pas la page.
  return (
    <div className="grid min-w-0 gap-5">
      <div role="tablist" aria-label="Onglets des e-mails" className="flex flex-wrap gap-2">
        {ONGLETS.map((element, index) => {
          const actif = element.cle === onglet;
          return (
            <button
              key={element.cle}
              ref={(bouton) => { refs.current[index] = bouton; }}
              type="button"
              role="tab"
              id={`onglet-emails-${element.cle}`}
              aria-selected={actif}
              // Seul le panneau actif est rendu : l'onglet inactif ne pointe vers aucun élément absent.
              aria-controls={actif ? `panneau-emails-${element.cle}` : undefined}
              tabIndex={actif ? 0 : -1}
              onClick={() => activer(element.cle)}
              onKeyDown={(evenement) => onTouche(evenement, index)}
              className={`${BOUTON} ${actif ? 'bg-encre text-sable' : ''}`}
            >
              {element.libelle}
            </button>
          );
        })}
      </div>

      {blocker.state === 'blocked' ? <ConfirmationSortie onQuitter={quitter} onRester={() => blocker.reset()} /> : null}

      <div role="tabpanel" id={`panneau-emails-${onglet}`} aria-labelledby={`onglet-emails-${onglet}`} className="min-w-0">
        {panneau()}
      </div>
    </div>
  );
}
