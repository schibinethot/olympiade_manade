import { describe, expect, it, vi } from 'vitest';
import { CLE_SESSION, sessionPossible } from '../../app/lib/supabase';

// Chargement différé de supabase-js (Task 8) : le client n'est chargé au démarrage que si
// l'appareil a peut-être une session à relire.

function stockage(cles: string[]): Pick<Storage, 'length' | 'key'> {
  return { length: cles.length, key: (i: number) => cles[i] ?? null };
}

const SANS_PARAMETRES = { search: '', hash: '' };

describe('sessionPossible', () => {
  it('est faux sur un appareil sans session ni lien de connexion', () => {
    expect(sessionPossible(stockage([]), SANS_PARAMETRES)).toBe(false);
    expect(sessionPossible(stockage(['olympiade-inscription', 'autre']), { search: '?annee=2025', hash: '#saison-2027' })).toBe(false);
  });

  it('est vrai avec une session ou une demande PKCE enregistrée', () => {
    expect(CLE_SESSION).toBe('olympiade-auth');
    expect(sessionPossible(stockage(['olympiade-auth']), SANS_PARAMETRES)).toBe(true);
    expect(sessionPossible(stockage(['x', 'olympiade-auth-code-verifier']), SANS_PARAMETRES)).toBe(true);
  });

  it('est vrai au retour du lien de l’email, même sans stockage lisible', () => {
    expect(sessionPossible(null, { search: '?code=abc123', hash: '' })).toBe(true);
    expect(sessionPossible(stockage([]), { search: '?error=access_denied&error_code=otp_expired', hash: '' })).toBe(true);
    expect(sessionPossible(stockage([]), { search: '', hash: '#access_token=jeton&type=magiclink' })).toBe(true);
    expect(sessionPossible(null, SANS_PARAMETRES)).toBe(false);
  });

  it('suit un stockage qui lève une erreur à la lecture', () => {
    const bloque = {
      get length(): number {
        throw new Error('stockage bloqué');
      },
      key: () => null,
    };
    expect(sessionPossible(bloque, SANS_PARAMETRES)).toBe(false);
  });
});

describe('supabase', () => {
  it('rejette sans variables d’environnement, au lieu de casser l’import du module', async () => {
    // Les variables sont lues à l'import du module : on les vide, puis on le recharge.
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', '');
    try {
      const { supabase } = await import('../../app/lib/supabase');
      await expect(supabase()).rejects.toThrow(/VITE_SUPABASE_URL/);
      // L'échec n'est pas retenu : l'appel suivant réessaie (et échoue ici de la même façon).
      await expect(supabase()).rejects.toThrow(/VITE_SUPABASE_URL/);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
