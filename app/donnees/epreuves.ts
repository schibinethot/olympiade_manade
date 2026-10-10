// Les 4 épreuves de référence (CDC 2.2) : modèle d'épreuves par défaut de l'app.
// Photos d'ambiance de la maquette (crédits dans app/donnees/photos-accueil.ts) : aucune photo libre
// des Olympiades elles-mêmes n'existe, les vraies photos d'épreuves viendront de l'organisation.
import type { PhotoAccueil } from './photos-accueil';

export type Epreuve = {
  numero: 1 | 2 | 3 | 4;
  nom: string;
  description: string;
  /** Format de l'épreuve, en pied de carte. */
  format: string;
  photo: PhotoAccueil['id'];
  /** Cadrage de la photo dans la carte (classe Tailwind object-position). */
  cadrage: string;
};

export const EPREUVES: readonly Epreuve[] = [
  {
    numero: 1,
    nom: 'Ferrade en piste',
    description:
      'Le cavalier renverse un anouble (taurillon d’environ un an) avec le fer depuis son cheval, met pied à terre, le maîtrise à mains nues et le couche pour simuler le marquage.',
    format: 'Individuelle',
    photo: 'manade',
    cadrage: 'object-[55%_70%]',
  },
  {
    numero: 2,
    nom: 'Saut de cheval à cheval',
    description:
      'Deux cavaliers encadrent un troisième cheval, non monté. L’un règle la vitesse et la direction, l’autre saute sur le cheval libre en plein galop.',
    format: 'Deux cavaliers',
    photo: 'chevaux',
    cadrage: 'object-[50%_45%]',
  },
  {
    numero: 3,
    nom: 'Saut de cheval à taureau',
    description:
      'Le cavalier saute de son cheval sur un taureau lancé et doit le tenir jusqu’à le mettre au sol. La durée de tenue compte.',
    format: 'Individuelle',
    photo: 'gardian',
    cadrage: 'object-[42%_40%]',
  },
  {
    numero: 4,
    nom: 'Attente au fer',
    description:
      'Les manadiers dirigent un taureau vers un angle de la piste pour qu’il charge de face deux gardians armés de tridents. Les deux doivent piquer en même temps, chacun d’un côté.',
    format: 'Collective',
    photo: 'arenes',
    cadrage: 'object-[50%_55%]',
  },
];
