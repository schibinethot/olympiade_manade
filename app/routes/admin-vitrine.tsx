import { useEffect, useState, type FormEvent } from 'react';
import { BOUTON, BOUTON_PLEIN, CadreAdmin, CARTE, CHAMP, useClientAdmin } from '../composants/admin/CadreAdmin';
import { CHAMPS_IDENTITE, type IdentiteLegale } from '../lib/identite';

type DateLigne = { id: string; annee: number; nom: string; ville: string; arenes: string | null; date_soiree: string; heure: string | null; statut: string; lien_billetterie: string | null };
type PalmaresLigne = { id: string; annee: number; evenement: string; ville: string; date_soiree: string | null; vainqueur: string; detail: string | null; statut: string; source_url: string | null };

export function meta() {
  return [{ title: 'Vitrine · Administration' }, { name: 'robots', content: 'noindex' }];
}

export default function VitrineAdmin() {
  return <CadreAdmin surtitre="Vitrine" titre="Contenus"><Contenu /></CadreAdmin>;
}

function Contenu() {
  const { client, erreurClient } = useClientAdmin();
  const [dates, setDates] = useState<DateLigne[]>([]);
  const [palmares, setPalmares] = useState<PalmaresLigne[]>([]);
  const [identite, setIdentite] = useState<IdentiteLegale>({ raison_sociale: '', forme_juridique: '', adresse: '', telephone: '', email: '', immatriculation: '', capital: '', tva: '', directeur_publication: '' });
  const [precision, setPrecision] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let actif = true;
    Promise.all([
      client.from('calendrier').select('id, annee, nom, ville, arenes, date_soiree, heure, statut, lien_billetterie').order('date_soiree'),
      client.from('palmares').select('id, annee, evenement, ville, date_soiree, vainqueur, detail, statut, source_url').order('annee', { ascending: false }),
      client.from('identite_legale').select('*').limit(1).maybeSingle(),
      client.from('contenus_vitrine').select('valeur').eq('cle', 'accueil_precision').maybeSingle(),
    ]).then(([cal, pal, idt, texte]) => {
      if (!actif) return;
      if (cal.error || pal.error) setErreur('La vitrine est illisible. Appliquez les migrations.');
      setDates((cal.data ?? []) as DateLigne[]);
      setPalmares((pal.data ?? []) as PalmaresLigne[]);
      if (idt.data) setIdentite({ ...identite, ...(idt.data as IdentiteLegale) });
      setPrecision((texte.data?.valeur as string | undefined) ?? '');
    });
    return () => { actif = false; };
  }, [client]);

  async function sauverIdentite(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!client) return;
    const champs = Object.fromEntries(CHAMPS_IDENTITE.map(({ cle }) => [cle, identite[cle]?.trim() || null]));
    const { error } = await client.from('identite_legale').upsert({ id: true, ...champs });
    setErreur(error ? 'L’identité n’a pas été enregistrée.' : null);
    setInfo(error ? null : 'Identité enregistrée. Aucun nom n’est inventé : les champs vides restent vides.');
  }

  async function sauverPrecision(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!client) return;
    const valeur = precision.trim();
    const { error } = valeur
      ? await client.from('contenus_vitrine').upsert({ cle: 'accueil_precision', valeur })
      : await client.from('contenus_vitrine').delete().eq('cle', 'accueil_precision');
    setErreur(error ? 'Le texte n’a pas été enregistré.' : null);
    setInfo(error ? null : 'Texte d’accueil enregistré.');
  }

  async function ajouterPhoto(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!client) return;
    const champs = new FormData(evenement.currentTarget);
    const { error } = await client.from('photos_vitrine').insert({
      url: String(champs.get('url') ?? ''),
      legende: String(champs.get('legende') ?? ''),
      auteur: String(champs.get('auteur') ?? ''),
      licence: String(champs.get('licence') ?? ''),
    });
    setErreur(error ? 'La photo n’a pas été ajoutée. L’adresse doit commencer par https:// et le crédit est obligatoire.' : null);
    if (!error) evenement.currentTarget.reset();
  }

  if (erreurClient) return <p className="text-rouge-alerte">{erreurClient}</p>;
  return (
    <>
      {erreur ? <p className="text-rouge-alerte">{erreur}</p> : null}
      {info ? <p role="status">{info}</p> : null}
      <form onSubmit={(evenement) => void sauverIdentite(evenement)} className={`${CARTE} grid gap-3`}>
        <h2 className="font-display text-2xl">Éditeur et responsable</h2>
        <p className="text-sm text-encre-2">Laissez vide ce que l’organisateur n’a pas encore donné. Le site n’affiche alors que l’encadré à compléter.</p>
        {CHAMPS_IDENTITE.map(({ cle, libelle }) => (
          <label key={cle} className="grid gap-2 text-sm font-medium">{libelle}
            <input className={CHAMP} value={identite[cle] ?? ''} onChange={(evenement) => setIdentite({ ...identite, [cle]: evenement.target.value })} />
          </label>
        ))}
        <button className={BOUTON_PLEIN}>Enregistrer l’identité</button>
      </form>
      <form onSubmit={(evenement) => void sauverPrecision(evenement)} className={`${CARTE} grid gap-3`}>
        <h2 className="font-display text-2xl">Texte d’accueil</h2>
        <textarea className={`${CHAMP} min-h-24 py-2`} value={precision} maxLength={2000} onChange={(evenement) => setPrecision(evenement.target.value)} />
        <button className={BOUTON_PLEIN}>Enregistrer le texte</button>
      </form>
      <form onSubmit={(evenement) => void ajouterPhoto(evenement)} className={`${CARTE} grid gap-3`}>
        <h2 className="font-display text-2xl">Photo supplémentaire</h2>
        <p className="text-sm text-encre-2">Les photos déjà créditées de la vitrine restent en place. Une photo ajoutée ici doit avoir un auteur et une licence.</p>
        <input name="url" type="url" required placeholder="https://" className={CHAMP} />
        <input name="legende" required placeholder="Légende" className={CHAMP} />
        <input name="auteur" required placeholder="Auteur" className={CHAMP} />
        <input name="licence" required placeholder="Licence" className={CHAMP} />
        <button className={BOUTON_PLEIN}>Ajouter la photo</button>
      </form>
      <section className={CARTE}>
        <h2 className="font-display text-2xl">Dates ({dates.length})</h2>
        <ul className="mt-3 grid gap-2 text-sm">{dates.slice(0, 12).map((date) => <li key={date.id}>{date.date_soiree} · {date.nom} · {date.ville} · {date.statut}</li>)}</ul>
        <DateForme onCreer={async (ligne) => {
          if (!client) return;
          const { error } = await client.from('calendrier').insert(ligne);
          setErreur(error ? 'La date n’a pas été ajoutée.' : null);
          if (!error) {
            const relu = await client.from('calendrier').select('id, annee, nom, ville, arenes, date_soiree, heure, statut, lien_billetterie').order('date_soiree');
            setDates((relu.data ?? []) as DateLigne[]);
          }
        }} />
      </section>
      <section className={CARTE}>
        <h2 className="font-display text-2xl">Palmarès ({palmares.length})</h2>
        <ul className="mt-3 grid gap-2 text-sm">{palmares.slice(0, 8).map((ligne) => <li key={ligne.id}>{ligne.annee} · {ligne.evenement} · {ligne.vainqueur} · {ligne.statut === 'a_confirmer' ? 'à confirmer' : 'confirmé'}</li>)}</ul>
        <PalmaresForme onCreer={async (ligne) => {
          if (!client) return;
          const { error } = await client.from('palmares').insert(ligne);
          setErreur(error ? 'Le palmarès n’a pas été ajouté.' : null);
          if (!error) {
            const relu = await client.from('palmares').select('id, annee, evenement, ville, date_soiree, vainqueur, detail, statut, source_url').order('annee', { ascending: false });
            setPalmares((relu.data ?? []) as PalmaresLigne[]);
          }
        }} />
      </section>
    </>
  );
}

