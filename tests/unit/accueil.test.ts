import { describe, expect, it } from 'vitest';
import {
  dernierVainqueur,
  formaterJourMois,
  instantSoiree,
  lieuSoiree,
  momentSoiree,
  prochaineSoireeA,
  saisonAccueil,
  soireeDeReference,
  texteCompteARebours,
} from '../../app/lib/accueil';
import type { Calendrier, Palmares } from '../../app/lib/donnees';

const soiree = (date_soiree: string, ville: string, extra: Partial<Calendrier> = {}): Calendrier => ({
  id: `${ville}-${date_soiree}`,
  annee: Number(date_soiree.slice(0, 4)),
  nom: `Olympiades de ${ville}`,
  ville,
  arenes: `Arènes de ${ville}`,
  date_soiree,
  heure: '21:30:00',
  statut: 'previsionnelle',
  lien_billetterie: null,
  ...extra,
});

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

describe('instantSoiree', () => {
  it('place l’heure de la soirée dans le fuseau de Paris, heure d’été comme d’hiver', () => {
    expect(instantSoiree('2027-08-20', '21:00:00').toISOString()).toBe('2027-08-20T19:00:00.000Z');
    expect(instantSoiree('2027-12-03', '21:00').toISOString()).toBe('2027-12-03T20:00:00.000Z');
  });

  it('prend le début de la journée quand l’heure est inconnue', () => {
    expect(instantSoiree('2027-07-19', null).toISOString()).toBe('2027-07-18T22:00:00.000Z');
  });
});

describe('texteCompteARebours', () => {
  it('compte en jours au-delà d’une journée, au singulier pour un seul jour', () => {
    expect(texteCompteARebours({ jours: 313, heures: 4, minutes: 12 })).toBe('313 jours');
    expect(texteCompteARebours({ jours: 1, heures: 9, minutes: 30 })).toBe('1 jour');
  });

  it('compte en heures et minutes le dernier jour', () => {
    expect(texteCompteARebours({ jours: 0, heures: 9, minutes: 30 })).toBe('9 h 30 min');
    expect(texteCompteARebours({ jours: 0, heures: 0, minutes: 5 })).toBe('5 min');
  });

  it('ne compte rien quand la soirée a commencé', () => {
    expect(texteCompteARebours(null)).toBeNull();
  });
});

describe('lieuSoiree', () => {
  it('nomme les arènes, et la ville quand le nom des arènes ne la contient pas', () => {
    expect(lieuSoiree({ arenes: 'Arènes de Nîmes', ville: 'Nîmes' })).toBe('aux arènes de Nîmes');
    expect(lieuSoiree({ arenes: 'Arènes André Blanc', ville: 'Mouriès' })).toBe('aux arènes André Blanc, à Mouriès');
    expect(lieuSoiree({ arenes: null, ville: 'Beaucaire' })).toBe('à Beaucaire');
  });
});

// Phrase commune à la carte « Notez les Olympiades » et à la page /noter (Task 6).
describe('momentSoiree', () => {
  it('donne le jour, l’heure, le lieu et la mention d’une date prévisionnelle', () => {
    expect(momentSoiree(soiree('2027-08-20', 'Nîmes', { heure: '21:00:00' }))).toBe(
      'le vendredi 20 août 2027 à 21h, aux arènes de Nîmes (date prévisionnelle)',
    );
    expect(momentSoiree(soiree('2027-05-01', 'Mouriès', { heure: null, statut: 'confirmee', arenes: null }))).toBe(
      'le samedi 1er mai 2027, à Mouriès',
    );
  });
});

describe('formaterJourMois', () => {
  it('donne le jour et le mois en toutes lettres', () => {
    expect(formaterJourMois('2027-08-20')).toBe('20 août');
    expect(formaterJourMois('2027-05-07')).toBe('7 mai');
  });

  it('écrit « 1er » pour le premier jour du mois', () => {
    expect(formaterJourMois('2027-05-01')).toBe('1er mai');
    expect(formaterJourMois('2027-05-11')).toBe('11 mai');
  });
});

describe('prochaineSoireeA', () => {
  it('cherche la prochaine soirée d’une ville donnée', () => {
    const calendrier = [soiree('2027-05-07', 'Alès'), soiree('2026-08-21', 'Nîmes'), soiree('2027-08-20', 'Nîmes')];
    expect(prochaineSoireeA(calendrier, 'Nîmes', new Date('2026-10-10T12:00:00+02:00'))?.date_soiree).toBe('2027-08-20');
    expect(prochaineSoireeA(calendrier, 'Nîmes', new Date('2027-09-01T12:00:00+02:00'))).toBeNull();
  });
});

describe('soireeDeReference', () => {
  const calendrier = [
    soiree('2027-05-01', 'Arles', { statut: 'confirmee' }),
    soiree('2027-08-19', 'Mouriès'),
    soiree('2027-08-20', 'Nîmes', { heure: '21:00:00' }),
    soiree('2027-08-27', 'Raphèle-lès-Arles'),
  ];

  it('vise la prochaine soirée de Nîmes, même si d’autres soirées viennent avant', () => {
    expect(soireeDeReference(calendrier, new Date('2026-10-10T12:00:00+02:00'))?.ville).toBe('Nîmes');
    expect(soireeDeReference(calendrier, new Date('2027-08-18T12:00:00+02:00'))?.date_soiree).toBe('2027-08-20');
  });

  it('revient à la prochaine soirée tous événements confondus quand Nîmes n’a plus de date', () => {
    expect(soireeDeReference(calendrier, new Date('2027-08-23T12:00:00+02:00'))?.ville).toBe('Raphèle-lès-Arles');
    expect(soireeDeReference(calendrier, new Date('2027-09-01T12:00:00+02:00'))).toBeNull();
  });
});

