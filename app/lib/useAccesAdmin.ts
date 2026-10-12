import { useEffect, useState } from 'react';
import { facteurTotpVerifie } from './auth';
import { supabase } from './supabase';
import { useSession } from './useSession';

export type AccesAdmin =
  | 'chargement'
  | 'anonyme'
  | 'enrolement-requis'
  | 'deux-facteurs-requis'
  | 'autorise'
  | 'refuse'
  | 'erreur';

/** Contrôle d'affichage seulement : chaque lecture des métriques est aussi protégée côté serveur. */
export function useAccesAdmin() {
  const { session, chargement } = useSession();
  const [verification, setVerification] = useState<{ jeton: string; acces: AccesAdmin; facteurId: string | null } | null>(null);
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
        if (!actif) return;
        if (error) {
          setVerification({ jeton, acces: 'erreur', facteurId: null });
          return;
        }
        if (data?.role !== 'admin') {
          setVerification({ jeton, acces: 'refuse', facteurId: null });
          return;
        }
        const niveau = await client.auth.mfa.getAuthenticatorAssuranceLevel();
        if (!actif) return;
        if (niveau.error) {
          setVerification({ jeton, acces: 'erreur', facteurId: null });
        } else if (niveau.data.currentLevel === 'aal2') {
          setVerification({ jeton, acces: 'autorise', facteurId: null });
        } else {
          const facteurId = await facteurTotpVerifie();
          if (actif) setVerification({
            jeton,
            acces: facteurId ? 'deux-facteurs-requis' : 'enrolement-requis',
            facteurId,
          });
        }
      } catch {
        if (actif) setVerification({ jeton, acces: 'erreur', facteurId: null });
      }
    })();
    return () => { actif = false; controle.abort(); };
  }, [jeton, id]);

  const acces: AccesAdmin = chargement ? 'chargement' : !jeton ? 'anonyme'
    : verification && verification.jeton === jeton ? verification.acces : 'chargement';
  const facteurId = verification && verification.jeton === jeton ? verification.facteurId : null;
  return { acces, session, facteurId };
}