function DateForme({ onCreer }: { onCreer: (ligne: Record<string, unknown>) => Promise<void> }) {
  return (
    <form className="mt-4 grid gap-2" onSubmit={(evenement) => {
      evenement.preventDefault();
      const champs = new FormData(evenement.currentTarget);
      const date = String(champs.get('date') ?? '');
      void onCreer({
        annee: Number(date.slice(0, 4)), nom: String(champs.get('nom') ?? ''), ville: String(champs.get('ville') ?? ''),
        date_soiree: date, heure: String(champs.get('heure') ?? '') || null, statut: 'previsionnelle',
      });
    }}>
      <div className="grid gap-2 tablette:grid-cols-2">
        <input name="nom" required placeholder="Nom" className={CHAMP} />
        <input name="ville" required placeholder="Ville" className={CHAMP} />
        <input name="date" type="date" required className={CHAMP} />
        <input name="heure" type="time" className={CHAMP} />
      </div>
      <button className={BOUTON}>Ajouter une date</button>
    </form>
  );
}

function PalmaresForme({ onCreer }: { onCreer: (ligne: Record<string, unknown>) => Promise<void> }) {
  return (
    <form className="mt-4 grid gap-2" onSubmit={(evenement) => {
      evenement.preventDefault();
      const champs = new FormData(evenement.currentTarget);
      void onCreer({
        annee: Number(champs.get('annee')), evenement: String(champs.get('evenement') ?? ''), ville: String(champs.get('ville') ?? ''),
        vainqueur: String(champs.get('vainqueur') ?? ''), statut: 'a_confirmer',
      });
    }}>
      <div className="grid gap-2 tablette:grid-cols-2">
        <input name="annee" type="number" required placeholder="Année" className={CHAMP} />
        <input name="evenement" required placeholder="Soirée" className={CHAMP} />
        <input name="ville" required placeholder="Ville" className={CHAMP} />
        <input name="vainqueur" required placeholder="Vainqueur" className={CHAMP} />
      </div>
      <button className={BOUTON}>Ajouter un résultat</button>
    </form>
  );
}
