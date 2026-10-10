import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Borne des lectures du navigateur : le signal d'abandon couvre aussi le chargement de supabase-js
// (module importé à la demande), pas seulement la requête. Un module lent ou bloqué ne retient pas
// la lecture au-delà du délai.

const { supabase } = vi.hoisted(() => ({ supabase: vi.fn() }));
vi.mock('../../app/lib/supabase', () => ({ supabase }));

import { DELAI_LECTURE_NAVIGATEUR_MS, lireDonneesVitrine } from '../../app/lib/donnees-vitrine';
import { ErreurDonnees, lireCalendrier, lirePalmares } from '../../app/lib/donnees';

const jamais = () => new Promise<never>(() => {});

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  supabase.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('lectures bornées par un signal', () => {
  it('le délai de 3 s reste celui du navigateur', () => {
    expect(DELAI_LECTURE_NAVIGATEUR_MS).toBe(3000);
  });

  it('abandon pendant le chargement de supabase-js : ErreurDonnees, sans attendre le module', async () => {
    supabase.mockImplementation(jamais);
    const controleur = new AbortController();
    const calendrier = lireCalendrier(controleur.signal);
    const palmares = lirePalmares(controleur.signal);
    controleur.abort();
    await expect(calendrier).rejects.toBeInstanceOf(ErreurDonnees);
    await expect(palmares).rejects.toBeInstanceOf(ErreurDonnees);
  });

  it('signal déjà abandonné : refus immédiat', async () => {
    supabase.mockImplementation(jamais);
    await expect(lireCalendrier(AbortSignal.abort())).rejects.toBeInstanceOf(ErreurDonnees);
  });

  it('module bloqué : la lecture des pages vitrine rend null aux deux tables à l’expiration du délai', async () => {
    supabase.mockImplementation(jamais);
    const debut = Date.now();
    const donnees = await lireDonneesVitrine(AbortSignal.timeout(50));
    expect(donnees.calendrier).toBeNull();
    expect(donnees.palmares).toBeNull();
    expect(Date.now() - debut).toBeLessThan(1000);
  });

  it('un échec du chargement reste une ErreurDonnees', async () => {
    supabase.mockRejectedValue(new Error('Failed to fetch dynamically imported module'));
    await expect(lireCalendrier(new AbortController().signal)).rejects.toThrow(ErreurDonnees);
    await expect(lireCalendrier()).rejects.toThrow(/dynamically imported module/);
  });
});

// Apostrophes (M2) : la base contient des apostrophes droites (« Olympiades d'Aimargues ») ; la
// couche de lecture les rend typographiques pour l'affichage, sans toucher aux adresses.

/** Client factice : chaque requête rend `lignes`, quels que soient les filtres et le tri. */
function clientFactice(lignes: unknown[]) {
  const requete = {
    select: () => requete,
    order: () => requete,
    abortSignal: () => requete,
    then: (ok: (valeur: unknown) => unknown, ko?: (raison: unknown) => unknown) =>
      Promise.resolve({ data: lignes, error: null }).then(ok, ko),
  };
  return { from: () => requete };
}

describe('apostrophes typographiques à la lecture', () => {
  it('apostrophe droite en apostrophe typographique, le reste du texte intact', async () => {
    const { apostrophes } = await import('../../app/lib/donnees');
    expect(apostrophes('Olympiades d\'Aimargues')).toBe('Olympiades d’Aimargues');
    expect(apostrophes('L\'Isle-sur-la-Sorgue, l\'an d\'après')).toBe('L’Isle-sur-la-Sorgue, l’an d’après');
    expect(apostrophes('Déjà d’Aimargues')).toBe('Déjà d’Aimargues');
    expect(apostrophes('Nîmes')).toBe('Nîmes');
  });

  it('calendrier : nom, ville et arènes ; ni le lien de billetterie ni les autres champs', async () => {
    const { lireCalendrier } = await import('../../app/lib/donnees');
    supabase.mockResolvedValue(
      clientFactice([
        {
          id: 'aimargues-2027',
          annee: 2027,
          nom: 'Olympiades d\'Aimargues',
          ville: 'L\'Isle',
          arenes: 'Arènes d\'Aimargues',
          date_soiree: '2027-07-15',
          heure: '21:00:00',
          statut: 'previsionnelle',
          lien_billetterie: 'https://exemple.fr/billets?ville=d\'aimargues',
        },
        { id: 'sans-arenes', annee: 2027, nom: 'Soirée', ville: 'Alès', arenes: null, date_soiree: '2027-05-07', heure: null, statut: 'previsionnelle', lien_billetterie: null },
      ]),
    );
    const [aimargues, sansArenes] = await lireCalendrier();
    expect(aimargues).toMatchObject({
      nom: 'Olympiades d’Aimargues',
      ville: 'L’Isle',
      arenes: 'Arènes d’Aimargues',
      lien_billetterie: 'https://exemple.fr/billets?ville=d\'aimargues',
    });
    expect(sansArenes.arenes).toBeNull();
  });

  it('palmarès : événement, ville, vainqueur et détail ; ni la source ni les autres champs', async () => {
    const { lirePalmares } = await import('../../app/lib/donnees');
    supabase.mockResolvedValue(
      clientFactice([
        {
          id: 'aimargues-2026',
          annee: 2026,
          evenement: 'Olympiades d\'Aimargues',
          ville: 'L\'Isle',
          date_soiree: '2026-07-16',
          vainqueur: 'Manade d\'Arles',
          detail: 'Ferrade en piste : l\'équipe d\'Aubanel.',
          statut: 'confirme',
          source_url: 'https://www.facebook.com/posts/resultat-d\'aimargues',
        },
      ]),
    );
    const [resultat] = await lirePalmares();
    expect(resultat).toMatchObject({
      evenement: 'Olympiades d’Aimargues',
      ville: 'L’Isle',
      vainqueur: 'Manade d’Arles',
      detail: 'Ferrade en piste : l’équipe d’Aubanel.',
      source_url: 'https://www.facebook.com/posts/resultat-d\'aimargues',
    });
  });
});
