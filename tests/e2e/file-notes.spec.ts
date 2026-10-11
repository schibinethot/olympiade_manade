import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const COMPTE = '00000000-0000-4000-8000-00000000000d';
const PASSAGE = '40000000-0000-4000-8000-00000000000a';
const SESSION = {
  access_token: 'jeton-spectateur-factice', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh-factice',
  user: { id: COMPTE, aud: 'authenticated', role: 'authenticated', email: 'lea@example.test',
    app_metadata: {}, user_metadata: { prenom: 'Léa' }, created_at: new Date().toISOString() },
};
const PLANNING = { generatedAt: new Date().toISOString(), fileActive: true, soirees: [{
  id: '20000000-0000-4000-8000-00000000000a', nom: 'Olympiade de test', date_soiree: '2026-10-11',
  mode_vote: 'deblocage', vote_debut: '2026-01-01T00:00:00Z', vote_fin: '2027-01-01T00:00:00Z', statut: 'en_cours', message_public: null,
  epreuves: [{ id: '30000000-0000-4000-8000-00000000000a', nom: 'Ferrade', ordre: 1, notee: true,
    passages: [{ id: PASSAGE, ordre: 1, statut_public: 'ouvert', manades: { nom: 'Vinuesa' } }] }],
}] };
function recu(id: string, statut: string, motif: string | null = null) {
  return { request_id: id, statut, soumise_le: new Date().toISOString(), confirmee_le: statut === 'confirmee' ? new Date().toISOString() : null, motif };
}
async function session(page: Page) {
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem('session-initialisee')) {
      localStorage.setItem('olympiade-auth', JSON.stringify(s)); sessionStorage.setItem('session-initialisee', 'true');
    }
  }, SESSION);
}
test.beforeEach(async ({ page }) => {
  // Aucune écriture réelle : toutes les API sont interceptées.
  await page.route('**/auth/v1/**', (r) => r.abort());
  await page.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }));
  await page.route('**/rest/v1/profils*', (r) => r.fulfill({ json: [{ prenom: 'Léa', role: 'spectateur' }] }));
  await page.route('**/api/notation/planning', (r) => r.fulfill({ json: PLANNING }));
  await session(page);
});

test('distingue réception et confirmation, puis reprend le suivi après rechargement', async ({ page }) => {
  let id = ''; let confirmer = false; let soumissions = 0;
  await page.route('**/rest/v1/rpc/mettre_note_en_file', (r) => {
    soumissions++; id = r.request().postDataJSON().p_request_id;
    return r.fulfill({ json: [recu(id, 'en_attente')] });
  });
  await page.route('**/rest/v1/rpc/lire_statuts_file_notes', (r) => r.fulfill({ json: [recu(id, confirmer ? 'confirmee' : 'en_attente')] }));
  await page.goto('/noter');
  const carte = page.getByRole('group', { name: 'Vinuesa', exact: true });
  await carte.getByRole('button', { name: '8 sur 10', exact: true }).click();
  await expect(carte.getByText('Note 8/10 reçue, en attente d’enregistrement.')).toBeVisible();
  await expect(carte.getByText('Note 8/10 enregistrée.', { exact: true })).toHaveCount(0);
  await page.reload();
  confirmer = true;
  await expect(carte.getByText('Note 8/10 enregistrée.', { exact: true })).toBeVisible({ timeout: 20_000 });
  expect(soumissions).toBe(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('notation.png'), fullPage: true });
});

test('garde la dernière correction hors ligne puis l’envoie après rechargement', async ({ page, context }) => {
  const envoyes: { p_note: number; p_request_id: string }[] = [];
  let autoriser = false;
  await page.route('**/rest/v1/rpc/mettre_note_en_file', (r) => {
    if (!autoriser) return r.abort();
    const action = r.request().postDataJSON(); envoyes.push(action);
    return r.fulfill({ json: [recu(action.p_request_id, 'confirmee')] });
  });
  await page.goto('/noter');
  const carte = page.getByRole('group', { name: 'Vinuesa', exact: true });
  await expect(carte.getByRole('button', { name: '8 sur 10', exact: true })).toBeEnabled();
  await context.setOffline(true);
  await carte.getByRole('button', { name: '8 sur 10', exact: true }).click();
  await expect(carte.getByText(/Note 8\/10 gardée/)).toBeVisible();
  await carte.getByRole('button', { name: '9 sur 10', exact: true }).click();
  await expect(carte.getByText(/Note 9\/10 gardée/)).toBeVisible();
  await context.setOffline(false);
  await page.reload();
  autoriser = true;
  await expect(carte.getByText('Note 9/10 enregistrée.', { exact: true })).toBeVisible({ timeout: 25_000 });
  expect(envoyes.length).toBeGreaterThan(0);
  expect(envoyes.every((a) => a.p_note === 9)).toBe(true);
  expect(new Set(envoyes.map((a) => a.p_request_id)).size).toBe(1);
});

test('un vote fermé est refusé sans fausse confirmation', async ({ page }) => {
  await page.route('**/rest/v1/rpc/mettre_note_en_file', (r) => r.fulfill({ json: [recu(r.request().postDataJSON().p_request_id, 'rejetee', 'vote_ferme')] }));
  await page.goto('/noter');
  const carte = page.getByRole('group', { name: 'Vinuesa', exact: true });
  await carte.getByRole('button', { name: '8 sur 10', exact: true }).click();
  await expect(carte.getByText('Vote fermé, note non prise en compte.')).toBeVisible();
  await expect(carte.getByText('Note 8/10 enregistrée.', { exact: true })).toHaveCount(0);
});

