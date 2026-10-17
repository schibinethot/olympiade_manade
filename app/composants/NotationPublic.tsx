import { useEffect, useState } from 'react';
import { AvisSoiree } from './AvisSoiree';
import { ChoixNotifications } from './Notifications';
import { useInstantanePublic } from '../lib/contexte-etat';
import { useFileNotes, type FileNoteItem } from '../lib/file-notes';
import { passageOuvert, useNotesConfirmees, usePlanningNotation } from '../lib/notation';
import { echeanceVote, libelleTempsRestant } from '../lib/temps-restant';

const motifs: Record<string, string> = {
  vote_ferme: 'Vote fermé, note non prise en compte.',
  email_non_verifie: 'Validez votre adresse email avant de noter.',
  identifiant_reutilise: 'Cet envoi ne peut pas être confirmé. Choisissez à nouveau votre note.',
  trop_de_modifications: 'Le nombre maximal de corrections a été atteint pour ce passage.',
  limite_atteinte: 'Le nombre maximal de corrections a été atteint pour ce passage.',
  trop_actions: 'Le nombre maximal de corrections a été atteint pour ce passage.',
};
function etatNote(item: FileNoteItem): string {
  switch (item.statut) {
    case 'pending': return `Note ${item.note}/10 gardée sur cet appareil, en attente d’envoi.`;
    case 'sending': return `Envoi de la note ${item.note}/10…`;
    case 'queued': return `Note ${item.note}/10 reçue, en attente d’enregistrement.`;
    case 'confirmed': return `Note ${item.note}/10 enregistrée.`;
    case 'rejected': return motifs[item.motif ?? ''] ?? 'Cette note n’a pas été prise en compte. Vous pouvez réessayer si le vote est encore ouvert.';
  }
}

