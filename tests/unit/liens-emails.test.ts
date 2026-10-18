import { describe, expect, it } from 'vitest';
import { cleLiensValide, finDeJourParis, signerLien, verifierLien, liensPour } from '../../serveur/liens-emails.mjs';

const CLE = 'a'.repeat(64);
const AUTRE_CLE = 'b'.repeat(64);

/** Jeton d'un lien : dans le fragment (`#j=`) des pages, dans la requête (`?j=`) du POST en un clic. */
function jetonDe(url: string) {
  const adresse = new URL(url);
  return (new URLSearchParams(adresse.hash.slice(1)).get('j') ?? adresse.searchParams.get('j')) as string;
}

describe('liens signés', () => {
  it('fait l’aller-retour signer puis vérifier', () => {
    const jeton = signerLien(CLE, { t: 'desinscription', d: 'dest-1' });
    expect(verifierLien(CLE, jeton)).toEqual({ t: 'desinscription', d: 'dest-1' });
  });

  it('refuse un jeton altéré, une autre clé, une clé absente et un jeton mal formé', () => {
    const jeton = signerLien(CLE, { t: 'desinscription', d: 'dest-1' });
    const [corps, signature] = jeton.split('.');
    const faux = Buffer.from(JSON.stringify({ t: 'desinscription', d: 'dest-2' })).toString('base64url');
    expect(verifierLien(CLE, `${faux}.${signature}`)).toBeNull();
    expect(verifierLien(CLE, `${corps}.${signature}x`)).toBeNull();
    expect(verifierLien(AUTRE_CLE, jeton)).toBeNull();
    expect(verifierLien('', jeton)).toBeNull();
    expect(verifierLien(undefined as unknown as string, jeton)).toBeNull();
    expect(verifierLien(CLE, 'nimportequoi')).toBeNull();
    expect(verifierLien(CLE, '')).toBeNull();
    expect(verifierLien(CLE, 'a.b.c')).toBeNull();
  });

  it('refuse une charge expirée', () => {
    const jeton = signerLien(CLE, { t: 'confirmation', d: 'dest-1', n: 'envoi-1', e: 1000 });
    expect(verifierLien(CLE, jeton, 999)).toMatchObject({ t: 'confirmation', n: 'envoi-1' });
    expect(verifierLien(CLE, jeton, 1001)).toBeNull();
  });

  it('une confirmation porte la ligne d’envoi de sa demande (sécurité M1) : sans elle, refusée', () => {
    expect(verifierLien(CLE, signerLien(CLE, { t: 'confirmation', d: 'dest-1', e: 1000 }), 0)).toBeNull();
    expect(verifierLien(CLE, signerLien(CLE, { t: 'confirmation', d: 'dest-1', n: 12, e: 1000 } as never), 0)).toBeNull();
  });

  it('liensPour : jeton dans le fragment des pages (M6), dans la requête du POST en un clic ; 7 jours pour la confirmation', () => {
    const maintenant = Date.UTC(2026, 6, 20, 12, 0, 0);
    const liens = liensPour({ origine: 'https://exemple.fr', cle: CLE, destinataireId: 'dest-1', maintenant });
    expect(liens.desinscription).toMatch(/^https:\/\/exemple\.fr\/emails\/desinscription#j=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(liens.desinscriptionUnClic).toMatch(/^https:\/\/exemple\.fr\/api\/emails\/desinscription\?j=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const confirmation = liens.confirmation('envoi-7');
    expect(confirmation).toMatch(/^https:\/\/exemple\.fr\/emails\/confirmation#j=/);
    expect(new URL(liens.desinscription).search).toBe('');
    expect(new URL(confirmation).search).toBe('');
    const loin = maintenant + 400 * 86_400_000;
    expect(verifierLien(CLE, jetonDe(liens.desinscription), loin)).toEqual({ t: 'desinscription', d: 'dest-1' });
    expect(verifierLien(CLE, jetonDe(liens.desinscriptionUnClic), loin)).toEqual({ t: 'desinscription', d: 'dest-1' });
    const jeton = jetonDe(confirmation);
    expect(verifierLien(CLE, jeton, maintenant + 7 * 86_400_000)).toMatchObject({ t: 'confirmation', d: 'dest-1', n: 'envoi-7' });
    expect(verifierLien(CLE, jeton, maintenant + 7 * 86_400_000 + 1)).toBeNull();
  });

  it('je_viens : valable le 31/07 à 23:00 (Paris), invalide le 01/08 à 00:01', () => {
    const liens = liensPour({ origine: 'https://exemple.fr', cle: CLE, destinataireId: 'dest-1', maintenant: Date.UTC(2026, 6, 1) });
    const lien = liens.jeViens('cal-1', '2026-07-31');
    expect(lien).toMatch(/^https:\/\/exemple\.fr\/emails\/je-viens#j=/);
    const jeton = jetonDe(lien);
    // 31/07 23:00 Paris = 21:00 UTC (heure d’été) ; 01/08 00:01 Paris = 31/07 22:01 UTC
    expect(verifierLien(CLE, jeton, Date.UTC(2026, 6, 31, 21, 0))).toMatchObject({ t: 'je_viens', d: 'dest-1', c: 'cal-1' });
    expect(verifierLien(CLE, jeton, Date.UTC(2026, 6, 31, 22, 1))).toBeNull();
  });

  it('refuse un jeton malformé ou malléable (suffixes, dernier caractère de la signature)', () => {
    const jeton = signerLien(CLE, { t: 'desinscription', d: 'dest-1' });
    expect(verifierLien(CLE, jeton)).not.toBeNull();
    expect(verifierLien(CLE, `${jeton}!`)).toBeNull();
    expect(verifierLien(CLE, `${jeton}=`)).toBeNull();
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    const dernier = jeton.at(-1) as string;
    for (const autre of alphabet) {
      if (autre === dernier) continue;
      expect(verifierLien(CLE, `${jeton.slice(0, -1)}${autre}`)).toBeNull();
    }
  });

  it('refuse une clé faible', () => {
    expect(cleLiensValide('a'.repeat(64))).toBe(true);
    expect(cleLiensValide('A1'.repeat(32))).toBe(true);
    expect(cleLiensValide('x')).toBe(false);
    expect(cleLiensValide('a'.repeat(63))).toBe(false);
    expect(cleLiensValide('g'.repeat(64))).toBe(false);
    expect(cleLiensValide(undefined as unknown as string)).toBe(false);
    expect(() => signerLien('x', { t: 'desinscription', d: 'd' })).toThrow();
    expect(() => signerLien('g'.repeat(64), { t: 'desinscription', d: 'd' })).toThrow();
    expect(verifierLien('x', 'a.b')).toBeNull();
    expect(verifierLien('a'.repeat(63), signerLien(CLE, { t: 'desinscription', d: 'd' }))).toBeNull();
  });

  it('contrôle le type de lien', () => {
    const jeton = signerLien(CLE, { t: 'desinscription', d: 'd' });
    expect(verifierLien(CLE, jeton, Date.now(), 'desinscription')).not.toBeNull();
    expect(verifierLien(CLE, jeton, Date.now(), 'confirmation')).toBeNull();
    const sansCalendrier = signerLien(CLE, { t: 'je_viens', d: 'd', e: Date.now() + 1000 });
    expect(verifierLien(CLE, sansCalendrier)).toBeNull();
    const sansEcheance = signerLien(CLE, { t: 'je_viens', d: 'd', c: 'c' });
    expect(verifierLien(CLE, sansEcheance)).toBeNull();
    const inconnu = signerLien(CLE, { t: 'admin', d: 'd' } as unknown as Parameters<typeof signerLien>[1]);
    expect(verifierLien(CLE, inconnu)).toBeNull();
    const dNonChaine = signerLien(CLE, { t: 'desinscription', d: 12 } as unknown as Parameters<typeof signerLien>[1]);
    expect(verifierLien(CLE, dNonChaine)).toBeNull();
  });

  it('finDeJourParis : exportée, juste, et refuse les dates impossibles', () => {
    expect(finDeJourParis('2026-07-31')).toBe(Date.UTC(2026, 6, 31, 21, 59, 59, 999));
    expect(finDeJourParis('2026-10-25')).toBe(Date.UTC(2026, 9, 25, 22, 59, 59, 999));
    expect(() => finDeJourParis('2026-02-31')).toThrow(RangeError);
    expect(() => finDeJourParis('2026-13-01')).toThrow(RangeError);
    expect(() => finDeJourParis('n’importe quoi')).toThrow(RangeError);
    const liens = liensPour({ origine: 'https://exemple.fr', cle: CLE, destinataireId: 'd', maintenant: 0 });
    expect(verifierLien(CLE, jetonDe(liens.jeViens('c', '2026-07-31')), 0, 'je_viens')?.e).toBe(finDeJourParis('2026-07-31'));
  });

  it('je_viens : juste aux changements d’heure', () => {
    const liens = liensPour({ origine: 'https://exemple.fr', cle: CLE, destinataireId: 'd', maintenant: Date.UTC(2026, 0, 1) });
    // 25/10/2026 : passage à l’heure d’hiver (journée de 25 h). 23:59 Paris = 22:59 UTC.
    const hiver = jetonDe(liens.jeViens('c', '2026-10-25'));
    expect(verifierLien(CLE, hiver, Date.UTC(2026, 9, 25, 22, 58))).not.toBeNull();
    expect(verifierLien(CLE, hiver, Date.UTC(2026, 9, 25, 23, 1))).toBeNull();
    // 29/03/2026 : passage à l’heure d’été. 23:59 Paris = 21:59 UTC.
    const ete = jetonDe(liens.jeViens('c', '2026-03-29'));
    expect(verifierLien(CLE, ete, Date.UTC(2026, 2, 29, 21, 58))).not.toBeNull();
    expect(verifierLien(CLE, ete, Date.UTC(2026, 2, 29, 22, 1))).toBeNull();
  });
});
