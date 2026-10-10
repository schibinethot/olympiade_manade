export type DateCalendrier = {
  date_soiree: string;
  heure: string | null;
  statut: 'previsionnelle' | 'confirmee' | 'annulee';
};

const FUSEAU = 'Europe/Paris';

function jourParis(date: Date): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function prochaineSoiree<T extends DateCalendrier>(dates: T[], maintenant: Date): T | null {
  const aujourdhui = jourParis(maintenant);
  const aVenir = dates
    .filter((x) => x.statut !== 'annulee' && x.date_soiree >= aujourdhui)
    .sort((a, b) => a.date_soiree.localeCompare(b.date_soiree));
  return aVenir[0] ?? null;
}

export function compteARebours(cible: Date, maintenant: Date): { jours: number; heures: number; minutes: number } | null {
  const ms = cible.getTime() - maintenant.getTime();
  if (ms <= 0) return null;
  const minutesTotales = Math.floor(ms / 60_000);
  return {
    jours: Math.floor(minutesTotales / 1440),
    heures: Math.floor((minutesTotales % 1440) / 60),
    minutes: minutesTotales % 60,
  };
}

export function formaterDateLongue(dateIso: string): string {
  const [a, m, j] = dateIso.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(a, m - 1, j)));
}

export function formaterHeure(heure: string | null): string | null {
  if (!heure) return null;
  const [h, min] = heure.split(':');
  return min === '00' ? `${Number(h)}h` : `${Number(h)}h${min}`;
}
