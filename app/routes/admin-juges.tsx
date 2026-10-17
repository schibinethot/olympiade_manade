import { useEffect, useState, type FormEvent } from 'react';
import { BOUTON_PLEIN, CadreAdmin, CARTE, CHAMP, useClientAdmin } from '../composants/admin/CadreAdmin';
import { CodeQr } from '../composants/CodeQr';

type Juge = { id: string; prenom: string; email: string | null };
type Soiree = { id: string; nom: string; date_soiree: string };

export function meta() {
  return [{ title: 'Juges · Administration' }, { name: 'robots', content: 'noindex' }];
}

export default function Juges() {
  return <CadreAdmin surtitre="Préparation" titre="Juges"><Contenu /></CadreAdmin>;
}

function Contenu() {
  const { client, session, erreurClient } = useClientAdmin();
  const [juges, setJuges] = useState<Juge[] | null>(null);
  const [soirees, setSoirees] = useState<Soiree[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [lien, setLien] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!client) return;
    let actif = true;
    Promise.all([
      client.rpc('lire_participants'),
      client.from('soirees').select('id, nom, date_soiree').order('date_soiree', { ascending: false }),
    ]).then(([personnes, liste]) => {
      if (!actif) return;
      if (personnes.error || liste.error) setErreur('La liste des juges est indisponible.');
      else {
        setJuges(((personnes.data ?? []) as { id: string; prenom: string; email: string | null; role: string }[])
          .filter((personne) => personne.role === 'juge'));
        setSoirees((liste.data ?? []) as Soiree[]);
      }
    });
    return () => { actif = false; };
  }, [client]);

  async function creer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!session?.access_token || enCours) return;
    const champs = new FormData(evenement.currentTarget);
    setEnCours(true);
    setErreur(null);
    setLien(null);
    try {
      const reponse = await fetch('/api/admin/juges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          prenom: String(champs.get('prenom') ?? ''),
          email: String(champs.get('email') ?? ''),
          soireeId: String(champs.get('soiree') ?? ''),
        }),
      });
      const corps = await reponse.json().catch(() => null) as { lien?: string | null; error?: string } | null;
      if (!reponse.ok) {
        setErreur(corps?.error === 'service_indisponible'
          ? 'La création d’un juge demande la clé serveur. Le rattachement d’un juge déjà existant reste possible sur la soirée.'
          : 'Le juge n’a pas pu être créé. Vérifiez les champs et la configuration.');
        return;
      }
      setLien(corps?.lien ?? null);
      evenement.currentTarget.reset();
    } catch {
      setErreur('Le juge n’a pas pu être créé.');
    } finally {
      setEnCours(false);
    }
  }

  if (erreurClient) return <p role="alert" className="text-rouge-alerte">{erreurClient}</p>;
  return (
    <>
      <section className={CARTE}>
        <h2 className="font-display text-2xl">Nouveau juge</h2>
        <p className="mt-1 text-sm text-encre-2">Le lien personnel s’affiche ici. Sans SMTP, transmettez-le vous-même au juge. Aucune inscription publique n’est ouverte.</p>
        <form onSubmit={(evenement) => void creer(evenement)} className="mt-4 grid gap-3">
          <label className="grid gap-2 font-medium">Prénom
            <input name="prenom" required maxLength={60} className={CHAMP} />
          </label>
          <label className="grid gap-2 font-medium">Email
            <input name="email" type="email" required maxLength={254} className={CHAMP} />
          </label>
          <label className="grid gap-2 font-medium">Soirée
            <select name="soiree" required className={CHAMP}>
              <option value="">Choisir</option>
              {soirees.map((soiree) => <option key={soiree.id} value={soiree.id}>{soiree.nom}</option>)}
            </select>
          </label>
          <button className={BOUTON_PLEIN} disabled={enCours || !soirees.length}>{enCours ? 'Création…' : 'Créer le lien du juge'}</button>
        </form>
        {erreur ? <p role="alert" className="mt-3 text-rouge-alerte">{erreur}</p> : null}
        {lien ? (
          <div className="mt-4 grid gap-3">
            <p className="break-all text-sm">Lien personnel : <a className="underline" href={lien}>{lien}</a></p>
            <CodeQr valeur={lien} libelle="QR code du lien personnel du juge" />
            <p className="text-sm text-encre-2">Transmettez le lien ou le QR au juge. Aucun SMS n’est envoyé.</p>
          </div>
        ) : null}
      </section>
      <section className={CARTE}>
        <h2 className="font-display text-2xl">Juges connus</h2>
        {!juges ? <p role="status" className="mt-3">Lecture…</p> : juges.length ? (
          <ul className="mt-3 divide-y divide-trait">
            {juges.map((juge) => <li key={juge.id} className="flex min-h-12 items-center justify-between gap-3"><span className="font-semibold">{juge.prenom}</span><span className="text-sm text-encre-2">{juge.email}</span></li>)}
          </ul>
        ) : <p className="mt-3 text-sm text-encre-2">Aucun juge pour le moment.</p>}
      </section>
    </>
  );
}
