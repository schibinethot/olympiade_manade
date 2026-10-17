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
  // Paramètres de bannière pour l'onglet Réglages.
  await contexte.route('**/rest/v1/parametres_cookies*', (route) =>
    route.fulfill({
      json: {
        id: 1,
        ...Object.fromEntries(
          Object.entries(SETTINGS).map(([k, v]) => [k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase()), v]),
        ),
      },
    }),
  );

  // Données factices COHÉRENTES pour les Statistiques et le Journal.
  // Totaux inventés : 248 consentements sur 30 jours =
  //   151 accept_all (61 %) + 64 reject_all (26 %) + 33 custom (13 %).
  // Mesure acceptée = accept_all + une partie des custom = 151 + 23 = 174 (70 %).
  // Publicité acceptée = accept_all + une petite partie des custom = 151 + 5 = 156 (63 %).
  const COMPTEURS = {
    total: 248,
    accept_all: 151,
    reject_all: 64,
    custom: 33,
    mesure: 174,
    publicite: 156,
  };
  // Journal mock : 50 lignes alignées sur les compteurs.
  const JOURNAL_FACTICE = (() => {
    const lignes = [];
    const base = Date.now();
    const pousser = (count, action, mesure, pub) => {
      for (let i = 0; i < count; i++) {
        lignes.push({
          id: `00000000-0000-4000-8000-${(lignes.length + 1).toString().padStart(12, '0')}`,
          visiteur_id: `v_demo_${lignes.length + 1}`,
          ip_hachee: `h_demo_${(lignes.length % 7) + 1}`,
          agent_utilisateur: ['Chrome', 'Safari', 'Firefox', 'Edge'][lignes.length % 4],
          consentement_donne: action !== 'reject_all',
          mesure_acceptee: mesure,
          publicite_acceptee: pub,
          action,
          url_page: ['https://exemple/', 'https://exemple/noter', 'https://exemple/dates', 'https://exemple/classements'][lignes.length % 4],
          provenance: null,
          cree_le: new Date(base - lignes.length * 1800000).toISOString(),
        });
      }
    };
    pousser(16, 'accept_all', true, true);     // 16 accept_all récents
    pousser(5, 'custom', true, false);          // 5 custom (mesure oui, pub non)
    pousser(2, 'custom', true, true);           // 2 custom (tout)
    pousser(1, 'custom', false, true);          // 1 custom (pub seule)
    pousser(26, 'reject_all', false, false);    // 26 reject_all
    return lignes;
  })();

  await contexte.route('**/rest/v1/consentements_cookies*', (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const methode = req.method();

    // HEAD (count seulement) : lit l'action/filtre et renvoie le compteur cohérent.
    if (methode === 'HEAD') {
      let count = COMPTEURS.total;
      const action = url.searchParams.get('action');
      if (action === 'eq.accept_all') count = COMPTEURS.accept_all;
      else if (action === 'eq.reject_all') count = COMPTEURS.reject_all;
      else if (action === 'eq.custom') count = COMPTEURS.custom;
      if (url.searchParams.get('mesure_acceptee') === 'eq.true') count = COMPTEURS.mesure;
      else if (url.searchParams.get('publicite_acceptee') === 'eq.true') count = COMPTEURS.publicite;
      return route.fulfill({
        status: 200,
        headers: {
          'content-range': `*/${count}`,
          'access-control-expose-headers': 'content-range',
        },
        body: '',
      });
    }

    // GET (journal, paginé) : renvoie les lignes selon Range + total.
    const range = (req.headers()['range'] || '0-49').match(/(\d+)-(\d+)/);
    const debut = range ? parseInt(range[1], 10) : 0;
    const fin = range ? parseInt(range[2], 10) : 49;
    const lignes = JOURNAL_FACTICE.slice(debut, fin + 1);
    return route.fulfill({
      status: 200,
      headers: {
        'content-range': `${debut}-${debut + Math.max(0, lignes.length - 1)}/${COMPTEURS.total}`,
        'access-control-expose-headers': 'content-range',
      },
      contentType: 'application/json',
      body: JSON.stringify(lignes),
    });
  });

  const page = await contexte.newPage();

  // Petit utilitaire : afficher le carton HTML inline. Hérite d'un même template
  // (sable + Playfair) pour que l'intro et le final soient visuellement cohérents.
  // On NAVIGUE vers une data: URL plutôt que setContent (plus fiable en vidéo :
  // la peinture est faite avant que la promesse ne résolve) et on attend que les
  // styles soient appliqués avant de rendre la main.
  async function afficherCarton({ fondClair = true, surtitre, titre, sous }) {
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${surtitre}</title><style>
      *,*::before,*::after{box-sizing:border-box}
      html,body{margin:0;padding:0;width:100%;height:100%;}
      body{background:${fondClair ? '#f7f4ed' : '#1c1912'};color:${fondClair ? '#1c1912' : '#f7f4ed'};font-family:Inter,-apple-system,"Segoe UI",system-ui,sans-serif;display:flex;align-items:center;justify-content:center;}
      .carte{padding:48px 56px;text-align:center;max-width:960px;}
      .surtitre{font-size:14px;font-weight:700;letter-spacing:.22em;color:${fondClair ? '#88693c' : '#f5b14d'};text-transform:uppercase;line-height:1;}
      .titre{font:400 ${fondClair ? '56px' : '48px'}/1.1 "Playfair Display",Georgia,"Times New Roman",serif;margin:18px 0 14px;}
      .sous{font-size:${fondClair ? '20px' : '18px'};color:${fondClair ? '#5a5246' : '#efe7d8'};line-height:1.4;}
    </style></head><body><div class="carte"><div class="surtitre">${surtitre}</div><div class="titre">${titre}</div><div class="sous">${sous}</div></div></body></html>`;
    await page.goto('data:text/html;charset=utf-8,' + encodeURIComponent(html), { waitUntil: 'load' });
    // Attendre que la peinture ET les styles soient effectivement appliqués.
    await page.waitForFunction(
      () => {
        const el = document.querySelector('.carte');
        if (!el) return false;
        const s = getComputedStyle(el);
        return s.textAlign === 'center' && document.fonts.status === 'loaded';
      },
      { timeout: 4000 },
    ).catch(() => {});
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
  }

  // Petit utilitaire : afficher une légende puis attendre, puis exécuter l'action.
  async function etape(legende, action, { pauseLecture = 1000, pauseApres = 900 } = {}) {
    await page.evaluate(SCRIPT_LEGENDE, legende);
    await page.waitForTimeout(pauseLecture);
    if (action) await action();
    await page.waitForTimeout(pauseApres);
  }

  // ---- 0. Carton titre
  await afficherCarton({
    fondClair: true,
    surtitre: 'Olympiade des Manades',
    titre: 'Le parcours cookies',
    sous: 'Du choix du visiteur jusqu’à votre tableau de bord.',
  });
  await page.waitForTimeout(2200);

  // ---- 1. Accueil, fenêtre apparaît
  await page.goto(`${BASE}/`);
  await page.locator('#cc-main .cm').waitFor({ state: 'visible' });
  await page.evaluate(SCRIPT_CURSEUR);
  await etape("1 · Le visiteur arrive sur l'accueil", null, { pauseLecture: 1600, pauseApres: 0 });

  // ---- 2. Clic sur Personnaliser (légende AVANT clic)
  await etape(
    '2 · Il ouvre « Personnaliser »',
    async () => {
      await cliquerAvecCurseur(page, page.locator('#cc-main .cm__btn[data-role="show"]'));
      await page.locator('#cc-main .pm').waitFor({ state: 'visible' });
      await page.evaluate(SCRIPT_CURSEUR);
    },
    { pauseLecture: 1100, pauseApres: 900 },
  );

  // ---- 3. Active Mesure d'audience
  await etape(
    "3 · Il active la mesure d'audience",
    async () => {
      const toggle = page.locator('#cc-main input.section__toggle[value="analytics"]').first();
      await bougerCurseurVers(page, toggle);
      await page.evaluate(() => window.__aideCliquerCurseur());
      await page.waitForTimeout(140);
      await toggle.click({ force: true });
    },
    { pauseLecture: 1100, pauseApres: 900 },
  );

  // ---- 4. Clique Enregistrer
  await etape(
    '4 · Il enregistre ses choix',
    async () => {
      await cliquerAvecCurseur(page, page.locator('#cc-main .pm__btn[data-role="save"]'));
    },
    { pauseLecture: 1000, pauseApres: 1000 },
  );

  // ---- 5. /noter, barre basse
  await contexte.clearCookies();
  await page.goto(`${BASE}/noter`);
  await page.locator('#cc-main .cm').waitFor({ state: 'visible' });
  await page.evaluate(SCRIPT_CURSEUR);
  await etape(
    '5 · Sur « Noter en direct » : barre basse, page utilisable',
    null,
    { pauseLecture: 1800, pauseApres: 0 },
  );

  // ---- 6. Tout refuser (légende AVANT, puis clic avec curseur visible)
  await etape(
    '6 · Cette fois il refuse tout',
    async () => {
      await cliquerAvecCurseur(page, page.locator('#cc-main .cm__btn[data-role="necessary"]'));
    },
    { pauseLecture: 1000, pauseApres: 900 },
  );

  // ---- 7. Il peut changer d'avis : clic sur « Gérer les cookies » du pied de page
  // 7a. Scrolle vers le pied de page avec la légende.
  await etape(
    "7 · Il peut changer d'avis depuis le pied de page",
    async () => {
      const gerer = page
        .locator('footer a, footer button')
        .filter({ hasText: /Gérer les cookies/i })
        .first();
      await gerer.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await page.evaluate(SCRIPT_CURSEUR);
      await cliquerAvecCurseur(page, gerer);
      await page.locator('#cc-main .pm').waitFor({ state: 'visible' });
      await page.evaluate(SCRIPT_CURSEUR);
    },
    { pauseLecture: 1100, pauseApres: 300 },
  );
  // 7b. Nouvelle légende sur le panneau rouvert, laissé en évidence > 2 s.
  await etape(
    'Les préférences se rouvrent, il peut tout changer',
    null,
    { pauseLecture: 2600, pauseApres: 0 },
  );

  // ---- 8. /admin/cookies (admin simulé) : Réglages → Statistiques → Journal
  // Charge la session admin dans localStorage côté client avant la navigation.
  await page.evaluate((valeur) => {
    try {
      localStorage.setItem('olympiade-auth', JSON.stringify(valeur));
    } catch {}
  }, session);
  await page.goto(`${BASE}/admin/cookies?onglet=reglages`);
  await page.waitForTimeout(1400);
  await page.evaluate(SCRIPT_CURSEUR);
  await etape(
    '8 · Côté admin : vos Réglages (textes, catégories, durée)',
    null,
    { pauseLecture: 2200, pauseApres: 0 },
  );

  const ongletStats = page.locator('[role="tab"]#onglet-cookies-statistiques');
  if (await ongletStats.count()) {
    await etape(
      '9 · Statistiques : taux d’acceptation sur la période',
      async () => {
        await cliquerAvecCurseur(page, ongletStats);
      },
      { pauseLecture: 1000, pauseApres: 1800 },
    );
  }
  const ongletJournal = page.locator('[role="tab"]#onglet-cookies-journal');
  if (await ongletJournal.count()) {
    await etape(
      '10 · Journal : la preuve horodatée (IP pseudonymisée)',
      async () => {
        await cliquerAvecCurseur(page, ongletJournal);
      },
      { pauseLecture: 1000, pauseApres: 2000 },
    );
  }

  // ---- Carton final (même style que l'intro, en inversé encre/sable)
  await afficherCarton({
    fondClair: false,
    surtitre: "C'est tout",
    titre: 'Simple pour vous, conforme CNIL pour vos visiteurs.',
    sous: 'Les détails et les réglages sont dans les autres onglets.',
  });
  await page.waitForTimeout(2000);

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
