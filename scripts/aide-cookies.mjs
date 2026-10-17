#!/usr/bin/env node
/**
 * Génère les captures et la vidéo de l'onglet « Comment ça marche » de
 * /admin/cookies dans public/aide/cookies/ :
 *   - captures PNG → WebP + AVIF (mobile 390×, ordinateur 960×), modes
 *     fenêtre / barre / aucun / préférences
 *   - vidéo du parcours visiteur enregistrée par Playwright, puis convertie
 *     en MP4 H.264 yuv420p faststart (≤ 3 Mo, sans son)
 *   - affiche de la vidéo (parcours-affiche.webp)
 *
 * Pré-requis : serveur de prod local sur http://localhost:4180
 * (lancer scripts/serveur.sh ou l'équivalent du scratchpad), ffmpeg,
 * cwebp et avifenc disponibles dans le PATH.
 *
 * Lancer : node scripts/aide-cookies.mjs
 */

import { chromium, devices } from '/Users/tpmge/Dev/olympiade_manade-cookies/node_modules/@playwright/test/index.mjs';
import { mkdirSync, readdirSync, renameSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { argv, exit } from 'node:process';

const BASE = 'http://localhost:4180';
const SORTIE = '/Users/tpmge/Dev/olympiade_manade-cookies/public/aide/cookies';
const TMP = join(tmpdir(), 'aide-cookies-' + Date.now());
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const CWEBP = '/opt/homebrew/bin/cwebp';
const AVIFENC = '/opt/homebrew/bin/avifenc';

mkdirSync(SORTIE, { recursive: true });
mkdirSync(TMP, { recursive: true });

const APPAREILS = [
  { nom: 'mobile', viewport: { width: 390, height: 720 } },
  { nom: 'ordinateur', viewport: { width: 960, height: 640 } },
];

const SETTINGS = {
  titre: 'Confidentialité',
  description:
    "Nous mesurons l’audience du site pour améliorer nos pages. Aucun cookie de publicité n’est déposé sans votre accord.",
  texteToutAccepter: 'Tout accepter',
  texteRefuser: 'Tout refuser',
  textePersonnaliser: 'Personnaliser',
  texteEnregistrer: 'Enregistrer mes choix',
  urlConfidentialite: '/confidentialite',
  mesureActive: true,
  mesureTitre: 'Mesure d’audience',
  mesureDescription: 'Mesure anonyme de la fréquentation (compteurs de visites, pages consultées).',
  publiciteActive: true,
  publiciteTitre: 'Publicité et réseaux sociaux',
  publiciteDescription: 'Ciblage publicitaire si vous l’acceptez. Sinon, rien n’est déposé.',
  dureeConsentementJours: 365,
};

/** Mock de la session administrateur AAL2 (aligné sur tests/e2e/preparation.spec.ts). */
function sessionAdmin() {
  const encoder = (valeur) => Buffer.from(JSON.stringify(valeur)).toString('base64url');
  const jeton = `${encoder({ alg: 'HS256', typ: 'JWT' })}.${encoder({
    sub: '00000000-0000-4000-8000-00000000000a',
    aal: 'aal2',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.c2lnbmF0dXJl`;
  return {
    access_token: jeton,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'refresh-factice',
    user: {
      id: '00000000-0000-4000-8000-00000000000a',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'admin@example.test',
      factors: [{ id: 'totp-admin', factor_type: 'totp', status: 'verified', friendly_name: 'Administration' }],
      app_metadata: {},
      user_metadata: { prenom: 'Camille', role: 'admin' },
      created_at: new Date().toISOString(),
    },
  };
}

async function creerContexteVisiteur(navigateur, viewport, options = {}) {
  const contexte = await navigateur.newContext({ viewport, ...options });
  await contexte.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
  });
  await contexte.route('**/api/cookie-consent/settings', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SETTINGS) }),
  );
  await contexte.route('**/api/cookie-consent/log', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
  );
  await contexte.route('**/auth/v1/**', (route) => route.abort());
  return contexte;
}

