import { describe, expect, it } from 'vitest';
import { modeConsentement } from '../../app/lib/parcours-cookies';

describe('modeConsentement', () => {
  // ── Mode aucun ────────────────────────────────────────────────────────────
  describe('aucun : routes /ecran et /ecran/*', () => {
    it('retourne aucun sur /ecran', () => {
      expect(modeConsentement('/ecran')).toBe('aucun');
    });

    it('retourne aucun sur /ecran/saint-gilles-2027', () => {
      expect(modeConsentement('/ecran/saint-gilles-2027')).toBe('aucun');
    });

    it('retourne aucun sur /ecran/ (slash final)', () => {
      expect(modeConsentement('/ecran/')).toBe('aucun');
    });

    it('ne confond pas /ecranX (pas de slash) avec /ecran', () => {
      // /ecranX n'est pas une route écran → fenêtre
      expect(modeConsentement('/ecranX')).toBe('fenetre');
    });
  });

  // ── Mode bandeau ─────────────────────────────────────────────────────────
  describe('bandeau : tunnels et pages compte/admin/légales', () => {
    const cas: string[] = [
      '/noter',
      '/inscription',
      '/inscription/code',
      '/jury',
      '/compte',
      '/admin',
      '/admin/soirees',
      '/admin/soirees/123/direct',
      '/admin/cookies',
      '/confidentialite',
      '/mentions-legales',
    ];

    for (const chemin of cas) {
      it(`retourne bandeau sur ${chemin}`, () => {
        expect(modeConsentement(chemin)).toBe('bandeau');
      });
    }
  });

  // ── Mode fenêtre ─────────────────────────────────────────────────────────
  describe('fenetre : reste du site', () => {
    const cas: string[] = [
      '/',
      '/classements',
      '/dates',
      '/contact',
      '/mentions-legales-plus',  // préfixe similaire mais pas exact
      '/classements/2027',
    ];

    for (const chemin of cas) {
      it(`retourne fenetre sur ${chemin}`, () => {
        expect(modeConsentement(chemin)).toBe('fenetre');
      });
    }
  });

  // ── Query string ignorée ─────────────────────────────────────────────────
  it('ignore la query string pour /ecran', () => {
    expect(modeConsentement('/ecran/slug?preview=1')).toBe('aucun');
  });

  it('ignore la query string pour /noter', () => {
    expect(modeConsentement('/noter?ref=email')).toBe('bandeau');
  });

  it('ignore la query string pour /', () => {
    expect(modeConsentement('/?utm_source=fb')).toBe('fenetre');
  });
});
