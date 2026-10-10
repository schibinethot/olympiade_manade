// Affiche de l'accueil : celle des Grandes Olympiades, aux arènes de Nîmes (maquette, écran
// public:accueil). Lieu et titre sont fixes ; la date et l'heure viennent de la prochaine soirée
// de Nîmes dans le calendrier.

export const VILLE_AFFICHE = 'Nîmes';

/**
 * Manades de la dernière édition connue à Nîmes, faute de programme pour l'édition à venir.
 * Libellées comme telles sur la page (« Les manades de l'édition 2026 »).
 */
export const EDITION_MANADES = {
  annee: 2026,
  manades: ['Vinuesa', 'Gillet', 'Robert Michel', 'Lafon', 'Arlatenco'],
} as const;
