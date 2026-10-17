import { describe, expect, it } from 'vitest';
import { signerLien, verifierLien, liensPour } from '../../serveur/liens-emails.mjs';

const CLE = 'a'.repeat(64);
const AUTRE_CLE = 'b'.repeat(64);

function jetonDe(url: string) {
  return new URL(url).searchParams.get('j') as string;
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
    const jeton = signerLien(CLE, { t: 'confirmation', d: 'dest-1', e: 1000 });
    expect(verifierLien(CLE, jeton, 999)).toMatchObject({ t: 'confirmation' });
    expect(verifierLien(CLE, jeton, 1001)).toBeNull();
  });

  it('liensPour : URLs, absence d’expiration pour la désinscription, 7 jours pour la confirmation', () => {
    const maintenant = Date.UTC(2026, 6, 20, 12, 0, 0);
    const liens = liensPour({ origine: 'https://exemple.fr', cle: CLE, destinataireId: 'dest-1', maintenant });
    expect(liens.desinscription).toMatch(/^https:\/\/exemple\.fr\/emails\/desinscription\?j=/);
    expect(liens.desinscriptionUnClic).toMatch(/^https:\/\/exemple\.fr\/api\/emails\/desinscription\?j=/);
    expect(liens.confirmation).toMatch(/^https:\/\/exemple\.fr\/emails\/confirmation\?j=/);
    const loin = maintenant + 400 * 86_400_000;
    expect(verifierLien(CLE, jetonDe(liens.desinscription), loin)).toEqual({ t: 'desinscription', d: 'dest-1' });
    expect(verifierLien(CLE, jetonDe(liens.desinscriptionUnClic), loin)).toEqual({ t: 'desinscription', d: 'dest-1' });
    const jeton = jetonDe(liens.confirmation);
    expect(verifierLien(CLE, jeton, maintenant + 7 * 86_400_000)).toMatchObject({ t: 'confirmation', d: 'dest-1' });
    expect(verifierLien(CLE, jeton, maintenant + 7 * 86_400_000 + 1)).toBeNull();
  });

  it('je_viens : valable le 31/07 à 23:00 (Paris), invalide le 01/08 à 00:01', () => {
    const liens = liensPour({ origine: 'https://exemple.fr', cle: CLE, destinataireId: 'dest-1', maintenant: Date.UTC(2026, 6, 1) });
    const lien = liens.jeViens('cal-1', '2026-07-31');
    expect(lien).toMatch(/^https:\/\/exemple\.fr\/emails\/je-viens\?j=/);
    const jeton = jetonDe(lien);
    // 31/07 23:00 Paris = 21:00 UTC (heure d’été) ; 01/08 00:01 Paris = 31/07 22:01 UTC
    expect(verifierLien(CLE, jeton, Date.UTC(2026, 6, 31, 21, 0))).toMatchObject({ t: 'je_viens', d: 'dest-1', c: 'cal-1' });
    expect(verifierLien(CLE, jeton, Date.UTC(2026, 6, 31, 22, 1))).toBeNull();
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