export function NotationPublic({ compte }: { compte: string }) {
  const { planning, chargement, erreur } = usePlanningNotation();
  const instantane = useInstantanePublic();
  const file = useFileNotes(compte);
  const [erreurSaisie, setErreurSaisie] = useState<string | null>(null);
  const [horloge, setHorloge] = useState<number | null>(null);
  useEffect(() => {
    setHorloge(Date.now());
    const minuteur = setInterval(() => setHorloge(Date.now()), 1000);
    return () => clearInterval(minuteur);
  }, []);
  const passages = planning?.soirees.flatMap((s) => s.epreuves.flatMap((e) => e.passages.map((p) => p.id))) ?? [];
  const confirmees = useNotesConfirmees(compte, passages);
  const dernieres = new Map<string, FileNoteItem>();
  for (const item of [...file.items].sort((a, b) => a.sequence - b.sequence || a.createdAt - b.createdAt || a.id.localeCompare(b.id))) dernieres.set(item.passageId, item);
  const enAttente = file.items.filter((i) => ['pending', 'sending', 'queued'].includes(i.statut));

  async function noter(passage: string, note: number) {
    setErreurSaisie(null);
    try { await file.enqueue(passage, note); }
    catch { setErreurSaisie('La note n’a pas pu être gardée sur cet appareil. Vérifiez l’espace disponible et réessayez en gardant cette page ouverte.'); }
  }

  return <section aria-label="Vos notes" className="mx-auto max-w-5xl px-4 pb-8 tablette:px-7 paysage:px-10">
    <div className="mb-6 rounded-2xl border border-trait bg-lin p-5">
      <h2 className="font-display text-2xl">Vos notes, de 1 à 10</h2>
      <p className="mt-2 text-sm text-encre-2">Choisissez une note pour l’envoyer. Vous pouvez la corriger tant que le vote est ouvert. Attendez la mention « enregistrée » pour savoir qu’elle est prise en compte.</p>
      {enAttente.length ? <p role="status" className="mt-3 font-semibold">{enAttente.length} {enAttente.length > 1 ? 'actions en attente' : 'action en attente'}. L’envoi reprend automatiquement avec la connexion. Gardez le site ouvert ou revenez sur cet appareil.</p> : null}
    </div>
    {file.storageError || erreurSaisie ? <p role="alert" className="mb-5 rounded-xl border border-rouge/30 bg-creme p-4 text-rouge-alerte">{erreurSaisie ?? 'Le stockage de cet appareil est indisponible. Aucune nouvelle note ne peut être gardée pour le moment.'}</p> : null}
    {erreur ? <p role="status" className="mb-5 text-encre-2">{erreur}</p> : null}
    {confirmees.erreur ? <p role="status" className="mb-5 text-encre-2">Vos anciennes notes ne peuvent pas être relues pour le moment. Les nouveaux envois gardent leur propre confirmation.</p> : null}
    {chargement ? <p role="status">Lecture des passages…</p> : null}
    {planning && !planning.fileActive ? <p role="status" className="mb-5 rounded-xl bg-lin p-4">L’enregistrement des notes n’est pas encore activé.</p> : null}
    {planning && planning.soirees.length === 0 ? <p>Les votes ouvriront le soir de l’Olympiade. Aucun passage n’est proposé pour le moment.</p> : null}
    {instantane.source === 'instantane' && instantane.soiree ? (
      <p className="mb-5 text-sm text-encre-2">
        Instantané public relu{instantane.calculeLe ? ` à ${new Date(instantane.calculeLe).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}.
        {instantane.soiree.epreuveEnCours ? ` ${instantane.soiree.epreuveEnCours}` : ''}
        {instantane.soiree.manadeEnPiste ? ` · ${instantane.soiree.manadeEnPiste}` : ''}
      </p>
    ) : null}
    {planning?.soirees.map((soiree) => <section key={soiree.id} aria-labelledby={`soiree-${soiree.id}`} className="mb-8">
      <h2 id={`soiree-${soiree.id}`} className="font-display text-3xl">{soiree.nom}</h2>
      {soiree.message_public ? <p className="mt-2 text-encre-2">{soiree.message_public}</p> : null}
      {soiree.epreuves.filter((e) => e.notee).map((epreuve) => <div key={epreuve.id} className="mt-6">
        <h3 className="mb-3 text-lg font-semibold">{epreuve.nom}</h3>
        <div className="grid gap-4 tablette:grid-cols-2">{epreuve.passages.map((passage) => {
          const item = dernieres.get(passage.id);
          const selection = item?.note ?? confirmees.notes[passage.id];
          const maintenantMs = horloge ?? Date.now();
          const ouvert = passageOuvert(soiree, passage, maintenantMs);
          const depuisInstantane = instantane.soiree?.passages.find((ligne) => ligne.id === passage.id)?.fermeLe;
          const reste = horloge == null ? null : libelleTempsRestant(echeanceVote({
            mode: soiree.mode_vote,
            voteFin: soiree.vote_fin,
            delaiMinutes: soiree.delai_vote_minutes,
            finPassage: passage.fin_passage_le,
            fermeLe: depuisInstantane ?? passage.ferme_le,
            heureFin: epreuve.heure_fin,
          }), maintenantMs, ouvert);
          return <fieldset key={passage.id} className="min-w-0 rounded-[22px] border border-trait bg-creme p-5">
            <legend className="px-2 font-display text-2xl">{passage.manades.nom}</legend>
            <p className="mb-1 text-sm text-encre-2">{ouvert ? 'À vous de noter' : passage.statut_public === 'a_venir' && soiree.mode_vote === 'deblocage' ? 'Vote à venir' : 'Vote fermé'}</p>
            {reste ? <p className="mb-3 text-sm font-semibold tabular-nums">{reste}</p> : <p className="mb-3 text-sm text-encre-2"> </p>}
            <div className="grid grid-cols-5 gap-2">{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <button key={n} type="button" aria-label={`${n} sur 10`} aria-pressed={selection === n}
              disabled={!ouvert || !planning.fileActive || file.loading || !!file.storageError}
              onClick={() => void noter(passage.id, n)}
              className={`min-h-12 rounded-xl border text-lg font-semibold tabular-nums disabled:opacity-45 ${selection === n ? 'border-encre bg-encre text-sable' : 'border-trait bg-sable text-encre hover:border-encre'}`}>{n}</button>)}</div>
            <p role="status" className={`mt-4 min-h-12 text-sm ${item?.statut === 'rejected' ? 'text-rouge-alerte' : 'text-encre-2'}`}>
              {item ? etatNote(item) : selection ? `Note ${selection}/10 enregistrée.` : 'Aucune note enregistrée.'}
            </p>
          </fieldset>;
        })}</div>
      </div>)}
    </section>)}
    <AvisSoiree compte={compte} soirees={planning?.soirees ?? []} />
    <ChoixNotifications compte={compte} />
    {file.items.length ? <details className="rounded-2xl border border-trait bg-creme p-5"><summary className="min-h-12 cursor-pointer font-semibold">Suivi de vos derniers envois</summary>
      <p className="mb-3 text-sm text-encre-2">Les notes gardées sur l’appareil doivent parvenir au serveur avant la fermeture du vote. Une note déjà reçue à temps peut finir d’être enregistrée ensuite.</p>
      <ul className="space-y-2">{file.items.slice(0, 20).map((item) => <li key={item.id} className="border-t border-trait pt-2 text-sm"><time dateTime={new Date(item.createdAt).toISOString()}>{new Date(item.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</time> · {etatNote(item)}</li>)}</ul>
    </details> : null}
  </section>;
}