describe('dernierVainqueur', () => {
  it('prend le résultat confirmé le plus récent et la frise des victoires confirmées de la manade', () => {
    const palmares = [
      resultat(2023, 'Nîmes', 'Vinuesa', { source_url: 'https://www.arenesdenimes.com/actu/2023' }),
      resultat(2024, 'Nîmes', 'Vinuesa', { source_url: 'https://www.arenesdenimes.com/actu/2024' }),
      resultat(2025, 'Nîmes', 'Vinuesa', { statut: 'a_confirmer' }),
      resultat(2026, 'Alès', 'Vinuesa', { date_soiree: '2026-05-15', source_url: 'https://www.objectifsud.fr/a' }),
      resultat(2026, 'Beauvoisin', 'Devaux', { date_soiree: '2026-08-17', detail: 'Face à Clément.' }),
    ];
    const v = dernierVainqueur(palmares);
    expect(v?.vainqueur).toBe('Devaux');
    expect(v?.resultat.detail).toBe('Face à Clément.');
    expect(v?.victoires).toEqual([{ annee: 2026, ville: 'Beauvoisin' }]);
  });

  it('ignore une ligne plus récente « à confirmer » et liste les sources sans doublon', () => {
    const palmares = [
      resultat(2023, 'Nîmes', 'Vinuesa', { date_soiree: '2023-08-18', source_url: 'https://www.arenesdenimes.com/actu/2023' }),
      resultat(2024, 'Nîmes', 'Vinuesa', { date_soiree: '2024-08-23', source_url: 'https://www.arenesdenimes.com/actu/2024' }),
      resultat(2026, 'Alès', 'Vinuesa', { date_soiree: '2026-05-15', source_url: 'https://www.objectifsud.fr/a' }),
      resultat(2026, 'Nîmes', 'Gillet', { date_soiree: '2026-08-21', statut: 'a_confirmer' }),
    ];
    const v = dernierVainqueur(palmares);
    expect(v?.vainqueur).toBe('Vinuesa');
    expect(v?.victoires).toEqual([
      { annee: 2023, ville: 'Nîmes' },
      { annee: 2024, ville: 'Nîmes' },
      { annee: 2026, ville: 'Alès' },
    ]);
    expect(v?.sources).toEqual([
      { domaine: 'arenesdenimes.com', url: 'https://www.arenesdenimes.com/actu/2023' },
      { domaine: 'objectifsud.fr', url: 'https://www.objectifsud.fr/a' },
    ]);
  });

  it('renvoie null sans résultat confirmé', () => {
    expect(dernierVainqueur([resultat(2025, 'Nîmes', 'Vinuesa', { statut: 'a_confirmer' })])).toBeNull();
    expect(dernierVainqueur([])).toBeNull();
  });
});

describe('saisonAccueil', () => {
  const calendrier = [
    soiree('2026-08-21', 'Nîmes', { statut: 'confirmee' }),
    soiree('2027-05-07', 'Alès'),
    soiree('2027-07-15', 'Aimargues'),
    soiree('2027-07-19', 'Beaucaire'),
    soiree('2027-08-02', 'Pérols'),
    soiree('2027-08-13', 'Saint-Rémy-de-Provence', { statut: 'confirmee' }),
    soiree('2027-08-16', 'Beauvoisin'),
    soiree('2027-08-19', 'Mouriès'),
    soiree('2027-08-20', 'Nîmes'),
  ];

  it('montre quatre soirées de la saison à partir de la prochaine, et le total de la saison', () => {
    const s = saisonAccueil(calendrier, new Date('2026-10-10T12:00:00+02:00'));
    expect(s?.annee).toBe(2027);
    expect(s?.total).toBe(8);
    expect(s?.lignes.map((l) => [l.soiree.ville, l.etat])).toEqual([
      ['Alès', 'prochaine'],
      ['Aimargues', 'a-venir'],
      ['Beaucaire', 'a-venir'],
      ['Pérols', 'a-venir'],
    ]);
  });

  it('en fin de saison, garde les dernières soirées et marque les soirées passées comme terminées', () => {
    const s = saisonAccueil(calendrier, new Date('2027-08-18T12:00:00+02:00'));
    expect(s?.lignes.map((l) => [l.soiree.ville, l.etat])).toEqual([
      ['Saint-Rémy-de-Provence', 'terminee'],
      ['Beauvoisin', 'terminee'],
      ['Mouriès', 'prochaine'],
      ['Nîmes', 'a-venir'],
    ]);
  });

  it('après la saison, montre la dernière saison connue, toute terminée', () => {
    const s = saisonAccueil(calendrier, new Date('2027-12-01T12:00:00+01:00'));
    expect(s?.annee).toBe(2027);
    expect(s?.lignes.every((l) => l.etat === 'terminee')).toBe(true);
  });

  it('marque une soirée annulée comme telle', () => {
    const s = saisonAccueil([soiree('2027-05-07', 'Alès', { statut: 'annulee' }), soiree('2027-07-15', 'Aimargues')], new Date('2027-01-01T12:00:00+01:00'));
    expect(s?.lignes.map((l) => l.etat)).toEqual(['annulee', 'prochaine']);
  });

  it('renvoie null pour un calendrier vide', () => {
    expect(saisonAccueil([], new Date())).toBeNull();
  });
});
