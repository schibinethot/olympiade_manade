import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { creerPlanningNotation } from '../../serveur/planning-notation.mjs';

const serveurs: Server[] = [];
afterEach(async () => { await Promise.all(serveurs.splice(0).map((s) => new Promise<void>((resolve) => { s.closeAllConnections(); s.close(() => resolve()); }))); });
async function ouvrir(options: Parameters<typeof creerPlanningNotation>[0]) {
  const planning = creerPlanningNotation(options);
  const serveur = createServer((req, res) => { void planning.repondre(req, res); });
  serveurs.push(serveur);
  await new Promise<void>((resolve) => serveur.listen(0, '127.0.0.1', resolve));
  const adresse = serveur.address();
  if (!adresse || typeof adresse === 'string') throw new Error('adresse absente');
  return `http://127.0.0.1:${adresse.port}/api/notation/planning`;
}

describe('cache public du planning', () => {
  it('regroupe une rafale et ne relaie ni session spectateur ni clé serveur', async () => {
    let maintenant = Date.now();
    const lire = vi.fn(async () => new Response(JSON.stringify([{ id: 'soiree-publique' }])));
    const adresse = await ouvrir({ url: 'https://projet.supabase.co', clePublique: 'cle-publique', fileActive: true, fetch: lire as typeof fetch, maintenant: () => maintenant });
    const reponses = await Promise.all(Array.from({ length: 50 }, () => fetch(adresse, { headers: { Authorization: 'Bearer secret-spectateur' } })));
    expect(reponses.every((r) => r.status === 200)).toBe(true);
    expect(lire).toHaveBeenCalledTimes(1);
    expect((await reponses[0].json()).fileActive).toBe(true);
    const options = lire.mock.calls[0] as unknown as [URL, RequestInit];
    expect(options[1].headers).toEqual({ apikey: 'cle-publique' });
    expect(options[0].searchParams.get('statut')).toBe('in.(publiee,en_cours)');
    maintenant += 5001;
    await fetch(adresse);
    expect(lire).toHaveBeenCalledTimes(2);
  });

  it('amortit aussi une panne et reprend après cinq secondes', async () => {
    let maintenant = Date.now();
    const lire = vi.fn().mockRejectedValueOnce(new Error('panne')).mockResolvedValue(new Response('[]'));
    const adresse = await ouvrir({ url: 'https://projet.supabase.co', clePublique: 'public', fetch: lire, maintenant: () => maintenant });
    const reponses = await Promise.all(Array.from({ length: 20 }, () => fetch(adresse)));
    expect(reponses.every((r) => r.status === 503)).toBe(true);
    expect(reponses[0].headers.get('retry-after')).toBe('5');
    await fetch(adresse);
    expect(lire).toHaveBeenCalledTimes(1);
    maintenant += 5001;
    expect((await fetch(adresse)).status).toBe(200);
    expect(lire).toHaveBeenCalledTimes(2);
  });

  it('refuse les écritures et un payload public trop volumineux', async () => {
    const lire = vi.fn(async () => new Response('x'.repeat(1_000_001)));
    const adresse = await ouvrir({ url: 'https://projet.supabase.co', clePublique: 'public', fetch: lire as typeof fetch });
    expect((await fetch(adresse, { method: 'POST' })).status).toBe(405);
    expect(lire).not.toHaveBeenCalled();
    expect((await fetch(adresse)).status).toBe(503);
  });
});
