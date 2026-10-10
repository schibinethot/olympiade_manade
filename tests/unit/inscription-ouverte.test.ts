import { describe, expect, it } from 'vitest';
import { inscriptionOuverte } from '../../app/lib/inscription-ouverte';

// Drapeau de build VITE_INSCRIPTION_OUVERTE : les liens publics vers /inscription n'apparaissent que
// lorsque l'envoi des codes au public est prêt (SMTP personnalisé configuré).
describe('inscriptionOuverte', () => {
  it('est faux par défaut, sans variable', () => {
    expect(inscriptionOuverte({})).toBe(false);
    expect(inscriptionOuverte({ VITE_INSCRIPTION_OUVERTE: undefined })).toBe(false);
    expect(inscriptionOuverte({ VITE_INSCRIPTION_OUVERTE: '' })).toBe(false);
  });

  it('n’est vrai que pour la chaîne exacte « true »', () => {
    expect(inscriptionOuverte({ VITE_INSCRIPTION_OUVERTE: 'true' })).toBe(true);
    for (const valeur of ['false', 'TRUE', 'True', ' true', 'true ', '1', 'oui', 'yes']) {
      expect(inscriptionOuverte({ VITE_INSCRIPTION_OUVERTE: valeur }), valeur).toBe(false);
    }
  });
});
