import { useEffect, useRef, useState } from 'react';
import { useInstantanePublic } from '../lib/contexte-etat';
import { supabase } from '../lib/supabase';

function iphoneSansInstallation(): boolean {
  const agent = navigator.userAgent;
  const iphone = /iPhone|iPad/.test(agent);
  const installe = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iphone && !installe;
}

export function BanniereDeblocage() {
  const instantane = useInstantanePublic();
  const precedent = useRef<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const ouvert = instantane.soiree?.passages.find((passage) => passage.statutEffectif === 'ouvert');
    const cle = ouvert ? ouvert.id : '';
    if (precedent.current === null) {
      precedent.current = cle;
      return;
    }
    if (cle && cle !== precedent.current && ouvert) {
      setMessage(`C’est le moment de noter ! ${ouvert.epreuve}${ouvert.manade ? ` : manade ${ouvert.manade}` : ''}`);
      navigator.vibrate?.(180);
    }
    precedent.current = cle;
  }, [instantane]);

  if (!message) return null;
  return (
    <p role="status" className="mx-4 mt-3 rounded-2xl bg-encre px-4 py-3 text-sm font-semibold text-sable tablette:mx-7">
      {message}
    </p>
  );
}

export function ChoixNotifications({ compte }: { compte: string }) {
  const [info, setInfo] = useState<string | null>(null);
  const [guide, setGuide] = useState(false);
  const clePublique = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

  async function choisir(choix: 'accepte' | 'refuse') {
    setInfo(null);
    const client = await supabase();
    const { error } = await client.rpc('enregistrer_choix_notifications', { p_choix: choix });
    if (error) {
      setInfo('Le choix n’a pas pu être horodaté. Réessayez.');
      return;
    }
    if (choix === 'refuse') {
      await client.from('abonnements_push').delete().eq('utilisateur_id', compte);
      setInfo('Notifications refusées. Vous pouvez changer d’avis plus tard.');
      setGuide(false);
      return;
    }
    if (iphoneSansInstallation()) {
      setGuide(true);
      setInfo('Sur iPhone, ajoutez d’abord le site à l’écran d’accueil.');
      return;
    }
    if (!clePublique || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setInfo('Choix enregistré. L’envoi push n’est pas activé sur ce service.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setInfo('Choix enregistré. Le navigateur n’a pas autorisé les notifications.');
      return;
    }
    const inscription = await navigator.serviceWorker.ready;
    const abonnement = await inscription.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: cleVersOctets(clePublique) as BufferSource,
    });
    const json = abonnement.toJSON();
    await client.from('abonnements_push').upsert({
      utilisateur_id: compte,
      endpoint: abonnement.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth_secret: json.keys?.auth ?? '',
      actif: true,
    }, { onConflict: 'endpoint' });
    setInfo('Notifications activées pour les passages de la soirée.');
  }

  return (
    <section aria-label="Notifications" className="mx-auto mt-6 max-w-5xl px-4 tablette:px-7">
      <div className="rounded-[22px] border border-trait bg-creme p-5">
        <h2 className="font-display text-2xl">Notifications de la soirée</h2>
        <p className="mt-2 text-sm text-encre-2">Un message quand un passage s’ouvre, et à la révélation du classement. Rien en dehors des soirées. Ce choix est distinct de l’inscription.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-encre px-4 font-semibold text-sable" onClick={() => void choisir('accepte')}>Accepter</button>
          <button type="button" className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-trait px-4 font-semibold" onClick={() => void choisir('refuse')}>Refuser</button>
        </div>
        {guide ? (
          <ol className="mt-3 list-decimal pl-5 text-sm">
            <li>Touchez Partager.</li>
            <li>Choisissez Sur l’écran d’accueil, puis rouvrez l’application pour accepter les notifications.</li>
          </ol>
        ) : null}
        {info ? <p role="status" className="mt-3 text-sm">{info}</p> : null}
      </div>
    </section>
  );
}

function cleVersOctets(cle: string): Uint8Array {
  const remplie = cle.replace(/-/g, '+').replace(/_/g, '/');
  const binaire = atob(remplie);
  return Uint8Array.from(binaire, (caractere) => caractere.charCodeAt(0));
}
