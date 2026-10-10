import { describe, expect, it } from 'vitest';
import { normaliserContact, validerContact } from '../../app/lib/contact';

const valide = { prenom: 'Léa', email: 'lea@exemple.fr', message: 'Bonjour, quelle date pour Nîmes ?' };

// Mêmes règles que les contraintes de public.messages_contact
// (supabase/migrations/20261011090000_vitrine.sql).
describe('validerContact', () => {
  it('accepte un message conforme', () => {
    expect(validerContact(valide)).toEqual({});
  });

  it('prénom : 1 à 60 caractères, non vide une fois rogné des espaces, tabulations et retours', () => {
    expect(validerContact({ ...valide, prenom: ' \t\r\n' }).prenom).toBe('Indiquez votre prénom.');
    expect(validerContact({ ...valide, prenom: 'a'.repeat(60) }).prenom).toBeUndefined();
    expect(validerContact({ ...valide, prenom: 'a'.repeat(61) }).prenom).toBe('Le prénom ne doit pas dépasser 60 caractères.');
  });

  it('email : 254 caractères au plus et une adresse valide', () => {
    expect(validerContact({ ...valide, email: '' }).email).toBe('Indiquez votre adresse email.');
    expect(validerContact({ ...valide, email: 'lea@exemple' }).email).toBe('Cette adresse email n’est pas valide.');
    expect(validerContact({ ...valide, email: 'lea @exemple.fr' }).email).toBe('Cette adresse email n’est pas valide.');
    expect(validerContact({ ...valide, email: 'a@b@exemple.fr' }).email).toBe('Cette adresse email n’est pas valide.');
    const longue = `${'a'.repeat(245)}@exemple.fr`;
    expect(longue.length).toBe(256);
    expect(validerContact({ ...valide, email: longue }).email).toBe('L’adresse email ne doit pas dépasser 254 caractères.');
  });

  it('message : 10 à 2 000 caractères, non vide une fois rogné', () => {
    expect(validerContact({ ...valide, message: 'Court' }).message).toBe('Le message doit contenir au moins 10 caractères.');
    expect(validerContact({ ...valide, message: `\n\t   neuf lettres \r\n` }).message).toBeUndefined();
    expect(validerContact({ ...valide, message: `  ${'a'.repeat(9)}  ` }).message).toBe('Le message doit contenir au moins 10 caractères.');
    expect(validerContact({ ...valide, message: 'a'.repeat(2000) }).message).toBeUndefined();
    expect(validerContact({ ...valide, message: 'a'.repeat(2001) }).message).toBe('Le message ne doit pas dépasser 2 000 caractères.');
  });

  it('compte les caractères comme la base (un emoji compte pour un)', () => {
    expect(validerContact({ ...valide, prenom: '🐂'.repeat(60) }).prenom).toBeUndefined();
  });
});

describe('normaliserContact', () => {
  it('rogne les blancs en tête et en fin, comme la base les ignore', () => {
    expect(normaliserContact({ prenom: '  Léa\t', email: ' lea@exemple.fr \n', message: '\r\n Bonjour à tous ! \n' })).toEqual({
      prenom: 'Léa',
      email: 'lea@exemple.fr',
      message: 'Bonjour à tous !',
    });
  });
});