test('ne transmet pas la file du compte précédent après un changement de session', async ({ page, context }) => {
  let envois = 0;
  await page.route('**/rest/v1/rpc/mettre_note_en_file', (r) => { envois++; return r.fulfill({ json: [recu(r.request().postDataJSON().p_request_id, 'confirmee')] }); });
  await page.goto('/noter');
  const carte = page.getByRole('group', { name: 'Vinuesa', exact: true });
  await expect(carte.getByRole('button', { name: '8 sur 10', exact: true })).toBeEnabled();
  await context.setOffline(true);
  await carte.getByRole('button', { name: '8 sur 10', exact: true }).click();
  await expect(carte.getByText(/Note 8\/10 gardée/)).toBeVisible();
  await page.evaluate((s) => localStorage.setItem('olympiade-auth', JSON.stringify({ ...s, access_token: 'autre-compte', user: { ...s.user, id: '00000000-0000-4000-8000-00000000000e' } })), SESSION);
  // Ferme l'ancienne page avant le retour réseau pour reproduire une nouvelle session propre.
  await page.goto('about:blank');
  await context.setOffline(false);
  await page.goto('/noter');
  await expect(carte.getByText('Aucune note enregistrée.')).toBeVisible();
  expect(envois).toBe(0);
});

test('deux onglets partagent les envois et la dernière correction', async ({ page, context }) => {
  await page.unroute('**/rest/v1/**');
  await context.route('**/auth/v1/**', (r) => r.abort());
  await context.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }));
  await context.route('**/rest/v1/profils*', (r) => r.fulfill({ json: [{ prenom: 'Léa', role: 'spectateur' }] }));
  await context.route('**/api/notation/planning', (r) => r.fulfill({ json: PLANNING }));
  const envoyes = new Map<string, number>();
  let derniereNote = 0;
  await context.route('**/rest/v1/rpc/mettre_note_en_file', async (r) => {
    const { p_request_id: id, p_note: note } = r.request().postDataJSON();
    if (envoyes.has(id)) expect(envoyes.get(id)).toBe(note);
    envoyes.set(id, note); derniereNote = note;
    await r.fulfill({ json: [recu(id, 'confirmee')] });
  });
  await page.goto('/noter');
  const autre = await context.newPage();
  await autre.goto('/noter');
  const carte = page.getByRole('group', { name: 'Vinuesa', exact: true });
  const carteAutre = autre.getByRole('group', { name: 'Vinuesa', exact: true });
  await expect(carteAutre.getByRole('button', { name: '9 sur 10', exact: true })).toBeEnabled();
  await Promise.all([
    carte.getByRole('button', { name: '8 sur 10', exact: true }).click(),
    carteAutre.getByRole('button', { name: '9 sur 10', exact: true }).click(),
  ]);
  await expect.poll(() => envoyes.size).toBeGreaterThan(0);
  await expect(carte.getByText(/Note [89]\/10 enregistrée\./)).toBeVisible();
  await expect(carteAutre.getByText(/Note [89]\/10 enregistrée\./)).toBeVisible();
  await expect.poll(async () => (await carte.getByRole('status').textContent()) === (await carteAutre.getByRole('status').textContent())).toBe(true);
  await expect(carte.getByRole('status')).toHaveText(`Note ${derniereNote}/10 enregistrée.`);
});

test('un stockage bloqué affiche une erreur et n’envoie aucune note', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: { open() { throw new DOMException('Stockage bloqué', 'SecurityError'); } } });
  });
  let envois = 0;
  page.on('request', (r) => { if (r.url().includes('/rpc/mettre_note_en_file')) envois++; });
  await page.goto('/noter');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Le stockage de cet appareil est indisponible');
  await expect(page.getByRole('button', { name: '8 sur 10', exact: true })).toBeDisabled();
  expect(envois).toBe(0);
});

test('respecte Retry-After après un refus de débit et conserve le même identifiant', async ({ page }) => {
  await page.clock.install();
  const ids: string[] = [];
  await page.route('**/rest/v1/rpc/mettre_note_en_file', (r) => {
    const id = r.request().postDataJSON().p_request_id; ids.push(id);
    return ids.length === 1
      ? r.fulfill({ status: 429, headers: { 'Retry-After': '12', 'Access-Control-Expose-Headers': 'Retry-After' }, json: { message: 'Trop de requêtes' } })
      : r.fulfill({ json: [recu(id, 'confirmee')] });
  });
  await page.goto('/noter');
  const carte = page.getByRole('group', { name: 'Vinuesa', exact: true });
  await carte.getByRole('button', { name: '8 sur 10', exact: true }).click();
  await expect.poll(() => ids.length).toBe(1);
  await expect(carte.getByText(/Note 8\/10 gardée/)).toBeVisible();
  expect(ids).toHaveLength(1);
  await page.clock.runFor(10_000);
  expect(ids).toHaveLength(1);
  await page.clock.runFor(5000);
  await expect(carte.getByText('Note 8/10 enregistrée.', { exact: true })).toBeVisible();
  expect(ids).toEqual([ids[0], ids[0]]);
});
