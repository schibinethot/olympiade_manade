// Photos de la maquette reprises sur l'accueil (README de docs/maquette et plan, règle 4).
// Fichiers en niveaux de gris dans public/photos/, passés en duotone par le CSS (charte, section 5).
// La Task 7 regroupera ces crédits avec ceux de la galerie (app/donnees/photos.ts).

export type PhotoAccueil = {
  id: 'gardian' | 'arenes' | 'manade' | 'chevaux';
  /** Version 640 px de large, pour les cartes. */
  fichier: string;
  auteur: string;
  licence: string;
  lienLicence: string;
  fiche: string;
};

const BY_SA_4 = { licence: 'CC BY-SA 4.0', lienLicence: 'https://creativecommons.org/licenses/by-sa/4.0/deed.fr' };

export const PHOTOS_ACCUEIL: Record<PhotoAccueil['id'], PhotoAccueil> = {
  // Photo de l'affiche, validée par l'utilisateur le 10/10/2026 (« elle est de chez nous »).
  // Le crédit Commons reste affiché tant que l'utilisateur ne confirme pas en être l'auteur.
  gardian: {
    id: 'gardian',
    fichier: '/photos/hero-640.webp',
    auteur: 'afroboof',
    licence: 'CC BY-SA 2.0',
    lienLicence: 'https://creativecommons.org/licenses/by-sa/2.0/deed.fr',
    fiche: 'https://commons.wikimedia.org/wiki/File:Gardian_galopant_vers_sa_manade.jpg',
  },
  manade: {
    id: 'manade',
    fichier: '/photos/manade-640.webp',
    auteur: 'Christian Ferrer',
    ...BY_SA_4,
    fiche: 'https://commons.wikimedia.org/wiki/File:Gardian_and_Camargue_cattle,_Saint-Gilles_11.jpg',
  },
  chevaux: {
    id: 'chevaux',
    fichier: '/photos/chevaux-640.webp',
    // Mention demandée par l'auteur (docs/photos-libres.md).
    auteur: 'Benjamin Smith / Wikimedia Commons',
    ...BY_SA_4,
    fiche: 'https://commons.wikimedia.org/wiki/File:Saint-Laurent-d%27Aigouze_-_Camargue_horses_-_01.jpg',
  },
  arenes: {
    id: 'arenes',
    fichier: '/photos/arenes-640.webp',
    auteur: 'Krzysztof Golik',
    ...BY_SA_4,
    fiche: 'https://commons.wikimedia.org/wiki/File:Arenes_de_Nimes_(1).jpg',
  },
};

export const RETOUCHE = 'retouchée (niveaux de gris, duotone)';
