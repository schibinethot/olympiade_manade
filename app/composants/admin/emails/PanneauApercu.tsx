/**
 * Panneau d'aperçu : date et prénom d'exemple, infos d'exemple, encart de bienvenue, moment simulé et
 * légende, autour d'ApercuEmail. Partagé par l'éditeur des modèles et le message aux inscrits.
 */

import { useMemo, useState } from 'react';
import type { ContexteEmail, Etape, ModeleEmail } from '../../../../serveur/gabarits-emails.mjs';
import { CHAMP } from '../CadreAdmin';
import { ApercuEmail, type LargeurApercu } from './ApercuEmail';
import type { DateCalendrier } from './donnees';
import { aUneEcheance, instantEnClair, libelleOptionDate, preparerApercu } from './outils';
import { CIBLE } from './styles';

const NB = ' ';
const CASE = `flex ${CIBLE} items-center gap-2`;

type Preparation = { ok: true; contexte: ContexteEmail; instant: Date } | { ok: false; message: string };

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
  const [largeur, setLargeur] = useState<LargeurApercu>('mobile');
  const [maintenant] = useState(() => new Date());
  const [origine] = useState(() => (typeof window === 'undefined' ? 'https://olympiadedesmanades.fr' : window.location.origin));
  const date = dates.find((ligne) => ligne.id === dateId) ?? null;

  const preparation = useMemo((): Preparation => {
    try {
      return { ok: true, ...preparerApercu({ cle, reglage, date, dates, prenom, origine, maintenant, exemples, encart }) };
    } catch (exception) {
      return { ok: false, message: exception instanceof Error ? exception.message : 'erreur inconnue' };
    }
  }, [cle, reglage, date, dates, prenom, origine, maintenant, exemples, encart]);

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
      </div>
      <ApercuEmail id={`${id}-apercu`} niveauTitre={niveauTitre} modele={modele}
        contexte={preparation.ok ? preparation.contexte : null} erreurContexte={preparation.ok ? null : preparation.message}
        largeur={largeur} onLargeur={setLargeur} legende={legende} />
    </div>
  );
}
