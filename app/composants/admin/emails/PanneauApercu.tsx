/**
 * Panneau d'aperçu : date et prénom d'exemple, infos d'exemple, encart de bienvenue, personne qui a
 * accepté ou non les annonces, moment simulé et légende, autour d'ApercuEmail. Partagé par l'éditeur
 * des modèles et le message aux inscrits. L'identité de l'organisateur (pied des emails) est lue dans
 * identite_legale, comme les mentions légales : sans elle, un avertissement dit qu'aucun email réel
 * ne partira.
 */

import { useMemo, useState } from 'react';
import type { Etape, ModeleEmail } from '../../../../serveur/gabarits-emails.mjs';
import { ligneOrganisateur } from '../../../lib/identite';
import { useIdentiteLegale } from '../../../lib/useIdentiteLegale';
import { CHAMP } from '../CadreAdmin';
import { ApercuEmail, type LargeurApercu } from './ApercuEmail';
import type { DateCalendrier } from './donnees';
import { annoncesParDefaut, aUneEcheance, instantEnClair, libelleOptionDate, preparerApercu, type ContexteApercu } from './outils';
import { ALERTE, CIBLE } from './styles';

const NB = '\u00a0';
const CASE = `flex ${CIBLE} items-center gap-2`;

type Preparation = { ok: true; contexte: ContexteApercu; instant: Date } | { ok: false; message: string };

export function PanneauApercu({ id, cle, modele, reglage, dates, dateId, onDateId, niveauTitre }: {
  id: string;
  cle: Etape;
  modele: ModeleEmail;
  reglage: { jours_decalage: number | null; heure_envoi: string | null };
  dates: readonly DateCalendrier[];
  dateId: string;
  /** Sans lui, la date est fixe (message aux inscrits d'une date) : pas de liste. */
  onDateId?: (id: string) => void;
  niveauTitre: 3 | 4;
}) {
  const [prenom, setPrenom] = useState('Camille');
  const [exemples, setExemples] = useState(false);
  const [encart, setEncart] = useState(true);
  const [annonces, setAnnonces] = useState(() => annoncesParDefaut(cle));
  const [largeur, setLargeur] = useState<LargeurApercu>('mobile');
  const [maintenant] = useState(() => new Date());
  const [origine] = useState(() => (typeof window === 'undefined' ? 'https://olympiadedesmanades.fr' : window.location.origin));
  const date = dates.find((ligne) => ligne.id === dateId) ?? null;
  const identite = useIdentiteLegale();
  const organisateur = ligneOrganisateur(identite.identite);

  const preparation = useMemo((): Preparation => {
    try {
      return { ok: true, ...preparerApercu({ cle, reglage, date, dates, prenom, origine, maintenant, exemples, encart, annonces, organisateur }) };
    } catch (exception) {
      return { ok: false, message: exception instanceof Error ? exception.message : 'erreur inconnue' };
    }
  }, [cle, reglage, date, dates, prenom, origine, maintenant, exemples, encart, annonces, organisateur]);

  const pour = prenom.trim() ? `pour ${prenom.trim()}` : 'sans prénom';
  const instant = preparation.ok ? preparation.instant : maintenant;
  const legende = aUneEcheance(cle) && instant !== maintenant ? `Tel qu’il partira le ${instantEnClair(instant)}, ${pour}.`
    : cle === 'bienvenue' && preparation.ok && preparation.contexte.encartDateProche ? `Tel que reçu 3 jours avant la date, ${pour}.`
      : `Tel qu’il partirait maintenant, ${pour}.`;

  return (
    <div className="grid min-w-0 content-start gap-3">
      <div className="grid gap-2">
        <div className="grid grid-cols-[minmax(0,1fr)_8rem] items-end gap-2">
          {onDateId ? (
            <div className="grid min-w-0 gap-1">
              <label htmlFor={`${id}-date`} className="text-sm font-semibold">Date d’exemple</label>
              <select id={`${id}-date`} className={CHAMP} value={dateId} onChange={(evenement) => onDateId(evenement.target.value)}>
                {dates.length ? null : <option value="">Aucune date au calendrier</option>}
                {dates.map((ligne) => <option key={ligne.id} value={ligne.id}>{libelleOptionDate(ligne)}</option>)}
              </select>
            </div>
          ) : (
            <p className="min-w-0 self-center text-sm text-encre-2">Date{NB}: {date ? libelleOptionDate(date) : 'aucune'}</p>
          )}
          <div className="grid min-w-0 gap-1">
            <label htmlFor={`${id}-prenom`} className="text-sm font-semibold">Prénom</label>
            <input id={`${id}-prenom`} className={CHAMP} value={prenom} maxLength={60} onChange={(evenement) => setPrenom(evenement.target.value)} />
          </div>
        </div>
        <label className={CASE} title="Heure, arènes, billetterie, infos pratiques, manades, vainqueur">
          <input type="checkbox" className="h-4 w-4 shrink-0 accent-encre" checked={exemples} onChange={(evenement) => setExemples(evenement.target.checked)} />
          Remplir les infos pas encore connues par des exemples
        </label>
        {cle === 'bienvenue' ? (
          <label className={CASE}>
            <input type="checkbox" className="h-4 w-4 shrink-0 accent-encre" checked={encart} onChange={(evenement) => setEncart(evenement.target.checked)} />
            Montrer l’encart «{NB}date proche{NB}»
          </label>
        ) : null}
        {/* Les autres dates ne sont envoyées qu'aux personnes qui ont accepté les annonces (revue juridique B3). */}
        {cle !== 'confirmation' ? (
          <label className={CASE}>
            <input type="checkbox" className="h-4 w-4 shrink-0 accent-encre" checked={annonces} onChange={(evenement) => setAnnonces(evenement.target.checked)} />
            Aperçu pour une personne qui a accepté les annonces
          </label>
        ) : null}
      </div>
      {identite.connue && !organisateur ? (
        <p className={`${ALERTE} text-sm`}>
          Identité de l’organisateur manquante{NB}: aucun email réel ne partira tant qu’elle n’est pas renseignée.
        </p>
      ) : null}
      <ApercuEmail id={`${id}-apercu`} niveauTitre={niveauTitre} modele={modele}
        contexte={preparation.ok ? preparation.contexte : null} erreurContexte={preparation.ok ? null : preparation.message}
        largeur={largeur} onLargeur={setLargeur} legende={legende} />
    </div>
  );
}
