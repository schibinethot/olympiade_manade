import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/useSession';

type Passage = { id: string; manade: string; epreuve: string; bareme: number; note: number | null };

export function meta() {
  return [{ title: 'Jury · Olympiade des Manades' }, { name: 'robots', content: 'noindex' }];
}

export default function Jury() {
  const { session, chargement } = useSession();
  const [passages, setPassages] = useState<Passage[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let actif = true;
    void (async () => {
      const client = await supabase();
      const profil = await client.from('profils').select('role').eq('id', session.user.id).maybeSingle();
      if (!actif) return;
      if (profil.error || (profil.data?.role !== 'juge' && profil.data?.role !== 'admin')) {
        setErreur('Cet écran est réservé aux juges de la soirée.');
        setPassages([]);
        return;
      }
      const liens = await client.from('soiree_juges').select('soiree_id').eq('juge_id', session.user.id);
      const soirees = ((liens.data ?? []) as { soiree_id: string }[]).map((lien) => lien.soiree_id);
      if (!soirees.length) { setPassages([]); return; }
      const epreuves = await client.from('epreuves').select('id, nom, soiree_id, notee').in('soiree_id', soirees).eq('notee', true);
      const reglages = await client.from('soirees').select('id, bareme_jury').in('id', soirees);
      const baremes = new Map(((reglages.data ?? []) as { id: string; bareme_jury: number }[]).map((soiree) => [soiree.id, soiree.bareme_jury]));
      const epreuveIds = ((epreuves.data ?? []) as { id: string }[]).map((epreuve) => epreuve.id);
      const liste = epreuveIds.length
        ? await client.from('passages').select('id, epreuve_id, manade_id, statut_jury').in('epreuve_id', epreuveIds).eq('statut_jury', 'ouvert')
        : { data: [] as { id: string; epreuve_id: string; manade_id: string }[] };
      const manadeIds = [...new Set(((liste.data ?? []) as { manade_id: string }[]).map((passage) => passage.manade_id))];
      const manades = manadeIds.length ? await client.from('manades').select('id, nom').in('id', manadeIds) : { data: [] };
      const noms = new Map(((manades.data ?? []) as { id: string; nom: string }[]).map((manade) => [manade.id, manade.nom]));
      const epreuveParId = new Map(((epreuves.data ?? []) as { id: string; nom: string; soiree_id: string }[]).map((epreuve) => [epreuve.id, epreuve]));
      const notes = await client.from('notes_jury').select('passage_id, note').eq('juge_id', session.user.id);
      const deja = new Map(((notes.data ?? []) as { passage_id: string; note: number }[]).map((note) => [note.passage_id, Number(note.note)]));
      if (!actif) return;
      setPassages(((liste.data ?? []) as { id: string; epreuve_id: string; manade_id: string }[]).map((passage) => {
        const epreuve = epreuveParId.get(passage.epreuve_id);
        return {
          id: passage.id,
          manade: noms.get(passage.manade_id) ?? 'Manade',
          epreuve: epreuve?.nom ?? 'Épreuve',
          bareme: baremes.get(epreuve?.soiree_id ?? '') ?? 20,
          note: deja.get(passage.id) ?? null,
        };
      }));
    })().catch(() => { if (actif) setErreur('La notation du jury est indisponible.'); });
    return () => { actif = false; };
  }, [session]);

  async function noter(passage: Passage, note: number) {
    if (!session) return;
    setErreur(null);
    setInfo(null);
    const client = await supabase();
    const { error } = await client.from('notes_jury').upsert({
      passage_id: passage.id, juge_id: session.user.id, note,
    });
    if (error) setErreur('La note n’a pas été enregistrée. Le passage est peut-être fermé.');
    else {
      setInfo('Note enregistrée.');
      setPassages((avant) => avant?.map((ligne) => ligne.id === passage.id ? { ...ligne, note } : ligne) ?? null);
    }
  }

  if (chargement) return <p className="px-4 pt-8" role="status">Vérification…</p>;
  if (!session) return <p className="px-4 pt-8">Ouvrez le lien personnel transmis par l’organisateur. <Link to="/admin" className="underline">Connexion organisateur</Link></p>;
  return (
    <div className="mx-auto grid max-w-xl gap-4 px-4 pt-8 pb-16">
      <h1 className="font-display text-4xl">Notation du jury</h1>
      {erreur ? <p role="alert" className="text-rouge-alerte">{erreur}</p> : null}
      {info ? <p role="status">{info}</p> : null}
      {!passages ? <p role="status">Lecture des passages ouverts…</p> : passages.length ? passages.map((passage) => (
        <section key={passage.id} className="rounded-[22px] border border-trait bg-creme p-5">
          <h2 className="font-display text-2xl">{passage.manade}</h2>
          <p className="text-sm text-encre-2">{passage.epreuve} · sur {passage.bareme}{passage.note != null ? ` · votre note ${passage.note}` : ''}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-trait px-3 font-semibold" onClick={() => void noter(passage, Math.max(0, (passage.note ?? passage.bareme) - 0.5))}>−</button>
            <button type="button" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-encre px-4 font-semibold text-sable" onClick={() => void noter(passage, passage.note ?? passage.bareme)}>Enregistrer {passage.note ?? passage.bareme}</button>
            <button type="button" className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-trait px-3 font-semibold" onClick={() => void noter(passage, Math.min(passage.bareme, (passage.note ?? 0) + 0.5))}>+</button>
          </div>
        </section>
      )) : <p>Aucun passage n’est ouvert pour le jury.</p>}
    </div>
  );
}
