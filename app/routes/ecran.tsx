import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { ClassementCalcule } from '../composants/ClassementCalcule';
import { CodeQr } from '../composants/CodeQr';
import { useInstantanePublic, type InstantanePublic } from '../lib/contexte-etat';

export function meta() {
  return [
    { title: 'Écran · Olympiade des Manades' },
    { name: 'robots', content: 'noindex' },
  ];
}

function estInstantane(valeur: unknown): valeur is InstantanePublic {
  if (!valeur || typeof valeur !== 'object') return false;
  const etat = (valeur as { etat?: unknown }).etat;
  return etat === 'hors-soiree' || etat === 'ouvert';
}

export default function Ecran() {
  const { slug = '' } = useParams();
  const contexte = useInstantanePublic();
  const [cible, setCible] = useState<InstantanePublic | null>(null);

  useEffect(() => {
    let arrete = false;
    async function lire() {
      try {
        const reponse = await fetch(`/api/etat-soiree?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
        if (!reponse.ok) return;
        const corps: unknown = await reponse.json();
        if (!arrete && estInstantane(corps)) setCible(corps);
      } catch {
        // L'écran reste sur le dernier instantané connu.
      }
    }
    void lire();
    const minuteur = setInterval(() => void lire(), 8_000);
    return () => {
      arrete = true;
      clearInterval(minuteur);
    };
  }, [slug]);

  const instantane = cible ?? contexte;
  const soiree = instantane.soiree?.slug === slug ? instantane.soiree : null;
  const ouvert = soiree && instantane.etat === 'ouvert';
  const [origine, setOrigine] = useState('');
  useEffect(() => { setOrigine(window.location.origin); }, []);
  const urlVote = origine ? `${origine}/noter` : '';

  return (
    <div className="min-h-dvh bg-encre px-6 py-8 text-sable">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm font-bold tracking-[.2em] text-or-clair uppercase">Olympiade des Manades</p>
        <button type="button" className="inline-flex min-h-12 items-center rounded-xl bg-sable px-4 font-semibold text-encre" onClick={() => void document.documentElement.requestFullscreen?.()}>Plein écran</button>
      </div>
      {instantane.source === 'fige' ? (
        <h1 className="mt-10 font-display text-5xl">L’affichage public n’est pas activé.</h1>
      ) : !soiree ? (
        <h1 className="mt-10 font-display text-5xl">En attente de la soirée.</h1>
      ) : (
        <>
          <h1 className="mt-6 font-display text-5xl tablette:text-7xl">{soiree.nom}</h1>
          {soiree.messagePublic && (soiree.statut === 'reportee' || soiree.statut === 'annulee')
            ? <p className="mt-6 max-w-4xl text-3xl">{soiree.messagePublic}</p> : null}
          <p className="mt-8 font-display text-4xl tablette:text-6xl">{soiree.epreuveEnCours ?? 'Épreuve à venir'}</p>
          <p className="mt-3 text-3xl">{soiree.manadeEnPiste ? soiree.manadeEnPiste : 'Manade à venir'}</p>
          {ouvert ? <p className="mt-6 text-4xl font-bold text-or-clair">Votez maintenant !</p> : null}
          <div className="mt-8 inline-block rounded-2xl bg-white p-4 text-encre">
            {urlVote ? <CodeQr valeur={urlVote} libelle="QR code pour noter les manades" taille={280} /> : <p className="text-2xl">QR code de vote</p>}
            <p className="mt-3 max-w-xs text-lg font-semibold text-encre">Votez maintenant sur votre téléphone</p>
          </div>
          <p className="mt-4 break-all text-xl">{urlVote || '/noter'}</p>
          {soiree.classements ? <div className="mt-10 text-encre"><ClassementCalcule classements={soiree.classements} /></div>
            : <p className="mt-10 text-2xl">Le classement sera révélé au moment de la remise des prix.</p>}
        </>
      )}
    </div>
  );
}
