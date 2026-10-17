import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

/** Coque Capacitor : fermée au public tant que le drapeau n’est pas ouvert. Le site web n’est pas concerné. */
export function CoqueAndroid({ children }: { children: ReactNode }) {
  const [bloque, setBloque] = useState(false);

  useEffect(() => {
    if (!navigator.userAgent.includes('OlympiadeAndroid')) return;
    let actif = true;
    void (async () => {
      try {
        const reponse = await fetch('/api/application', { cache: 'no-store' });
        const corps = await reponse.json() as { ouverteAuPublic?: boolean };
        if (!actif) return;
        if (corps.ouverteAuPublic) return;
        const client = await supabase();
        const session = await client.auth.getSession();
        const id = session.data.session?.user.id;
        if (!id) { setBloque(true); return; }
        const profil = await client.from('profils').select('role').eq('id', id).maybeSingle();
        if (profil.data?.role !== 'admin' && profil.data?.role !== 'juge') setBloque(true);
      } catch {
        if (actif) setBloque(true);
      }
    })();
    return () => { actif = false; };
  }, []);

  if (!bloque) return children;
  return (
    <p role="status" className="mx-auto max-w-xl px-4 pt-16 text-lg">
      Cette application est réservée à l’organisation. L’ouverture au public est désactivée.
    </p>
  );
}
