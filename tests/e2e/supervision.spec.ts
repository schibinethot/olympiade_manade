import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const SESSION = {
  access_token: 'jeton-admin-factice', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh-factice',
  user: { id: '00000000-0000-4000-8000-00000000000a', aud: 'authenticated', role: 'authenticated',
    email: 'admin@example.test', app_metadata: {}, user_metadata: { prenom: 'Camille', role: 'admin' }, created_at: new Date().toISOString() },
};
const MESURE = { minute: '2026-10-11T10:00:00Z', requests: 120, errors5xx: 2,
  responseBytes: 1500000, cpuMs: 150, rssBytes: 45000000, eventLoopLagMs: 2,
  inflightMax: 5, httpConnectionsMax: 10, instances: 1, p95Ms: 25 };
const STATS = {
  generatedAt: '2026-10-11T10:01:00Z', windowHours: 1,
  sources: { serverPersistence: 'unconfigured', databaseStatus: 'available', supabaseBandwidth: 'unknown' },
  activeUsers: { authenticatedLast2m: 427, profilesTotal: 820, lastHeartbeatAt: '2026-10-11T10:00:59Z' },
  votes: { public: { total: 8000, modifiedLast5m: 250, modifiedLastHour: 3000 }, jury: { total: 32, modifiedLast5m: 2, modifiedLastHour: 10 } },
  database: { sizeBytes: 50000000, connections: { current: 8, max: 60 } },
  fileNotes: { queued: 123, oldestQueuedAt: '2026-10-11T10:00:57Z', confirmedLast5m: 600, confirmedLastHour: 2400, rejectedLastHour: 3, workersActive: 2, lastWorkerAt: '2026-10-11T10:01:00Z' },
  server: { current: { inflight: 1, httpConnections: 2, rssBytes: 45000000, eventLoopLagMs: 2 },
    totals: { requests: 120, errors5xx: 2, responseBytes: 1500000, cpuMs: 150 },
    latencyMs: { p95: 25 }, history: [MESURE, { ...MESURE, minute: '2026-10-11T10:01:00Z', requests: 80 }] },
};

test.beforeEach(async ({ page }) => {
  // Aucune identité ni écriture réelle : toutes les API de Supabase sont interceptées.
  await page.route('**/auth/v1/**', (r) => r.abort());
  await page.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }));
});
async function ouvrirSession(page: Page, role = 'admin') {
  await page.addInitScript((session) => localStorage.setItem('olympiade-auth', JSON.stringify(session)), SESSION);
  await page.route('**/rest/v1/profils*', (r) => r.fulfill({ json: [{ prenom: 'Camille', role }] }));
}
async function mesures(page: Page) {
  await page.route('**/api/admin/supervision*', (r) => r.fulfill({ json: STATS }));
}

test('un visiteur doit se connecter et ne demande aucune statistique', async ({ page }) => {
  let lectures = 0;
  page.on('request', (r) => { if (r.url().includes('/api/admin/supervision')) lectures++; });
  await page.goto('/admin/statistiques');
  await expect(page.getByText('Connectez-vous pour consulter les statistiques.')).toBeVisible();
  expect(lectures).toBe(0);
  await page.getByRole('link', { name: 'Accéder à l’administration' }).click();
  await expect(page.getByLabel('Email administrateur')).toBeVisible();
});

test('le rôle de user_metadata ne donne pas accès au back-office', async ({ page }) => {
  await ouvrirSession(page, 'spectateur');
  let lectures = 0;
  page.on('request', (r) => { if (r.url().includes('/api/admin/supervision')) lectures++; });
  await page.goto('/admin/statistiques');
  await expect(page.getByText('Ces statistiques sont réservées aux administrateurs.')).toBeVisible();
  expect(lectures).toBe(0);
});

test('connexion administrateur par mot de passe puis ouverture des statistiques', async ({ page }) => {
  let envoyes: Record<string, unknown> | null = null;
  await page.route('**/auth/v1/token*', async (r) => {
    envoyes = r.request().postDataJSON();
    await r.fulfill({ json: SESSION });
  });
  await page.route('**/rest/v1/profils*', (r) => r.fulfill({ json: [{ prenom: 'Camille', role: 'admin' }] }));
  await mesures(page);
  await page.goto('/admin');
  await page.getByLabel('Email administrateur').fill('admin@example.test');
  await page.getByLabel('Mot de passe').fill('mot-de-passe-factice');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.getByRole('link', { name: 'Statistiques et charge →' }).click();
  await expect(page.getByText('427', { exact: true })).toBeVisible();
  expect(envoyes).toMatchObject({ email: 'admin@example.test', password: 'mot-de-passe-factice' });
});

test('statistiques accessibles sur mobile et desktop, sources honnêtes et export CSV', async ({ page }) => {
  await ouvrirSession(page);
  await mesures(page);
  await page.goto('/admin/statistiques');
  await expect(page.getByText('427', { exact: true })).toBeVisible();
  await expect(page.getByText('Capacité à valider par un test de charge')).toBeVisible();
  await expect(page.getByText(/Historique permanent non configuré/)).toBeVisible();
  await expect(page.getByText('Non mesurés ici')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'File d’attente des notes', exact: true })).toBeVisible();
  await expect(page.getByText('123', { exact: true })).toBeVisible();
  await expect(page.getByText('Notes en attente', { exact: true })).toBeVisible();
  const requete = page.waitForRequest((r) => r.url().includes('/api/admin/supervision?heures=24'));
  await page.getByRole('button', { name: '24 heures', exact: true }).click();
  expect((await requete).headers().authorization).toBe('Bearer jeton-admin-factice');
  await expect(page.getByText('427', { exact: true })).toBeVisible();
  const telechargement = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter les mesures' }).click();
  expect((await telechargement).suggestedFilename()).toBe('supervision-2026-10-11-24h.csv');
  const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations;
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('une panne conserve les dernières mesures avec avertissement, une révocation les efface', async ({ page }) => {
  await ouvrirSession(page);
  let statut = 200;
  await page.route('**/api/admin/supervision*', (r) => r.fulfill({ status: statut, json: statut === 200 ? STATS : { error: 'unavailable' } }));
  await page.goto('/admin/statistiques');
  await expect(page.getByText('427', { exact: true })).toBeVisible();
  statut = 503;
  await page.getByRole('button', { name: 'Actualiser', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Les dernières mesures connues restent affichées');
  await expect(page.getByText('427', { exact: true })).toBeVisible();
  statut = 403;
  await page.getByRole('button', { name: 'Actualiser', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('n’est plus administrateur');
  await expect(page.getByText('427', { exact: true })).toHaveCount(0);
});

test('la présence est espacée et suspendue lorsque l’onglet est masqué', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => { Math.random = () => 0; });
  await ouvrirSession(page);
  let signaux = 0;
  await page.route('**/rest/v1/rpc/enregistrer_presence', (r) => { signaux++; return r.fulfill({ json: null }); });
  await page.goto('/admin');
  await expect(page.getByRole('link', { name: 'Statistiques et charge →' })).toBeVisible();
  await expect.poll(() => signaux).toBe(1);
  await page.clock.runFor(20_000);
  expect(signaux).toBe(1);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.runFor(90_000);
  expect(signaux).toBe(1);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.runFor(1);
  await expect.poll(() => signaux).toBe(2);
});
