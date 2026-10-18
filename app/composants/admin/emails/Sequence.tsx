/**
 * Frise de la séquence : les 9 e-mails dans l'ordre, avec leur moment d'envoi, leurs destinataires,
 * leur interrupteur et le prochain envoi estimé ; bandeaux du mode d'envoi et des soirées suspendues.
 * Les bandeaux sont persistants : pas de rôle d'alerte, qui les ferait annoncer à chaque affichage.
 */

import { useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { envoisAVenir, type EnvoiEstime } from '../../../../serveur/echeances-emails.mjs';
import { formaterDate, type Etape } from '../../../../serveur/gabarits-emails.mjs';
import { BOUTON, CARTE } from '../CadreAdmin';
import { enregistrerModele, type DateCalendrier, type EtatChargement, type EtatEmails, type LigneBilan, type ModeleEmailLigne } from './donnees';
import { BandeauxServeur } from './EtatServeur';
import {
  aUneEcheance, datesPourEstimation, instantEnClair, jourParisDe, POUR_QUI, prochainEnvoiEnClair, quandEnClair, soireesSuspendues,
} from './outils';
import { ALERTE } from './styles';

const NB = '\u00a0';

/** Ce qui remplace l'estimation pour les e-mails qui ne dépendent pas d'une date. */
const SANS_ESTIMATION: Partial<Record<Etape, string>> = {
  confirmation: 'À chaque nouvelle demande d’abonnement',
  bienvenue: 'À chaque nouvelle inscription confirmée',
  annonce: 'Calculé à chaque passage, selon les consentements',
  message: 'Seulement quand vous l’envoyez',
};

function Interrupteur({ modele, client, idTitre, onModele }: {
  modele: ModeleEmailLigne;
  client: SupabaseClient;
  idTitre: string;
  onModele: (ligne: ModeleEmailLigne) => void;
}) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Contrainte modeles_emails_confirmation_active : sans confirmation, personne ne pourrait confirmer.
  const verrouille = modele.cle === 'confirmation';
  const idAide = `aide-actif-${modele.cle}`;

  async function basculer() {
    if (verrouille || enCours) return;
    setEnCours(true);
    setErreur(null);
    const resultat = await enregistrerModele(client, modele.cle, { actif: !modele.actif });
    setEnCours(false);
    if (resultat.ok) onModele(resultat.valeur);
    else setErreur(resultat.message);
  }

  return (
    <div className="grid justify-items-start gap-1 tablette:justify-items-end">
      {/* Écriture en cours : aria-disabled, l'interrupteur garde le focus (basculer() ignore le clic). */}
      <button type="button" role="switch" aria-checked={modele.actif} aria-labelledby={idTitre}
        aria-describedby={verrouille ? idAide : undefined} disabled={verrouille} aria-disabled={enCours || undefined}
        onClick={() => void basculer()}
        className="group inline-flex min-h-12 items-center gap-3 rounded-xl px-1 text-sm font-semibold disabled:cursor-not-allowed aria-disabled:cursor-wait">
        <span className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-trait bg-lin transition-colors group-aria-checked:border-encre group-aria-checked:bg-encre group-disabled:opacity-60 group-aria-disabled:opacity-60">
          <span className="block h-5 w-5 translate-x-1 rounded-full bg-creme shadow transition-transform group-aria-checked:translate-x-6" />
        </span>
        <span aria-hidden="true">{enCours ? 'Enregistrement…' : modele.actif ? 'Actif' : 'Désactivé'}</span>
      </button>
      {verrouille ? <p id={idAide} className="max-w-56 text-sm text-encre-2 tablette:text-right">Toujours actif{NB}: sans cet email, personne ne pourrait confirmer son adresse.</p> : null}
      {erreur ? <p role="alert" className="text-sm text-rouge-alerte">{erreur}</p> : null}
    </div>
  );
}

function prochainEnvoi(modele: ModeleEmailLigne, estime: EnvoiEstime | undefined, date: DateCalendrier | undefined, inscritsConnus: boolean): string {
  if (!modele.actif) return 'Aucun, l’email est désactivé';
  const sans = SANS_ESTIMATION[modele.cle];
  if (sans) return sans;
  if (!inscritsConnus) return 'Estimation indisponible';
  return prochainEnvoiEnClair(estime, date) ?? 'Aucun dans les 7 prochains jours';
}

