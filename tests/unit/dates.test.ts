import { describe, expect, it } from 'vitest';
import { compteARebours, formaterDateLongue, formaterHeure, prochaineSoiree } from '../../app/lib/dates';

const d = (date_soiree: string, statut: 'previsionnelle' | 'confirmee' | 'annulee' = 'previsionnelle', heure: string | null = '21:00') =>
  ({ date_soiree, heure, statut });

describe('prochaineSoiree', () => {
  it('renvoie la plus proche soirée non annulée à venir, en comptant le jour même', () => {
    const maintenant = new Date('2027-08-13T10:00:00+02:00');
    const dates = [d('2027-08-20'), d('2027-08-11'), d('2027-08-13'), d('2027-08-12', 'annulee')];
    expect(prochaineSoiree(dates, maintenant)?.date_soiree).toBe('2027-08-13');
  });

  it('ignore les soirées annulées', () => {
    const maintenant = new Date('2027-08-12T10:00:00+02:00');
    expect(prochaineSoiree([d('2027-08-12', 'annulee'), d('2027-08-20')], maintenant)?.date_soiree).toBe('2027-08-20');
  });

  it('renvoie null quand rien n’est à venir', () => {
    const maintenant = new Date('2027-09-01T10:00:00+02:00');
    expect(prochaineSoiree([d('2027-08-20'), d('2027-08-21', 'annulee')], maintenant)).toBeNull();
    expect(prochaineSoiree([], maintenant)).toBeNull();
  });
});

describe('compteARebours', () => {
  it('découpe la durée restante en jours, heures et minutes', () => {
    expect(compteARebours(new Date('2027-08-20T21:00:00+02:00'), new Date('2027-08-18T19:30:00+02:00'))).toEqual({
      jours: 2,
      heures: 1,
      minutes: 30,
    });
  });

  it('renvoie null quand la cible est passée', () => {
    expect(compteARebours(new Date('2027-08-20T21:00:00+02:00'), new Date('2027-08-20T21:00:01+02:00'))).toBeNull();
  });
});

describe('formats français', () => {
  it('formate la date longue', () => {
    expect(formaterDateLongue('2027-08-20')).toBe('vendredi 20 août 2027');
  });

  it('formate l’heure à la française', () => {
    expect(formaterHeure('21:00')).toBe('21h');
    expect(formaterHeure('21:30:00')).toBe('21h30');
    expect(formaterHeure(null)).toBeNull();
  });
});
