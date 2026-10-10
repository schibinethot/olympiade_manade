import { describe, expect, it } from 'vitest';
import { noteProjections, sectionsDates } from '../../app/lib/calendrier';
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

const CALENDRIER: Calendrier[] = [
  soiree('2025-08-22', 'Nîmes', { statut: 'confirmee' }),
  soiree('2026-05-15', 'Alès', { statut: 'confirmee' }),
  soiree('2026-08-17', 'Beauvoisin', { statut: 'confirmee' }),
  soiree('2026-08-21', 'Nîmes', { statut: 'confirmee' }),
  soiree('2027-08-20', 'Nîmes', { heure: '21:00:00' }),
  soiree('2027-05-01', 'Arles', { statut: 'confirmee', heure: '15:30:00' }),
  soiree('2027-07-15', 'Aimargues'),
  soiree('2027-08-16', 'Le Crès', { heure: '21:00:00' }),
  soiree('2027-08-16', 'Beauvoisin'),
];

const PALMARES: Palmares[] = [
  resultat(2026, 'Nîmes', 'Arlatenco'),
  resultat(2026, 'Beauvoisin', 'Devaux'),
  resultat(2026, 'Bezouce', 'Labourayre', { statut: 'a_confirmer' }),
  resultat(2025, 'Nîmes', 'Vinuesa'),
];

const OCTOBRE_2026 = new Date('2026-10-10T10:00:00Z');

describe('sectionsDates', () => {
  it('met la saison à venir d’abord, puis les archives de la plus récente à la plus ancienne', () => {
    const sections = sectionsDates(CALENDRIER, PALMARES, OCTOBRE_2026);
    expect(sections.map((s) => [s.id, s.titre, s.total])).toEqual([
      ['saison-2027', 'Saison 2027', 5],
      ['archives-2026', 'Archives 2026', 3],
      ['archives-2025', 'Archives 2025', 1],
    ]);
  });

  it('groupe les soirées par mois, dans l’ordre des dates, et compte les confirmées', () => {
    const [saison] = sectionsDates(CALENDRIER, PALMARES, OCTOBRE_2026);
    expect(saison.mois.map((m) => [m.libelle, m.lignes.map((l) => l.soiree.ville)])).toEqual([
      ['Mai', ['Arles']],
      ['Juillet', ['Aimargues']],
      // Même jour : dans l'ordre des heures (Le Crès à 21h, Beauvoisin à 21h30).
      ['Août', ['Le Crès', 'Beauvoisin', 'Nîmes']],
    ]);
    expect(saison.confirmees).toBe(1);
    expect(saison.previsionnelles).toBe(4);
    expect(saison.premiere?.ville).toBe('Arles');
    expect(saison.derniere?.ville).toBe('Nîmes');
  });

  it('compte les soirées de chaque mois de mai à août au moins, pour la frise de la saison', () => {
    const [saison] = sectionsDates(CALENDRIER, PALMARES, OCTOBRE_2026);
    expect(saison.frise.map((m) => [m.court, m.nombre])).toEqual([
      ['Mai', 1],
      ['Juin', 0],
      ['Juil.', 1],
      ['Août', 3],
    ]);
  });

  it('marque la prochaine soirée et les soirées terminées', () => {
    const aout = new Date('2027-08-17T10:00:00Z');
    const [saison] = sectionsDates(CALENDRIER, PALMARES, aout);
    const etats = saison.mois.flatMap((m) => m.lignes.map((l) => [l.soiree.ville, l.etat]));
    expect(etats).toEqual([
      ['Arles', 'terminee'],
      ['Aimargues', 'terminee'],
      ['Le Crès', 'terminee'],
      ['Beauvoisin', 'terminee'],
      ['Nîmes', 'prochaine'],
    ]);
  });

  it('fait remonter la soirée du jour en tête de sa section', () => {
    const jour = new Date('2027-08-16T08:00:00Z');
    const [saison] = sectionsDates(CALENDRIER, PALMARES, jour);
    expect(saison.ceSoir.map((l) => [l.soiree.ville, l.etat])).toEqual([
      ['Le Crès', 'ce-soir'],
      ['Beauvoisin', 'ce-soir'],
    ]);
    expect(saison.mois.flatMap((m) => m.lignes.map((l) => l.soiree.ville))).toEqual(['Arles', 'Aimargues', 'Nîmes']);
  });

  it('donne le vainqueur d’une archive quand le palmarès a la même ville et la même année', () => {
    const sections = sectionsDates(CALENDRIER, PALMARES, OCTOBRE_2026);
    const archives2026 = sections[1].mois.flatMap((m) => m.lignes);
    expect(archives2026.map((l) => [l.soiree.ville, l.vainqueur?.nom ?? null])).toEqual([
      ['Alès', null],
      ['Beauvoisin', 'Devaux'],
      ['Nîmes', 'Arlatenco'],
    ]);
    expect(sections[2].mois[0].lignes[0].vainqueur).toEqual({ nom: 'Vinuesa', aConfirmer: false });
  });

  it('signale un vainqueur à confirmer', () => {
    const calendrier = [soiree('2026-08-06', 'Bezouce', { statut: 'confirmee' })];
    const [archives] = sectionsDates(calendrier, PALMARES, OCTOBRE_2026);
    expect(archives.mois[0].lignes[0].vainqueur).toEqual({ nom: 'Labourayre', aConfirmer: true });
  });

  it('se passe du palmarès quand il est indisponible', () => {
    const sections = sectionsDates(CALENDRIER, null, OCTOBRE_2026);
    expect(sections.every((s) => s.mois.every((m) => m.lignes.every((l) => l.vainqueur === null)))).toBe(true);
  });

  it('garde la dernière saison comme saison quand plus rien n’est à venir', () => {
    const sections = sectionsDates(CALENDRIER, PALMARES, new Date('2027-12-01T10:00:00Z'));
    expect(sections.map((s) => s.titre)).toEqual(['Saison 2027', 'Archives 2026', 'Archives 2025']);
  });

  it('ne renvoie rien pour un calendrier vide', () => {
    expect(sectionsDates([], PALMARES, OCTOBRE_2026)).toEqual([]);
  });
});

describe('noteProjections', () => {
  const section = (confirmees: number, previsionnelles: number) => ({ annee: 2027, confirmees, previsionnelles });

  it('reprend la phrase demandée quand une seule date est confirmée', () => {
    expect(noteProjections(section(1, 17))).toBe(
      'Les dates 2027 sont des projections, à confirmer par chaque organisateur. Une seule est déjà confirmée.',
    );
  });

  it('suit le nombre de dates confirmées', () => {
    expect(noteProjections(section(0, 18))).toBe(
      'Les dates 2027 sont des projections, à confirmer par chaque organisateur. Aucune n’est encore confirmée.',
    );
    expect(noteProjections(section(3, 15))).toBe(
      'Les dates 2027 sont des projections, à confirmer par chaque organisateur. 3 sont déjà confirmées.',
    );
  });

  it('ne parle plus que des dates restantes quand la plupart sont confirmées', () => {
    expect(noteProjections(section(15, 3))).toBe('3 dates 2027 sont encore prévisionnelles, à confirmer par chaque organisateur.');
    expect(noteProjections(section(17, 1))).toBe('Une date 2027 est encore prévisionnelle, à confirmer par son organisateur.');
  });

  it('disparaît quand toutes les dates sont confirmées', () => {
    expect(noteProjections(section(18, 0))).toBeNull();
  });
});
