/**
 * Administration des e-mails de la séquence (design §6).
 *
 * Onglets (?onglet=) : Séquence (frise, éditeur d'un modèle en ?modele=<cle>), Dates (infos
 * pratiques, message aux inscrits), Envois (bilan, mode SMTP, désinscrits). Même schéma ARIA que
 * /admin/cookies : seul le panneau actif est rendu, seul l'onglet actif porte aria-controls.
 */

import { useRef, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router';
import { ETAPES, type Etape } from '../../serveur/gabarits-emails.mjs';
import { BOUTON, CadreAdmin } from '../composants/admin/CadreAdmin';
import { Dates } from '../composants/admin/emails/Dates';
import { useDonneesEmails } from '../composants/admin/emails/donnees';
import { Editeur } from '../composants/admin/emails/Editeur';
import { Envois } from '../composants/admin/emails/Envois';
import { Sequence } from '../composants/admin/emails/Sequence';

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

function Contenu() {
  const [params, setParams] = useSearchParams();
  const demande = params.get('onglet');
  const onglet: Onglet = estOnglet(demande) ? demande : 'sequence';
  const demandeModele = params.get('modele');
  const cleModele = onglet === 'sequence' && estEtape(demandeModele) ? demandeModele : null;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  // Vrai quand l'éditeur est ouvert depuis la frise (et non par l'adresse) : il prend alors le focus.
  const ouvertDepuisLaFrise = useRef(false);
  const { client, jeton, emailAdmin, erreurClient, donnees, etat, recharger, remplacerModele, remplacerInfos } = useDonneesEmails();

  function activer(cle: Onglet, focalise = false) {
    setParams((avant) => {
      const copie = new URLSearchParams(avant);
      copie.delete('modele');
      if (cle === 'sequence') copie.delete('onglet');
      else copie.set('onglet', cle);
      return copie;
    }, { replace: true });
    if (focalise) {
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
          <button type="button" className={BOUTON} onClick={recharger}>Réessayer</button>
        </div>
      );
    }
    const { modeles, dates, bilan, rattaches } = donnees.valeur;
    if (onglet === 'dates') {
      return <Dates dates={dates} rattaches={rattaches} modeleMessage={modeles.find((modele) => modele.cle === 'message')}
        client={client} jeton={jeton} etat={etat} onInfos={remplacerInfos} />;
    }
    if (onglet === 'envois') {
      return <Envois bilan={bilan} modeles={modeles} dates={dates} etat={etat} client={client} onActualiser={recharger} />;
    }
    const modele = cleModele ? modeles.find((ligne) => ligne.cle === cleModele) : undefined;
    if (cleModele && !modele) {
      return (
        <div className="grid justify-items-start gap-3">
          <p role="alert">Ce modèle n’est pas encore en base. Les textes de départ sont créés au démarrage du serveur.</p>
          <button type="button" className={BOUTON} onClick={() => ouvrirModele(null)}>← Toute la séquence</button>
        </div>
      );
    }
    if (modele) {
      return <Editeur key={modele.cle} modele={modele} dates={dates} client={client} jeton={jeton} emailAdmin={emailAdmin}
        focaliser={ouvertDepuisLaFrise.current} onEnregistre={remplacerModele} onFermer={() => ouvrirModele(null)} />;
    }
    return <Sequence modeles={modeles} dates={dates} bilan={bilan} rattaches={rattaches} etat={etat} client={client}
      onModele={remplacerModele} onOuvrir={ouvrirModele} onDates={() => activer('dates')} />;
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

      <div role="tabpanel" id={`panneau-emails-${onglet}`} aria-labelledby={`onglet-emails-${onglet}`} className="min-w-0">
        {panneau()}
      </div>
    </div>
  );
}