function convertirImage(sourcePng, basenameSansExt) {
  const webp = join(SORTIE, `${basenameSansExt}.webp`);
  const avif = join(SORTIE, `${basenameSansExt}.avif`);
  execFileSync(CWEBP, ['-q', '82', '-m', '6', sourcePng, '-o', webp], { stdio: 'ignore' });
  execFileSync(AVIFENC, ['--min', '28', '--max', '36', '--speed', '6', sourcePng, avif], { stdio: 'ignore' });
}

// ---------------------------------------------------------------------------
// 1. Captures
// ---------------------------------------------------------------------------

async function capturerModes(navigateur) {
  console.log('[captures] démarrage');
  for (const appareil of APPAREILS) {
    const contexte = await creerContexteVisiteur(navigateur, appareil.viewport);
    const page = await contexte.newPage();

    // Fenêtre (/)
    await page.goto(`${BASE}/`);
    await page.locator('#cc-main .cm').waitFor({ state: 'visible' });
    await page.waitForTimeout(500);
    const pngFenetre = join(TMP, `${appareil.nom}-fenetre.png`);
    await page.locator('#cc-main .cm').screenshot({ path: pngFenetre });
    convertirImage(pngFenetre, `${appareil.nom}-fenetre`);

    // Préférences (clic sur Personnaliser)
    await page.locator('#cc-main .cm__btn[data-role="show"]').click();
    await page.locator('#cc-main .pm').waitFor({ state: 'visible' });
    await page.waitForTimeout(500);
    const pngPrefs = join(TMP, `${appareil.nom}-preferences.png`);
    await page.locator('#cc-main .pm').screenshot({ path: pngPrefs });
    convertirImage(pngPrefs, `${appareil.nom}-preferences`);

    // Barre (/noter)
    await contexte.clearCookies();
    await page.goto(`${BASE}/noter`);
    await page.locator('#cc-main .cm').waitFor({ state: 'visible' });
    await page.waitForTimeout(500);
    const pngBarre = join(TMP, `${appareil.nom}-bandeau.png`);
    // Capture plein viewport pour voir la barre en contexte de page.
    await page.screenshot({ path: pngBarre, clip: {
      x: 0,
      y: Math.max(0, appareil.viewport.height - 240),
      width: appareil.viewport.width,
      height: Math.min(240, appareil.viewport.height),
    } });
    convertirImage(pngBarre, `${appareil.nom}-bandeau`);

    // Aucun bandeau (/ecran/*)
    await contexte.clearCookies();
    await page.goto(`${BASE}/ecran/nimes-2027`);
    await page.waitForTimeout(800);
    const pngAucun = join(TMP, `${appareil.nom}-aucun.png`);
    await page.screenshot({ path: pngAucun, fullPage: false });
    convertirImage(pngAucun, `${appareil.nom}-aucun`);

    await contexte.close();
    console.log(`[captures] ${appareil.nom} ✓`);
  }
}

// ---------------------------------------------------------------------------
// 2. Vidéo
// ---------------------------------------------------------------------------

const SCRIPT_CURSEUR = () => {
  const curseur = document.createElement('div');
  curseur.setAttribute('aria-hidden', 'true');
  curseur.style.cssText =
    'position:fixed;z-index:2147483647;pointer-events:none;left:0;top:0;width:28px;height:28px;background:rgba(28,25,18,.85);border:2px solid #f7f4ed;border-radius:50%;box-shadow:0 2px 10px rgba(0,0,0,.35);transition:left .4s ease,top .4s ease,transform .15s ease;transform:translate(-50%,-50%);';
  document.body.appendChild(curseur);
  // Trace sillon derrière le curseur
  window.__aideBougerCurseur = (x, y) => {
    curseur.style.left = x + 'px';
    curseur.style.top = y + 'px';
  };
  window.__aideCliquerCurseur = () => {
    curseur.style.transform = 'translate(-50%,-50%) scale(.72)';
    setTimeout(() => (curseur.style.transform = 'translate(-50%,-50%)'), 180);
  };
};

