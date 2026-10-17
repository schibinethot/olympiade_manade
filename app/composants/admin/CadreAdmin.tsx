import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { useAccesAdmin } from '../../lib/useAccesAdmin';

export const CARTE = 'rounded-[22px] border border-trait bg-creme p-5 tablette:p-6';
export const BOUTON = 'inline-flex min-h-12 items-center justify-center rounded-xl border border-trait px-4 text-sm font-semibold disabled:opacity-50';
export const BOUTON_PLEIN = `${BOUTON} bg-encre text-sable`;
export const CHAMP = 'min-h-12 w-full rounded-xl border border-trait bg-sable px-3';

const LIENS = [
  { vers: '/admin/soirees', libelle: 'Soirées' },
  { vers: '/admin/vitrine', libelle: 'Vitrine' },
  { vers: '/admin/participants', libelle: 'Participants' },
  { vers: '/admin/juges', libelle: 'Juges' },
  { vers: '/admin/messages', libelle: 'Messages' },
  { vers: '/admin/abonnes', libelle: 'Abonnés' },
  { vers: '/admin/emails', libelle: 'E-mails' },
  { vers: '/admin/statistiques', libelle: 'Statistiques' },
  { vers: '/admin/cookies', libelle: 'Cookies' },
] as const;

export function useClientAdmin() {
  const { acces, session } = useAccesAdmin();
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [erreurClient, setErreurClient] = useState<string | null>(null);
  useEffect(() => {
    if (acces !== 'autorise') return;
    let actif = true;
    supabase().then((valeur) => { if (actif) setClient(valeur); }).catch(() => {
      if (actif) setErreurClient('La connexion aux données est indisponible.');
    });
    return () => { actif = false; };
  }, [acces]);
  return { acces, session, client, erreurClient };
}

export function CadreAdmin({ titre, surtitre, children }: { titre: string; surtitre: string; children: ReactNode }) {
  const { acces } = useAccesAdmin();
  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-8 pb-16 tablette:px-7">
      <Link to="/admin" className="inline-flex min-h-12 items-center text-sm font-medium text-encre-2 underline underline-offset-4">← Administration</Link>
      <p className="mt-3 text-xs font-bold tracking-[.18em] text-or-ink uppercase">{surtitre}</p>
      <h1 className="mt-2 font-display text-4xl">{titre}</h1>
      {acces === 'chargement' ? <p role="status" className="mt-8">Vérification de l’accès…</p>
        : acces !== 'autorise' ? (
          <div className={`${CARTE} mt-8`}>
            <p role={acces === 'anonyme' ? 'status' : 'alert'}>{acces === 'anonyme'
              ? 'Connectez-vous pour consulter cette page.'
              : acces === 'refuse'
                ? 'Cette page est réservée aux administrateurs.'
                : acces === 'enrolement-requis'
                  ? 'Activez l’authentification à deux facteurs depuis la page d’administration.'
                  : acces === 'deux-facteurs-requis'
                    ? 'Vérifiez votre code d’authentification à deux facteurs depuis la page d’administration.'
                    : 'Impossible de vérifier vos droits. Réessayez depuis l’administration.'}</p>
            <Link to="/admin" className={`${BOUTON} mt-4`}>Accéder à l’administration</Link>
          </div>
        ) : <>
          <nav aria-label="Préparation" className="mt-6 flex flex-wrap gap-2">
            {LIENS.map((lien) => <Link key={lien.vers} to={lien.vers} className={BOUTON}>{lien.libelle}</Link>)}
          </nav>
          <div className="mt-6 grid gap-5">{children}</div>
        </>}
    </div>
  );
}
