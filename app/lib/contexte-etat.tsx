import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ETAT_SOIREE, type EtatSoiree } from './etat-soiree';

export type InstantanePublic = {
  etat: EtatSoiree;
  source: 'fige' | 'instantane';
  /** Horodatage de la dernière écriture de l’instantané, quand le serveur le fournit. */
  calculeLe?: string | null;
  soiree: {
    id: string;
    slug: string;
    nom: string;
    lieu: string | null;
    dateSoiree: string | null;
    statut: string;
    messagePublic: string | null;
    modeVote: string;
    classementVisible: boolean;
    voteDebut: string;
    voteFin: string;
    epreuveEnCours: string | null;
    manadeEnPiste: string | null;
    passages: { id: string; epreuve: string; manade: string; ordre: number; statutEffectif: string; statutJury: string; fermeLe: string | null; votes: number }[];
    classements: {
      provisoire: boolean;
      officiel: 'separe' | 'combine' | 'jury';
      methode: 'points' | 'moyenne';
      parEpreuve: { epreuveId: string; nom: string; ordre: number; public: Ligne[] | null; jury: Ligne[] | null; combine: Ligne[] | null }[];
      general: { public: LigneGeneral[] | null; jury: LigneGeneral[] | null; combine: LigneGeneral[] | null };
    } | null;
  } | null;
};

type Ligne = { manadeId: string; manadeNom: string; score: number; votes: number | null; rang: number; points: number };
type LigneGeneral = { manadeId: string; manadeNom: string; total: number; epreuves: number; rang: number };

const FIGE: InstantanePublic = { etat: ETAT_SOIREE, source: 'fige', soiree: null };
const Contexte = createContext<InstantanePublic>(FIGE);

function estInstantane(valeur: unknown): valeur is InstantanePublic {
  if (!valeur || typeof valeur !== 'object') return false;
  const etat = (valeur as { etat?: unknown }).etat;
  return etat === 'hors-soiree' || etat === 'ouvert';
}

/** Relit l’instantané public. Sans ETAT_SOIREE_REEL, le serveur répond toujours hors soirée. */
export function FournisseurEtatSoiree({ children }: { children: ReactNode }) {
  const [instantane, setInstantane] = useState<InstantanePublic>(FIGE);

  useEffect(() => {
    let arrete = false;
    async function lire() {
      if (document.visibilityState === 'hidden') return;
      try {
        const reponse = await fetch('/api/etat-soiree', { cache: 'no-store' });
        if (!reponse.ok) return;
        const corps: unknown = await reponse.json();
        if (!arrete && estInstantane(corps)) setInstantane(corps);
      } catch {
        // Le pré-rendu hors soirée reste affiché.
      }
    }
    void lire();
    const minuteur = setInterval(() => void lire(), 8_000);
    document.addEventListener('visibilitychange', lire);
    return () => {
      arrete = true;
      clearInterval(minuteur);
      document.removeEventListener('visibilitychange', lire);
    };
  }, []);

  return <Contexte.Provider value={instantane}>{children}</Contexte.Provider>;
}

export function useInstantanePublic(): InstantanePublic {
  return useContext(Contexte);
}
