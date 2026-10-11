import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/useSession';

/** Présence opérationnelle d'un compte, sans identifiant publicitaire ni historique de navigation. */
export function SuiviPresence() {
  const { session } = useSession();
  const id = session?.user.id;
  useEffect(() => {
    if (!id) return;
    let arrete = false;
    let enCours = false;
    let dernierEssai = 0;
    let timer: ReturnType<typeof setTimeout>;
    const controle = new AbortController();
    async function envoyer() {
      if (arrete || enCours) return;
      if (document.visibilityState === 'visible' && navigator.onLine && Date.now() - dernierEssai >= 60_000) {
        enCours = true;
        dernierEssai = Date.now();
        try {
          const client = await supabase();
          if (!arrete) await client.rpc('enregistrer_presence')
            .abortSignal(AbortSignal.any([controle.signal, AbortSignal.timeout(5000)]));
        } catch {
          // La mesure ne bloque jamais la connexion ni le vote. Un seul nouvel essai au prochain tour.
        } finally {
          enCours = false;
        }
      }
      if (!arrete) timer = setTimeout(() => void envoyer(), 60_000 + Math.random() * 15_000);
    }
    function auRetour() {
      if (document.visibilityState !== 'visible' || arrete || enCours) return;
      clearTimeout(timer);
      timer = setTimeout(() => void envoyer(), Math.random() * 5000);
    }
    timer = setTimeout(() => void envoyer(), Math.random() * 30_000);
    document.addEventListener('visibilitychange', auRetour);
    window.addEventListener('online', auRetour);
    return () => {
      arrete = true;
      controle.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', auRetour);
      window.removeEventListener('online', auRetour);
    };
  }, [id]);
  return null;
}
