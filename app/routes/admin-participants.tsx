import { useEffect, useState } from 'react';
import { CadreAdmin, CARTE, useClientAdmin } from '../composants/admin/CadreAdmin';

type Participant = {
  id: string;
  prenom: string;
  role: string;
  email: string | null;
  consentement_le: string | null;
  cree_le: string;
};

const ROLES: Record<string, string> = { admin: 'Administrateur', juge: 'Juge', spectateur: 'Spectateur' };

export function meta() {
  return [{ title: 'Participants · Administration' }, { name: 'robots', content: 'noindex' }];
}

export default function Participants() {
  return <CadreAdmin surtitre="Préparation" titre="Participants"><Liste /></CadreAdmin>;
}

function Liste() {
  const { client, erreurClient } = useClientAdmin();
  const [lignes, setLignes] = useState<Participant[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let actif = true;
    client.rpc('lire_participants').then(({ data, error }) => {
      if (!actif) return;
      if (error) setErreur('La liste des participants est indisponible. Vérifiez que la migration de pilotage est appliquée.');
      else setLignes((data ?? []) as Participant[]);
    });
    return () => { actif = false; };
  }, [client]);

  if (erreurClient || erreur) return <p role="alert" className="text-rouge-alerte">{erreurClient ?? erreur}</p>;
  if (!lignes) return <p role="status">Lecture des participants…</p>;
  return (
    <section className={CARTE} aria-labelledby="titre-participants">
      <h2 id="titre-participants" className="font-display text-2xl">Comptes</h2>
      <p className="mt-1 text-sm text-encre-2">{lignes.length} compte{lignes.length > 1 ? 's' : ''}. Le rôle se change côté serveur, pas depuis cette liste.</p>
      <ul className="mt-4 divide-y divide-trait">
        {lignes.map((personne) => (
          <li key={personne.id} className="flex min-h-12 flex-wrap items-center justify-between gap-2 py-2">
            <span className="font-semibold">{personne.prenom}</span>
            <span className="text-sm text-encre-2">{personne.email}</span>
            <span className="text-sm">{ROLES[personne.role] ?? personne.role}</span>
            <span className="text-sm text-encre-2">{personne.consentement_le ? 'Consentement enregistré' : 'Consentement en attente'}</span>
          </li>
        ))}
      </ul>
      {!lignes.length ? <p className="mt-3 text-sm text-encre-2">Aucun compte pour le moment.</p> : null}
      <p className="mt-4 text-sm text-encre-2">Les inscriptions publiques restent fermées tant que le drapeau prévu n’est pas activé.</p>
    </section>
  );
}
