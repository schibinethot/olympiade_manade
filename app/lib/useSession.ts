import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { CLE_SESSION, quandClientCree, sessionPossible, supabase } from './supabase';

export type EtatSession = {
  session: Session | null;
  /** Prénom du profil (table profils, lu par le spectateur lui-même : politique profils_lecture). */
  prenom: string | null;
  /** Vrai tant que la session et le prénom ne sont pas connus (pré-rendu, hydratation, lecture). */
  chargement: boolean;
};

const AU_DEPART: EtatSession = { session: null, prenom: null, chargement: true };
/**
 * Attente maximale de la session (chargement de supabase-js) puis de la lecture du prénom, comme pour
 * les autres lectures du navigateur.
 */
const DELAI_PROFIL_MS = 3000;

// Un seul état pour toute l'application : l'en-tête, la carte de l'accueil et les pages
// d'inscription lisent la même session, avec une seule écoute de Supabase et une seule lecture du
// prénom par connexion.
let etat: EtatSession = AU_DEPART;
const abonnes = new Set<() => void>();
let demarre = false;
let tour = 0;

function publier(suivant: EtatSession) {
  etat = suivant;
  for (const rappel of abonnes) rappel();
}

async function lirePrenom(client: SupabaseClient, session: Session): Promise<string | null> {
  const { data, error } = await client
    .from('profils')
    .select('prenom')
    .eq('id', session.user.id)
    .abortSignal(AbortSignal.timeout(DELAI_PROFIL_MS))
    .maybeSingle<{ prenom: string }>();
  if (!error && typeof data?.prenom === 'string') return data.prenom;
  // Profil illisible (réseau) : prénom envoyé à l'inscription, pour l'affichage seulement.
  const prenom: unknown = session.user.user_metadata?.prenom;
  return typeof prenom === 'string' ? prenom : null;
}

async function appliquer(client: SupabaseClient, session: Session | null) {
  const numero = ++tour;
  if (!session) {
    publier({ session: null, prenom: null, chargement: false });
    return;
  }
  // Même spectateur (jeton rafraîchi, onglet revenu au premier plan) : le prénom est déjà connu.
  if (etat.session?.user.id === session.user.id && etat.prenom) {
    publier({ ...etat, session, chargement: false });
    return;
  }
  publier({ session, prenom: null, chargement: true });
  const prenom = await lirePrenom(client, session).catch(() => null);
  // Une déconnexion ou une autre connexion a pu arriver pendant la lecture : elle l'emporte.
  if (numero === tour) publier({ session, prenom, chargement: false });
}

/** Stockage local du navigateur, ou null s'il est indisponible. */
function stockageLocal(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Charge le client ; sans lui (variables absentes, réseau), personne n'est connecté. Même borne que
 * les lectures du navigateur : si la session n'est pas connue dans le délai (supabase-js lent ou
 * bloqué), la page s'affiche en version non connectée, et la session s'applique si elle arrive ensuite.
 */
function charger() {
  const numero = tour;
  const borne = setTimeout(() => {
    if (tour === numero && etat.chargement) publier({ session: null, prenom: null, chargement: false });
  }, DELAI_PROFIL_MS);
  supabase().catch(() => {
    clearTimeout(borne);
    publier({ session: null, prenom: null, chargement: false });
  });
}

function demarrer() {
  if (demarre) return;
  demarre = true;
  // Écoute de la session dès que le client existe, quel que soit l'appel qui le crée : la relecture
  // ci-dessous, ou la demande d'un code depuis /inscription. INITIAL_SESSION arrive dès
  // l'abonnement, une fois la session relue dans le stockage local (ou le lien de secours de l'email
  // échangé). La doc de supabase-js déconseille d'appeler Supabase dans le rappel lui-même (verrou
  // interne) : la suite est décalée.
  quandClientCree((client) => {
    client.auth.onAuthStateChange((_evenement, session) => {
      setTimeout(() => void appliquer(client, session), 0);
    });
  });
  if (sessionPossible(stockageLocal(), window.location)) {
    charger();
  } else {
    // Aucune session sur cet appareil : personne n'est connecté, et supabase-js reste à charger.
    publier({ session: null, prenom: null, chargement: false });
  }
  // Connexion depuis un autre onglet : la session apparaît dans le stockage, on la relit ici aussi.
  window.addEventListener('storage', (evenement) => {
    if (evenement.key?.startsWith(CLE_SESSION) && evenement.newValue) charger();
  });
}

function sAbonner(rappel: () => void) {
  abonnes.add(rappel);
  demarrer();
  return () => {
    abonnes.delete(rappel);
  };
}

/**
 * Session du spectateur et prénom de son profil.
 *
 * Au pré-rendu et pendant l'hydratation : { session: null, chargement: true }, puis l'état réel du
 * navigateur. Aucun écart d'hydratation.
 */
export function useSession(): EtatSession {
  return useSyncExternalStore(
    sAbonner,
    () => etat,
    () => AU_DEPART,
  );
}
