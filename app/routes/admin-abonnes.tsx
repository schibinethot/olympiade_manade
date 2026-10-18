import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BOUTON, CadreAdmin, CARTE, useClientAdmin } from '../composants/admin/CadreAdmin';

type Abonne = { id: string; email: string; consentement_le: string };
const TAILLE_PAGE = 50;
/** Lignes par lecture de destinataires_emails (plafond des réponses PostgREST de Supabase). */
const TAILLE_LOT = 1000;

/** État d'envoi d'un abonné, lu dans destinataires_emails (une adresse, une fiche d'envoi). */
type EtatAbonne = 'confirme' | 'a_confirmer' | 'reabonnement' | 'desinscrit';
type FicheEnvoi = { email: string; abonnement_a_confirmer: boolean; desinscrit_le: string | null };

const LIBELLES_ETAT: Record<EtatAbonne | 'inconnu', { texte: string; classe: string }> = {
  confirme: { texte: 'Confirmé', classe: 'border-ok/50 bg-ok/10 text-encre' },
  a_confirmer: { texte: 'En attente de confirmation', classe: 'border-alerte bg-ambre/15 text-encre' },
  reabonnement: { texte: 'Désinscrit, nouvelle demande en attente de confirmation', classe: 'border-alerte bg-ambre/15 text-encre' },
  desinscrit: { texte: 'Désinscrit', classe: 'border-trait bg-lin text-encre-2' },
  inconnu: { texte: 'État d’envoi inconnu', classe: 'border-trait bg-lin text-encre-2' },
};

function etatDe(fiche: FicheEnvoi): EtatAbonne {
  if (fiche.abonnement_a_confirmer) return fiche.desinscrit_le ? 'reabonnement' : 'a_confirmer';
  return fiche.desinscrit_le ? 'desinscrit' : 'confirme';
}

/**
 * États d'envoi de tous les abonnés, joints par adresse côté navigateur. Les adresses ne passent jamais
 * dans l'URL d'une requête (journaux de Supabase) : la lecture filtre sur abonne, par lots de 1 000.
 * RLS : l'admin AAL2 lit destinataires_emails comme abonnements_actualites (prive.est_admin()).
 */
async function lireEtats(client: SupabaseClient): Promise<Map<string, EtatAbonne>> {
  const lot = (debut: number) => client.from('destinataires_emails')
    .select('email, abonnement_a_confirmer, desinscrit_le', debut === 0 ? { count: 'exact' } : undefined)
    .eq('abonne', true).order('email').range(debut, debut + TAILLE_LOT - 1);
  const premier = await lot(0);
  if (premier.error) throw premier.error;
  const total = premier.count ?? premier.data?.length ?? 0;
  const suivants = await Promise.all(
    Array.from({ length: Math.max(0, Math.ceil(total / TAILLE_LOT) - 1) }, (_, index) => lot((index + 1) * TAILLE_LOT)),
  );
  const etats = new Map<string, EtatAbonne>();
  for (const reponse of [premier, ...suivants]) {
    if (reponse.error) throw reponse.error;
    for (const fiche of (reponse.data ?? []) as FicheEnvoi[]) etats.set(fiche.email, etatDe(fiche));
  }
  return etats;
}

export function meta() {
  return [{ title: 'Abonnés · Administration' }, { name: 'robots', content: 'noindex' }];
}

export default function Abonnes() {
  return <CadreAdmin surtitre="Actualités" titre="Abonnés aux actualités"><Liste /></CadreAdmin>;
}

function PastilleEtat({ etat }: { etat: EtatAbonne | 'inconnu' }) {
  const { texte, classe } = LIBELLES_ETAT[etat];
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${classe}`}>{texte}</span>;
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
  // null pendant la lecture, 'erreur' si les fiches d'envoi sont illisibles : la liste reste utilisable.
  const [etats, setEtats] = useState<Map<string, EtatAbonne> | 'erreur' | null>(null);

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

  useEffect(() => {
    if (!client) return;
    let actif = true;
    setEtats(null);
    lireEtats(client).then(
      (valeur) => { if (actif) setEtats(valeur); },
      () => { if (actif) setEtats('erreur'); },
    );
    return () => { actif = false; };
  }, [client, revision]);

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
    <p className="text-sm text-encre-2">
      Adresses recueillies sur l’accueil pour les actualités, informations pratiques, résultats et notations. Chaque nouvelle
      adresse reçoit d’abord un email de confirmation&nbsp;: tant que la personne n’a pas cliqué, rien d’autre ne lui part.
    </p>
    <div role="alert">{erreurClient || erreur ? <p className="mt-4 text-rouge-alerte">{erreurClient || erreur}</p> : null}</div>
    {etats === 'erreur' ? <p className="mt-4 text-sm text-rouge-alerte">L’état de confirmation des abonnés est illisible. Réessayez plus tard.</p> : null}
    {!lignes && !erreur && !erreurClient ? <p role="status" className="mt-4">Lecture des abonnés…</p> : null}
    {erreur ? <button className={`${BOUTON} mt-3`} onClick={() => setRevision((valeur) => valeur + 1)}>Réessayer</button> : null}
    {lignes ? <>
      <h2 className="mt-5 font-display text-2xl">{total} abonné{total > 1 ? 's' : ''}</h2>
      {!lignes.length ? <p className="mt-3">Aucune inscription pour le moment.</p> : <ul className="mt-3 divide-y divide-trait">
        {lignes.map((abonne) => <li key={abonne.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="grid min-w-0 gap-1">
            <p className="font-semibold break-all">{abonne.email}</p>
            <p className="text-xs text-encre-2">Consentement reçu le <time dateTime={abonne.consentement_le}>{new Date(abonne.consentement_le).toLocaleString('fr-FR')}</time></p>
            {etats === null ? <p className="text-xs text-encre-2">État d’envoi…</p>
              : etats === 'erreur' ? null
                : <p><PastilleEtat etat={etats.get(abonne.email) ?? 'inconnu'} /></p>}
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
