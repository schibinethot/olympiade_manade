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

function client(): SupabaseClient {
  try {
    return supabase();
  } catch (erreur) {
    throw new ErreurDonnees(erreur instanceof Error ? erreur.message : String(erreur));
  }
}

/**
 * Les lectures acceptent un signal d'abandon. postgrest-js refait jusqu'à trois fois une lecture
 * qui échoue sur le réseau (après 1, 2 puis 4 s) ; une requête abandonnée n'est pas refaite. Dans
 * le navigateur, le signal borne donc l'attente d'une navigation quand Supabase ne répond pas.
 */
export async function lireCalendrier(signal?: AbortSignal): Promise<Calendrier[]> {
  const requete = client()
    .from('calendrier')
    .select('id, annee, nom, ville, arenes, date_soiree, heure, statut, lien_billetterie')
    .order('date_soiree');
  const { data, error } = await (signal ? requete.abortSignal(signal) : requete);
  if (error) throw new ErreurDonnees(`Calendrier indisponible : ${error.message}`);
  return data as Calendrier[];
}

export async function lirePalmares(signal?: AbortSignal): Promise<Palmares[]> {
  const requete = client()
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
  const { error } = await client().from('messages_contact').insert(champs);
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
