import { useState } from 'react';
import { avisOuvertClient } from '../lib/avis';
import type { SoireeNotation } from '../lib/notation';
import { supabase } from '../lib/supabase';

export function AvisSoiree({ compte, soirees }: { compte: string; soirees: SoireeNotation[] }) {
  const ouverte = soirees.find((soiree) => avisOuvertClient(soiree));
  const [etoiles, setEtoiles] = useState(0);
  const [commentaire, setCommentaire] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  if (!ouverte) return null;

  async function envoyer() {
    setErreur(null);
    if (etoiles < 1) { setErreur('Choisissez une note de 1 à 5.'); return; }
    const client = await supabase();
    if (!ouverte) return;
    const { error } = await client.from('avis_soiree').upsert({
      soiree_id: ouverte.id, votant_id: compte, etoiles, commentaire: commentaire.trim() || null,
    });
    if (error) setErreur('L’avis n’a pas été enregistré. Le vote de la soirée est peut-être encore ouvert.');
    else setInfo('Avis enregistré. Il reste visible des seuls organisateurs.');
  }

  return (
    <section aria-label="Avis sur la soirée" className="mt-8 rounded-[22px] border border-trait bg-creme p-5">
      <h2 className="font-display text-2xl">Votre avis sur la soirée</h2>
      <p className="mt-1 text-sm text-encre-2">De 1 à 5. Cet avis ne change pas les notes des manades. Un seul avis par personne.</p>
      <div className="mt-3 flex gap-2" role="group" aria-label="Note de 1 à 5">
        {[1, 2, 3, 4, 5].map((note) => (
          <button key={note} type="button" aria-pressed={etoiles === note} className={`min-h-12 min-w-12 rounded-xl border font-semibold ${etoiles === note ? 'border-encre bg-encre text-sable' : 'border-trait bg-sable'}`} onClick={() => setEtoiles(note)}>{note}</button>
        ))}
      </div>
      <label className="mt-3 grid gap-2 text-sm font-medium">Commentaire facultatif
        <textarea maxLength={500} value={commentaire} onChange={(evenement) => setCommentaire(evenement.target.value)} className="min-h-24 rounded-xl border border-trait bg-sable px-3 py-2" />
      </label>
      <button type="button" className="mt-3 inline-flex min-h-12 items-center rounded-xl bg-encre px-4 font-semibold text-sable" onClick={() => void envoyer()}>Enregistrer l’avis</button>
      {erreur ? <p className="mt-2 text-sm text-rouge-alerte">{erreur}</p> : null}
      {info ? <p role="status" className="mt-2 text-sm">{info}</p> : null}
    </section>
  );
}
