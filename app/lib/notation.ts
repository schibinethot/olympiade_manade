import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type PassageNotation = { id: string; ordre: number; statut_public: 'a_venir' | 'ouvert' | 'clos'; manades: { nom: string } };
export type EpreuveNotation = { id: string; nom: string; ordre: number; notee: boolean; passages: PassageNotation[] };
export type SoireeNotation = {
  id: string; nom: string; date_soiree: string; mode_vote: 'libre' | 'deblocage';
  vote_debut: string; vote_fin: string; statut: 'publiee' | 'en_cours'; message_public: string | null; epreuves: EpreuveNotation[];
};
type Planning = { generatedAt: string; fileActive: boolean; soirees: SoireeNotation[] };

export function passageOuvert(soiree: SoireeNotation, passage: PassageNotation, maintenant: number): boolean {
  return (soiree.statut === 'publiee' || soiree.statut === 'en_cours') && (soiree.mode_vote === 'deblocage'
    ? passage.statut_public === 'ouvert'
    : maintenant >= Date.parse(soiree.vote_debut) && maintenant < Date.parse(soiree.vote_fin));
}

/** Planning public mis en cache sur Railway, relecture décalée et uniquement à l'écran. */
export function usePlanningNotation() {
  const [planning, setPlanning] = useState<Planning | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  useEffect(() => {
    let arrete = false;
    let occupe = false;
    let timer: ReturnType<typeof setTimeout>;
    const controle = new AbortController();
    async function lire() {
      if (arrete || occupe) return;
      if (document.visibilityState !== 'visible') { timer = setTimeout(lire, 10_000); return; }
      occupe = true;
      try {
        const reponse = await fetch('/api/notation/planning', { signal: AbortSignal.any([controle.signal, AbortSignal.timeout(6000)]) });
        if (!reponse.ok) throw new Error('indisponible');
        const data = await reponse.json() as Planning;
        if (!Array.isArray(data.soirees) || typeof data.fileActive !== 'boolean') throw new Error('invalide');
        if (!arrete) { setPlanning(data); setErreur(null); }
      } catch {
        if (!arrete) setErreur('Le planning ne peut pas être actualisé. Les dernières informations connues restent affichées.');
      } finally {
        occupe = false;
        if (!arrete) { setChargement(false); timer = setTimeout(lire, 10_000 + Math.random() * 2000); }
      }
    }
    function reprendre() { if (document.visibilityState === 'visible' && !occupe) { clearTimeout(timer); timer = setTimeout(lire, Math.random() * 1000); } }
    void lire();
    document.addEventListener('visibilitychange', reprendre);
    window.addEventListener('online', reprendre);
    return () => { arrete = true; controle.abort(); clearTimeout(timer); document.removeEventListener('visibilitychange', reprendre); window.removeEventListener('online', reprendre); };
  }, []);
  return { planning, erreur, chargement };
}

/** Relecture des notes confirmées du compte, sans scruter les notes de tous les votants. */
export function useNotesConfirmees(compte: string, passages: string[]) {
  const [etat, setEtat] = useState<{ compte: string; notes: Record<string, number>; erreur: boolean }>({ compte, notes: {}, erreur: false });
  const ids = [...new Set(passages)].sort().join(',');
  useEffect(() => {
    if (!ids) return;
    let arrete = false;
    const controle = new AbortController();
    async function lire() {
      try {
        const client = await supabase();
        const { data: session } = await client.auth.getSession();
        if (arrete || session.session?.user.id !== compte) return;
        const { data, error } = await client.from('notes_public').select('passage_id,note').eq('votant_id', compte)
          .in('passage_id', ids.split(',')).limit(200).abortSignal(AbortSignal.any([controle.signal, AbortSignal.timeout(6000)]));
        if (error) throw error;
        if (!arrete) setEtat({ compte, notes: Object.fromEntries((data ?? []).map((n: { passage_id: string; note: number }) => [n.passage_id, n.note])), erreur: false });
      } catch { if (!arrete) setEtat((ancien) => ({ compte, notes: ancien.compte === compte ? ancien.notes : {}, erreur: true })); }
    }
    void lire();
    window.addEventListener('online', lire);
    return () => { arrete = true; controle.abort(); window.removeEventListener('online', lire); };
  }, [compte, ids]);
  return etat.compte === compte ? etat : { compte, notes: {}, erreur: false };
}
