import { useEffect, useState } from 'react';
import { BOUTON, CadreAdmin, CARTE, useClientAdmin } from '../composants/admin/CadreAdmin';

type Abonne = { id: string; email: string; consentement_le: string };
const TAILLE_PAGE = 50;

export function meta() {
  return [{ title: 'Abonnés · Administration' }, { name: 'robots', content: 'noindex' }];
}

export default function Abonnes() {
  return <CadreAdmin surtitre="Actualités" titre="Abonnés aux actualités"><Liste /></CadreAdmin>;
}

function Liste() {
  const { client, erreurClient } = useClientAdmin();
  const [lignes, setLignes] = useState<Abonne[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    if (!client) return;
    let actif = true;
    setLignes(null);
    setErreur(null);
    void (async () => {
      try {
        const { data, error, count } = await client.from('abonnements_actualites')
          .select('id,email,consentement_le', { count: 'exact' })
          .order('consentement_le', { ascending: false }).order('id')
          .range(page * TAILLE_PAGE, (page + 1) * TAILLE_PAGE - 1);
        if (!actif) return;
        if (error) throw error;
        setLignes((data ?? []) as Abonne[]);
        setTotal(count ?? 0);
      } catch {
        if (actif) setErreur('La liste des abonnés est indisponible.');
      }
    })();
    return () => { actif = false; };
  }, [client, page, revision]);

  async function retirer(id: string) {
    if (!client || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const { data, error } = await client.from('abonnements_actualites').delete().eq('id', id).select('id');
      if (error || !data?.length) throw error ?? new Error('Suppression non confirmée');
      setConfirmation(null);
      if (lignes?.length === 1 && page > 0) setPage((valeur) => valeur - 1);
      else setRevision((valeur) => valeur + 1);
    } catch {
      setErreur('Le retrait n’a pas pu être confirmé. Réessayez.');
    } finally {
      setEnCours(false);
    }
  }

  return <section className={`${CARTE} min-w-0`} aria-label="Liste des abonnés">
    <p className="text-sm text-encre-2">Adresses recueillies sur l’accueil pour les actualités, informations pratiques, résultats et notations. Aucun envoi automatique n’est déclenché par une inscription.</p>
    <div role="alert">{erreurClient || erreur ? <p className="mt-4 text-rouge-alerte">{erreurClient || erreur}</p> : null}</div>
    {!lignes && !erreur && !erreurClient ? <p role="status" className="mt-4">Lecture des abonnés…</p> : null}
    {erreur ? <button className={`${BOUTON} mt-3`} onClick={() => setRevision((valeur) => valeur + 1)}>Réessayer</button> : null}
    {lignes ? <>
      <h2 className="mt-5 font-display text-2xl">{total} abonné{total > 1 ? 's' : ''}</h2>
      {!lignes.length ? <p className="mt-3">Aucune inscription pour le moment.</p> : <ul className="mt-3 divide-y divide-trait">
        {lignes.map((abonne) => <li key={abonne.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0">
            <p className="font-semibold break-all">{abonne.email}</p>
            <p className="mt-1 text-xs text-encre-2">Consentement reçu le <time dateTime={abonne.consentement_le}>{new Date(abonne.consentement_le).toLocaleString('fr-FR')}</time></p>
          </div>
          {confirmation === abonne.id ? <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">Retirer cette adresse&nbsp;?</span>
            <button className={BOUTON} disabled={enCours} onClick={() => void retirer(abonne.id)}>{enCours ? 'Retrait…' : 'Confirmer le retrait'}</button>
            <button className={BOUTON} disabled={enCours} onClick={() => setConfirmation(null)}>Annuler</button>
          </div> : <button className={BOUTON} disabled={enCours} onClick={() => setConfirmation(abonne.id)} aria-label={`Retirer ${abonne.email}`}>Retirer</button>}
        </li>)}
      </ul>}
      {total > TAILLE_PAGE ? <nav aria-label="Pages des abonnés" className="mt-4 flex items-center justify-between gap-3">
        <button className={BOUTON} disabled={page === 0 || enCours} onClick={() => { setConfirmation(null); setPage((valeur) => valeur - 1); }}>Précédente</button>
        <span className="text-sm">Page {page + 1} sur {Math.ceil(total / TAILLE_PAGE)}</span>
        <button className={BOUTON} disabled={(page + 1) * TAILLE_PAGE >= total || enCours} onClick={() => { setConfirmation(null); setPage((valeur) => valeur + 1); }}>Suivante</button>
      </nav> : null}
    </> : null}
  </section>;
}
