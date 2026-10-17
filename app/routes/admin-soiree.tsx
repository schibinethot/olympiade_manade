import { useEffect, useState, type DragEvent, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { BOUTON, BOUTON_PLEIN, CadreAdmin, CARTE, CHAMP, useClientAdmin } from '../composants/admin/CadreAdmin';
import { ImportPlanning } from '../composants/admin/ImportPlanning';
import { CodeQr } from '../composants/CodeQr';
import { etapesReordre } from '../lib/ordre';
import { documentPdf, matriceQr, telechargerFichier } from '../lib/pdf';
import { EPREUVES_MODELE, champParis, depuisChampParis, etapesEchange, horairesModele, slugifier } from '../lib/preparation';

type Soiree = {
  id: string; slug: string; nom: string; date_soiree: string; lieu: string | null;
  vote_debut: string; vote_fin: string; mode_vote: 'libre' | 'deblocage';
  mode_fenetre: 'ajustable' | 'automatique'; delai_vote_minutes: number | null;
  bareme_jury: number; mode_classement: 'separe' | 'combine' | 'jury';
  methode_general: 'points' | 'moyenne'; poids_jury: number; classement_visible: boolean;
  statut: string; message_public: string | null;
};
type Manade = { id: string; nom: string };
type LienManade = { manade_id: string; ordre: number };
type Epreuve = { id: string; ordre: number; nom: string; description: string | null; notee: boolean; heure_debut: string | null; heure_fin: string | null };
type Passage = { id: string; epreuve_id: string; manade_id: string; ordre: number };
type Juge = { id: string; prenom: string };

const STATUTS = ['brouillon', 'publiee', 'en_cours', 'terminee', 'reportee', 'annulee'] as const;

export function meta() {
  return [{ title: 'Préparation · Administration' }, { name: 'robots', content: 'noindex' }];
}

export default function PreparationSoiree() {
  const { soireeId = '' } = useParams();
  return <CadreAdmin surtitre="Préparation" titre="Soirée"><Editeur soireeId={soireeId} /></CadreAdmin>;
}

function Editeur({ soireeId }: { soireeId: string }) {
  const { client, session, erreurClient } = useClientAdmin();
  const [soiree, setSoiree] = useState<Soiree | null>(null);
  const [annuaire, setAnnuaire] = useState<Manade[]>([]);
  const [engages, setEngages] = useState<LienManade[]>([]);
  const [epreuves, setEpreuves] = useState<Epreuve[]>([]);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [juges, setJuges] = useState<Juge[]>([]);
  const [rattaches, setRattaches] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [origine, setOrigine] = useState('');
  useEffect(() => { setOrigine(window.location.origin); }, []);

  async function recharger() {
    if (!client) return;
    const [s, m, sm, e, p, j, sj] = await Promise.all([
      client.from('soirees').select('*').eq('id', soireeId).maybeSingle(),
      client.from('manades').select('id, nom').order('nom'),
      client.from('soiree_manades').select('manade_id, ordre').eq('soiree_id', soireeId).order('ordre'),
      client.from('epreuves').select('id, ordre, nom, description, notee, heure_debut, heure_fin').eq('soiree_id', soireeId).order('ordre'),
      client.from('passages').select('id, epreuve_id, manade_id, ordre'),
      client.from('profils').select('id, prenom').eq('role', 'juge').order('prenom'),
      client.from('soiree_juges').select('juge_id').eq('soiree_id', soireeId),
    ]);
    if (s.error || !s.data) { setErreur('Cette soirée est introuvable.'); return; }
    setSoiree(s.data as Soiree);
    setAnnuaire((m.data ?? []) as Manade[]);
    setEngages((sm.data ?? []) as LienManade[]);
    const epreuveIds = new Set(((e.data ?? []) as Epreuve[]).map((epreuve) => epreuve.id));
    setEpreuves((e.data ?? []) as Epreuve[]);
    setPassages(((p.data ?? []) as Passage[]).filter((passage) => epreuveIds.has(passage.epreuve_id)));
    setJuges((j.data ?? []) as Juge[]);
    setRattaches(((sj.data ?? []) as { juge_id: string }[]).map((ligne) => ligne.juge_id));
  }

  useEffect(() => { if (client) void recharger(); }, [client, soireeId]);

  async function executer(action: () => PromiseLike<{ error: { message: string } | null }>) {
    if (enCours) return;
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    const { error } = await action();
    setEnCours(false);
    if (error) setErreur(error.message || 'L’enregistrement n’a pas abouti.');
    else { setInfo('Enregistré.'); await recharger(); }
  }

  async function enregistrerInfos(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!client || !soiree) return;
    const champs = new FormData(evenement.currentTarget);
    const delai = String(champs.get('delai') ?? '');
    await executer(() => client.from('soirees').update({
      nom: String(champs.get('nom') ?? '').trim(),
      lieu: String(champs.get('lieu') ?? '').trim() || null,
      date_soiree: String(champs.get('date') ?? soiree.date_soiree),
      vote_debut: depuisChampParis(String(champs.get('debut') ?? '')),
      vote_fin: depuisChampParis(String(champs.get('fin') ?? '')),
      mode_vote: String(champs.get('mode_vote')),
      mode_fenetre: String(champs.get('mode_fenetre')),
      delai_vote_minutes: delai === '' ? null : Number(delai),
      bareme_jury: Number(champs.get('bareme')),
      mode_classement: String(champs.get('mode_classement')),
      methode_general: String(champs.get('methode')),
      poids_jury: Number(champs.get('poids')),
      classement_visible: champs.get('visible') === 'on',
      statut: String(champs.get('statut')),
      message_public: String(champs.get('message') ?? '').trim() || null,
    }).eq('id', soiree.id));
  }

  async function basculerManade(manadeId: string, present: boolean) {
    if (!client) return;
    await executer(async () => {
      if (present) {
        const passagesManade = passages.filter((passage) => passage.manade_id === manadeId).map((passage) => passage.id);
        if (passagesManade.length) {
          const suppression = await client.from('passages').delete().in('id', passagesManade);
          if (suppression.error) return suppression;
        }
        return client.from('soiree_manades').delete().eq('soiree_id', soireeId).eq('manade_id', manadeId);
      }
      const ordre = (engages.at(-1)?.ordre ?? 0) + 1;
      const ajout = await client.from('soiree_manades').insert({ soiree_id: soireeId, manade_id: manadeId, ordre });
      if (ajout.error) return ajout;
      if (epreuves.length) {
        return client.from('passages').insert(epreuves.map((epreuve) => ({
          epreuve_id: epreuve.id,
          manade_id: manadeId,
          ordre: (passages.filter((passage) => passage.epreuve_id === epreuve.id).at(-1)?.ordre ?? 0) + 1,
        })));
      }
      return ajout;
    });
  }

  async function deplacerManade(index: number, sens: -1 | 1) {
    if (!client) return;
    const voisin = engages[index + sens];
    const courant = engages[index];
    if (!voisin || !courant) return;
    const [temporaire, ordreCourant, ordreVoisin] = etapesEchange(courant.ordre, voisin.ordre);
    await executer(async () => {
      const a = await client.from('soiree_manades').update({ ordre: temporaire }).eq('soiree_id', soireeId).eq('manade_id', courant.manade_id);
      if (a.error) return a;
      const b = await client.from('soiree_manades').update({ ordre: ordreCourant }).eq('soiree_id', soireeId).eq('manade_id', voisin.manade_id);
      if (b.error) return b;
      return client.from('soiree_manades').update({ ordre: ordreVoisin }).eq('soiree_id', soireeId).eq('manade_id', courant.manade_id);
    });
  }

  async function poserModele() {
    if (!client || !soiree) return;
    if (epreuves.length && !window.confirm('Remplacer le planning actuel par les 4 épreuves de référence ? Les passages déjà notés ne peuvent pas être supprimés.')) return;
    const horaires = horairesModele(soiree.date_soiree);
    await executer(async () => {
      if (epreuves.length) {
        const suppression = await client.from('epreuves').delete().eq('soiree_id', soireeId);
        if (suppression.error) return suppression;
      }
      const creees = await client.from('epreuves').insert(EPREUVES_MODELE.map((epreuve, index) => ({
        soiree_id: soireeId,
        ordre: index + 1,
        nom: epreuve.nom,
        description: epreuve.description,
        notee: true,
        heure_debut: horaires[index]?.heureDebut,
        heure_fin: horaires[index]?.heureFin,
      }))).select('id');
      if (creees.error || !creees.data) return creees;
      if (!engages.length) return creees;
      return client.from('passages').insert(creees.data.flatMap((epreuve) => engages.map((manade) => ({
        epreuve_id: epreuve.id, manade_id: manade.manade_id, ordre: manade.ordre,
      }))));
    });
  }

  async function ajouterEpreuve(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!client) return;
    const champs = new FormData(evenement.currentTarget);
    const nom = String(champs.get('nom') ?? '').trim();
    await executer(async () => {
      const creee = await client.from('epreuves').insert({
        soiree_id: soireeId,
        ordre: (epreuves.at(-1)?.ordre ?? 0) + 1,
        nom,
        description: String(champs.get('description') ?? '').trim() || null,
        notee: champs.get('notee') === 'on',
      }).select('id').single();
      if (creee.error || !creee.data) return creee;
      if (!engages.length) return creee;
      return client.from('passages').insert(engages.map((manade) => ({
        epreuve_id: creee.data.id, manade_id: manade.manade_id, ordre: manade.ordre,
      })));
    });
  }

  async function deplacerEpreuve(index: number, sens: -1 | 1) {
    if (!client) return;
    const courant = epreuves[index];
    const voisin = epreuves[index + sens];
    if (!courant || !voisin) return;
    const [temporaire, ordreCourant, ordreVoisin] = etapesEchange(courant.ordre, voisin.ordre);
    await executer(async () => {
      const a = await client.from('epreuves').update({ ordre: temporaire }).eq('id', courant.id);
      if (a.error) return a;
      const b = await client.from('epreuves').update({ ordre: ordreCourant }).eq('id', voisin.id);
      if (b.error) return b;
      return client.from('epreuves').update({ ordre: ordreVoisin }).eq('id', courant.id);
    });
  }

  async function supprimerEpreuve(id: string) {
    if (!client || !window.confirm('Supprimer cette épreuve et ses passages ?')) return;
    await executer(() => client.from('epreuves').delete().eq('id', id));
  }

  async function glisser(table: 'epreuves' | 'passages' | 'soiree_manades', liste: { id: string; ordre: number }[], depuis: number, vers: number) {
    if (!client) return;
    const etapes = etapesReordre(liste, depuis, vers);
    if (!etapes.length) return;
    await executer(async () => {
      for (const etape of etapes) {
        const requete = table === 'soiree_manades'
          ? client.from(table).update({ ordre: etape.ordre }).eq('soiree_id', soireeId).eq('manade_id', etape.id)
          : client.from(table).update({ ordre: etape.ordre }).eq('id', etape.id);
        const resultat = await requete;
        if (resultat.error) return resultat;
      }
      return { error: null };
    });
  }

  function depot(evenement: DragEvent, vers: number, appliquer: (depuis: number) => void) {
    evenement.preventDefault();
    const depuis = Number(evenement.dataTransfer.getData('text/plain'));
    if (Number.isInteger(depuis)) appliquer(depuis);
  }

  async function deplacerPassage(epreuveId: string, index: number, sens: -1 | 1) {
    if (!client) return;
    const liste = passages.filter((passage) => passage.epreuve_id === epreuveId).sort((a, b) => a.ordre - b.ordre);
    const courant = liste[index];
    const voisin = liste[index + sens];
    if (!courant || !voisin) return;
    const [temporaire, ordreCourant, ordreVoisin] = etapesEchange(courant.ordre, voisin.ordre);
    await executer(async () => {
      const a = await client.from('passages').update({ ordre: temporaire }).eq('id', courant.id);
      if (a.error) return a;
      const b = await client.from('passages').update({ ordre: ordreCourant }).eq('id', voisin.id);
      if (b.error) return b;
      return client.from('passages').update({ ordre: ordreVoisin }).eq('id', courant.id);
    });
  }

  async function basculerJuge(jugeId: string, present: boolean) {
    if (!client) return;
    await executer(() => present
      ? client.from('soiree_juges').delete().eq('soiree_id', soireeId).eq('juge_id', jugeId)
      : client.from('soiree_juges').insert({ soiree_id: soireeId, juge_id: jugeId }));
  }

  async function dupliquer() {
    if (!client || !soiree) return;
    await executer(async () => {
      let slug = `${slugifier(soiree.slug)}-copie`.slice(0, 60);
      let identifiant: string | null = null;
      for (let essai = 0; essai < 5; essai += 1) {
        const copie = await client.from('soirees').insert({
          slug,
          nom: `${soiree.nom} (copie)`,
          date_soiree: soiree.date_soiree,
          lieu: soiree.lieu,
          vote_debut: soiree.vote_debut,
          vote_fin: soiree.vote_fin,
          mode_vote: soiree.mode_vote,
          mode_fenetre: soiree.mode_fenetre,
          delai_vote_minutes: soiree.delai_vote_minutes,
          bareme_jury: soiree.bareme_jury,
          mode_classement: soiree.mode_classement,
          methode_general: soiree.methode_general,
          poids_jury: soiree.poids_jury,
          classement_visible: false,
          statut: 'brouillon',
        }).select('id').single();
        if (!copie.error && copie.data) { identifiant = copie.data.id as string; break; }
        if (!copie.error || !/duplicate|unique/i.test(copie.error.message)) return copie;
        slug = `${slugifier(soiree.slug)}-copie-${essai + 2}`.slice(0, 60);
      }
      if (!identifiant) return { error: { message: 'La copie n’a pas pu être créée.' } };
      if (engages.length) {
        const liens = await client.from('soiree_manades').insert(engages.map((manade) => ({
          soiree_id: identifiant, manade_id: manade.manade_id, ordre: manade.ordre,
        })));
        if (liens.error) return liens;
      }
      if (epreuves.length) {
        const creees = await client.from('epreuves').insert(epreuves.map((epreuve) => ({
          soiree_id: identifiant,
          ordre: epreuve.ordre,
          nom: epreuve.nom,
          description: epreuve.description,
          notee: epreuve.notee,
          heure_debut: epreuve.heure_debut,
          heure_fin: epreuve.heure_fin,
        }))).select('id, ordre');
        if (creees.error || !creees.data) return creees;
        const parOrdre = new Map((creees.data as { id: string; ordre: number }[]).map((epreuve) => [epreuve.ordre, epreuve.id]));
        const aCopier = passages.flatMap((passage) => {
          const source = epreuves.find((epreuve) => epreuve.id === passage.epreuve_id);
          const epreuveId = source ? parOrdre.get(source.ordre) : undefined;
          return epreuveId ? [{ epreuve_id: epreuveId, manade_id: passage.manade_id, ordre: passage.ordre }] : [];
        });
        if (aCopier.length) {
          const copies = await client.from('passages').insert(aCopier);
          if (copies.error) return copies;
        }
      }
      return { error: null };
    });
  }

  if (erreurClient) return <p role="alert" className="text-rouge-alerte">{erreurClient}</p>;
  if (!soiree) return <p role="status">{erreur ?? 'Lecture de la soirée…'}</p>;
  const nomManade = new Map(annuaire.map((manade) => [manade.id, manade.nom]));

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Link to={`/admin/soirees/${soiree.id}/direct`} className={BOUTON_PLEIN}>Cockpit en direct</Link>
        <Link to={`/admin/soirees/${soiree.id}/resultats`} className={BOUTON}>Résultats</Link>
        <button type="button" className={BOUTON} onClick={() => void dupliquer()} disabled={enCours}>Dupliquer</button>
      </div>
      {erreur ? <p role="alert" className="text-rouge-alerte">{erreur}</p> : null}
      {info ? <p role="status" className="text-sm">{info}</p> : null}
      <form onSubmit={(evenement) => void enregistrerInfos(evenement)} className={`${CARTE} grid gap-3`}>
        <h2 className="font-display text-2xl">Infos et réglages</h2>
        <label className="grid gap-2 font-medium">Nom<input name="nom" defaultValue={soiree.nom} required className={CHAMP} /></label>
        <label className="grid gap-2 font-medium">Lieu<input name="lieu" defaultValue={soiree.lieu ?? ''} className={CHAMP} /></label>
        <label className="grid gap-2 font-medium">Date<input name="date" type="date" defaultValue={soiree.date_soiree} required className={CHAMP} /></label>
        <div className="grid gap-3 tablette:grid-cols-2">
          <label className="grid gap-2 font-medium">Début des votes<input name="debut" type="datetime-local" defaultValue={champParis(soiree.vote_debut)} required className={CHAMP} /></label>
          <label className="grid gap-2 font-medium">Fin des votes<input name="fin" type="datetime-local" defaultValue={champParis(soiree.vote_fin)} required className={CHAMP} /></label>
        </div>
        <div className="grid gap-3 tablette:grid-cols-2">
          <label className="grid gap-2 font-medium">Mode de vote
            <select name="mode_vote" defaultValue={soiree.mode_vote} className={CHAMP}><option value="deblocage">Par déblocage</option><option value="libre">Libre</option></select>
          </label>
          <label className="grid gap-2 font-medium">Fenêtre
            <select name="mode_fenetre" defaultValue={soiree.mode_fenetre} className={CHAMP}><option value="ajustable">Ajustable</option><option value="automatique">Automatique</option></select>
          </label>
          <label className="grid gap-2 font-medium">Délai de vote (minutes, vide = désactivé)
            <input name="delai" type="number" min={1} max={30} defaultValue={soiree.delai_vote_minutes ?? ''} className={CHAMP} />
          </label>
          <label className="grid gap-2 font-medium">Barème du jury
            <select name="bareme" defaultValue={soiree.bareme_jury} className={CHAMP}><option value={20}>Sur 20</option><option value={10}>Sur 10</option></select>
          </label>
          <label className="grid gap-2 font-medium">Classement officiel
            <select name="mode_classement" defaultValue={soiree.mode_classement} className={CHAMP}>
              <option value="separe">Jury et prix du public</option>
              <option value="combine">Combiné</option>
              <option value="jury">Jury seul</option>
            </select>
          </label>
          <label className="grid gap-2 font-medium">Méthode du général
            <select name="methode" defaultValue={soiree.methode_general} className={CHAMP}><option value="points">Points par place</option><option value="moyenne">Moyenne</option></select>
          </label>
          <label className="grid gap-2 font-medium">Poids du jury (%)
            <input name="poids" type="number" min={0} max={100} defaultValue={soiree.poids_jury} className={CHAMP} />
          </label>
          <label className="grid gap-2 font-medium">Statut
            <select name="statut" defaultValue={soiree.statut} className={CHAMP}>
              {STATUTS.map((statut) => <option key={statut} value={statut}>{statut}</option>)}
            </select>
          </label>
        </div>
        <label className="flex min-h-12 items-center gap-3 font-medium">
          <input name="visible" type="checkbox" defaultChecked={soiree.classement_visible} /> Classement visible du public
        </label>
        <label className="grid gap-2 font-medium">Message public (report ou annulation)
          <textarea name="message" defaultValue={soiree.message_public ?? ''} maxLength={500} className={`${CHAMP} min-h-24 py-2`} />
        </label>
        <button className={BOUTON_PLEIN} disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
      </form>

      <section className={CARTE}>
        <h2 className="font-display text-2xl">Manades</h2>
        <ul className="mt-3 grid gap-2">
          {annuaire.map((manade) => {
            const index = engages.findIndex((lien) => lien.manade_id === manade.id);
            return (
              <li
                key={manade.id}
                className="flex min-h-12 flex-wrap items-center gap-2"
                draggable={index >= 0}
                onDragStart={(evenement) => evenement.dataTransfer.setData('text/plain', String(index))}
                onDragOver={(evenement) => evenement.preventDefault()}
                onDrop={(evenement) => depot(evenement, index, (depuis) => void glisser('soiree_manades', engages.map((lien) => ({ id: lien.manade_id, ordre: lien.ordre })), depuis, index))}
              >
                <button type="button" className={BOUTON} onClick={() => void basculerManade(manade.id, index >= 0)}>{index >= 0 ? 'Retirer' : 'Engager'} {manade.nom}</button>
                {index >= 0 ? <>
                  <span className="text-sm text-encre-2">Ordre {engages[index]?.ordre}</span>
                  <button type="button" className={BOUTON} onClick={() => void deplacerManade(index, -1)} disabled={index === 0}>Monter</button>
                  <button type="button" className={BOUTON} onClick={() => void deplacerManade(index, 1)} disabled={index === engages.length - 1}>Descendre</button>
                </> : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={CARTE}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl">Planning</h2>
          <button type="button" className={BOUTON} onClick={() => void poserModele()} disabled={enCours}>Modèle des 4 épreuves</button>
          <p className="mt-2 w-full text-sm text-encre-2">Glissez une ligne pour changer l’ordre, ou utilisez Monter et Descendre. Les notes déjà enregistrées ne sont pas modifiées.</p>
        </div>
        {epreuves.map((epreuve, index) => {
          const liste = passages.filter((passage) => passage.epreuve_id === epreuve.id).sort((a, b) => a.ordre - b.ordre);
          return (
            <article
              key={epreuve.id}
              className="mt-4 border-t border-trait pt-4"
              draggable
              onDragStart={(evenement) => evenement.dataTransfer.setData('text/plain', String(index))}
              onDragOver={(evenement) => evenement.preventDefault()}
              onDrop={(evenement) => depot(evenement, index, (depuis) => void glisser('epreuves', epreuves.map((ligne) => ({ id: ligne.id, ordre: ligne.ordre })), depuis, index))}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{epreuve.ordre}. {epreuve.nom}{epreuve.notee ? '' : ' · démonstration'}</h3>
                <button type="button" className={BOUTON} onClick={() => void deplacerEpreuve(index, -1)} disabled={index === 0}>Monter</button>
                <button type="button" className={BOUTON} onClick={() => void deplacerEpreuve(index, 1)} disabled={index === epreuves.length - 1}>Descendre</button>
                <button type="button" className={BOUTON} onClick={() => void supprimerEpreuve(epreuve.id)}>Supprimer</button>
              </div>
              {epreuve.description ? <p className="mt-1 text-sm text-encre-2">{epreuve.description}</p> : null}
              <ul className="mt-2 grid gap-1">
                {liste.map((passage, rang) => (
                  <li
                    key={passage.id}
                    className="flex min-h-12 items-center gap-2"
                    draggable
                    onDragStart={(evenement) => { evenement.stopPropagation(); evenement.dataTransfer.setData('text/plain', String(rang)); }}
                    onDragOver={(evenement) => evenement.preventDefault()}
                    onDrop={(evenement) => { evenement.stopPropagation(); depot(evenement, rang, (depuis) => void glisser('passages', liste.map((ligne) => ({ id: ligne.id, ordre: ligne.ordre })), depuis, rang)); }}
                  >
                    <span>{nomManade.get(passage.manade_id) ?? 'Manade'}</span>
                    <button type="button" className={BOUTON} onClick={() => void deplacerPassage(epreuve.id, rang, -1)} disabled={rang === 0}>Monter</button>
                    <button type="button" className={BOUTON} onClick={() => void deplacerPassage(epreuve.id, rang, 1)} disabled={rang === liste.length - 1}>Descendre</button>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
        <form onSubmit={(evenement) => void ajouterEpreuve(evenement)} className="mt-4 grid gap-3">
          <h3 className="font-semibold">Saisie manuelle</h3>
          <label className="grid gap-2 font-medium">Nom<input name="nom" required className={CHAMP} /></label>
          <label className="grid gap-2 font-medium">Description<textarea name="description" className={`${CHAMP} min-h-20 py-2`} /></label>
          <label className="flex min-h-12 items-center gap-3"><input name="notee" type="checkbox" defaultChecked /> Épreuve notée</label>
          <button className={BOUTON_PLEIN} disabled={enCours}>Ajouter l’épreuve</button>
        </form>
      </section>

      {client ? (
        <ImportPlanning
          client={client}
          soireeId={soireeId}
          jour={soiree.date_soiree}
          dejaSaisi={epreuves.length > 0}
          sessionToken={session?.access_token}
          onApplique={() => void recharger()}
        />
      ) : null}
      <section className={CARTE}>
        <h2 className="font-display text-2xl">Juges de la soirée</h2>
        {!juges.length ? <p className="mt-2 text-sm text-encre-2">Aucun compte juge. Créez-en un depuis la page Juges.</p> : (
          <ul className="mt-3 grid gap-2">
            {juges.map((juge) => {
              const present = rattaches.includes(juge.id);
              return <li key={juge.id}><button type="button" className={BOUTON} onClick={() => void basculerJuge(juge.id, present)}>{present ? 'Retirer' : 'Rattacher'} {juge.prenom}</button></li>;
            })}
          </ul>
        )}
      </section>

      <section className={CARTE}>
        <h2 className="font-display text-2xl">QR code de vote et affiche</h2>
        <p className="mt-1 text-sm text-encre-2">À afficher dans les arènes. Le public ouvre /noter. Les inscriptions restent fermées tant que le drapeau de build n’est pas ouvert.</p>
        {origine && soiree ? (
          <div className="mt-4 inline-block rounded-2xl bg-white p-3">
            <CodeQr valeur={`${origine}/noter`} libelle={`QR code de vote pour ${soiree.nom}`} />
          </div>
        ) : null}
        <p className="mt-2 break-all text-sm">{origine ? `${origine}/noter` : '/noter'}</p>
        <button type="button" className={`${BOUTON} mt-3`} onClick={() => {
          if (!soiree || !origine) return;
          const url = `${origine}/noter`;
          telechargerFichier(`affiche-${soiree.slug}.pdf`, documentPdf({
            titre: soiree.nom,
            lignes: [soiree.lieu ?? '', soiree.date_soiree, 'Votez sur votre téléphone', url],
            qr: matriceQr(url),
            legendeQr: 'Scannez pour noter les manades',
          }), 'application/pdf');
        }}>Télécharger l’affiche PDF</button>
      </section>
    </>
  );
}
