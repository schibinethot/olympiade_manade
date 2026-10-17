import { describe, expect, it } from 'vitest';
import type { FicheManade } from '../../app/donnees/manades';
import { ficheManade, identiteManade, lienFicheManade, resultatsManade, victoiresConfirmees } from '../../app/lib/manades';
import type { Palmares } from '../../app/lib/donnees';

const fiches: FicheManade[] = [
  { slug: 'robert-michel', nom: 'Robert Michel', localisation: 'Mouriès', accroche: 'Une accroche.', presentation: [], activites: [], reperes: [], sources: [], verifieLe: '17 octobre 2026' },
  { slug: 'gillet', nom: 'Gillet', localisation: 'Mouriès', accroche: 'Une accroche.', presentation: [], activites: [], reperes: [], sources: [], verifieLe: '17 octobre 2026' },
];

const ligne = (partiel: Partial<Palmares>): Palmares => ({
  id: crypto.randomUUID(), annee: 2026, evenement: 'Olympiades', ville: 'Nîmes', date_soiree: '2026-08-16', vainqueur: 'Arlatenco', detail: null, statut: 'confirme', source_url: null, ...partiel,
});

describe('identité des manades', () => {
  it('accepte le préfixe et l’alias Michel Robert, sans recherche partielle', () => {
    expect(identiteManade(' Manade Michel   Robert ')).toBe('robert michel');
    expect(ficheManade('Manade Michel Robert', fiches)?.slug).toBe('robert-michel');
    expect(lienFicheManade('Gillette', fiches)).toBeNull();
  });
});

describe('résultats d’une manade', () => {
  it('garde les victoires, rangs et mentions sans transformer une citation en victoire', () => {
    const resultats = resultatsManade([
      ligne({ id: 'victoire', vainqueur: 'Manade Gillet', date_soiree: '2026-08-20' }),
      ligne({ id: 'classement', detail: 'Classement : 1. Arlatenco, 2. Vinuesa, 3. Gillet, 4. Lafon.' }),
      ligne({ id: 'mention', detail: 'À Mouriès, Gillet signe une belle épreuve.', date_soiree: '2026-06-01' }),
      ligne({ id: 'sous-chaine', detail: 'La famille Gillette était présente.', date_soiree: '2026-05-01' }),
    ], 'Gillet');
    expect(resultats.map((r) => r.resultat.id)).toEqual(['victoire', 'classement', 'mention']);
    expect(resultats[1]).toMatchObject({ rang: 3, victoire: false, citation: false });
    expect(resultats[2]).toMatchObject({ rang: null, victoire: false, citation: true });
    expect(victoiresConfirmees(resultats.map((r) => r.resultat), 'Gillet')).toBe(1);
  });

  it('conserve le statut et classe les événements du plus récent au plus ancien', () => {
    const resultats = resultatsManade([
      ligne({ id: 'ancien', vainqueur: 'Vinuesa', date_soiree: '2025-08-01', statut: 'a_confirmer' }),
      ligne({ id: 'recent', vainqueur: 'Vinuesa', date_soiree: '2026-08-01' }),
    ], 'Vinuesa');
    expect(resultats.map((r) => r.resultat.id)).toEqual(['recent', 'ancien']);
    expect(resultats[1].resultat.statut).toBe('a_confirmer');
    expect(victoiresConfirmees(resultats.map((r) => r.resultat), 'Vinuesa')).toBe(1);
  });

  it('lit les cinq places de Nîmes 2026 et l’alias Michel Robert', () => {
    const nimes = ligne({
      id: 'nimes-2026',
      vainqueur: 'Arlatenco',
      detail: 'Classement : 1. Arlatenco, 2. Vinuesa, 3. Robert Michel, 4. Gillet, 5. Lafon.',
    });
    expect(resultatsManade([nimes], 'Vinuesa')[0]).toMatchObject({ rang: 2, victoire: false });
    expect(resultatsManade([nimes], 'Michel Robert')[0]).toMatchObject({ rang: 3, victoire: false });
    expect(resultatsManade([nimes], 'Gillet')[0]).toMatchObject({ rang: 4, victoire: false });
    expect(resultatsManade([nimes], 'Lafon')[0]).toMatchObject({ rang: 5, victoire: false });
    expect(resultatsManade([nimes], 'Arlatenco')[0]).toMatchObject({ rang: 1, victoire: true });
  });
});
