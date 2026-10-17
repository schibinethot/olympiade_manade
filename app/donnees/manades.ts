export type SourceManade = { id: string; titre: string; url: string };
export type TexteSourceManade = { texte: string; sources: string[] };

export type FicheManade = {
  slug: string;
  nom: string;
  localisation: string;
  accroche: string;
  presentation: TexteSourceManade[];
  activites: (TexteSourceManade & { titre: string })[];
  reperes: { libelle: string; valeur: string; sources: string[] }[];
  sources: SourceManade[];
  siteOfficiel?: { url: string; libelle: string };
  verifieLe: string;
};

/** Présentations documentées ; le palmarès reste lu depuis les données publiques du site. */
export const FICHES_MANADES: FicheManade[] = [
  {
    slug: 'vinuesa',
    nom: 'Vinuesa',
    localisation: 'Le Cailar · Gard',
    accroche: 'Chevaux Camargue, taureaux et spectacles au Mas du Pont de Laute.',
    presentation: [
      {
        texte: 'Installé au Mas du Pont de Laute, Renaud Vinuesa a construit son élevage autour du cheval Camargue. Après avoir travaillé à la manade Laurent de 1990 à 1994, il se lance à son compte, puis développe son troupeau de taureaux à partir de 2000.',
        sources: ['portrait'],
      },
      {
        texte: 'Le travail avec les animaux nourrit aussi les spectacles : chevaux montés ou en liberté, taureaux et scènes de vie évoquent la culture gardiane. Renaud et Mylène Vinuesa conçoivent ces représentations avec les amateurs de la manade.',
        sources: ['portrait'],
      },
    ],
    activites: [
      {
        titre: 'Élevage et course camarguaise',
        texte: 'L’élevage associe chevaux de race Camargue et taureaux destinés notamment aux courses camarguaises. Le dressage des chevaux fait partie du parcours du manadier.',
        sources: ['chefsdoc'],
      },
      {
        titre: 'Spectacles et accueil de groupes',
        texte: 'Ferrades, réceptions de groupes et spectacles permettent de découvrir les traditions camarguaises et le pastoralisme.',
        sources: ['chefsdoc'],
      },
      {
        titre: 'Production locale',
        texte: 'Le répertoire des éleveurs mentionne la vente directe de viande bio et l’habilitation Taureau de Camargue AOP.',
        sources: ['lgrb'],
      },
    ],
    reperes: [
      { libelle: 'Lieu', valeur: 'Mas du Pont de Laute, Le Cailar', sources: ['chefsdoc'] },
      { libelle: 'Élevage de taureaux', valeur: 'Depuis 2000', sources: ['portrait'] },
      { libelle: 'Manadier', valeur: 'Renaud Vinuesa', sources: ['lgrb'] },
    ],
    sources: [
      { id: 'portrait', titre: 'Voir Plus · portrait de Renaud Vinuesa (2020)', url: 'https://voir-plus.com/2020/08/02/eleveur-de-chevaux-et-taureaux-reconnu-cavalier-emerite-renaud-vinuesa-porte-haut-la-bouvine-et-les-traditions/' },
      { id: 'chefsdoc', titre: 'Chefs d’Oc · rencontre à la manade (2022)', url: 'https://www.chefsdoc.fr/renaud-vinuesa-eleveur-de-chevaux-et-de-taureaux-de-camargue-avec-carole-soubeiran/' },
      { id: 'lgrb', titre: 'LGRB · fiche Vinuesa et marque à feu', url: 'https://lgrb.fr/les-manades/' },
    ],
    verifieLe: '2026-10-17',
  },
  {
    slug: 'gillet',
    nom: 'Gillet',
    localisation: 'Saint-Martin-de-Crau · Bouches-du-Rhône',
    accroche: 'Une histoire familiale de taureaux et de chevaux au Mas des Fioles.',
    presentation: [
      {
        texte: 'La manade Gillet est installée au Mas des Fioles, à Saint-Martin-de-Crau, avec des pâturages à Aureille et dans la commune. Le livre généalogique situe ses débuts en 1975 et identifie Guillaume Gillet à sa tête.',
        sources: ['lgrb'],
      },
      {
        texte: 'Son histoire se transmet entre générations. Pour le rendez-vous de Vallabrègues en mars 2026, le club taurin Lou Mamaï rappelait les liens tissés avec Louis, Daniel puis Guillaume Gillet, et les taureaux de la manade accueillis dans ses arènes.',
        sources: ['vallabregues'],
      },
    ],
    activites: [
      {
        titre: 'Taureaux et chevaux',
        texte: 'Course camarguaise, manifestations de rue et élevage de chevaux figurent parmi les activités recensées par le LGRB.',
        sources: ['lgrb'],
      },
      {
        titre: 'Réceptions au mas',
        texte: 'Le site accueille des événements privés ou professionnels : mariages, baptêmes, anniversaires et séminaires, dans un cadre lié aux traditions provençales.',
        sources: ['tourisme'],
      },
      {
        titre: 'Production agricole',
        texte: 'La manade produit également de la viande locale bio, selon le répertoire des éleveurs.',
        sources: ['lgrb'],
      },
    ],
    reperes: [
      { libelle: 'Lieu', valeur: 'Mas des Fioles, Saint-Martin-de-Crau', sources: ['tourisme'] },
      { libelle: 'Origines', valeur: '1975', sources: ['lgrb'] },
      { libelle: 'Manadier', valeur: 'Guillaume Gillet', sources: ['lgrb'] },
    ],
    sources: [
      { id: 'lgrb', titre: 'LGRB · fiche Gillet et marque à feu', url: 'https://lgrb.fr/les-manades/' },
      { id: 'vallabregues', titre: 'Beaucaire Terre d’Argence · rendez-vous de Vallabrègues (2026)', url: 'https://www.provence-camargue-tourisme.com/fete-manifestation/course-camarguaise/' },
      { id: 'tourisme', titre: 'Provence-Alpes-Côte d’Azur Tourisme · manade Gillet', url: 'https://provence-alpes-cotedazur.com/que-faire/detente-et-loisirs/toutes-les-activites-detente-et-loisirs/manade-gillet-saint-martin-de-crau-fr-3052351/' },
    ],
    verifieLe: '2026-10-17',
  },
  {
    slug: 'robert-michel',
    nom: 'Robert Michel',
    localisation: 'Lattes · Hérault',
    accroche: 'La famille Michel fait vivre l’élevage et les traditions au Domaine de Fangouse.',
    presentation: [
      {
        texte: 'Aux portes de Montpellier, le Domaine de Fangouse accueille les taureaux et chevaux de la manade Robert Michel. Cet ancien domaine viticole de Lattes associe aujourd’hui l’élevage, les animations camarguaises et l’accueil de réceptions.',
        sources: ['domaine'],
      },
      {
        texte: 'Robert Michel reprend seul l’élevage de chevaux en 1993, après une période sous le nom Marié / Michel. La manade de taureaux prend son nom en 2000 ; son troupeau est reconstitué à partir de 2007 avec des origines Saumade et Mailhan.',
        sources: ['histoire'],
      },
    ],
    activites: [
      {
        titre: 'Élevage de race Camargue',
        texte: 'Les chevaux grandissent en semi-liberté dans les marais. L’élevage propose des jeunes chevaux et des animaux débourrés ou dressés ; les taureaux sont sélectionnés pour la course camarguaise.',
        sources: ['histoire'],
      },
      {
        titre: 'Animations et traditions',
        texte: 'Jeux de gardians, ferrades, calèches et haies d’honneur font partie des prestations. La manade organise aussi des roussataïo, sorties de juments accompagnées de leurs poulains.',
        sources: ['domaine', 'histoire'],
      },
      {
        titre: 'Réceptions et produits du domaine',
        texte: 'La famille accueille mariages et événements professionnels au domaine, avec un service traiteur et la vente directe de viande et de terrines de taureau.',
        sources: ['domaine'],
      },
    ],
    reperes: [
      { libelle: 'Lieu', valeur: 'Domaine de Fangouse, Lattes', sources: ['domaine'] },
      { libelle: 'Manade de taureaux', valeur: 'Créée sous ce nom en 2000', sources: ['histoire'] },
      { libelle: 'Élevage de chevaux', valeur: 'Robert Michel seul depuis 1993', sources: ['histoire'] },
    ],
    sources: [
      { id: 'domaine', titre: 'Domaine de Fangouse · site officiel', url: 'https://domainedefangouse.fr/' },
      { id: 'histoire', titre: 'Domaine de Fangouse · histoire et élevages', url: 'https://domainedefangouse.fr/presentation/' },
      { id: 'lgrb', titre: 'LGRB · fiche Michel Robert et marque à feu', url: 'https://lgrb.fr/les-manades/' },
    ],
    siteOfficiel: { url: 'https://domainedefangouse.fr/', libelle: 'Domaine de Fangouse' },
    verifieLe: '2026-10-17',
  },
  {
    slug: 'lafon',
    nom: 'Lafon',
    localisation: 'Saint-Nazaire-de-Pézan · Hérault',
    accroche: 'Jean et Iris Lafon, une histoire de transmission dans les marais de l’étang de l’Or.',
    presentation: [
      {
        texte: 'L’histoire de la manade remonte à l’élevage Zuccarelli, fondé en 1957. Elle porte ensuite le nom Lafon-Besson de 1979 à 1983, avant que Jean Lafon poursuive seul, puis avec sa fille Iris.',
        sources: ['histoire'],
      },
      {
        texte: 'Ses taureaux de race Camargue sont élevés en semi-liberté, notamment dans les marais de Saint-Nazaire-de-Pézan et de Saint-Just. L’iris stylisé dans un ovale, adopté comme marque en 1983, accompagne la devise violet, blanc et vert.',
        sources: ['histoire'],
      },
    ],
    activites: [
      {
        titre: 'Course et traditions taurines',
        texte: 'La manade participe aux courses camarguaises, aux abrivado et bandido. Ferrades et jeux de gardians complètent les démonstrations du travail à cheval.',
        sources: ['traditions'],
      },
      {
        titre: 'Découverte de la Camargue',
        texte: 'Les spectacles équestres et taurins présentent les traditions de la manade, sur place ou lors de manifestations organisées dans d’autres communes.',
        sources: ['spectacles'],
      },
      {
        titre: 'Accueil et réceptions',
        texte: 'Le Mas du Grès et la Jasso de Portaïé accueillent mariages, fêtes privées, groupes de visiteurs et rencontres d’entreprises.',
        sources: ['accueil'],
      },
    ],
    reperes: [
      { libelle: 'Ancrage', valeur: 'Saint-Nazaire-de-Pézan, près de Lunel', sources: ['accueil'] },
      { libelle: 'Origines de l’élevage', valeur: '1957 · manade Zuccarelli', sources: ['histoire'] },
      { libelle: 'Marque à feu', valeur: 'Un iris dans un ovale, depuis 1983', sources: ['histoire'] },
    ],
    sources: [
      { id: 'histoire', titre: 'Manade Lafon · historique officiel', url: 'https://www.manade-lafon.com/manade-lafon-historique.html' },
      { id: 'traditions', titre: 'Manade Lafon · présentation des activités (PDF)', url: 'https://www.manade-lafon.com/images/manade-lafon_Presentation.pdf' },
      { id: 'spectacles', titre: 'Manade Lafon · spectacles équestres et taurins', url: 'https://www.manade-lafon.com/spectacles-equestre-taurins.html' },
      { id: 'accueil', titre: 'Manade Lafon · site officiel', url: 'https://www.manade-lafon.com/' },
      { id: 'lgrb', titre: 'LGRB · marque à feu de Lafon', url: 'https://lgrb.fr/les-manades/' },
    ],
    siteOfficiel: { url: 'https://www.manade-lafon.com/', libelle: 'Manade Lafon' },
    verifieLe: '2026-10-17',
  },
  {
    slug: 'arlatenco',
    nom: 'Arlatenco',
    localisation: 'Aimargues · Gard',
    accroche: 'Depuis 1951, une manade familiale mêlant élevage, spectacles et équitation.',
    presentation: [
      {
        texte: 'Transmise au sein de la famille Clément depuis 1951, la manade Arlatenco a développé plusieurs activités autour de son élevage de taureaux de Camargue. Son exploitation se trouve chemin de la Grande Cabane, à Aimargues ; son siège est à Codognan.',
        sources: ['accueil', 'contact'],
      },
      {
        texte: 'Les fêtes taurines restent au cœur de son activité, avec des participations aux courses camarguaises, abrivado, bandido et Olympiades. L’accueil d’événements et l’enseignement de l’équitation prolongent cette activité familiale.',
        sources: ['accueil'],
      },
    ],
    activites: [
      {
        titre: 'Élevage et spectacles taurins',
        texte: 'Le troupeau est élevé pour les manifestations camarguaises. La manade propose également des animations taurines lors d’événements accueillis sur son domaine.',
        sources: ['accueil'],
      },
      {
        titre: 'Équitation et travail des chevaux',
        texte: 'Sarah Clément assure l’enseignement de l’équitation pour enfants et adultes. Les écuries proposent aussi pension, travail et débourrage des chevaux.',
        sources: ['equitation'],
      },
      {
        titre: 'Réceptions et services agricoles',
        texte: 'La manade loue un espace pour les événements et propose des travaux agricoles, notamment la préparation des sols, la fenaison et la vente de fourrage.',
        sources: ['accueil'],
      },
    ],
    reperes: [
      { libelle: 'Exploitation', valeur: 'Chemin Grande Cabane, Aimargues', sources: ['contact'] },
      { libelle: 'Histoire familiale', valeur: 'Depuis 1951', sources: ['accueil'] },
      { libelle: 'Famille', valeur: 'Clément', sources: ['equitation'] },
    ],
    sources: [
      { id: 'accueil', titre: 'Manade Arlatenco · présentation officielle', url: 'https://manadearlatenco.fr/' },
      { id: 'equitation', titre: 'Manade Arlatenco · activités équestres', url: 'https://manadearlatenco.fr/cours-dequitation/' },
      { id: 'contact', titre: 'Manade Arlatenco · localisation', url: 'https://manadearlatenco.fr/contact/' },
      { id: 'lgrb', titre: 'LGRB · fiche Arlatenco et marque à feu', url: 'https://lgrb.fr/les-manades/' },
    ],
    siteOfficiel: { url: 'https://manadearlatenco.fr/', libelle: 'Manade Arlatenco' },
    verifieLe: '2026-10-17',
  },
];
