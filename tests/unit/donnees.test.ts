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
