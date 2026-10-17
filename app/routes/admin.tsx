import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { VerificationHumaine } from '../composants/VerificationHumaine';
import { commencerEnrolementTotp, connecterAdmin, verifierTotp, type EnrolementTotp, MESSAGES_AUTH } from '../lib/auth';
import { useAccesAdmin } from '../lib/useAccesAdmin';
import { TitrePage } from '../composants/TitrePage';
import type { Route } from './+types/admin';

export const meta: Route.MetaFunction = () => [
  { title: 'Administration · Olympiade des Manades' },
  { name: 'robots', content: 'noindex' },
];

export default function Admin() {
  const { acces, facteurId, session } = useAccesAdmin();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [reinitialisationCaptcha, setReinitialisationCaptcha] = useState(0);
  const [enrolement, setEnrolement] = useState<EnrolementTotp | null>(null);

  useEffect(() => {
    setEnrolement(null);
    setErreur(null);
  }, [session?.user.id]);

  async function connecter(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (enCours) return;
    const champs = new FormData(evenement.currentTarget);
    setEnCours(true);
    setErreur(null);
    try {
      if (!captchaToken) throw new Error(MESSAGES_AUTH.verificationHumaine);
      await connecterAdmin(
        String(champs.get('email') ?? ''),
        String(champs.get('mot-de-passe') ?? ''),
        captchaToken,
      );
    } catch (echec) {
      const statut = typeof echec === 'object' && echec !== null && 'status' in echec ? echec.status : undefined;
      const message = echec instanceof Error ? echec.message : '';
      setErreur(message === MESSAGES_AUTH.verificationHumaine
        ? message
        : statut === 429
          ? 'Trop de tentatives. Réessayez dans quelques minutes.'
          : 'Connexion refusée. Vérifiez vos identifiants et votre réseau.');
    } finally {
      setEnCours(false);
      setCaptchaToken(null);
      setReinitialisationCaptcha((valeur) => valeur + 1);
    }
  }

  async function preparerTotp() {
    if (enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      setEnrolement(await commencerEnrolementTotp());
    } catch {
      setErreur('Impossible de préparer l’authentification à deux facteurs. Réessayez.');
    } finally {
      setEnCours(false);
    }
  }

  async function confirmerTotp(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (enCours) return;
    const champs = new FormData(evenement.currentTarget);
    const id = enrolement?.facteurId ?? facteurId;
    if (!id) return;
    setEnCours(true);
    setErreur(null);
    try {
      await verifierTotp(id, String(champs.get('code-totp') ?? ''));
      setEnrolement(null);
    } catch {
      setErreur('Code incorrect ou expiré. Vérifiez l’heure de votre appareil puis réessayez.');
    } finally {
      setEnCours(false);
    }
  }

  const formulaireTotp = (id: string) => (
    <form onSubmit={confirmerTotp} className="grid max-w-md gap-5 rounded-[22px] border border-trait bg-creme p-6">
      <label className="grid gap-2 font-medium">Code de l’application d’authentification
        <input name="code-totp" inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={6} pattern="[0-9]{6}" className="min-h-12 w-full rounded-xl border border-trait bg-sable px-3" />
      </label>
      <button disabled={enCours || !id} className="min-h-12 rounded-xl bg-encre px-5 font-semibold text-sable disabled:opacity-60">
        {enCours ? 'Vérification…' : 'Vérifier le second facteur'}
      </button>
      {erreur ? <p role="alert" className="text-rouge-alerte">{erreur}</p> : null}
    </form>
  );

  return <>
    <TitrePage surtitre="Espace organisateur" titre="Administration">
      <p>Connectez-vous avec votre compte administrateur pour préparer une soirée, la piloter, puis suivre l’activité du service.</p>
    </TitrePage>
    <div className="px-4 tablette:px-7 paysage:px-10 bureau:px-14">
      {acces === 'chargement' ? <p role="status">Vérification de l’accès…</p> :
        acces === 'autorise' ? <nav className="grid max-w-md gap-3" aria-label="Espaces d’administration">
          <Link to="/admin/soirees" className="inline-flex min-h-12 items-center rounded-xl border border-trait px-5 font-semibold">Mes soirées</Link>
          <Link to="/admin/participants" className="inline-flex min-h-12 items-center rounded-xl border border-trait px-5 font-semibold">Participants</Link>
          <Link to="/admin/juges" className="inline-flex min-h-12 items-center rounded-xl border border-trait px-5 font-semibold">Juges</Link>
          <Link to="/admin/messages" className="inline-flex min-h-12 items-center rounded-xl border border-trait px-5 font-semibold">Messages de contact</Link>
          <Link to="/admin/abonnes" className="inline-flex min-h-12 items-center rounded-xl border border-trait px-5 font-semibold">Abonnés aux actualités</Link>
          <Link to="/admin/statistiques" className="inline-flex min-h-12 items-center rounded-xl bg-encre px-5 font-semibold text-sable">Statistiques et charge →</Link>
        </nav> :
        acces === 'deux-facteurs-requis' && facteurId ? <div className="grid gap-4">
          <p>Entrez le code à 6 chiffres de votre application d’authentification.</p>
          {formulaireTotp(facteurId)}
        </div> :
        acces === 'enrolement-requis' ? <div className="grid max-w-md gap-5 rounded-[22px] border border-trait bg-creme p-6">
          <div className="grid gap-2">
            <h2 className="text-xl font-semibold">Activer le second facteur</h2>
            <p>Les fonctions d’administration restent verrouillées tant qu’un code TOTP n’a pas été configuré et vérifié.</p>
          </div>
          {!enrolement ? <button type="button" onClick={preparerTotp} disabled={enCours} className="min-h-12 rounded-xl bg-encre px-5 font-semibold text-sable disabled:opacity-60">
            {enCours ? 'Préparation…' : 'Configurer mon application'}
          </button> : <>
            <img src={enrolement.qrCode} alt="QR code à scanner dans l’application d’authentification" className="size-52 max-w-full rounded-lg bg-white p-2" />
            <p className="text-sm">Si vous ne pouvez pas scanner le QR code, saisissez cette clé : <code className="break-all font-mono">{enrolement.secret}</code></p>
            {formulaireTotp(enrolement.facteurId)}
          </>}
          {erreur && !enrolement ? <p role="alert" className="text-rouge-alerte">{erreur}</p> : null}
        </div> :
        acces === 'refuse' ? <p role="alert">Ce compte n’a pas accès à l’administration. Déconnectez-vous pour utiliser un autre compte.</p> :
        acces === 'erreur' ? <p role="alert">Impossible de vérifier vos droits. Rechargez la page pour réessayer.</p> :
        <form onSubmit={connecter} className="grid max-w-md gap-5 rounded-[22px] border border-trait bg-creme p-6">
          <label className="grid gap-2 font-medium">Email administrateur
            <input name="email" type="email" autoComplete="username" required maxLength={254} className="min-h-12 w-full rounded-xl border border-trait bg-sable px-3" />
          </label>
          <label className="grid gap-2 font-medium">Mot de passe
            <input name="mot-de-passe" type="password" autoComplete="current-password" required className="min-h-12 w-full rounded-xl border border-trait bg-sable px-3" />
          </label>
          <VerificationHumaine
            action="admin-connexion"
            reinitialisation={reinitialisationCaptcha}
            onJetonChange={setCaptchaToken}
          />
          <button disabled={enCours} className="min-h-12 rounded-xl bg-encre px-5 font-semibold text-sable disabled:opacity-60">{enCours ? 'Connexion…' : 'Se connecter'}</button>
          {erreur ? <p role="alert" className="text-rouge-alerte">{erreur}</p> : null}
          <p className="text-sm text-encre-2">L’accès est réservé aux comptes habilités par l’organisateur.</p>
        </form>}
    </div>
  </>;
}
