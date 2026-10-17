/** Échéance affichée au spectateur (CDC §4.4). La base reste seule juge de l’acceptation. */

export type IndicesEcheance = {
  mode: 'libre' | 'deblocage';
  voteFin?: string | null;
  delaiMinutes?: number | null;
  finPassage?: string | null;
  fermeLe?: string | null;
  heureFin?: string | null;
};

export function echeanceVote(indices: IndicesEcheance): number | null {
  if (indices.fermeLe) {
    const fixe = Date.parse(indices.fermeLe);
    return Number.isNaN(fixe) ? null : fixe;
  }
  const fenetre = indices.mode === 'libre' && indices.voteFin ? Date.parse(indices.voteFin) : null;
  const fenetreValide = fenetre !== null && !Number.isNaN(fenetre) ? fenetre : null;
  if (indices.delaiMinutes == null) return fenetreValide;
  const baseIso = indices.finPassage ?? (indices.mode === 'libre' ? indices.heureFin : null);
  const base = baseIso ? Date.parse(baseIso) : NaN;
  const auto = Number.isNaN(base) ? null : base + indices.delaiMinutes * 60_000;
  if (fenetreValide == null) return auto;
  if (auto == null) return fenetreValide;
  return Math.min(auto, fenetreValide);
}

/** Phrase affichée tant que le passage est ouvert. `null` si le vote est fermé. */
export function libelleTempsRestant(echeance: number | null, maintenant: number, ouvert: boolean): string | null {
  if (!ouvert) return null;
  if (echeance == null) return 'Vote ouvert, sans heure de fermeture automatique.';
  const reste = echeance - maintenant;
  if (reste <= 0) return 'Temps de vote écoulé.';
  const total = Math.ceil(reste / 1000);
  const minutes = Math.floor(total / 60);
  const secondes = total % 60;
  if (minutes >= 60) {
    const heures = Math.floor(minutes / 60);
    return `Temps restant : ${heures} h ${minutes % 60} min`;
  }
  if (minutes > 0) return `Temps restant : ${minutes} min ${String(secondes).padStart(2, '0')} s`;
  return `Temps restant : ${secondes} s`;
}
