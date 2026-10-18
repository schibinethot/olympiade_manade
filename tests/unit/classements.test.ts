import { describe, expect, it } from 'vitest';
import {
  anneeChoisie,
  anneesClassements,
  lireClassement,
  nombreResultatsConfirmes,
  resultatsAnnee,
  soireesGagneesParManade,
} from '../../app/lib/classements';
import type { Calendrier, Palmares } from '../../app/lib/donnees';

const resultat = (annee: number, ville: string, vainqueur: string, extra: Partial<Palmares> = {}): Palmares => ({
  id: `${ville}-${annee}`,
  annee,
  evenement: `Olympiades de ${ville}`,
  ville,
  date_soiree: `${annee}-08-15`,
  vainqueur,
  detail: null,
  statut: 'confirme',
  source_url: null,
  ...extra,
});

const soiree = (date_soiree: string, ville: string): Calendrier => ({
  id: `${ville}-${date_soiree}`,
  annee: Number(date_soiree.slice(0, 4)),
  nom: `Olympiades de ${ville}`,
  ville,
  arenes: null,
  date_soiree,
  heure: null,
  statut: 'previsionnelle',
  lien_billetterie: null,
});

const PALMARES: Palmares[] = [
  resultat(2023, 'Nîmes', 'Vinuesa', { date_soiree: '2023-08-18' }),
  resultat(2024, 'Nîmes', 'Vinuesa', { date_soiree: '2024-08-23' }),
  resultat(2025, 'Nîmes', 'Vinuesa', { date_soiree: '2025-08-22' }),
  resultat(2026, 'Alès', 'Vinuesa', { date_soiree: '2026-05-15' }),
  resultat(2026, 'Nîmes', 'Arlatenco', { date_soiree: '2026-08-21' }),
  resultat(2026, 'Bezouce', 'Labourayre', { date_soiree: '2026-08-06', statut: 'a_confirmer' }),
];
const CALENDRIER = [soiree('2026-08-21', 'Nîmes'), soiree('2027-08-20', 'Nîmes')];

describe('anneesClassements', () => {
  it('ouvre un onglet pour les trois années les plus récentes, les plus anciennes vont aux éditions précédentes', () => {
    expect(anneesClassements(PALMARES, CALENDRIER)).toEqual({ onglets: [2027, 2026, 2025], parDefaut: 2026, precedentes: [2024, 2023] });
  });

  it('choisit par défaut la plus récente année qui a des résultats', () => {
    const avec2027 = [...PALMARES, resultat(2027, 'Arles', 'Clément')];
    expect(anneesClassements(avec2027, CALENDRIER).parDefaut).toBe(2027);
  });

  it('se contente du calendrier quand le palmarès est indisponible, et inversement', () => {
    expect(anneesClassements(null, CALENDRIER)).toEqual({ onglets: [2027, 2026], parDefaut: 2027, precedentes: [] });
    expect(anneesClassements(PALMARES, null).onglets).toEqual([2026, 2025, 2024]);
    expect(anneesClassements(null, null)).toEqual({ onglets: [], parDefaut: null, precedentes: [] });
  });
});

describe('anneeChoisie', () => {
  const annees = { onglets: [2027, 2026, 2025], parDefaut: 2026, precedentes: [] };

  it('lit l’année de l’adresse quand elle a un onglet', () => {
    expect(anneeChoisie('2025', annees)).toBe(2025);
  });

  it('revient à l’année par défaut pour une valeur absente ou inconnue', () => {
    expect(anneeChoisie(null, annees)).toBe(2026);
    expect(anneeChoisie('2019', annees)).toBe(2026);
    expect(anneeChoisie('abc', annees)).toBe(2026);
  });
});

describe('resultatsAnnee', () => {
  it('trie les résultats de l’année du plus récent au plus ancien', () => {
    expect(resultatsAnnee(PALMARES, 2026).map((p) => p.ville)).toEqual(['Nîmes', 'Bezouce', 'Alès']);
  });

  it('met en tête une soirée sans date, faute de mieux en fin d’année', () => {
    const sansDate = resultat(2026, 'Béziers', 'Grand Salan', { date_soiree: null });
    expect(resultatsAnnee([...PALMARES, sansDate], 2026)[0].ville).toBe('Béziers');
  });
});

