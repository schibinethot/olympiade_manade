/** Photographies originales des quatre épreuves, servies localement sans recadrage ni retouche. */
export type PhotoEpreuve = {
  id: 'ferrade-en-piste' | 'saut-cheval-a-cheval' | 'saut-cheval-a-taureau' | 'attente-au-fer';
  fichier: string;
  largeur: number;
  hauteur: number;
  alt: string;
  auteur: string;
  fiche: string;
  droits: 'Tous droits réservés';
};

const FICHE_SALLUVII = 'https://www.salluvii.fr/Olympiades-Camarguaises-2008';
const FICHE_VOIR_PLUS = 'https://voir-plus.com/2026/08/19/la-fete-votive-de-beauvoisin-incontournable-et-festive/';

export const PHOTOS_EPREUVES: Record<PhotoEpreuve['id'], PhotoEpreuve> = {
  'ferrade-en-piste': {
    id: 'ferrade-en-piste',
    fichier: '/photos/epreuves/ferrade-en-piste.jpg',
    largeur: 550,
    hauteur: 367,
    alt: 'Cavalier renversant un anouble au fer depuis son cheval en piste.',
    auteur: 'Éric Blanc / Salluvii',
    fiche: FICHE_SALLUVII,
    droits: 'Tous droits réservés',
  },
  'saut-cheval-a-cheval': {
    id: 'saut-cheval-a-cheval',
    fichier: '/photos/epreuves/saut-cheval-a-cheval.jpg',
    largeur: 800,
    hauteur: 533,
    alt: 'Cavalier en plein transfert de cheval à cheval, avec deux cavaliers et trois chevaux.',
    auteur: 'Voir Plus',
    fiche: FICHE_VOIR_PLUS,
    droits: 'Tous droits réservés',
  },
  'saut-cheval-a-taureau': {
    id: 'saut-cheval-a-taureau',
    fichier: '/photos/epreuves/saut-cheval-a-taureau.jpg',
    largeur: 800,
    hauteur: 571,
    alt: 'Cavalier basculant de son cheval sur le taureau en course.',
    auteur: 'Voir Plus',
    fiche: FICHE_VOIR_PLUS,
    droits: 'Tous droits réservés',
  },
  'attente-au-fer': {
    id: 'attente-au-fer',
    fichier: '/photos/epreuves/attente-au-fer.jpg',
    largeur: 550,
    hauteur: 367,
    alt: 'Deux gardians à pied face au taureau, chacun armé d’un trident.',
    auteur: 'Éric Blanc / Salluvii',
    fiche: FICHE_SALLUVII,
    droits: 'Tous droits réservés',
  },
};
