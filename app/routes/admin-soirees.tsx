import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { BOUTON, BOUTON_PLEIN, CadreAdmin, CARTE, CHAMP, useClientAdmin } from '../composants/admin/CadreAdmin';
import { fenetreDefaut, slugifier } from '../lib/preparation';

type Soiree = { id: string; slug: string; nom: string; date_soiree: string; lieu: string | null; statut: string };
type Manade = { id: string; nom: string; ville: string | null };

const STATUTS: Record<string, string> = {
  brouillon: 'Brouillon', publiee: 'Publiée', en_cours: 'En cours', terminee: 'Terminée', reportee: 'Reportée', annulee: 'Annulée',
};

export function meta() {
  return [{ title: 'Soirées · Administration' }, { name: 'robots', content: 'noindex' }];
}

export default function Soirees() {
  return <CadreAdmin surtitre="Préparation" titre="Mes soirées"><Contenu /></CadreAdmin>;
}

function Contenu() {
  const { client, erreurClient } = useClientAdmin();
  const [soirees, setSoirees] = useState<Soiree[] | null>(null);
  const [manades, setManades] = useState<Manade[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function recharger(actuel = client) {
    if (!actuel) return;
    const [liste, annuaire] = await Promise.all([
      actuel.from('soirees').select('id, slug, nom, date_soiree, lieu, statut').order('date_soiree', { ascending: false }),
      actuel.from('manades').select('id, nom, ville').order('nom'),
    ]);
    if (liste.error || annuaire.error) setErreur('Les soirées sont indisponibles.');
    else {
      setSoirees((liste.data ?? []) as Soiree[]);
      setManades((annuaire.data ?? []) as Manade[]);
    }
  }

  useEffect(() => { if (client) void recharger(client); }, [client]);

  async function creer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!client || enCours) return;
    const champs = new FormData(evenement.currentTarget);
    const nom = String(champs.get('nom') ?? '').trim();
    const date = String(champs.get('date') ?? '');
    const lieu = String(champs.get('lieu') ?? '').trim();
    const fenetre = fenetreDefaut(date);
    setEnCours(true);
    setErreur(null);
    let slug = slugifier(`${nom}-${date.slice(0, 4)}`);
    for (let essai = 0; essai < 5; essai += 1) {
      const { error } = await client.from('soirees').insert({
        slug, nom, date_soiree: date, lieu: lieu || null,
        vote_debut: fenetre.voteDebut, vote_fin: fenetre.voteFin, statut: 'brouillon',
      });
      if (!error) {
        evenement.currentTarget.reset();
        await recharger();
        setEnCours(false);
        return;
      }
      if (!/duplicate|unique/i.test(error.message)) {
        setErreur('La soirée n’a pas pu être créée.');
        setEnCours(false);
        return;
      }
      slug = `${slugifier(nom)}-${essai + 2}`;
    }
    setErreur('La soirée n’a pas pu être créée.');
    setEnCours(false);
  }

  async function ajouterManade(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!client || enCours) return;
    const champs = new FormData(evenement.currentTarget);
    setEnCours(true);
    setErreur(null);
    const { error } = await client.from('manades').insert({
      nom: String(champs.get('nom') ?? '').trim(),
      ville: String(champs.get('ville') ?? '').trim() || null,
    });
    setEnCours(false);
    if (error) setErreur('La manade n’a pas pu être ajoutée à l’annuaire.');
    else { evenement.currentTarget.reset(); await recharger(); }
  }

  if (erreurClient) return <p role="alert" className="text-rouge-alerte">{erreurClient}</p>;
  return (
    <>
      <section className={CARTE}>
        <h2 className="font-display text-2xl">Nouvelle soirée</h2>
        <p className="mt-1 text-sm text-encre-2">Créée en brouillon, invisible du public. Fenêtre de vote par défaut : 21h00–23h30, heure de Paris.</p>
        <form onSubmit={(evenement) => void creer(evenement)} className="mt-4 grid gap-3 tablette:grid-cols-2">
          <label className="grid gap-2 font-medium">Nom<input name="nom" required maxLength={120} className={CHAMP} /></label>
          <label className="grid gap-2 font-medium">Date<input name="date" type="date" required className={CHAMP} /></label>
          <label className="grid gap-2 font-medium tablette:col-span-2">Lieu<input name="lieu" maxLength={160} className={CHAMP} /></label>
          <button className={BOUTON_PLEIN} disabled={enCours}>{enCours ? 'Enregistrement…' : 'Créer la soirée'}</button>
        </form>
      </section>
      {erreur ? <p role="alert" className="text-rouge-alerte">{erreur}</p> : null}
      <section className={CARTE}>
        <h2 className="font-display text-2xl">Soirées</h2>
        {!soirees ? <p role="status" className="mt-3">Lecture…</p> : (
          <ul className="mt-3 divide-y divide-trait">
            {soirees.map((soiree) => (
              <li key={soiree.id} className="flex min-h-14 flex-wrap items-center justify-between gap-3 py-2">
                <div>
                  <p className="font-semibold">{soiree.nom}</p>
                  <p className="text-sm text-encre-2">{soiree.date_soiree} · {soiree.lieu || 'Lieu à préciser'} · {STATUTS[soiree.statut] ?? soiree.statut}</p>
                </div>
                <Link to={`/admin/soirees/${soiree.id}`} className={BOUTON}>Préparer</Link>
              </li>
            ))}
          </ul>
        )}
        {soirees && !soirees.length ? <p className="mt-3 text-sm text-encre-2">Aucune soirée. Le public reste hors soirée.</p> : null}
      </section>
      <section className={CARTE}>
        <h2 className="font-display text-2xl">Annuaire des manades</h2>
        <form onSubmit={(evenement) => void ajouterManade(evenement)} className="mt-4 grid gap-3 tablette:grid-cols-[1fr_1fr_auto]">
          <label className="grid gap-2 font-medium">Nom<input name="nom" required maxLength={80} className={CHAMP} /></label>
          <label className="grid gap-2 font-medium">Ville<input name="ville" maxLength={80} className={CHAMP} /></label>
          <button className={`${BOUTON_PLEIN} self-end`} disabled={enCours}>Ajouter</button>
        </form>
        <ul className="mt-4 columns-1 tablette:columns-2">
          {manades.map((manade) => <li key={manade.id} className="min-h-8">{manade.nom}{manade.ville ? ` · ${manade.ville}` : ''}</li>)}
        </ul>
      </section>
    </>
  );
}
