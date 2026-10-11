import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useSession } from './useSession';

export type AccesAdmin = 'chargement' | 'anonyme' | 'autorise' | 'refuse' | 'erreur';

/** Contrôle d'affichage seulement : chaque lecture des métriques est aussi protégée côté serveur. */
export function useAccesAdmin() {
  const { session, chargement } = useSession();
  const [verification, setVerification] = useState<{ jeton: string; acces: AccesAdmin } | null>(null);
  const jeton = session?.access_token;
  const id = session?.user.id;

  useEffect(() => {
    if (!jeton || !id) return;
    let actif = true;
    const controle = new AbortController();
    void (async () => {
      try {
        const client = await supabase();
        const { data, error } = await client.from('profils').select('role').eq('id', id)
          .abortSignal(AbortSignal.any([controle.signal, AbortSignal.timeout(5000)]))
          .maybeSingle<{ role: string }>();
        if (actif) setVerification({ jeton, acces: error ? 'erreur' : data?.role === 'admin' ? 'autorise' : 'refuse' });
      } catch {
        if (actif) setVerification({ jeton, acces: 'erreur' });
      }
    })();
    return () => { actif = false; controle.abort(); };
  }, [jeton, id]);

  const acces: AccesAdmin = chargement ? 'chargement' : !jeton ? 'anonyme'
    : verification?.jeton === jeton ? verification.acces : 'chargement';
  return { acces, session };
}
