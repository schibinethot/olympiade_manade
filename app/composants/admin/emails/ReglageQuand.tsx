/** Réglage « Quand » d'une étape : jour et heure d'envoi, bornés comme en base, et résumé en clair. */

import type { Etape } from '../../../../serveur/gabarits-emails.mjs';
import { CARTE, CHAMP } from '../CadreAdmin';
import { HEURE_MAX, HEURE_MIN, JOURS_MAX, JOURS_MIN, libelleChoixJours, quandEnClair } from './outils';

const NB = '\u00a0';
const CHOIX_JOURS = Array.from({ length: JOURS_MAX - JOURS_MIN + 1 }, (_, index) => JOURS_MIN + index);

export function ReglageQuand({ cle, datee, jours, heure, erreurJours, erreurHeure, onJours, onHeure }: {
  cle: Etape;
  datee: boolean;
  jours: number | null;
  heure: string;
  erreurJours: string | null;
  erreurHeure: string | null;
  onJours: (jours: number | null) => void;
  onHeure: (heure: string) => void;
}) {
  return (
    <section className={`${CARTE} grid gap-4`} aria-labelledby="titre-quand-modele">
      <h3 id="titre-quand-modele" className="font-display text-xl">Quand</h3>
      {datee ? (
        <>
          <div className="grid gap-4 tablette:grid-cols-2">
            <div className="grid gap-1.5">
              <label htmlFor="modele-jours" className="text-sm font-semibold">Jour d’envoi</label>
              <select id="modele-jours" className={CHAMP} value={jours ?? ''}
                aria-invalid={erreurJours ? true : undefined} aria-describedby={erreurJours ? 'modele-jours-erreur' : undefined}
                onChange={(evenement) => onJours(evenement.target.value === '' ? null : Number(evenement.target.value))}>
                {jours === null ? <option value="">Choisir</option> : null}
                {CHOIX_JOURS.map((choix) => <option key={choix} value={choix}>{libelleChoixJours(choix, cle === 'annonce')}</option>)}
              </select>
              {erreurJours ? <p id="modele-jours-erreur" className="text-sm text-rouge-alerte">{erreurJours}</p> : null}
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="modele-heure" className="text-sm font-semibold">Heure d’envoi</label>
              <input id="modele-heure" type="time" min={HEURE_MIN} max={HEURE_MAX} step={300} className={CHAMP} value={heure}
                aria-invalid={erreurHeure ? true : undefined} aria-describedby={erreurHeure ? 'modele-heure-erreur' : undefined}
                onChange={(evenement) => onHeure(evenement.target.value)} />
              {erreurHeure ? <p id="modele-heure-erreur" className="text-sm text-rouge-alerte">{erreurHeure}</p> : null}
            </div>
          </div>
          <p className="text-sm text-encre-2">
            {quandEnClair(cle, jours, heure || null)}, heure de Paris. Réglable de 14 jours avant à 7 jours après la date,
            entre 7{NB}h et 21{NB}h.
          </p>
        </>
      ) : (
        <p className="text-sm">{quandEnClair(cle, null, null)}. Cet email ne se règle pas sur une date.</p>
      )}
    </section>
  );
}
