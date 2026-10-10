import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { DateCalendrier } from './dates';
import type { ChampsContact } from './contact';

export type Calendrier = DateCalendrier & {
  id: string;
  annee: number;
  nom: string;
  ville: string;
  arenes: string | null;
  lien_billetterie: string | null;
};

export type Palmares = {
  id: string;
  annee: number;
  evenement: string;
  ville: string;
  date_soiree: string | null;
  vainqueur: string;
  detail: string | null;
  statut: 'confirme' | 'a_confirmer';
  source_url: string | null;
};

export class ErreurDonnees extends Error {}

/** Rejette en ErreurDonnees dès l'abandon du signal, sans attendre la promesse. */
function avantAbandon<T>(promesse: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resoudre, rejeter) => {
    const abandon = () => rejeter(new ErreurDonnees('Supabase non chargé dans le délai imparti'));
    if (signal.aborted) {
      abandon();
      return;
    }
    signal.addEventListener('abort', abandon, { once: true });
    promesse.then(resoudre, rejeter).finally(() => signal.removeEventListener('abort', abandon));
  });
}

/**
 * Client Supabase, chargé à la demande ; un échec (variables absentes, réseau) devient ErreurDonnees.
 * Le signal borne aussi le chargement du module supabase-js : un module lent ou bloqué ne retient pas
 * la lecture au-delà du délai (le chargement continue, il servira à la lecture suivante).
 */
async function client(signal?: AbortSignal): Promise<SupabaseClient> {
  try {
    return await (signal ? avantAbandon(supabase(), signal) : supabase());
  } catch (erreur) {
    if (erreur instanceof ErreurDonnees) throw erreur;
    throw new ErreurDonnees(erreur instanceof Error ? erreur.message : String(erreur));
  }
}

/**
 * Les lectures acceptent un signal d'abandon, qui borne le chargement du client puis la requête.
 * postgrest-js refait jusqu'à trois fois une lecture qui échoue sur le réseau (après 1, 2 puis 4 s) ;
 * une requête abandonnée n'est pas refaite. Dans le navigateur, le signal borne donc l'attente d'une
 * navigation quand supabase-js ou Supabase ne répondent pas.
 */
export async function lireCalendrier(signal?: AbortSignal): Promise<Calendrier[]> {
  const requete = (await client(signal))
    .from('calendrier')
    .select('id, annee, nom, ville, arenes, date_soiree, heure, statut, lien_billetterie')
    .order('date_soiree');
  const { data, error } = await (signal ? requete.abortSignal(signal) : requete);
  if (error) throw new ErreurDonnees(`Calendrier indisponible : ${error.message}`);
  return data as Calendrier[];
}

export async function lirePalmares(signal?: AbortSignal): Promise<Palmares[]> {
  const requete = (await client(signal))
    .from('palmares')
    .select('id, annee, evenement, ville, date_soiree, vainqueur, detail, statut, source_url')
    .order('annee', { ascending: false })
    .order('date_soiree', { ascending: false });
  const { data, error } = await (signal ? requete.abortSignal(signal) : requete);
  if (error) throw new ErreurDonnees(`Palmarès indisponible : ${error.message}`);
  return data as Palmares[];
}

/**
 * Dépôt d'un message de contact. Insertion seule, sans .select() : la base ne donne pas à anon le
 * droit de relire la table, et supabase-js n'envoie alors que « return=minimal ».
 */
export async function envoyerMessageContact(champs: ChampsContact): Promise<void> {
  const { error } = await (await client()).from('messages_contact').insert(champs);
  if (error) throw new ErreurDonnees(`Message non enregistré : ${error.message}`);
}

/**
 * Lecture qui ne lève jamais : null si les données sont indisponibles (Supabase injoignable,
 * variables absentes au build). La page affiche alors son repli, et le pré-rendu ne casse pas.
 */
export async function lireOuRepli<T>(lecture: () => Promise<T>): Promise<T | null> {
  try {
    return await lecture();
  } catch (erreur) {
    console.warn(erreur instanceof ErreurDonnees ? erreur.message : `Lecture des données impossible : ${String(erreur)}`);
    return null;
  }
}
