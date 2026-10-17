import { useState } from 'react';
import { useNavigate } from 'react-router';
import { TitrePage } from '../composants/TitrePage';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/useSession';

export function meta() {
  return [
    { title: 'Mon compte · Olympiade des Manades' },
    { name: 'robots', content: 'noindex' },
  ];
}

export default function Compte() {
  const { session, chargement, prenom } = useSession();
  const naviguer = useNavigate();
  const [confirmation, setConfirmation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function supprimer() {
    if (!session?.access_token || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const reponse = await fetch('/api/compte', { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!reponse.ok) {
        setErreur('La suppression n’a pas abouti. Un compte organisateur ou juge se retire avec l’organisateur.');
        return;
      }
      const client = await supabase();
      await client.auth.signOut();
      void naviguer('/');
    } catch {
      setErreur('La suppression n’a pas abouti.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      <TitrePage surtitre="Compte" titre="Supprimer mon compte">
        <p>Cette action efface le compte spectateur, ses notes et ses avis. Elle est irréversible.</p>
      </TitrePage>
      <div className="mx-auto max-w-xl px-4 pt-6">
        {chargement ? <p role="status">Vérification…</p> : null}
        {!chargement && !session ? <p>Connectez-vous pour supprimer votre compte.</p> : null}
        {session ? (
          <section className="rounded-[22px] border border-trait bg-creme p-5">
            <p>Compte de {prenom || 'ce spectateur'}.</p>
            {confirmation ? (
              <button type="button" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-encre px-4 font-semibold text-sable" disabled={enCours} onClick={() => void supprimer()}>
                {enCours ? 'Suppression…' : 'Confirmer la suppression'}
              </button>
            ) : (
              <button type="button" className="mt-4 inline-flex min-h-12 items-center rounded-xl border border-trait px-4 font-semibold" onClick={() => setConfirmation(true)}>Supprimer mon compte</button>
            )}
            {erreur ? <p className="mt-3 text-sm text-rouge-alerte">{erreur}</p> : null}
          </section>
        ) : null}
      </div>
    </>
  );
}
