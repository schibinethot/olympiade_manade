import { useEffect, useState } from 'react';
import { BOUTON, CadreAdmin, CARTE, useClientAdmin } from '../composants/admin/CadreAdmin';

type Message = { id: string; prenom: string; email: string; message: string; cree_le: string; traite: boolean };

export function meta() {
  return [{ title: 'Messages · Administration' }, { name: 'robots', content: 'noindex' }];
}

export default function Messages() {
  return <CadreAdmin surtitre="Préparation" titre="Messages de contact"><Liste /></CadreAdmin>;
}

function Liste() {
  const { client, erreurClient } = useClientAdmin();
  const [lignes, setLignes] = useState<Message[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let actif = true;
    client.from('messages_contact').select('id, prenom, email, message, cree_le, traite').order('cree_le', { ascending: false })
      .then(({ data, error }) => {
        if (!actif) return;
        if (error) setErreur('Les messages sont indisponibles.');
        else setLignes((data ?? []) as Message[]);
      });
    return () => { actif = false; };
  }, [client]);

  async function traiter(id: string) {
    if (!client || enCours) return;
    setEnCours(id);
    setErreur(null);
    const { error } = await client.from('messages_contact').update({ traite: true }).eq('id', id);
    setEnCours(null);
    if (error) setErreur('Le message n’a pas pu être marqué comme traité.');
    else setLignes((avant) => avant?.map((message) => message.id === id ? { ...message, traite: true } : message) ?? null);
  }

  if (erreurClient) return <p role="alert" className="text-rouge-alerte">{erreurClient}</p>;
  if (!lignes && !erreur) return <p role="status">Lecture des messages…</p>;
  return (
    <section className="grid gap-4" aria-labelledby="titre-messages">
      <h2 id="titre-messages" className="sr-only">Messages reçus</h2>
      {erreur ? <p role="alert" className="text-rouge-alerte">{erreur}</p> : null}
      {!lignes?.length ? <p className={CARTE}>Aucun message pour le moment.</p> : lignes.map((message) => (
        <article key={message.id} className={CARTE}>
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-2xl">{message.prenom}</h3>
            <time className="text-sm text-encre-2" dateTime={message.cree_le}>{new Date(message.cree_le).toLocaleString('fr-FR')}</time>
          </header>
          <p className="mt-1 text-sm text-encre-2">{message.email}</p>
          <p className="mt-3 whitespace-pre-wrap">{message.message}</p>
          {message.traite ? <p className="mt-3 text-sm font-semibold">Traité</p>
            : <button type="button" className={`${BOUTON} mt-3 bg-encre text-sable`} disabled={enCours === message.id} onClick={() => void traiter(message.id)}>
              {enCours === message.id ? 'Enregistrement…' : 'Marquer comme traité'}
            </button>}
        </article>
      ))}
    </section>
  );
}
