import { useState, type FormEvent } from 'react';
import { BOUTON, BOUTON_PLEIN, CHAMP } from './CadreAdmin';
import { EPREUVES_MODELE, horairesModele } from '../../lib/preparation';
import type { SupabaseClient } from '@supabase/supabase-js';

type EpreuveBrouillon = { ordre: number; nom: string; heureDebut: string; heureFin: string; description: string; descriptionIa: boolean };
type ManadeBrouillon = { nom: string; connue: boolean };
type Brouillon = { manades: ManadeBrouillon[]; epreuves: EpreuveBrouillon[]; avertissements: string[] };

const VIDE: Brouillon = { manades: [], epreuves: [], avertissements: [] };

export function ImportPlanning({ client, soireeId, jour, dejaSaisi, sessionToken, onApplique }: {
  client: SupabaseClient;
  soireeId: string;
  jour: string;
  dejaSaisi: boolean;
  sessionToken: string | undefined;
  onApplique: () => void;
}) {
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function deposer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!sessionToken || enCours) return;
    const fichier = (evenement.currentTarget.elements.namedItem('fichier') as HTMLInputElement).files?.[0];
    if (!fichier) return;
    if (fichier.size > 20 * 1024 * 1024) { setErreur('Fichier trop lourd (20 Mo maximum).'); return; }
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      const prepare = await preparerFichier(fichier);
      const reponse = await fetch('/api/admin/import-planning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ soireeId, nom: prepare.nom, type: prepare.type, contenuBase64: prepare.base64 }),
      });
      const corps = await reponse.json().catch(() => null) as { brouillon?: Brouillon; applique?: boolean; error?: string } | null;
      if (!reponse.ok || !corps?.brouillon) {
        setErreur('La lecture n’a pas abouti. Vous pouvez saisir le planning à la main.');
        setBrouillon(VIDE);
        return;
      }
      if (corps.applique) {
        setErreur('Refus : un import ne doit pas écrire le planning.');
        return;
      }
      const annuaire = await client.from('manades').select('nom');
      const connus = new Set(((annuaire.data ?? []) as { nom: string }[]).map((manade) => manade.nom.toLocaleLowerCase('fr')));
      setBrouillon({
        ...corps.brouillon,
        manades: corps.brouillon.manades.map((manade) => ({ ...manade, connue: connus.has(manade.nom.toLocaleLowerCase('fr')) })),
      });
      setInfo('Brouillon à relire. Rien n’est encore dans le planning.');
    } catch {
      setErreur('Le fichier n’a pas pu être envoyé.');
    } finally {
      setEnCours(false);
    }
  }

  async function appliquer() {
    if (!brouillon || enCours) return;
    if (dejaSaisi && !window.confirm('Remplacer le planning déjà saisi ? Les notes existantes empêchent le remplacement.')) return;
    if (!window.confirm('Appliquer ce brouillon au planning ?')) return;
    setEnCours(true);
    setErreur(null);
    const epreuves = brouillon.epreuves.length ? brouillon.epreuves : EPREUVES_MODELE.map((epreuve, index) => ({
      ordre: index + 1, nom: epreuve.nom, description: epreuve.description, descriptionIa: false, heureDebut: '', heureFin: '',
    }));
    const horaires = horairesModele(jour);
    const epreuvesActuelles = await client.from('epreuves').select('id').eq('soiree_id', soireeId);
    const epreuveIds = ((epreuvesActuelles.data ?? []) as { id: string }[]).map((epreuve) => epreuve.id);
    const passagesActuels = epreuveIds.length
      ? await client.from('passages').select('id').in('epreuve_id', epreuveIds)
      : { data: [] as { id: string }[] };
    const passageIds = ((passagesActuels.data ?? []) as { id: string }[]).map((passage) => passage.id);
    const notes = passageIds.length
      ? await client.from('notes_public').select('passage_id').in('passage_id', passageIds).limit(1)
      : { data: [] as { passage_id: string }[] };
    if ((notes.data ?? []).length) {
      setErreur('Des notes existent déjà : le planning n’est pas remplacé.');
      setEnCours(false);
      return;
    }
    const suppression = await client.from('epreuves').delete().eq('soiree_id', soireeId);
    if (suppression.error) { setErreur('Le planning actuel n’a pas pu être retiré.'); setEnCours(false); return; }
    for (const manade of brouillon.manades) {
      const nom = manade.nom.trim();
      if (!nom) continue;
      let id: string | undefined;
      const existante = await client.from('manades').select('id').eq('nom', nom).maybeSingle();
      if (existante.data?.id) id = existante.data.id as string;
      else {
        const creee = await client.from('manades').insert({ nom }).select('id').single();
        id = creee.data?.id as string | undefined;
      }
      if (!id) continue;
      const deja = await client.from('soiree_manades').select('manade_id').eq('soiree_id', soireeId).eq('manade_id', id).maybeSingle();
      if (!deja.data) await client.from('soiree_manades').insert({ soiree_id: soireeId, manade_id: id, ordre: brouillon.manades.indexOf(manade) + 1 });
    }
    const creees = await client.from('epreuves').insert(epreuves.map((epreuve, index) => ({
      soiree_id: soireeId,
      ordre: index + 1,
      nom: epreuve.nom,
      description: epreuve.description || null,
      description_ia: epreuve.descriptionIa,
      notee: true,
      heure_debut: horaires[index]?.heureDebut ?? null,
      heure_fin: horaires[index]?.heureFin ?? null,
    }))).select('id, ordre');
    if (creees.error || !creees.data) { setErreur('Les épreuves n’ont pas été créées.'); setEnCours(false); return; }
    const engages = await client.from('soiree_manades').select('manade_id, ordre').eq('soiree_id', soireeId).order('ordre');
    const passages = ((creees.data ?? []) as { id: string }[]).flatMap((epreuve) => ((engages.data ?? []) as { manade_id: string; ordre: number }[]).map((manade) => ({
      epreuve_id: epreuve.id, manade_id: manade.manade_id, ordre: manade.ordre,
    })));
    if (passages.length) {
      const ecrits = await client.from('passages').insert(passages);
      if (ecrits.error) { setErreur('Les passages n’ont pas été créés.'); setEnCours(false); return; }
    }
    setInfo('Planning appliqué.');
    setBrouillon(null);
    setEnCours(false);
    onApplique();
  }

  return (
    <section className="rounded-[22px] border border-trait bg-creme p-5">
      <h2 className="font-display text-2xl">Importer un planning</h2>
      <p className="mt-1 text-sm text-encre-2">PDF, photo, Word, Excel ou CSV. Le résultat se relit ici. Rien n’est écrit avant « Appliquer au planning ».</p>
      <form onSubmit={(evenement) => void deposer(evenement)} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="grid gap-2 text-sm font-medium">Fichier
          <input name="fichier" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.docx,.xlsx,.xls,.csv,image/*,application/pdf" className={CHAMP} required />
        </label>
        <button className={BOUTON_PLEIN} disabled={enCours || !sessionToken}>{enCours ? 'Lecture…' : 'Lire le fichier'}</button>
      </form>
      {erreur ? <p className="mt-3 text-sm text-rouge-alerte">{erreur}</p> : null}
      {info ? <p role="status" className="mt-3 text-sm">{info}</p> : null}
      {brouillon ? (
        <div className="mt-4 grid gap-3">
          {brouillon.avertissements.map((avertissement) => <p key={avertissement} className="text-sm text-encre-2">{avertissement}</p>)}
          <h3 className="font-semibold">Manades</h3>
          {brouillon.manades.map((manade, index) => (
            <label key={`${manade.nom}-${index}`} className="grid gap-1 text-sm">Manade {index + 1}{manade.connue ? '' : ' · nouvelle'}
              <input className={CHAMP} value={manade.nom} onChange={(evenement) => setBrouillon({ ...brouillon, manades: brouillon.manades.map((ligne, rang) => rang === index ? { ...ligne, nom: evenement.target.value } : ligne) })} />
            </label>
          ))}
          <button type="button" className={BOUTON} onClick={() => setBrouillon({ ...brouillon, manades: [...brouillon.manades, { nom: '', connue: false }] })}>Ajouter une manade</button>
          <h3 className="font-semibold">Épreuves</h3>
          {brouillon.epreuves.map((epreuve, index) => (
            <div key={epreuve.ordre} className="grid gap-2 rounded-xl border border-trait p-3">
              <label className="grid gap-1 text-sm">Nom
                <input className={CHAMP} value={epreuve.nom} onChange={(evenement) => modifierEpreuve(setBrouillon, brouillon, index, { nom: evenement.target.value })} />
              </label>
              <label className="grid gap-1 text-sm">Description{epreuve.descriptionIa ? ' · générée par l’IA' : ''}
                <textarea className={`${CHAMP} min-h-20 py-2`} value={epreuve.description} onChange={(evenement) => modifierEpreuve(setBrouillon, brouillon, index, { description: evenement.target.value, descriptionIa: false })} />
              </label>
            </div>
          ))}
          <button type="button" className={BOUTON_PLEIN} disabled={enCours} onClick={() => void appliquer()}>Appliquer au planning</button>
        </div>
      ) : null}
    </section>
  );
}

function modifierEpreuve(setBrouillon: (valeur: Brouillon) => void, brouillon: Brouillon, index: number, patch: Partial<EpreuveBrouillon>) {
  setBrouillon({ ...brouillon, epreuves: brouillon.epreuves.map((ligne, rang) => rang === index ? { ...ligne, ...patch } : ligne) });
}

async function preparerFichier(fichier: File): Promise<{ nom: string; type: string; base64: string }> {
  let blob: Blob = fichier;
  let type = fichier.type;
  let nom = fichier.name;
  if (/heic/i.test(fichier.type) || fichier.name.toLowerCase().endsWith('.heic')) {
    const bitmap = await createImageBitmap(fichier);
    const echelle = Math.min(1, 2576 / Math.max(bitmap.width, bitmap.height));
    const toile = document.createElement('canvas');
    toile.width = Math.round(bitmap.width * echelle);
    toile.height = Math.round(bitmap.height * echelle);
    toile.getContext('2d')?.drawImage(bitmap, 0, 0, toile.width, toile.height);
    const jpeg = await new Promise<Blob | null>((resoudre) => toile.toBlob(resoudre, 'image/jpeg', 0.85));
    if (!jpeg) throw new Error('heic');
    blob = jpeg;
    type = 'image/jpeg';
    nom = fichier.name.replace(/\.heic$/i, '.jpg');
  }
  const octets = new Uint8Array(await blob.arrayBuffer());
  let binaire = '';
  octets.forEach((octet) => { binaire += String.fromCharCode(octet); });
  return { nom, type, base64: btoa(binaire) };
}
