/**
 * Données de l'admin des e-mails : types alignés sur la migration 20261017160000_sequence_emails.sql,
 * lectures sous RLS (admin AAL2) et appels aux endpoints /api/admin/emails/* du serveur.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ETAPES, type Etape } from '../../../../serveur/gabarits-emails.mjs';
import { useClientAdmin } from '../CadreAdmin';
import { decalerJour, jourParisDe, LIBELLES_RAISONS } from './outils';

const NB = '\u00a0';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModeleEmailLigne = {
  cle: Etape;
  nom: string;
  actif: boolean;
  sujet: string;
  preheader: string;
  corps: string;
  encart: string | null;
  jours_decalage: number | null;
  heure_envoi: string | null;
  modifie_le: string;
};

/** Les seules colonnes que l'admin peut écrire (grant update de la migration). */
export type MajModele = Partial<Pick<ModeleEmailLigne,
  'actif' | 'sujet' | 'preheader' | 'corps' | 'encart' | 'jours_decalage' | 'heure_envoi'>>;

export type StatutSoiree = 'brouillon' | 'publiee' | 'en_cours' | 'terminee' | 'reportee' | 'annulee';

export type SoireeLiee = {
  slug: string;
  statut: StatutSoiree;
  soiree_manades?: { ordre: number; manades: { nom: string } | null }[] | null;
};

export type DateCalendrier = {
  id: string;
  nom: string;
  ville: string;
  arenes: string | null;
  date_soiree: string;
  heure: string | null;
  statut: 'previsionnelle' | 'confirmee' | 'annulee';
  lien_billetterie: string | null;
  infos_pratiques: string | null;
  soiree_id: string | null;
  soiree: SoireeLiee | null;
};

export type StatutEnvoi = 'en_attente' | 'envoye' | 'simule' | 'echec' | 'saute';

/** Une ligne de la vue bilan_envois_emails. */
export type LigneBilan = {
  etape: Etape;
  calendrier_id: string | null;
  reel: boolean;
  statut: StatutEnvoi;
  nombre: number;
  dernier_envoi: string | null;
};

export type ModeEnvoi = 'off' | 'log' | 'smtp';

/** Réponse de GET /api/admin/emails/etat. */
export type EtatEmails = {
  mode: ModeEnvoi;
  pret: boolean;
  cleLiens: boolean;
  dernierPassage: string | null;
  dernierBilan: Partial<Record<'reserves' | 'envoyes' | 'simules' | 'echecs' | 'sautes', number>> | null;
};

export type EtatChargement<T> =
  | { statut: 'chargement' }
  | { statut: 'ok'; valeur: T }
  | { statut: 'erreur'; message: string; code?: string | null };

export const COLONNES_MODELE = 'cle, nom, actif, sujet, preheader, corps, encart, jours_decalage, heure_envoi, modifie_le';
const COLONNES_DATE = 'id, nom, ville, arenes, date_soiree, heure, statut, lien_billetterie, infos_pratiques, soiree_id, '
  + 'soiree:soirees(slug, statut, soiree_manades(ordre, manades(nom)))';
const COLONNES_BILAN = 'etape, calendrier_id, reel, statut, nombre, dernier_envoi';

// ---------------------------------------------------------------------------
// Appels aux endpoints admin du serveur
// ---------------------------------------------------------------------------

export type ReponseApi<T> = { ok: true; donnees: T } | { ok: false; statut: number; message: string };

/** Codes `error` des endpoints admin (serveur/emails.mjs), dits à l'organisateur. */
const MESSAGES_ERREUR: Readonly<Record<string, string>> = {
  planificateur_inactif: `L’envoi est arrêté sur le serveur (mode off ou configuration incomplète)${NB}: rien ne peut partir.`,
  service_indisponible: `Le service d’envoi est indisponible${NB}: sa configuration sur le serveur est incomplète.`,
  adresse_admin_absente: `Votre compte n’a pas d’adresse email${NB}: le test ne peut pas partir.`,
  brouillon_invalide: `Le serveur n’a pas pu rendre ce texte${NB}: vérifiez les liens et la mise en forme.`,
  format_invalide: `Le serveur a refusé ce texte${NB}: vérifiez l’objet (200 caractères au plus) et le corps.`,
  corps_par_defaut: 'Écrivez votre message avant d’envoyer.',
  date_introuvable: 'Cette date n’existe plus au calendrier. Rechargez la page.',
  envoi_impossible: 'Le serveur d’envoi a refusé l’email. Réessayez dans quelques minutes.',
};

