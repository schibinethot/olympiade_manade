// Logique de la page d'accueil, sans React : tout ce qui se déduit du calendrier et du palmarès.
import { jourParis, prochaineSoiree } from './dates';
import type { Calendrier, Palmares } from './donnees';

const FUSEAU = 'Europe/Paris';

/** Heure murale de Paris pour un instant donné, lue comme si c'était de l'UTC. */
function murParis(instant: number): number {
  const parties = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: FUSEAU,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  );
  return Date.UTC(+parties.year, +parties.month - 1, +parties.day, +parties.hour, +parties.minute, +parties.second);
}

/**
 * Début d'une soirée : sa date et son heure, lues à Paris (heure d'été comme d'hiver).
 * Sans heure connue, le début de la journée.
 */
export function instantSoiree(dateIso: string, heure: string | null): Date {
  const [a, m, j] = dateIso.split('-').map(Number);
  const [h, min] = (heure ?? '00:00').split(':').map(Number);
  const voulu = Date.UTC(a, m - 1, j, h, min);
  // Première estimation avec le décalage de Paris à cet instant, puis correction près d'un
  // changement d'heure.
  let instant = voulu - (murParis(voulu) - voulu);
  instant += voulu - murParis(instant);
  return new Date(instant);
}

/** Texte du compte à rebours : en jours, puis en heures et minutes le dernier jour. */
export function texteCompteARebours(reste: { jours: number; heures: number; minutes: number } | null): string | null {
  if (!reste) return null;
  if (reste.jours >= 1) return `${reste.jours} jour${reste.jours > 1 ? 's' : ''}`;
  if (reste.heures >= 1) return reste.minutes ? `${reste.heures} h ${reste.minutes} min` : `${reste.heures} h`;
  return `${Math.max(1, reste.minutes)} min`;
}

/** « aux arènes de Nîmes », « aux arènes André Blanc, à Mouriès », « à Beaucaire ». */
export function lieuSoiree({ arenes, ville }: Pick<Calendrier, 'arenes' | 'ville'>): string {
  if (!arenes) return `à ${ville}`;
  if (!/^ar[eè]nes\b/i.test(arenes)) return `à ${ville} (${arenes})`;
  const nom = `aux a${arenes.slice(1)}`;
  return arenes.includes(ville) ? nom : `${nom}, à ${ville}`;
}

/** « 20 août » */
export function formaterJourMois(dateIso: string): string {
  const [a, m, j] = dateIso.split('-').map(Number);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(a, m - 1, j)),
  );
}

/** Prochaine soirée d'une ville (l'affiche d'accueil est celle de Nîmes). */
export function prochaineSoireeA(calendrier: Calendrier[], ville: string, maintenant: Date): Calendrier | null {
  return prochaineSoiree(
    calendrier.filter((s) => s.ville === ville),
    maintenant,
  );
}

export type DernierVainqueur = {
  vainqueur: string;
  /** Le résultat confirmé le plus récent du palmarès. */
  resultat: Palmares;
  /** Toutes les victoires confirmées de la manade, de la plus ancienne à la plus récente. */
  victoires: { annee: number; ville: string }[];
  /** Domaines des sources de ces victoires, sans doublon, avec un lien vers la première. */
  sources: { domaine: string; url: string }[];
};

const ordreResultat = (p: Palmares) => p.date_soiree ?? `${p.annee}-12-31`;

function domaine(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Dernier vainqueur connu : la ligne confirmée la plus récente du palmarès. Une ligne plus récente
 * encore « à confirmer » est ignorée. Le nom vient des données : rien n'est codé en dur.
 */
export function dernierVainqueur(palmares: Palmares[]): DernierVainqueur | null {
  const confirmes = palmares
    .filter((p) => p.statut === 'confirme')
    .sort((a, b) => ordreResultat(a).localeCompare(ordreResultat(b)));
  const resultat = confirmes.at(-1);
  if (!resultat) return null;

  const victoires = confirmes.filter((p) => p.vainqueur.trim() === resultat.vainqueur.trim());
  const sources: DernierVainqueur['sources'] = [];
  for (const v of victoires) {
    const nom = v.source_url ? domaine(v.source_url) : null;
    if (nom && v.source_url && !sources.some((s) => s.domaine === nom)) sources.push({ domaine: nom, url: v.source_url });
  }
  return {
    vainqueur: resultat.vainqueur.trim(),
    resultat,
    victoires: victoires.map((v) => ({ annee: v.annee, ville: v.ville })),
    sources,
  };
}

export type EtatLigneSaison = 'terminee' | 'prochaine' | 'a-venir' | 'annulee';

export type SaisonAccueil = {
  annee: number;
  /** Nombre de soirées de la saison, pour le lien vers /dates. */
  total: number;
  lignes: { soiree: Calendrier; etat: EtatLigneSaison }[];
};

/**
 * Extrait de la saison pour l'accueil : quelques soirées à partir de la prochaine (les dernières
 * de la saison quand elle touche à sa fin). Sans soirée à venir, la dernière saison connue.
 */
export function saisonAccueil(calendrier: Calendrier[], maintenant: Date, taille = 4): SaisonAccueil | null {
  if (calendrier.length === 0) return null;
  const prochaine = prochaineSoiree(calendrier, maintenant);
  const annee = prochaine?.annee ?? Math.max(...calendrier.map((s) => s.annee));
  const saison = calendrier
    .filter((s) => s.annee === annee)
    .sort((a, b) => a.date_soiree.localeCompare(b.date_soiree));
  const aujourdhui = jourParis(maintenant);
  const rang = prochaine ? saison.findIndex((s) => s.id === prochaine.id) : saison.length;
  const debut = Math.max(0, Math.min(rang, saison.length - taille));
  return {
    annee,
    total: saison.length,
    lignes: saison.slice(debut, debut + taille).map((soiree) => ({
      soiree,
      etat:
        soiree.statut === 'annulee'
          ? 'annulee'
          : soiree.id === prochaine?.id
            ? 'prochaine'
            : soiree.date_soiree < aujourdhui
              ? 'terminee'
              : 'a-venir',
    })),
  };
}

/**
 * Données d'une page qui porte le calendrier : l'en-tête y lit la prochaine soirée.
 * `lueLe` est l'instant de lecture, qui sert d'heure au premier rendu (pré-rendu puis hydratation).
 */
export type AvecCalendrier = { calendrier: Calendrier[] | null; lueLe: string };

export function aCalendrier(donnees: unknown): donnees is AvecCalendrier {
  return (
    typeof donnees === 'object' &&
    donnees !== null &&
    'calendrier' in donnees &&
    'lueLe' in donnees &&
    typeof donnees.lueLe === 'string'
  );
}
