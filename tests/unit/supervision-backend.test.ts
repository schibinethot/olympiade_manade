import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { creerSupervision, indexLatence, percentile95 } from '../../serveur/supervision.mjs';

const serveurs: Server[] = [];

afterEach(async () => {
  await Promise.all(
    serveurs.splice(0).map(
      (serveur) =>
        new Promise<void>((ok) => {
          serveur.close(() => ok());
        }),
    ),
  );
});

async function servir(supervision: ReturnType<typeof creerSupervision>): Promise<string> {
  const serveur = createServer((req, res) => {
    supervision.observerRequete(req, res);
    if (supervision.estRoute(req.url)) {
      supervision.repondre(req, res).catch(() => {
        res.statusCode = 500;
        res.end();
      });
      return;
    }
    res.writeHead(204, { 'Content-Length': '0' });
    res.end();
  });
  supervision.attacherServeur(serveur);
  serveurs.push(serveur);
  await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
  return `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
}

function json(valeur: unknown, statut = 200): Response {
  return new Response(JSON.stringify(valeur), {
    status: statut,
    headers: { 'content-type': 'application/json' },
  });
}

describe('histogramme de latence', () => {
  it('classe les bornes sans échantillons non bornés', () => {
    expect([0, 10, 10.1, 25, 3000, 9000].map(indexLatence)).toEqual([0, 0, 1, 1, 7, 8]);
  });

  it('calcule un p95 sur les comptes agrégés', () => {
    expect(percentile95([95, 5, 0, 0, 0, 0, 0, 0, 0])).toBe(10);
    expect(percentile95([94, 6, 0, 0, 0, 0, 0, 0, 0])).toBe(25);
    expect(percentile95([0, 0, 0, 0, 0, 0, 0, 0, 1])).toBe(3001);
    expect(percentile95(Array(9).fill(0))).toBeNull();
  });
});

describe('persistance agrégée', () => {
  it('écrit un seul agrégat borné après le changement de minute', async () => {
    let maintenant = Date.parse('2026-10-11T10:00:10Z');
    const fetchFn = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    const supervision = creerSupervision({
      supabaseUrl: 'https://projet.supabase.co',
      publishableKey: 'publique',
      serviceRoleKey: 'secrete-serveur',
      instanceId: 'srv-test',
      fetchFn,
      now: () => maintenant,
      timers: false,
    });
    const base = await servir(supervision);
    expect((await fetch(`${base}/une-page`)).status).toBe(204);

    maintenant = Date.parse('2026-10-11T10:01:01Z');
    supervision.avancer();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2)); // mesure puis nettoyage initial
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toContain('/rpc/enregistrer_metrique_serveur');
    const corps = JSON.parse(String(init?.body));
    expect(corps).toMatchObject({
      p_minute: '2026-10-11T10:00:00.000Z',
      p_instance_id: 'srv-test',
      p_requetes: 1,
      p_erreurs_5xx: 0,
      p_octets_reponse: 0,
    });
    expect(corps.p_latences).toHaveLength(9);
    expect(corps.p_latences.reduce((somme: number, n: number) => somme + n, 0)).toBe(1);

    supervision.avancer();
    await new Promise((ok) => setTimeout(ok, 0));
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe('endpoint administrateur de supervision', () => {
  it('refuse sans Bearer avant tout appel Supabase', async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const supervision = creerSupervision({
      supabaseUrl: 'https://projet.supabase.co',
      publishableKey: 'publique',
      fetchFn,
      timers: false,
    });
    const base = await servir(supervision);
    const reponse = await fetch(`${base}/api/admin/supervision`);
    expect(reponse.status).toBe(401);
    expect(reponse.headers.get('cache-control')).toBe('no-store');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('revérifie le rôle dans profils et refuse un spectateur malgré son JWT', async () => {
    const fetchFn = vi.fn<typeof fetch>(async (url) => {
      if (String(url).endsWith('/auth/v1/user')) return json({ id: 'utilisateur-1', user_metadata: { role: 'admin' } });
      if (String(url).includes('/rest/v1/profils?')) return json([{ id: 'utilisateur-1', role: 'spectateur' }]);
      throw new Error(`appel inattendu ${url}`);
    });
    const supervision = creerSupervision({
      supabaseUrl: 'https://projet.supabase.co',
      publishableKey: 'publique',
      fetchFn,
      timers: false,
    });
    const base = await servir(supervision);
    const reponse = await fetch(`${base}/api/admin/supervision`, {
      headers: { Authorization: 'Bearer entete.charge.signature' },
    });
    expect(reponse.status).toBe(403);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(fetchFn.mock.calls.some(([url]) => String(url).includes('lire_supervision'))).toBe(false);
  });

  it('retourne uniquement les agrégats à un admin et borne la fenêtre à 1 ou 24 h', async () => {
    const snapshot = {
      activeUsers: { authenticatedLast2m: 12, profilesTotal: 30, lastHeartbeatAt: '2026-10-11T10:00:00Z' },
      votes: {
        public: { total: 20, modifiedLast5m: 3, modifiedLastHour: 10 },
        jury: { total: 4, modifiedLast5m: 1, modifiedLastHour: 2 },
      },
      database: { sizeBytes: 1234, connections: { current: 5, max: 60 } },
      serverHistory: [
        {
          minute: '2026-10-11T10:00:00Z',
          requests: 100,
          errors5xx: 2,
          responseBytes: 5000,
          cpuMs: 80,
          rssBytes: 1000,
          eventLoopLagMs: 4,
          inflightMax: 8,
          httpConnectionsMax: 20,
          authenticatedActiveUsers: 12,
          instances: 1,
          p95Ms: 100,
        },
      ],
    };
    const fetchFn = vi.fn<typeof fetch>(async (url) => {
      if (String(url).endsWith('/auth/v1/user')) return json({ id: 'admin-1' });
      if (String(url).includes('/rest/v1/profils?')) return json([{ id: 'admin-1', role: 'admin' }]);
      if (String(url).endsWith('/rest/v1/rpc/lire_supervision')) return json(snapshot);
      if (String(url).endsWith('/rest/v1/rpc/lire_statistiques_file_notes')) return json({ queued: 42, workersActive: 2 });
      throw new Error(`appel inattendu ${url}`);
    });
    const supervision = creerSupervision({
      supabaseUrl: 'https://projet.supabase.co',
      publishableKey: 'publique',
      serviceRoleKey: 'secrete-serveur',
      fetchFn,
      timers: false,
    });
    const base = await servir(supervision);
    const reponse = await fetch(`${base}/api/admin/supervision?heures=999`, {
      headers: { Authorization: 'Bearer entete.charge.signature' },
    });
    expect(reponse.status).toBe(200);
    const corps = await reponse.json();
    expect(corps.windowHours).toBe(1);
    expect(corps.sources).toMatchObject({
      databaseStatus: 'available',
      serverPersistence: 'available',
      supabaseBandwidth: 'unknown',
    });
    expect(corps.activeUsers.authenticatedLast2m).toBe(12);
    expect(corps.fileNotes).toEqual({ queued: 42, workersActive: 2 });
    expect(corps.server.history).toEqual(snapshot.serverHistory);
    expect(corps.server.totals).toMatchObject({ requests: 100, errors5xx: 2, responseBytes: 5000, cpuMs: 80 });
    const appelRpc = fetchFn.mock.calls.find(([url]) => String(url).includes('lire_supervision'));
    expect(JSON.parse(String(appelRpc?.[1]?.body))).toEqual({ p_heures: 1 });
  });

  it('reste utilisable avec les mesures locales si le RPC de statistiques est indisponible', async () => {
    const fetchFn = vi.fn<typeof fetch>(async (url) => {
      if (String(url).endsWith('/auth/v1/user')) return json({ id: 'admin-1' });
      if (String(url).includes('/rest/v1/profils?')) return json([{ id: 'admin-1', role: 'admin' }]);
      if (String(url).endsWith('/rest/v1/rpc/lire_supervision')) return json({ message: 'missing' }, 404);
      throw new Error(`appel inattendu ${url}`);
    });
    const supervision = creerSupervision({
      supabaseUrl: 'https://projet.supabase.co',
      publishableKey: 'publique',
      fetchFn,
      timers: false,
    });
    const base = await servir(supervision);
    await fetch(`${base}/une-page`);
    const reponse = await fetch(`${base}/api/admin/supervision?heures=24`, {
      headers: { Authorization: 'Bearer entete.charge.signature' },
    });
    const corps = await reponse.json();
    expect(reponse.status).toBe(200);
    expect(corps.sources.databaseStatus).toBe('error');
    expect(corps.database.sizeBytes).toBeNull();
    expect(corps.activeUsers.authenticatedLast2m).toBeNull();
    expect(corps.server.history.length).toBeGreaterThan(0);
    expect(corps.server.totals.requests).toBeGreaterThanOrEqual(1);
  });

  it('applique une limite de débit bornée', async () => {
    const supervision = creerSupervision({
      supabaseUrl: 'https://projet.supabase.co',
      publishableKey: 'publique',
      fetchFn: vi.fn<typeof fetch>(),
      ratePerMinute: 1,
      timers: false,
    });
    const base = await servir(supervision);
    expect((await fetch(`${base}/api/admin/supervision`)).status).toBe(401);
    expect((await fetch(`${base}/api/admin/supervision`)).status).toBe(429);
  });
});
