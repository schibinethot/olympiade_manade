import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { COLONNES_IDENTITE, type IdentiteLegale } from './identite';
import { quandClientCree, supabase } from './supabase';

export type LectureIdentite = {
  /** Vrai une fois la lecture terminée, réussie ou non. */
  connue: boolean;
  /** Null si la table est vide, absente ou illisible : l'appelant affiche alors son repli. */
  identite: IdentiteLegale | null;
};

/**
 * Identité de l'organisateur (table identite_legale, même source que les mentions légales).
 *
 * - `immediat` (pages légales, admin) : la lecture charge le client Supabase si besoin.
 * - `differe` (accueil) : la lecture attend que le client existe déjà (première interaction,
 *   session). La page vitrine s'affiche ainsi sans charger supabase-js pour une seule ligne de texte.
 */
export function useIdentiteLegale(chargement: 'immediat' | 'differe' = 'immediat'): LectureIdentite {
  const [lecture, setLecture] = useState<LectureIdentite>({ connue: false, identite: null });

  useEffect(() => {
    let actif = true;
    const lire = (client: SupabaseClient) => {
      void Promise.resolve(client.from('identite_legale').select(COLONNES_IDENTITE).limit(1).maybeSingle())
        .then(({ data, error }) => {
          if (actif) setLecture({ connue: true, identite: error ? null : ((data ?? null) as IdentiteLegale | null) });
        })
        .catch(() => {
          if (actif) setLecture({ connue: true, identite: null });
        });
    };
    if (chargement === 'differe') {
      const retirer = quandClientCree(lire);
      return () => {
        actif = false;
        retirer();
      };
    }
    supabase().then(lire).catch(() => {
      if (actif) setLecture({ connue: true, identite: null });
    });
    return () => {
      actif = false;
    };
  }, [chargement]);

  return lecture;
}
