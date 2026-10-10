// Photos de la maquette reprises sur l'accueil (README de docs/maquette et plan, règle 4).
// Fichiers en niveaux de gris dans public/photos/, passés en duotone par le CSS (charte, section 5).
// Pas de galerie à part (Task 7) : ces quatre photos sont toutes celles du site, et leurs crédits
// complets, affichés sous l'affiche et sous les épreuves, sont repris par les mentions légales.
//
// Chaque photo existe en WebP (tous navigateurs) et en AVIF monochrome, environ moitié moins lourd
// (avifenc -q 45 --yuv 400, depuis les fichiers de docs/maquette/img).

export type PhotoAccueil = {
  id: 'gardian' | 'arenes' | 'manade' | 'chevaux';
  /** Version 640 px de large, pour les cartes : WebP, et AVIF pour les navigateurs qui le lisent. */
  fichier: string;
  avif: string;
  /** Dimensions réelles des deux fichiers 640. */
  largeur: number;
  hauteur: number;
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
    avif: '/photos/hero-640.avif',
    largeur: 640,
    hauteur: 425,
    auteur: 'afroboof',
    licence: 'CC BY-SA 2.0',
    lienLicence: 'https://creativecommons.org/licenses/by-sa/2.0/deed.fr',
    fiche: 'https://commons.wikimedia.org/wiki/File:Gardian_galopant_vers_sa_manade.jpg',
  },
  manade: {
    id: 'manade',
    fichier: '/photos/manade-640.webp',
    avif: '/photos/manade-640.avif',
    largeur: 640,
    hauteur: 360,
    auteur: 'Christian Ferrer',
    ...BY_SA_4,
    fiche: 'https://commons.wikimedia.org/wiki/File:Gardian_and_Camargue_cattle,_Saint-Gilles_11.jpg',
  },
  chevaux: {
    id: 'chevaux',
    fichier: '/photos/chevaux-640.webp',
    avif: '/photos/chevaux-640.avif',
    largeur: 640,
    hauteur: 427,
    // Mention demandée par l'auteur (docs/photos-libres.md).
    auteur: 'Benjamin Smith / Wikimedia Commons',
    ...BY_SA_4,
    fiche: 'https://commons.wikimedia.org/wiki/File:Saint-Laurent-d%27Aigouze_-_Camargue_horses_-_01.jpg',
  },
  arenes: {
    id: 'arenes',
    fichier: '/photos/arenes-640.webp',
    avif: '/photos/arenes-640.avif',
    largeur: 640,
    hauteur: 421,
    auteur: 'Krzysztof Golik',
    ...BY_SA_4,
    fiche: 'https://commons.wikimedia.org/wiki/File:Arenes_de_Nimes_(1).jpg',
  },
};

export const RETOUCHE = 'retouchée (niveaux de gris, duotone)';

/**
 * Fichiers de l'affiche de l'accueil (photo « gardian »). Sur téléphone, l'affiche, plus haute que
 * large, ne montre qu'une bande verticale de la photo : jusqu'à 480 px de large, un recadrage de
 * 700 × 730 pris à 38 % (le même point que le cadrage CSS, donc exactement la même image) remplace la
 * photo entière : 48 Ko en AVIF au lieu de 74 Ko, et de 110 Ko pour le WebP d'origine.
 */
export const AFFICHE = {
  telephone: {
    media: '(max-width: 480px)',
    avif: '/photos/hero-telephone.avif',
    webp: '/photos/hero-telephone.webp',
    largeur: 700,
    hauteur: 730,
  },
  entiere: { avif: '/photos/hero.avif', webp: '/photos/hero.webp', largeur: 1100, hauteur: 730 },
} as const;
