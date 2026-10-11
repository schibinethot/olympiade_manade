import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { supabase } from '../lib/supabase';
import { useAccesAdmin } from '../lib/useAccesAdmin';
import { TitrePage } from '../composants/TitrePage';
import type { Route } from './+types/admin';

export const meta: Route.MetaFunction = () => [
  { title: 'Administration · Olympiade des Manades' },
  { name: 'robots', content: 'noindex' },
];

export default function Admin() {
  const { acces } = useAccesAdmin();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function connecter(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (enCours) return;
    const champs = new FormData(evenement.currentTarget);
    setEnCours(true);
    setErreur(null);
    try {
      const { error } = await (await supabase()).auth.signInWithPassword({
        email: String(champs.get('email') ?? '').trim(), password: String(champs.get('mot-de-passe') ?? ''),
      });
      if (error) setErreur(error.status === 429 ? 'Trop de tentatives. Réessayez dans quelques minutes.' : 'Connexion refusée. Vérifiez vos identifiants.');
    } catch {
      setErreur('Connexion impossible. Vérifiez votre réseau et réessayez.');
    } finally {
      setEnCours(false);
    }
  }

  return <>
    <TitrePage surtitre="Espace organisateur" titre="Administration">
      <p>Connectez-vous avec votre compte administrateur pour suivre l’activité et la charge du service.</p>
    </TitrePage>
    <div className="px-4 tablette:px-7 paysage:px-10 bureau:px-14">
      {acces === 'chargement' ? <p role="status">Vérification de l’accès…</p> :
        acces === 'autorise' ? <Link to="/admin/statistiques" className="inline-flex min-h-12 items-center rounded-xl bg-encre px-5 font-semibold text-sable">Statistiques et charge →</Link> :
        acces === 'refuse' ? <p role="alert">Ce compte n’a pas accès à l’administration. Déconnectez-vous pour utiliser un autre compte.</p> :
        acces === 'erreur' ? <p role="alert">Impossible de vérifier vos droits. Rechargez la page pour réessayer.</p> :
        <form onSubmit={connecter} className="grid max-w-md gap-5 rounded-[22px] border border-trait bg-creme p-6">
          <label className="grid gap-2 font-medium">Email administrateur
            <input name="email" type="email" autoComplete="username" required maxLength={254} className="min-h-12 w-full rounded-xl border border-trait bg-sable px-3" />
          </label>
          <label className="grid gap-2 font-medium">Mot de passe
            <input name="mot-de-passe" type="password" autoComplete="current-password" required className="min-h-12 w-full rounded-xl border border-trait bg-sable px-3" />
          </label>
          <button disabled={enCours} className="min-h-12 rounded-xl bg-encre px-5 font-semibold text-sable disabled:opacity-60">{enCours ? 'Connexion…' : 'Se connecter'}</button>
          {erreur ? <p role="alert" className="text-rouge-alerte">{erreur}</p> : null}
          <p className="text-sm text-encre-2">L’accès est réservé aux comptes habilités par l’organisateur.</p>
        </form>}
    </div>
  </>;
}
