// Aides pures de la préparation d'une soirée (CDC §4.1 et §4.2).

export const EPREUVES_MODELE = [
  {
    nom: 'Ferrade en piste',
    description: 'Le cavalier renverse un anouble avec le fer depuis son cheval, met pied à terre, le maîtrise à mains nues et le couche pour simuler le marquage.',
  },
  {
    nom: 'Saut de cheval à cheval',
    description: 'Deux cavaliers encadrent un troisième cheval, non monté. L’un règle la vitesse et la direction, l’autre saute sur le cheval libre en plein galop.',
  },
  {
    nom: 'Saut de cheval à taureau',
    description: 'Le cavalier saute de son cheval sur un taureau lancé et doit le tenir jusqu’à le mettre au sol. La durée de tenue compte.',
  },
  {
    nom: 'Attente au fer',
    description: 'Les manadiers dirigent un taureau vers un angle de la piste pour qu’il charge de face deux gardians armés de tridents. Les deux doivent piquer en même temps, chacun d’un côté.',
  },
] as const;

/** Slug public : minuscules, chiffres et tirets. */
export function slugifier(nom: string): string {
  const base = nom.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return base || 'soiree';
}

/** Décalage de `timeZone` en minutes à l'instant donné (positif à l'est de Greenwich). */
export function decalageMinutes(instant: Date, timeZone = 'Europe/Paris'): number {
  const parties = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const lire = (type: string) => Number(parties.find((partie) => partie.type === type)?.value);
  const mur = Date.UTC(lire('year'), lire('month') - 1, lire('day'), lire('hour'), lire('minute'), lire('second'));
  return Math.round((mur - instant.getTime()) / 60_000);
}

/** Heure civile de Paris, exprimée en instant UTC. */
export function instantParis(jour: string, heure: number, minute: number): string {
  const annee = Number(jour.slice(0, 4));
  const mois = Number(jour.slice(5, 7));
  const quantieme = Number(jour.slice(8, 10));
  const vise = Date.UTC(annee, mois - 1, quantieme, heure, minute);
  const premier = new Date(vise - decalageMinutes(new Date(vise)) * 60_000);
  const second = new Date(vise - decalageMinutes(premier) * 60_000);
  return second.toISOString();
}

/** Fenêtre par défaut du CDC : 21h00–23h30, heure de Paris. */
export function fenetreDefaut(jour: string): { voteDebut: string; voteFin: string } {
  return { voteDebut: instantParis(jour, 21, 0), voteFin: instantParis(jour, 23, 30) };
}

/** Créneaux du modèle : quatre épreuves de 30 minutes à partir de 21h00. */
export function horairesModele(jour: string): { heureDebut: string; heureFin: string }[] {
  return EPREUVES_MODELE.map((_, index) => ({
    heureDebut: instantParis(jour, 21, index * 30),
    heureFin: instantParis(jour, 21, index * 30 + 25),
  }));
}

/** Valeur pour un champ datetime-local, en heure de Paris. */
export function champParis(iso: string): string {
  const parties = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(iso));
  const lire = (type: string) => parties.find((partie) => partie.type === type)?.value ?? '00';
  return `${lire('year')}-${lire('month')}-${lire('day')}T${lire('hour')}:${lire('minute')}`;
}

/** Champ datetime-local interprété comme heure de Paris. */
export function depuisChampParis(valeur: string): string {
  const [jour, clock] = valeur.split('T');
  const [heure, minute] = (clock ?? '0:0').split(':').map(Number);
  return instantParis(jour ?? '', heure ?? 0, minute ?? 0);
}
export function etapesEchange(ordreA: number, ordreB: number): [number, number, number] {
  return [32_000, ordreA, ordreB];
}