const SCRIPT_LEGENDE = (texte) => {
  let bulle = document.getElementById('aide-legende');
  if (!bulle) {
    bulle = document.createElement('div');
    bulle.id = 'aide-legende';
    bulle.style.cssText =
      'position:fixed;left:50%;top:24px;transform:translateX(-50%);z-index:2147483646;background:#1c1912;color:#f7f4ed;font:600 15px/1.3 Inter,system-ui,sans-serif;padding:10px 18px;border-radius:999px;box-shadow:0 10px 32px rgba(28,25,18,.4);max-width:92vw;text-align:center;pointer-events:none;';
    document.body.appendChild(bulle);
  }
  bulle.textContent = texte;
};

async function bougerCurseurVers(page, locator) {
  const box = await locator.boundingBox();
  if (!box) return;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.evaluate(([x, y]) => window.__aideBougerCurseur(x, y), [x, y]);
  await page.waitForTimeout(450);
  await page.mouse.move(x, y);
  return { x, y };
}

async function cliquerAvecCurseur(page, locator) {
  await bougerCurseurVers(page, locator);
  await page.evaluate(() => window.__aideCliquerCurseur());
  await page.waitForTimeout(140);
  await locator.click();
}

async function enregistrerVideo(navigateur) {
  console.log('[vidéo] démarrage');
  const dossierVideo = join(TMP, 'videos');
  mkdirSync(dossierVideo, { recursive: true });
  const contexte = await navigateur.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: dossierVideo, size: { width: 1280, height: 720 } },
  });
  await contexte.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
  });
  await contexte.route('**/api/cookie-consent/settings', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SETTINGS) }),
  );
  await contexte.route('**/api/cookie-consent/log', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
  );
  await contexte.route('**/auth/v1/**', (route) => route.abort());
  // Compte admin simulé : chargé plus bas, uniquement avant /admin/cookies.
  const session = sessionAdmin();
  await contexte.route('**/auth/v1/user', (route) =>
    route.fulfill({ json: session.user }),
  );
  await contexte.route('**/rest/v1/profils*', (route) =>
    route.fulfill({ json: [{ id: session.user.id, prenom: 'Camille', role: 'admin' }] }),
  );
  // Données factices pour admin/cookies : paramètres, stats, journal.
  await contexte.route('**/rest/v1/parametres_cookies*', (route) =>
    route.fulfill({ json: { id: 1, ...Object.fromEntries(Object.entries(SETTINGS).map(([k, v]) => [k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase()), v])) } }),
  );
  await contexte.route('**/rest/v1/consentements_cookies*', (route) =>
    route.fulfill({
      headers: { 'content-range': '0-2/3', 'access-control-expose-headers': 'content-range' },
      json: [
        { id: '00000000-0000-4000-8000-00000000000f', visiteur_id: 'v_demo_1', ip_hachee: 'h_demo', agent_utilisateur: 'Chrome', consentement_donne: true, mesure_acceptee: true, publicite_acceptee: false, action: 'custom', url_page: 'https://exemple/', provenance: null, cree_le: new Date().toISOString() },
        { id: '00000000-0000-4000-8000-00000000000e', visiteur_id: 'v_demo_2', ip_hachee: 'h_demo', agent_utilisateur: 'Safari', consentement_donne: true, mesure_acceptee: true, publicite_acceptee: true, action: 'accept_all', url_page: 'https://exemple/noter', provenance: null, cree_le: new Date().toISOString() },
        { id: '00000000-0000-4000-8000-00000000000d', visiteur_id: 'v_demo_3', ip_hachee: 'h_demo', agent_utilisateur: 'Firefox', consentement_donne: false, mesure_acceptee: false, publicite_acceptee: false, action: 'reject_all', url_page: 'https://exemple/', provenance: null, cree_le: new Date().toISOString() },
      ],
    }),
  );

  const page = await contexte.newPage();

  // ---- 0. Carton titre
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><title>Parcours cookies</title><style>
    html,body{margin:0;height:100%;background:#f7f4ed;color:#1c1912;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;}
    .carte{padding:48px 56px;text-align:center;}
    .surtitre{font-size:14px;font-weight:700;letter-spacing:.22em;color:#88693c;text-transform:uppercase;}
    .titre{font:400 56px/1.1 "Playfair Display",Georgia,serif;margin:16px 0 14px;}
    .sous{font-size:20px;color:#5a5246;}
  </style></head><body><div class="carte"><div class="surtitre">Olympiade des Manades</div><div class="titre">Le parcours cookies</div><div class="sous">30 secondes, du choix du visiteur à votre tableau de bord.</div></div></body></html>`);
  await page.waitForTimeout(2400);

  // ---- 1. Accueil, fenêtre apparaît
  await page.goto(`${BASE}/`);
  await page.locator('#cc-main .cm').waitFor({ state: 'visible' });
  await page.evaluate(SCRIPT_CURSEUR);
  await page.evaluate(SCRIPT_LEGENDE, "1 · Le visiteur arrive sur l'accueil");
  await page.waitForTimeout(1500);

  // ---- 2. Clic sur Personnaliser
  await page.evaluate(SCRIPT_LEGENDE, '2 · Il clique sur Personnaliser');
  await cliquerAvecCurseur(page, page.locator('#cc-main .cm__btn[data-role="show"]'));
  await page.locator('#cc-main .pm').waitFor({ state: 'visible' });
  await page.evaluate(SCRIPT_CURSEUR);
  await page.evaluate(SCRIPT_LEGENDE, '2 · Il clique sur Personnaliser');
  await page.waitForTimeout(1300);

  // ---- 3. Active Mesure d'audience
  await page.evaluate(SCRIPT_LEGENDE, "3 · Il active la mesure d'audience");
  // L'input analytics est le 2e section__toggle (après necessary, readonly).
  const toggleAnalytics = page.locator('#cc-main input.section__toggle[value="analytics"]').first();
  await bougerCurseurVers(page, toggleAnalytics);
  await page.evaluate(() => window.__aideCliquerCurseur());
  await page.waitForTimeout(140);
  await toggleAnalytics.click({ force: true });
  await page.waitForTimeout(1200);

  // ---- 4. Clique Enregistrer
  await page.evaluate(SCRIPT_LEGENDE, '4 · Il enregistre ses choix');
  await cliquerAvecCurseur(page, page.locator('#cc-main .pm__btn[data-role="save"]'));
  await page.waitForTimeout(1300);

  // ---- 5. /noter, barre basse
  await contexte.clearCookies();
  await page.goto(`${BASE}/noter`);
  await page.locator('#cc-main .cm').waitFor({ state: 'visible' });
  await page.evaluate(SCRIPT_CURSEUR);
  await page.evaluate(SCRIPT_LEGENDE, '5 · Sur « Noter en direct » : barre basse, page utilisable');
  await page.waitForTimeout(1800);

  // ---- 6. Tout refuser
  await page.evaluate(SCRIPT_LEGENDE, '6 · Cette fois il refuse tout');
  await cliquerAvecCurseur(page, page.locator('#cc-main .cm__btn[data-role="necessary"]'));
  await page.waitForTimeout(900);

  // ---- 7. /admin/cookies (admin simulé) : onglets
  // Charge la session admin dans localStorage côté client avant la navigation.
  await page.evaluate((valeur) => {
    try {
      localStorage.setItem('olympiade-auth', JSON.stringify(valeur));
    } catch {}
  }, session);
  await page.goto(`${BASE}/admin/cookies`);
  await page.waitForTimeout(1500);
  await page.evaluate(SCRIPT_CURSEUR);
  await page.evaluate(SCRIPT_LEGENDE, '7 · Côté admin : vous suivez tout depuis /admin/cookies');
  await page.waitForTimeout(1300);

  // Clique sur Statistiques puis Journal
  const ongletStats = page.locator('[role="tab"]#onglet-cookies-statistiques');
  if (await ongletStats.count()) {
    await cliquerAvecCurseur(page, ongletStats);
    await page.waitForTimeout(1200);
  }
  const ongletJournal = page.locator('[role="tab"]#onglet-cookies-journal');
  if (await ongletJournal.count()) {
    await cliquerAvecCurseur(page, ongletJournal);
    await page.waitForTimeout(1500);
  }

  // Carton final
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><title>Fin</title><style>
    html,body{margin:0;height:100%;background:#1c1912;color:#f7f4ed;font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;}
    .surtitre{font-size:12px;font-weight:700;letter-spacing:.24em;color:#f5b14d;text-transform:uppercase;}
    .titre{font:400 42px/1.15 "Playfair Display",Georgia,serif;margin:14px 0 10px;}
    .sous{font-size:16px;color:#efe7d8;opacity:.85;}
  </style></head><body><div style="text-align:center;padding:0 32px"><div class="surtitre">C'est tout</div><div class="titre">Simple pour vous, conforme CNIL pour vos visiteurs.</div><div class="sous">Les détails et les réglages sont dans les autres onglets.</div></div></body></html>`);
  await page.waitForTimeout(1600);

  const videoHandle = page.video();
  await page.close();
  await contexte.close();
  const brut = await videoHandle.path();
  console.log('[vidéo] enregistrement brut :', brut);
  return brut;
}

async function convertirVideo(sourceWebm) {
  const mp4 = join(SORTIE, 'parcours.mp4');
  const affichePng = join(TMP, 'parcours-affiche.png');
  const afficheWebp = join(SORTIE, 'parcours-affiche.webp');
  console.log('[vidéo] encodage MP4');
  execFileSync(
    FFMPEG,
    [
      '-y',
      '-i', sourceWebm,
      '-an',
      '-vf', 'scale=1280:-2',
      '-c:v', 'libx264',
      '-profile:v', 'main',
      '-pix_fmt', 'yuv420p',
      '-preset', 'slow',
      '-crf', '28',
      '-maxrate', '900k',
      '-bufsize', '1800k',
      '-movflags', '+faststart',
      mp4,
    ],
    { stdio: 'inherit' },
  );
  console.log('[vidéo] affiche (frame à 1 s)');
  execFileSync(
    FFMPEG,
    ['-y', '-ss', '1.0', '-i', mp4, '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '2', affichePng],
    { stdio: 'ignore' },
  );
  execFileSync(CWEBP, ['-q', '78', affichePng, '-o', afficheWebp], { stdio: 'ignore' });
  const taille = statSync(mp4).size;
  console.log(`[vidéo] parcours.mp4 : ${(taille / 1024 / 1024).toFixed(2)} Mo`);
}

// ---------------------------------------------------------------------------
// Entrée
// ---------------------------------------------------------------------------

const uniquement = argv[2];

try {
  const navigateur = await chromium.launch();
  if (!uniquement || uniquement === 'captures') {
    await capturerModes(navigateur);
  }
  if (!uniquement || uniquement === 'video') {
    const brut = await enregistrerVideo(navigateur);
    await navigateur.close();
    await convertirVideo(brut);
  } else {
    await navigateur.close();
  }
  // Total des fichiers de public/aide/cookies
  const total = readdirSync(SORTIE).reduce((somme, f) => somme + statSync(join(SORTIE, f)).size, 0);
  console.log(`[total] public/aide/cookies : ${(total / 1024 / 1024).toFixed(2)} Mo`);
  rmSync(TMP, { recursive: true, force: true });
} catch (erreur) {
  console.error('[erreur]', erreur);
  exit(1);
}
