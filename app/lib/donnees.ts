import { supabase } from './supabase';
import type { DateCalendrier } from './dates';

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

export async function lireCalendrier(): Promise<Calendrier[]> {
  const { data, error } = await supabase
    .from('calendrier')
    .select('id, annee, nom, ville, arenes, date_soiree, heure, statut, lien_billetterie')
    .order('date_soiree');
  if (error) throw new ErreurDonnees(`Calendrier indisponible : ${error.message}`);
  return data as Calendrier[];
}

export async function lirePalmares(): Promise<Palmares[]> {
  const { data, error } = await supabase
    .from('palmares')
    .select('id, annee, evenement, ville, date_soiree, vainqueur, detail, statut, source_url')
    .order('annee', { ascending: false })
    .order('date_soiree', { ascending: false });
  if (error) throw new ErreurDonnees(`Palmarès indisponible : ${error.message}`);
  return data as Palmares[];
}
