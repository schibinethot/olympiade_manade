import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { BOUTON, BOUTON_PLEIN, CadreAdmin, CARTE, CHAMP, useClientAdmin } from '../composants/admin/CadreAdmin';

type Passage = {
  id: string; epreuve_id: string; manade_id: string; ordre: number;
  statut_public: string; statut_jury: string; jury_lie_au_public: boolean;
  fin_passage_le: string | null; ferme_le: string | null;
};
type Epreuve = { id: string; ordre: number; nom: string; notee: boolean; heure_debut: string | null; heure_fin: string | null };
type Soiree = { id: string; nom: string; statut: string; mode_vote: string; delai_vote_minutes: number | null };

export function meta() {
  return [{ title: 'Cockpit · Administration' }, { name: 'robots', content: 'noindex' }];
}

export default function Cockpit() {
  const { soireeId = '' } = useParams();
  return <CadreAdmin surtitre="En direct" titre="Cockpit"><Pilotage soireeId={soireeId} /></CadreAdmin>;
}

function Pilotage({ soireeId }: { soireeId: string }) {
  const { client, erreurClient } = useClientAdmin();
  const [soiree, setSoiree] = useState<Soiree | null>(null);
  const [epreuves, setEpreuves] = useState<Epreuve[]>([]);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [noms, setNoms] = useState<Map<string, string>>(new Map());
  const [votes, setVotes] = useState<Map<string, number>>(new Map());
  const [jugesEnRetard, setJugesEnRetard] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(5);
  const [maintenant, setMaintenant] = useState(() => Date.now());

  async function recharger() {
    if (!client) return;
    const [s, e, manades] = await Promise.all([
      client.from('soirees').select('id, nom, statut, mode_vote, delai_vote_minutes').eq('id', soireeId).maybeSingle(),
      client.from('epreuves').select('id, ordre, nom, notee, heure_debut, heure_fin').eq('soiree_id', soireeId).order('ordre'),
      client.from('soiree_manades').select('manade_id, manades(nom)').eq('soiree_id', soireeId),
    ]);
    if (s.error || !s.data) { setErreur('Soirée introuvable.'); return; }
    setSoiree(s.data as Soiree);
    const listeEpreuves = (e.data ?? []) as Epreuve[];
    setEpreuves(listeEpreuves);
    const ids = listeEpreuves.map((epreuve) => epreuve.id);
    const p = ids.length
      ? await client.from('passages').select('id, epreuve_id, manade_id, ordre, statut_public, statut_jury, jury_lie_au_public, fin_passage_le, ferme_le').in('epreuve_id', ids)
      : { data: [], error: null };
    if (p.error) { setErreur('Les passages sont indisponibles.'); return; }
    const liste = (p.data ?? []) as Passage[];
    setPassages(liste);
    const carte = new Map<string, string>();
    for (const lien of (manades.data ?? []) as { manade_id: string; manades: { nom: string } | { nom: string }[] | null }[]) {
      const nom = Array.isArray(lien.manades) ? lien.manades[0]?.nom : lien.manades?.nom;
      if (nom) carte.set(lien.manade_id, nom);
    }
    setNoms(carte);
    const passageIds = liste.map((passage) => passage.id);
    if (passageIds.length) {
      const notes = await client.from('notes_public').select('passage_id').in('passage_id', passageIds);
      const compte = new Map<string, number>();
      for (const note of (notes.data ?? []) as { passage_id: string }[]) compte.set(note.passage_id, (compte.get(note.passage_id) ?? 0) + 1);
      setVotes(compte);
      const jury = await client.from('notes_jury').select('passage_id, juge_id').in('passage_id', passageIds);
      const rattaches = await client.from('soiree_juges').select('juge_id, profils(prenom)').eq('soiree_id', soireeId);
      const ouverts = new Set(liste.filter((passage) => passage.statut_jury === 'ouvert').map((passage) => passage.id));
      const notesParJuge = new Map<string, Set<string>>();
      for (const note of (jury.data ?? []) as { passage_id: string; juge_id: string }[]) {
        const ensemble = notesParJuge.get(note.juge_id) ?? new Set();
        ensemble.add(note.passage_id);
        notesParJuge.set(note.juge_id, ensemble);
      }
      const retard: string[] = [];
      for (const juge of (rattaches.data ?? []) as { juge_id: string; profils: { prenom: string } | { prenom: string }[] | null }[]) {
        const prenom = Array.isArray(juge.profils) ? juge.profils[0]?.prenom : juge.profils?.prenom;
        const faites = notesParJuge.get(juge.juge_id) ?? new Set();
        if ([...ouverts].some((id) => !faites.has(id))) retard.push(prenom ?? 'Juge');
      }
      setJugesEnRetard(retard);
    }
  }

  useEffect(() => {
    if (!client) return;
    void recharger();
    const minuteur = setInterval(() => { setMaintenant(Date.now()); void recharger(); }, 8_000);
    return () => clearInterval(minuteur);
  }, [client, soireeId]);

  async function executer(action: () => PromiseLike<{ error: { message: string } | null }>) {
    if (!client || enCours) return;
    setEnCours(true);
    setErreur(null);
    const { error } = await action();
    setEnCours(false);
    setConfirmation(null);
    if (error) setErreur(error.message || 'L’action n’a pas abouti.');
    else await recharger();
  }

  function maj(ids: string[], valeurs: Record<string, unknown>) {
    if (!client) return Promise.resolve({ error: { message: 'Indisponible' } });
    return client.from('passages').update(valeurs).in('id', ids);
  }

  function juryASuivre(cibles: Passage[]) {
    return cibles.length > 0 && cibles.every((passage) => passage.jury_lie_au_public && passage.statut_jury !== 'verrouille');
  }

  async function debloquer(cibles: Passage[]) {
    await executer(() => maj(cibles.map((passage) => passage.id), juryASuivre(cibles)
      ? { statut_public: 'ouvert', statut_jury: 'ouvert' }
      : { statut_public: 'ouvert' }));
  }

  async function fermer(cibles: Passage[]) {
    await executer(() => maj(cibles.map((passage) => passage.id), {
      statut_public: 'clos',
      ferme_le: new Date().toISOString(),
      ...(juryASuivre(cibles) ? { statut_jury: 'clos' } : {}),
    }));
  }

  async function passageTermine(passage: Passage) {
    const fin = new Date().toISOString();
    const delai = soiree?.delai_vote_minutes;
    await executer(() => maj([passage.id], {
      fin_passage_le: fin,
      ferme_le: delai == null ? null : new Date(Date.now() + delai * 60_000).toISOString(),
    }));
  }

  async function prolonger(passage: Passage) {
    const base = passage.ferme_le && Date.parse(passage.ferme_le) > Date.now() ? Date.parse(passage.ferme_le) : Date.now();
    await executer(() => maj([passage.id], {
      statut_public: 'ouvert',
      ferme_le: new Date(base + minutes * 60_000).toISOString(),
    }));
  }

  async function decalerSuite(ordre: number) {
    if (!client) return;
    await executer(async () => {
      const suivantes = epreuves.filter((epreuve) => epreuve.ordre > ordre && epreuve.heure_debut && epreuve.heure_fin);
      for (const epreuve of suivantes) {
        const resultat = await client.from('epreuves').update({
          heure_debut: new Date(Date.parse(epreuve.heure_debut ?? '') + minutes * 60_000).toISOString(),
          heure_fin: new Date(Date.parse(epreuve.heure_fin ?? '') + minutes * 60_000).toISOString(),
        }).eq('id', epreuve.id);
        if (resultat.error) return resultat;
      }
      return { error: null };
    });
  }

  if (erreurClient) return <p role="alert" className="text-rouge-alerte">{erreurClient}</p>;
  if (!soiree) return <p role="status">{erreur ?? 'Lecture du cockpit…'}</p>;
  const courante = epreuves.find((epreuve) => passages.some((passage) => passage.epreuve_id === epreuve.id && passage.statut_public === 'ouvert'))
    ?? epreuves.find((epreuve) => epreuve.notee) ?? epreuves[0];
  const liste = passages.filter((passage) => passage.epreuve_id === courante?.id).sort((a, b) => a.ordre - b.ordre);

  return (
    <>
      <p className="text-sm text-encre-2">{soiree.nom} · {soiree.statut} · {soiree.mode_vote === 'libre' ? 'Vote libre' : 'Vote par déblocage'}</p>
      <Link to={`/admin/soirees/${soireeId}`} className="text-sm underline">Retour à la préparation</Link>
      {erreur ? <p role="alert" className="text-rouge-alerte">{erreur}</p> : null}
      <label className="grid max-w-xs gap-2 font-medium">Minutes (décalage ou prolongation)
        <input type="number" min={1} max={30} value={minutes} onChange={(evenement) => setMinutes(Number(evenement.target.value))} className={CHAMP} />
      </label>
      {courante ? (
        <section className={CARTE}>
          <h2 className="font-display text-3xl">{courante.nom}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={BOUTON_PLEIN} disabled={enCours} onClick={() => void debloquer(liste)}>Débloquer l’épreuve</button>
            <button type="button" className={BOUTON} disabled={enCours} onClick={() => setConfirmation(confirmation === 'fermer' ? null : 'fermer')}>Fermer l’épreuve</button>
            <button type="button" className={BOUTON} disabled={enCours} onClick={() => void decalerSuite(courante.ordre)}>Décaler la suite de +{minutes} min</button>
          </div>
          {confirmation === 'fermer' ? <button type="button" className={`${BOUTON_PLEIN} mt-3`} onClick={() => void fermer(liste)}>Confirmer la fermeture</button> : null}
          <ul className="mt-5 grid gap-3">
            {liste.map((passage) => {
              const reste = passage.ferme_le ? Math.max(0, Math.ceil((Date.parse(passage.ferme_le) - maintenant) / 1000)) : null;
              return (
                <li key={passage.id} className="rounded-xl border border-trait p-3">
                  <p className="font-semibold">{noms.get(passage.manade_id) ?? 'Manade'}</p>
                  <p className="text-sm text-encre-2">{votes.get(passage.id) ?? 0} vote{(votes.get(passage.id) ?? 0) > 1 ? 's' : ''} · public {passage.statut_public} · jury {passage.statut_jury}</p>
                  {reste !== null && passage.statut_public === 'ouvert' ? <p className="text-sm">{reste > 0 ? `Fermeture automatique dans ${reste} s` : 'Échéance de vote dépassée'}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className={BOUTON_PLEIN} disabled={enCours} onClick={() => void debloquer([passage])}>Débloquer</button>
                    <button type="button" className={BOUTON} disabled={enCours} onClick={() => void fermer([passage])}>Fermer</button>
                    <button type="button" className={BOUTON} disabled={enCours} onClick={() => void passageTermine(passage)}>Passage terminé</button>
                    <button type="button" className={BOUTON} disabled={enCours} onClick={() => void prolonger(passage)}>Prolonger de +{minutes} min</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : <p>Aucune épreuve. Préparez le planning d’abord.</p>}
      <section className={CARTE}>
        <h2 className="font-display text-2xl">Juges en retard</h2>
        {jugesEnRetard.length ? <ul className="mt-2">{jugesEnRetard.map((nom) => <li key={nom}>{nom}</li>)}</ul> : <p className="mt-2 text-sm text-encre-2">Aucun retard sur les passages ouverts au jury.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={BOUTON} onClick={() => setConfirmation(confirmation === 'verrouiller' ? null : 'verrouiller')}>Verrouiller le jury</button>
          <button type="button" className={BOUTON} onClick={() => setConfirmation(confirmation === 'terminer' ? null : 'terminer')}>Terminer la soirée</button>
          <button type="button" className={BOUTON} onClick={() => setConfirmation(confirmation === 'annuler' ? null : 'annuler')}>Annuler la soirée</button>
        </div>
        {confirmation === 'verrouiller' ? <button type="button" className={`${BOUTON_PLEIN} mt-3`} onClick={() => void executer(() => maj(passages.map((p) => p.id), { statut_jury: 'verrouille' }))}>Confirmer le verrouillage</button> : null}
        {confirmation === 'terminer' && client ? <button type="button" className={`${BOUTON_PLEIN} mt-3`} onClick={() => void executer(() => client.from('soirees').update({ statut: 'terminee' }).eq('id', soireeId))}>Confirmer la fin</button> : null}
        {confirmation === 'annuler' && client ? <button type="button" className={`${BOUTON_PLEIN} mt-3`} onClick={() => void executer(() => client.from('soirees').update({ statut: 'annulee' }).eq('id', soireeId))}>Confirmer l’annulation</button> : null}
      </section>
    </>
  );
}