export function Sequence({ modeles, dates, bilan, rattaches, etat, client, onModele, onOuvrir, onEcrire }: {
  modeles: readonly ModeleEmailLigne[];
  dates: readonly DateCalendrier[];
  bilan: readonly LigneBilan[];
  rattaches: Record<string, number> | null;
  etat: EtatChargement<EtatEmails>;
  client: SupabaseClient;
  onModele: (ligne: ModeleEmailLigne) => void;
  onOuvrir: (cle: Etape) => void;
  /** Ouvre le message aux inscrits d'une date (onglet Dates). */
  onEcrire: (calendrierId: string) => void;
}) {
  const [maintenant] = useState(() => new Date());
  const parId = useMemo(() => new Map(dates.map((date) => [date.id, date])), [dates]);
  // Soirée liée annulée ou reportée : ses étapes 2 à 5 sont suspendues, l'estimation aussi.
  const premiers = useMemo(() => {
    const parEtape = new Map<string, EnvoiEstime>();
    for (const estime of envoisAVenir(modeles, datesPourEstimation(dates), rattaches ?? {}, maintenant, 7)) {
      if (!parEtape.has(estime.etape)) parEtape.set(estime.etape, estime);
    }
    return parEtape;
  }, [modeles, dates, rattaches, maintenant]);
  const derniers = useMemo(() => {
    const parEtape = new Map<string, { quand: string; reel: boolean }>();
    for (const ligne of bilan) {
      if ((ligne.statut !== 'envoye' && ligne.statut !== 'simule') || !ligne.dernier_envoi) continue;
      const avant = parEtape.get(ligne.etape);
      if (!avant || ligne.dernier_envoi > avant.quand) parEtape.set(ligne.etape, { quand: ligne.dernier_envoi, reel: ligne.reel });
    }
    return parEtape;
  }, [bilan]);
  const suspendues = soireesSuspendues(dates, jourParisDe(maintenant));

  return (
    <div className="grid min-w-0 gap-5">
      <BandeauxServeur etat={etat} />
      {suspendues.map((date) => {
        const statut = date.soiree?.statut === 'annulee' ? 'annulée' : 'reportée';
        return (
          <div key={date.id} className={ALERTE}>
            <p className="font-semibold">Soirée {statut} à {date.ville}, le {formaterDate(date.date_soiree, date.heure).date}.</p>
            <p className="text-sm">
              La soirée liée à cette date est {statut} alors que la date reste confirmée au calendrier{NB}: ses rappels sont suspendus.
              Mettez le calendrier à jour, ou prévenez les inscrits.
            </p>
            <button type="button" className={`${BOUTON} mt-2 bg-creme`} onClick={() => onEcrire(date.id)}>Écrire aux inscrits de cette date</button>
          </div>
        );
      })}
      {rattaches === null ? <p className={ALERTE}>Le nombre d’inscrits par date est illisible{NB}: les estimations sont indisponibles.</p> : null}

      <section className={`${CARTE} min-w-0`} aria-labelledby="titre-mode-emploi">
        <h2 id="titre-mode-emploi" className="font-display text-2xl">Comment ça marche</h2>
        <ul className="mt-3 grid list-disc gap-1.5 pl-5 text-sm">
          <li>Chaque personne inscrite suit la prochaine date confirmée du calendrier, et reçoit les emails ci-dessous, au plus un email automatique par jour.</li>
          <li>«{NB}Modifier l’email{NB}» ouvre le texte avec un aperçu en direct. Les infos (date, heure, arènes…) se remplissent seules, et une ligne dont l’info n’est pas encore connue n’apparaît pas.</li>
          <li>L’interrupteur arrête ou relance un email tout de suite. Le message aux inscrits d’une date s’écrit depuis l’onglet Dates.</li>
        </ul>
      </section>

      <h2 className="font-display text-2xl">Les {modeles.length} emails</h2>
      {modeles.length === 0 ? (
        <p className={CARTE}>Aucun modèle en base pour le moment. Les textes de départ sont créés au démarrage du serveur{NB}: rechargez la page dans une minute.</p>
      ) : (
        <ol aria-label="Étapes de la séquence" className="grid gap-3">
          {modeles.map((modele, index) => {
            const idTitre = `etape-${modele.cle}`;
            const dernier = derniers.get(modele.cle);
            const estime = premiers.get(modele.cle);
            const lignes: [string, string][] = [
              ['Quand', quandEnClair(modele.cle, modele.jours_decalage, modele.heure_envoi)],
              ['Pour qui', POUR_QUI[modele.cle]],
              [aUneEcheance(modele.cle) ? 'Prochain envoi' : 'Envoi', prochainEnvoi(modele, estime, estime ? parId.get(estime.calendrierId) : undefined, rattaches !== null)],
              ...(dernier ? [['Dernier envoi', `${instantEnClair(dernier.quand)}${dernier.reel ? '' : ' (simulé)'}`] as [string, string]] : []),
            ];
            return (
              <li key={modele.cle} className={`${CARTE} grid gap-4 tablette:grid-cols-[minmax(0,1fr)_auto] tablette:items-start`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-or font-display text-lg text-or-ink">{index + 1}</span>
                    <h3 id={idTitre} className="font-display text-xl">{modele.nom}</h3>
                  </div>
                  <dl className="mt-3 grid gap-1.5 text-sm">
                    {lignes.map(([terme, valeur]) => (
                      <div key={terme} className="grid gap-0.5 tablette:grid-cols-[8.5rem_minmax(0,1fr)]">
                        <dt className="font-semibold text-encre-2">{terme}</dt>
                        <dd>{valeur}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="flex flex-wrap items-start gap-3 tablette:grid tablette:justify-items-end">
                  <Interrupteur modele={modele} client={client} idTitre={idTitre} onModele={onModele} />
                  <button id={`modifier-${modele.cle}`} type="button" className={BOUTON} aria-describedby={idTitre} onClick={() => onOuvrir(modele.cle)}>
                    Modifier l’email
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