function messageErreur(statut: number, code: unknown): string {
  if (typeof code === 'string' && MESSAGES_ERREUR[code]) return MESSAGES_ERREUR[code];
  if (statut === 401) return 'Votre session a expiré. Reconnectez-vous depuis l’administration.';
  if (statut === 403) return 'Action réservée aux administrateurs connectés avec la double authentification.';
  if (statut === 429) return 'Trop d’essais en peu de temps. Réessayez dans une heure.';
  if (statut === 503) return MESSAGES_ERREUR.service_indisponible;
  return 'Le serveur n’a pas répondu comme prévu. Réessayez.';
}

/** GET (sans corps) ou POST JSON avec le jeton de la session admin. */
export async function appelerApiAdmin<T>(chemin: string, jeton: string, corps?: unknown): Promise<ReponseApi<T>> {
  try {
    const reponse = await fetch(chemin, {
      method: corps === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${jeton}`,
        ...(corps === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    const donnees: unknown = await reponse.json().catch(() => null);
    if (!reponse.ok || donnees === null || typeof donnees !== 'object') {
      const code = donnees && typeof donnees === 'object' && 'error' in donnees ? donnees.error : null;
      return { ok: false, statut: reponse.status, message: messageErreur(reponse.status, code) };
    }
    return { ok: true, donnees: donnees as T };
  } catch {
    return { ok: false, statut: 0, message: 'Le serveur est injoignable. Vérifiez la connexion et réessayez.' };
  }
}

// ---------------------------------------------------------------------------
// Écritures sous RLS
// ---------------------------------------------------------------------------

type Ecriture<T> = { ok: true; valeur: T } | { ok: false; message: string };

function messageEcriture(code: string | undefined): string {
  if (code === '23514') return `Un champ dépasse les limites permises. Vérifiez les longueurs et le réglage «${NB}Quand${NB}».`;
  if (code === 'PGRST116' || code === '42501') return `Enregistrement refusé${NB}: vérifiez votre accès administrateur.`;
  return 'L’enregistrement a échoué. Réessayez.';
}

export async function enregistrerModele(client: SupabaseClient, cle: Etape, champs: MajModele): Promise<Ecriture<ModeleEmailLigne>> {
  const { data, error } = await client.from('modeles_emails').update(champs).eq('cle', cle).select(COLONNES_MODELE).single();
  if (error || !data) return { ok: false, message: messageEcriture(error?.code) };
  return { ok: true, valeur: data as unknown as ModeleEmailLigne };
}

export async function enregistrerInfosPratiques(client: SupabaseClient, id: string, infos: string | null): Promise<Ecriture<string | null>> {
  const { data, error } = await client.from('calendrier').update({ infos_pratiques: infos }).eq('id', id).select('id, infos_pratiques').single();
  if (error || !data) return { ok: false, message: messageEcriture(error?.code) };
  return { ok: true, valeur: (data as { infos_pratiques: string | null }).infos_pratiques };
}

// ---------------------------------------------------------------------------
// Lectures
// ---------------------------------------------------------------------------

/** Rattachés confirmés et non désinscrits : ceux qui reçoivent les étapes et le message de la date. */
async function compterRattaches(client: SupabaseClient, calendrierId: string): Promise<number> {
  const { count, error } = await client.from('rattachements_emails')
    .select('destinataire_id, destinataires_emails!inner(id)', { count: 'exact', head: true })
    .eq('calendrier_id', calendrierId)
    .is('destinataires_emails.desinscrit_le', null)
    .not('destinataires_emails.confirme_le', 'is', null);
  if (error) throw error;
  return count ?? 0;
}

export type DonneesEmails = {
  modeles: ModeleEmailLigne[];
  /** Dates du calendrier à partir de J-8 (étapes « après » encore possibles), dans l'ordre. */
  dates: DateCalendrier[];
  bilan: LigneBilan[];
  /** Inscrits par date, ou null si le comptage a échoué. */
  rattaches: Record<string, number> | null;
};

const ordreEtape = (cle: Etape) => ETAPES.indexOf(cle);

/**
 * Tout ce que les onglets partagent : modèles, calendrier, bilan, inscrits par date, état du serveur.
 * Les écritures remplacent la ligne en place, sans tout relire.
 */
export function useDonneesEmails() {
  const { client, session, erreurClient } = useClientAdmin();
  const jeton = session?.access_token ?? null;
  const [donnees, setDonnees] = useState<EtatChargement<DonneesEmails>>({ statut: 'chargement' });
  const [etat, setEtat] = useState<EtatChargement<EtatEmails>>({ statut: 'chargement' });
  // Silencieux : les données affichées restent en place pendant la relecture (« Actualiser »).
  const [lecture, setLecture] = useState({ revision: 0, silencieuse: false });
  const [actualisation, setActualisation] = useState(false);

  useEffect(() => {
    if (!client) return;
    let actif = true;
    if (lecture.silencieuse) setActualisation(true);
    else setDonnees({ statut: 'chargement' });
    void (async () => {
      try {
        const depuis = decalerJour(jourParisDe(new Date()), -8);
        const [modeles, dates, bilan] = await Promise.all([
          client.from('modeles_emails').select(COLONNES_MODELE),
          client.from('calendrier').select(COLONNES_DATE).gte('date_soiree', depuis)
            .order('date_soiree').order('heure', { nullsFirst: false }),
          client.from('bilan_envois_emails').select(COLONNES_BILAN),
        ]);
        if (modeles.error || dates.error || bilan.error) throw modeles.error ?? dates.error ?? bilan.error;
        const lignesDates = (dates.data ?? []) as unknown as DateCalendrier[];
        let rattaches: Record<string, number> | null = null;
        try {
          const comptes = await Promise.all(lignesDates.map((date) => compterRattaches(client, date.id)));
          rattaches = Object.fromEntries(lignesDates.map((date, index) => [date.id, comptes[index]]));
        } catch {
          rattaches = null;
        }
        if (!actif) return;
        setDonnees({
          statut: 'ok',
          valeur: {
            modeles: ((modeles.data ?? []) as unknown as ModeleEmailLigne[])
              .filter((modele) => ordreEtape(modele.cle) >= 0)
              .sort((a, b) => ordreEtape(a.cle) - ordreEtape(b.cle)),
            dates: lignesDates,
            bilan: (bilan.data ?? []) as unknown as LigneBilan[],
            rattaches,
          },
        });
      } catch (erreur) {
        // Le code PostgREST (42P01, 42501, PGRST200…) suffit au diagnostic : jamais le détail de la réponse.
        const code = erreur && typeof erreur === 'object' && 'code' in erreur && typeof erreur.code === 'string' ? erreur.code : null;
        // Jamais l'objet entier : il peut porter des détails de la base.
        console.error('Admin des emails : lecture impossible', code ?? (erreur instanceof Error ? erreur.name : 'inconnue'));
        if (actif) setDonnees({ statut: 'erreur', code, message: 'Les données des emails sont illisibles. Vérifiez que la migration est appliquée, puis réessayez.' });
      } finally {
        if (actif) setActualisation(false);
      }
    })();
    return () => { actif = false; };
  }, [client, lecture]);

  useEffect(() => {
    if (!jeton) return;
    let actif = true;
    void appelerApiAdmin<EtatEmails>('/api/admin/emails/etat', jeton).then((reponse) => {
      if (!actif) return;
      setEtat(reponse.ok ? { statut: 'ok', valeur: reponse.donnees } : { statut: 'erreur', message: reponse.message });
    });
    return () => { actif = false; };
  }, [jeton, lecture.revision]);

  /** Relit tout ; `silencieuse` garde l'écran en place pendant la relecture. */
  const recharger = useCallback((silencieuse = false) => {
    setLecture((avant) => ({ revision: avant.revision + 1, silencieuse }));
  }, []);

  const remplacerModele = useCallback((ligne: ModeleEmailLigne) => {
    setDonnees((avant) => avant.statut !== 'ok' ? avant : {
      statut: 'ok',
      valeur: { ...avant.valeur, modeles: avant.valeur.modeles.map((modele) => (modele.cle === ligne.cle ? ligne : modele)) },
    });
  }, []);

  const remplacerInfos = useCallback((id: string, infos: string | null) => {
    setDonnees((avant) => avant.statut !== 'ok' ? avant : {
      statut: 'ok',
      valeur: { ...avant.valeur, dates: avant.valeur.dates.map((date) => (date.id === id ? { ...date, infos_pratiques: infos } : date)) },
    });
  }, []);

  return {
    client,
    jeton,
    emailAdmin: session?.user.email ?? null,
    erreurClient,
    donnees,
    etat,
    actualisation,
    recharger,
    remplacerModele,
    remplacerInfos,
  };
}

// ---------------------------------------------------------------------------
// Comptes de l'onglet Envois
// ---------------------------------------------------------------------------

/** Raisons libellées (calcul des échéances et contrôles au moment de l'envoi). */
export const RAISONS_CONNUES: readonly string[] = Object.keys(LIBELLES_RAISONS);

export type ComptesEnvois = {
  /** Envois sautés ou en échec, par raison. */
  raisons: Record<string, number>;
  abonnes: number;
  aConfirmer: number;
  annonces: number;
  desinscrits: number;
  /** Nom des dates citées par le bilan, y compris les plus anciennes. */
  dates: Record<string, Pick<DateCalendrier, 'id' | 'nom' | 'ville' | 'date_soiree'>>;
};

async function compter(requete: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count, error } = await requete;
  if (error) throw error;
  return count ?? 0;
}

export function useComptesEnvois(client: SupabaseClient | null, calendrierIds: readonly string[], revision: number) {
  const [comptes, setComptes] = useState<EtatChargement<ComptesEnvois>>({ statut: 'chargement' });
  const cleIds = calendrierIds.join(',');

  useEffect(() => {
    if (!client) return;
    let actif = true;
    // Une relecture garde les comptes affichés jusqu'aux nouveaux.
    setComptes((avant) => (avant.statut === 'ok' ? avant : { statut: 'chargement' }));
    const ids = cleIds ? cleIds.split(',') : [];
    const destinataires = () => client.from('destinataires_emails').select('id', { count: 'exact', head: true });
    void (async () => {
      try {
        const [raisons, abonnes, aConfirmer, annonces, desinscrits, dates] = await Promise.all([
          // Un envoi en attente peut porter une raison (nouvel essai prévu) : seuls les sautés et les échecs comptent.
          Promise.all(RAISONS_CONNUES.map((raison) => compter(
            client.from('envois_emails').select('id', { count: 'exact', head: true })
              .eq('raison', raison).in('statut', ['saute', 'echec']),
          ))),
          compter(destinataires().eq('abonne', true).eq('abonnement_a_confirmer', false)),
          compter(destinataires().eq('abonnement_a_confirmer', true)),
          compter(destinataires().eq('annonces', true).is('desinscrit_le', null)),
          compter(destinataires().not('desinscrit_le', 'is', null)),
          ids.length ? client.from('calendrier').select('id, nom, ville, date_soiree').in('id', ids) : Promise.resolve({ data: [], error: null }),
        ]);
        if (dates.error) throw dates.error;
        if (!actif) return;
        const lignes = (dates.data ?? []) as Pick<DateCalendrier, 'id' | 'nom' | 'ville' | 'date_soiree'>[];
        setComptes({
          statut: 'ok',
          valeur: {
            raisons: Object.fromEntries(RAISONS_CONNUES.map((raison, index) => [raison, raisons[index]])),
            abonnes,
            aConfirmer,
            annonces,
            desinscrits,
            dates: Object.fromEntries(lignes.map((ligne) => [ligne.id, ligne])),
          },
        });
      } catch {
        if (actif) setComptes({ statut: 'erreur', message: 'Les compteurs des envois sont illisibles. Réessayez.' });
      }
    })();
    return () => { actif = false; };
  }, [client, cleIds, revision]);

  return comptes;
}
