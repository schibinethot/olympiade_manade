import { describe, expect, it } from 'vitest';
import { calculerClassements, exporterClassementsCsv, statutPublicEffectif } from '../../serveur/classements.mjs';

const EPREUVES = ['Ferrade en piste', 'Saut de cheval à cheval', 'Saut de cheval à taureau', 'Attente au fer'];
const MANADES = [
  { id: 'a', nom: 'Arlatenco' },
  { id: 'v', nom: 'Vinuesa' },
  { id: 'b', nom: 'Bon' },
  { id: 'c', nom: 'Lafon' },
];

/** Vinuesa deuxième partout : 8, les autres se partagent les premières places. */
const SCORES_ALES: Record<string, number[]> = {
  a: [10, 3, 4, 10],
  v: [8, 8, 8, 8],
  b: [4, 10, 3, 4],
  c: [3, 4, 10, 3],
};

function passagesAles(notesJury = true) {
  return EPREUVES.flatMap((nom, index) => MANADES.map((manade) => ({
    id: `${nom}-${manade.id}`,
    epreuveId: `e${index}`,
    epreuveNom: nom,
    epreuveOrdre: index + 1,
    manadeId: manade.id,
    manadeNom: manade.nom,
    publicOuvert: false,
    juryOuvert: false,
    notesPublic: [SCORES_ALES[manade.id][index]],
    notesJury: notesJury ? [SCORES_ALES[manade.id][index] * 2] : [],
  })));
}

describe('moteur de classements', () => {
  it('donne le général à Vinuesa au cumul de points alors qu’elle est deuxième de chaque épreuve', () => {
    const resultat = calculerClassements(passagesAles(), {
      mode: 'separe', methode: 'points', poidsJury: 70, baremeJury: 20,
    });
    for (const epreuve of resultat.parEpreuve) {
      expect(epreuve.public?.find((ligne) => ligne.manadeNom === 'Vinuesa')?.rang).toBe(2);
      expect(epreuve.public?.some((ligne) => ligne.rang === 1 && ligne.manadeNom !== 'Vinuesa')).toBe(true);
    }
    expect(resultat.general.public?.[0]).toMatchObject({ manadeNom: 'Vinuesa', rang: 1, total: 12 });
    expect(resultat.general.jury?.[0]?.manadeNom).toBe('Vinuesa');
  });

  it('peut désigner un autre vainqueur en moyenne qu’au cumul de points', () => {
    const passages = [
      ['e1', 'Une', 'A', 10], ['e1', 'Une', 'B', 9], ['e1', 'Une', 'C', 8],
      ['e2', 'Deux', 'A', 10], ['e2', 'Deux', 'B', 9], ['e2', 'Deux', 'C', 8],
      ['e3', 'Trois', 'C', 10], ['e3', 'Trois', 'A', 2], ['e3', 'Trois', 'B', 1],
    ].map((ligne, index) => {
      const epreuveId = String(ligne[0]);
      const epreuveNom = String(ligne[1]);
      const manadeNom = String(ligne[2]);
      const note = Number(ligne[3]);
      return {
        id: String(index), epreuveId, epreuveNom, epreuveOrdre: epreuveId === 'e1' ? 1 : epreuveId === 'e2' ? 2 : 3,
        manadeId: manadeNom, manadeNom, publicOuvert: false, juryOuvert: false,
        notesPublic: [note], notesJury: [note],
      };
    });
    const points = calculerClassements(passages, { mode: 'jury', methode: 'points', poidsJury: 70, baremeJury: 10 });
    const moyenne = calculerClassements(passages, { mode: 'jury', methode: 'moyenne', poidsJury: 70, baremeJury: 10 });
    expect(points.general.public?.[0]?.manadeNom).toBe('A');
    expect(moyenne.general.public?.[0]?.manadeNom).toBe('C');
  });

  it('ramène le jury sur 10 et partage le rang des ex æquo', () => {
    const passages = [{
      id: '1', epreuveId: 'e', epreuveNom: 'Ferrade', epreuveOrdre: 1,
      manadeId: 'a', manadeNom: 'A', publicOuvert: false, juryOuvert: false,
      notesPublic: [8], notesJury: [16],
    }, {
      id: '2', epreuveId: 'e', epreuveNom: 'Ferrade', epreuveOrdre: 1,
      manadeId: 'b', manadeNom: 'B', publicOuvert: false, juryOuvert: false,
      notesPublic: [8], notesJury: [16],
    }, {
      id: '3', epreuveId: 'e', epreuveNom: 'Ferrade', epreuveOrdre: 1,
      manadeId: 'c', manadeNom: 'C', publicOuvert: false, juryOuvert: false,
      notesPublic: [4], notesJury: [8],
    }];
    const resultat = calculerClassements(passages, { mode: 'combine', methode: 'points', poidsJury: 70, baremeJury: 20 });
    const jury = resultat.parEpreuve[0]?.jury ?? [];
    expect(jury.find((ligne) => ligne.manadeNom === 'A')).toMatchObject({ rang: 1, score: 8, points: 3 });
    expect(jury.find((ligne) => ligne.manadeNom === 'B')).toMatchObject({ rang: 1, points: 3 });
    expect(jury.find((ligne) => ligne.manadeNom === 'C')).toMatchObject({ rang: 3, points: 1 });
    expect(resultat.parEpreuve[0]?.combine?.find((ligne) => ligne.manadeNom === 'A')?.score).toBeCloseTo(8);
  });

  it('exclut une manade sans note et marque le classement provisoire', () => {
    const passages = passagesAles(false).map((passage, index) => ({ ...passage, juryOuvert: index === 0 }));
    const resultat = calculerClassements(passages, { mode: 'separe', methode: 'points', poidsJury: 70, baremeJury: 20 });
    expect(resultat.provisoire).toBe(true);
    expect(resultat.parEpreuve[0]?.jury).toEqual([]);
    expect(resultat.general.public?.[0]?.manadeNom).toBe('Vinuesa');
  });

  it('exporte un CSV et ferme un passage dont l’échéance est passée', () => {
    const csv = exporterClassementsCsv(calculerClassements(passagesAles(), {
      mode: 'separe', methode: 'points', poidsJury: 70, baremeJury: 20,
    }));
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Vinuesa');
    const maintenant = Date.parse('2027-08-20T21:00:00.000Z');
    expect(statutPublicEffectif({
      statutPublic: 'ouvert', fermeLe: '2027-08-20T20:00:00.000Z', finPassageLe: null,
      heureFin: null, delaiMinutes: 5, modeVote: 'deblocage',
    }, maintenant)).toBe('clos');
  });
});
