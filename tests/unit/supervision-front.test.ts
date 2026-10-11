import { describe, expect, it } from 'vitest';
import { exporterMesures, latence, nombre, octets } from '../../app/lib/supervision';

describe('affichage des mesures de supervision', () => {
  it('distingue une source indisponible d’une vraie mesure nulle', () => {
    expect(nombre(null)).toBe('Indisponible');
    expect(nombre(NaN)).toBe('Indisponible');
    expect(nombre(0)).toBe('0');
    expect(octets(null)).toBe('Indisponible');
    expect(octets(0)).toBe('0 o');
    expect(octets(1_500_000)).toBe('1,5 Mo');
    expect(latence(null)).toBe('Indisponible');
    expect(latence(3001)).toBe('> 3 000 ms');
    expect(latence(25)).toBe('≤ 25 ms');
  });
  it('exporte les unités brutes et laisse vides les mesures absentes', () => {
    const csv = exporterMesures([{ minute: '2026-10-11T10:00:00Z', requests: 5, errors5xx: 1,
      responseBytes: 1500, p95Ms: null, cpuMs: 80, rssBytes: 10000, eventLoopLagMs: 2,
      inflightMax: 2, httpConnectionsMax: 3, instances: 1 }]);
    expect(csv).toContain('2026-10-11T10:00:00.000Z;5;1;1500;;80;10000;2;2;3;1;');
    expect(csv).not.toMatch(/undefined|NaN/);
  });
});