describe('lireClassement', () => {
  it('lit le classement complet et garde la suite du détail', () => {
    const detail =
      'Classement : 1. Arlatenco, 2. Vinuesa (à quelques points), 3. Robert Michel, 4. Gillet, 5. Lafon. Saut de cheval à taureau : Yannis Helly (Arlatenco).';
    expect(lireClassement(detail)).toEqual({
      rangs: [
        { rang: 1, manade: 'Arlatenco', precision: null },
        { rang: 2, manade: 'Vinuesa', precision: 'à quelques points' },
        { rang: 3, manade: 'Robert Michel', precision: null },
        { rang: 4, manade: 'Gillet', precision: null },
        { rang: 5, manade: 'Lafon', precision: null },
      ],
      suite: 'Saut de cheval à taureau : Yannis Helly (Arlatenco).',
    });
  });

  it('accepte un classement sans suite', () => {
    expect(lireClassement('Classement : 1. Vinuesa, 2. Gillet.')).toEqual({
      rangs: [
        { rang: 1, manade: 'Vinuesa', precision: null },
        { rang: 2, manade: 'Gillet', precision: null },
      ],
      suite: null,
    });
  });

  it('laisse le texte tel quel quand ce n’est pas un classement', () => {
    expect(lireClassement('Face à Clément et La Lauze.')).toBeNull();
    expect(lireClassement('Classement : Vinuesa devant Gillet.')).toBeNull();
    expect(lireClassement('Classement : 2. Vinuesa, 3. Gillet.')).toBeNull();
    expect(lireClassement(null)).toBeNull();
  });
});

describe('soireesGagneesParManade', () => {
  it('compte les victoires confirmées de l’année, groupe les variantes de nom et trie par nombre puis par nom', () => {
    const palmares: Palmares[] = [
      resultat(2026, 'Nîmes', 'Arlatenco'),
      resultat(2026, 'Alès', 'Manade Arlatenco', { date_soiree: '2026-05-15' }),
      resultat(2026, 'Bezouce', 'Labourayre', { statut: 'a_confirmer' }),
      resultat(2026, 'Mouriès', 'Clément', { date_soiree: '2026-07-10' }),
      resultat(2026, 'Beauvoisin', 'Devaux', { date_soiree: '2026-07-15' }),
      resultat(2026, 'Lunel', 'Clément', { date_soiree: '2026-06-20' }),
    ];
    // L'écriture retenue est celle de la ligne la plus récente de la manade (Nîmes = « Arlatenco »
    // plus récent qu'Alès = « Manade Arlatenco »). Même nombre de victoires : tri alphabétique
    // français (Arlatenco avant Clément).
    expect(soireesGagneesParManade(palmares, 2026)).toEqual([
      { nom: 'Arlatenco', victoires: 2 },
      { nom: 'Clément', victoires: 2 },
      { nom: 'Devaux', victoires: 1 },
    ]);
  });

  it('ignore les résultats à confirmer et les autres années', () => {
    const palmares: Palmares[] = [
      resultat(2026, 'Nîmes', 'Vinuesa'),
      resultat(2026, 'Alès', 'Vinuesa', { statut: 'a_confirmer' }),
      resultat(2025, 'Nîmes', 'Vinuesa'),
    ];
    expect(soireesGagneesParManade(palmares, 2026)).toEqual([{ nom: 'Vinuesa', victoires: 1 }]);
  });

  it('ne renvoie rien quand aucun résultat n’est confirmé pour l’année', () => {
    expect(soireesGagneesParManade([resultat(2026, 'Nîmes', 'Vinuesa', { statut: 'a_confirmer' })], 2026)).toEqual([]);
  });

  it('ignore un vainqueur vide', () => {
    const palmares = [resultat(2026, 'Nîmes', '  '), resultat(2026, 'Alès', 'Vinuesa')];
    expect(soireesGagneesParManade(palmares, 2026)).toEqual([{ nom: 'Vinuesa', victoires: 1 }]);
  });
});

describe('nombreResultatsConfirmes', () => {
  it('compte les lignes confirmées de l’année, sans compter les « à confirmer »', () => {
    const palmares: Palmares[] = [
      resultat(2026, 'Nîmes', 'Vinuesa'),
      resultat(2026, 'Alès', 'Clément'),
      resultat(2026, 'Mouriès', 'Devaux', { statut: 'a_confirmer' }),
      resultat(2025, 'Nîmes', 'Gillet'),
    ];
    expect(nombreResultatsConfirmes(palmares, 2026)).toBe(2);
  });
});
