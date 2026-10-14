import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { BOUTON, CadreAdmin, useClientAdmin } from '../composants/admin/CadreAdmin';
import { ClassementCalcule } from '../composants/ClassementCalcule';
import type { InstantanePublic } from '../lib/contexte-etat';
import { calculerClassements, exporterClassementsCsv } from '../../serveur/classements.mjs';

type Classements = NonNullable<NonNullable<InstantanePublic['soiree']>['classements']>;

export function meta() {
  return [{ title: 'Résultats · Administration' }, { name: 'robots', content: 'noindex' }];
}

export default function Resultats() {
  const { soireeId = '' } = useParams();
  return <CadreAdmin surtitre="Résultats" titre="Classements"><Calcul soireeId={soireeId} /></CadreAdmin>;
}

function Calcul({ soireeId }: { soireeId: string }) {
  const { client, erreurClient } = useClientAdmin();
  const [resultat, setResultat] = useState<Classements | null>(null);
  const [nom, setNom] = useState('');
  const [visible, setVisible] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let actif = true;
    void (async () => {
      const soiree = await client.from('soirees').select('nom, mode_classement, methode_general, poids_jury, bareme_jury, classement_visible').eq('id', soireeId).maybeSingle();
      if (!actif) return;
      if (soiree.error || !soiree.data) { setErreur('Soirée introuvable.'); return; }
      setNom(soiree.data.nom as string);
      setVisible(Boolean(soiree.data.classement_visible));
      const epreuves = await client.from('epreuves').select('id, nom, ordre, notee').eq('soiree_id', soireeId);
      const ids = ((epreuves.data ?? []) as { id: string }[]).map((epreuve) => epreuve.id);
      const [passages, manades] = await Promise.all([
        ids.length ? client.from('passages').select('id, epreuve_id, manade_id, statut_public, statut_jury, ferme_le').in('epreuve_id', ids) : Promise.resolve({ data: [], error: null }),
        client.from('manades').select('id, nom'),
      ]);
      const liste = (passages.data ?? []) as { id: string; epreuve_id: string; manade_id: string; statut_public: string; statut_jury: string; ferme_le: string | null }[];
      const notesP = liste.length ? await client.from('notes_public').select('passage_id, note').in('passage_id', liste.map((p) => p.id)) : { data: [] };
      const notesJ = liste.length ? await client.from('notes_jury').select('passage_id, note').in('passage_id', liste.map((p) => p.id)) : { data: [] };
      if (!actif) return;
      const noms = new Map(((manades.data ?? []) as { id: string; nom: string }[]).map((manade) => [manade.id, manade.nom]));
      const epreuveParId = new Map(((epreuves.data ?? []) as { id: string; nom: string; ordre: number; notee: boolean }[]).map((epreuve) => [epreuve.id, epreuve]));
      const publics = new Map<string, number[]>();
      const jurys = new Map<string, number[]>();
      for (const note of (notesP.data ?? []) as { passage_id: string; note: number }[]) {
        const valeurs = publics.get(note.passage_id) ?? [];
        valeurs.push(Number(note.note));
        publics.set(note.passage_id, valeurs);
      }
      for (const note of (notesJ.data ?? []) as { passage_id: string; note: number }[]) {
        const valeurs = jurys.get(note.passage_id) ?? [];
        valeurs.push(Number(note.note));
        jurys.set(note.passage_id, valeurs);
      }
      const passagesCalcul = liste.flatMap((passage) => {
        const epreuve = epreuveParId.get(passage.epreuve_id);
        if (!epreuve?.notee) return [];
        const ferme = passage.ferme_le ? Date.parse(passage.ferme_le) <= Date.now() : false;
        return [{
          id: passage.id,
          epreuveId: passage.epreuve_id,
          epreuveNom: epreuve.nom,
          epreuveOrdre: epreuve.ordre,
          manadeId: passage.manade_id,
          manadeNom: noms.get(passage.manade_id) ?? 'Manade',
          publicOuvert: passage.statut_public === 'ouvert' && !ferme,
          juryOuvert: passage.statut_jury === 'ouvert',
          notesPublic: publics.get(passage.id) ?? [],
          notesJury: jurys.get(passage.id) ?? [],
        }];
      });
      setResultat(calculerClassements(passagesCalcul, {
        mode: soiree.data.mode_classement,
        methode: soiree.data.methode_general,
        poidsJury: soiree.data.poids_jury,
        baremeJury: soiree.data.bareme_jury,
      }) as Classements);
    })();
    return () => { actif = false; };
  }, [client, soireeId]);

  function exporter() {
    if (!resultat) return;
    const url = URL.createObjectURL(new Blob([exporterClassementsCsv(resultat)], { type: 'text/csv;charset=utf-8' }));
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `classements-${nom || 'soiree'}.csv`;
    lien.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function reveler(valeur: boolean) {
    if (!client) return;
    const { error } = await client.from('soirees').update({ classement_visible: valeur }).eq('id', soireeId);
    if (error) setErreur('La visibilité n’a pas pu être modifiée.');
    else setVisible(valeur);
  }

  if (erreurClient) return <p role="alert" className="text-rouge-alerte">{erreurClient}</p>;
  if (erreur) return <p role="alert" className="text-rouge-alerte">{erreur}</p>;
  if (!resultat) return <p role="status">Calcul des classements…</p>;
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BOUTON} onClick={exporter}>Exporter CSV</button>
        <button type="button" className={BOUTON} onClick={() => void reveler(!visible)}>{visible ? 'Masquer le classement public' : 'Révéler le classement public'}</button>
        <Link to={`/admin/soirees/${soireeId}/direct`} className={BOUTON}>Cockpit</Link>
      </div>
      <p className="text-sm text-encre-2">{nom} · {visible ? 'visible du public lorsque la soirée réelle est activée' : 'masqué pour le public'}</p>
      <ClassementCalcule classements={resultat} />
    </>
  );
}
