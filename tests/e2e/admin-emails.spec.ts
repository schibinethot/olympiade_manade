/**
 * Admin /admin/emails : frise de la séquence, éditeur des modèles (aperçu en direct, variables,
 * enregistrement, test), dates (infos pratiques, message aux inscrits) et bilan des envois.
 *
 * Session admin AAL2 factice et routes REST simulées, comme admin-cookies-aide.spec.ts. Les
 * endpoints /api/admin/emails/* (tâche 5) sont simulés eux aussi.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '../outils/test-e2e';
import { ETAPES, MODELES_DEFAUT } from '../../serveur/gabarits-emails.mjs';

const ID_ADMIN = '00000000-0000-4000-8000-00000000000a';

const SESSION = (() => {
  const encoder = (valeur: unknown) => Buffer.from(JSON.stringify(valeur)).toString('base64url');
  const jeton = `${encoder({ alg: 'HS256', typ: 'JWT' })}.${encoder({
    sub: ID_ADMIN,
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
      id: ID_ADMIN,
      aud: 'authenticated',
      role: 'authenticated',
      email: 'admin@example.test',
      factors: [{ id: 'totp-admin', factor_type: 'totp', status: 'verified', friendly_name: 'Administration' }],
      app_metadata: {},
      user_metadata: { prenom: 'Camille', role: 'admin' },
      created_at: new Date().toISOString(),
    },
  };
})();

const COLONNES_EDITABLES = ['actif', 'sujet', 'preheader', 'corps', 'encart', 'jours_decalage', 'heure_envoi'];

/** Jour de Paris décalé de `jours` par rapport à aujourd'hui : « AAAA-MM-JJ ». */
function jourParis(jours: number) {
  const parties = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date());
  const [annee, mois, jour] = parties.split('-').map(Number);
  return new Date(Date.UTC(annee, mois - 1, jour + jours)).toISOString().slice(0, 10);
}

const DATE_PROCHE = {
  id: 'date-proche', nom: 'Rencontre des manades', ville: 'Lunel', arenes: 'Arènes San Juan',
  date_soiree: jourParis(4), heure: '21:30:00', statut: 'confirmee', lien_billetterie: null,
  infos_pratiques: null, soiree_id: null, soiree: null,
};
const DATE_SOMMIERES = {
  id: 'date-sommieres', nom: 'Olympiade des Manades', ville: 'Sommières', arenes: 'Arènes Gilles Arnaud',
  date_soiree: '2027-07-31', heure: '21:30:00', statut: 'confirmee', lien_billetterie: 'https://billetterie.exemple.fr',
  infos_pratiques: 'Parking derrière les arènes.', soiree_id: 'soiree-sommieres',
  soiree: { slug: 'sommieres-2027', statut: 'reportee', soiree_manades: [{ ordre: 1, manades: { nom: 'Vinuesa' } }] },
};
const DATE_BEZOUCE = {
  id: 'date-bezouce', nom: 'Olympiade des Manades', ville: 'Bezouce', arenes: null,
  date_soiree: '2027-08-05', heure: null, statut: 'previsionnelle', lien_billetterie: null,
  infos_pratiques: null, soiree_id: null, soiree: null,
};

function modelesParDefaut() {
  return ETAPES.map((cle) => {
    const defaut = MODELES_DEFAUT[cle];
    return {
      cle, nom: defaut.nom, actif: true, sujet: defaut.sujet, preheader: defaut.preheader, corps: defaut.corps,
      encart: defaut.encart, jours_decalage: defaut.jours_decalage,
      heure_envoi: defaut.heure_envoi === null ? null : `${defaut.heure_envoi}:00`,
      modifie_le: '2026-10-17T08:00:00Z',
    };
  });
}

type Simulation = {
  patchsModeles: { url: string; corps: Record<string, unknown> }[];
  patchsCalendrier: { url: string; corps: Record<string, unknown> }[];
  tests: { autorisation: string | null; corps: Record<string, unknown> }[];
  messages: { autorisation: string | null; corps: Record<string, unknown> }[];
};

function compter(route: Route, nombre: number) {
  return route.fulfill({
    status: 200,
    headers: { 'content-range': `*/${nombre}`, 'access-control-expose-headers': 'content-range' },
    contentType: 'application/json',
    body: route.request().method() === 'HEAD' ? '' : '[]',
  });
}

async function ouvrirAdmin(page: Page): Promise<Simulation> {
  const simulation: Simulation = { patchsModeles: [], patchsCalendrier: [], tests: [], messages: [] };
  const modeles = modelesParDefaut();
  await page.addInitScript((valeur) => {
    try {
      localStorage.setItem('olympiade-auth', JSON.stringify(valeur));
    } catch {}
  }, SESSION);
  await page.route('**/auth/v1/**', (route) =>
    route.request().url().includes('/user') ? route.fulfill({ json: SESSION.user }) : route.abort(),
  );
  await page.route('**/rest/v1/profils*', (route) =>
    route.fulfill({ json: [{ id: ID_ADMIN, prenom: 'Camille', role: 'admin' }] }),
  );
  await page.route('**/rest/v1/modeles_emails*', (route) => {
    const requete = route.request();
    if (requete.method() === 'PATCH') {
      const corps = requete.postDataJSON() as Record<string, unknown>;
      simulation.patchsModeles.push({ url: requete.url(), corps });
      const cle = new URL(requete.url()).searchParams.get('cle')?.replace(/^eq\./, '');
      const ligne = modeles.find((modele) => modele.cle === cle);
      if (!ligne) return route.fulfill({ status: 404, json: {} });
      Object.assign(ligne, corps);
      return route.fulfill({ json: ligne });
    }
    return route.fulfill({ json: modeles });
  });
  await page.route('**/rest/v1/calendrier*', (route) => {
    const requete = route.request();
    if (requete.method() === 'PATCH') {
      const corps = requete.postDataJSON() as Record<string, unknown>;
      simulation.patchsCalendrier.push({ url: requete.url(), corps });
      return route.fulfill({ json: { id: 'date-proche', ...corps } });
    }
    return route.fulfill({ json: [DATE_PROCHE, DATE_SOMMIERES, DATE_BEZOUCE] });
  });
  await page.route('**/rest/v1/rattachements_emails*', (route) => {
    const calendrier = new URL(route.request().url()).searchParams.get('calendrier_id');
    return compter(route, calendrier === 'eq.date-proche' ? 3 : calendrier === 'eq.date-sommieres' ? 2 : 0);
  });
  await page.route('**/rest/v1/bilan_envois_emails*', (route) => route.fulfill({
    json: [
      { etape: 'confirmation', calendrier_id: null, reel: false, statut: 'simule', nombre: 12, dernier_envoi: '2026-10-16T08:00:00Z' },
      { etape: 'bienvenue', calendrier_id: null, reel: false, statut: 'simule', nombre: 9, dernier_envoi: '2026-10-16T08:05:00Z' },
      { etape: 'veille', calendrier_id: 'date-proche', reel: false, statut: 'saute', nombre: 2, dernier_envoi: null },
      // En attente ou en échec, dernier_envoi est l'heure de la dernière tentative (tâche 5).
      { etape: 'veille', calendrier_id: 'date-proche', reel: false, statut: 'echec', nombre: 1, dernier_envoi: '2026-10-17T07:30:00Z' },
    ],
  }));
  await page.route('**/rest/v1/envois_emails*', (route) => {
    const raison = new URL(route.request().url()).searchParams.get('raison');
    return compter(route, raison === 'eq.fenetre_depassee' ? 2 : raison === 'eq.rendu_invalide' ? 1 : 0);
  });
  await page.route('**/rest/v1/destinataires_emails*', (route) => {
    const parametres = new URL(route.request().url()).searchParams;
    if (parametres.get('desinscrit_le') === 'not.is.null') return compter(route, 4);
    if (parametres.get('abonnement_a_confirmer') === 'eq.true') return compter(route, 2);
    if (parametres.get('annonces') === 'eq.true') return compter(route, 7);
    return compter(route, 15);
  });
  await page.route('**/api/admin/emails/etat', (route) => route.fulfill({
    json: {
      mode: 'log', pret: true, cleLiens: true, dernierPassage: '2026-10-17T08:00:00Z',
      dernierBilan: { reserves: 3, envoyes: 0, simules: 3, echecs: 0, sautes: 1 },
    },
  }));
  await page.route('**/api/admin/emails/test', (route) => {
    simulation.tests.push({
      autorisation: route.request().headers().authorization ?? null,
      corps: route.request().postDataJSON() as Record<string, unknown>,
    });
    return route.fulfill({ json: { ok: true, mode: 'log' } });
  });
  await page.route('**/api/admin/emails/message', (route) => {
    simulation.messages.push({
      autorisation: route.request().headers().authorization ?? null,
      corps: route.request().postDataJSON() as Record<string, unknown>,
    });
    return route.fulfill({ json: { ok: true, destinataires: 3 } });
  });
  return simulation;
}

async function attendreSansViolationGrave(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .include('[role="tablist"]')
    .include('[role="tabpanel"]')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  const graves = violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id} (${violation.impact}) : ${violation.nodes.map((noeud) => noeud.target.join(' ')).join(', ')}`);
  expect(graves).toEqual([]);
}

const corpsDuMessage = (page: Page) => page.getByRole('textbox', { name: 'Corps du message', exact: true });
const apercu = (page: Page) => page.getByRole('region', { name: /Aperçu de l’email/ });

test.describe('admin des e-mails', () => {
  test('trois onglets, une frise de 9 étapes et ?onglet=dates ouvre Dates', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/emails');
    const onglets = page.getByRole('tablist', { name: 'Onglets des e-mails' }).getByRole('tab');
    await expect(onglets).toHaveCount(3, { timeout: 8000 });
    await expect(onglets).toHaveText(['Séquence', 'Dates', 'Envois']);
    await expect(onglets.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(onglets.nth(0)).toHaveAttribute('aria-controls', 'panneau-emails-sequence');
    await expect(onglets.nth(1)).not.toHaveAttribute('aria-controls', /.+/);

    await expect(page.getByRole('heading', { name: 'Les 9 emails', level: 2 })).toBeVisible();
    const etapes = page.getByRole('list', { name: 'Étapes de la séquence' }).getByRole('listitem');
    await expect(etapes).toHaveCount(9);
    await expect(etapes.nth(2)).toContainText('7 jours avant, à 10 h');
    await expect(etapes.nth(3)).toContainText('La veille, à 18 h');
    // Date proche à J+4 avec 3 inscrits : la veille tombe dans les 7 prochains jours, et la date est nommée.
    await expect(etapes.nth(3)).toContainText(/environ 3 inscrits de Lunel \(\S+ \d{2}\/\d{2}\), \S+ \d{2}\/\d{2} à 18 h/);
    // Bandeaux persistants : visibles, sans rôle d'alerte (rien n'est annoncé à chaque affichage).
    await expect(page.getByText('Aucun email ne part réellement.')).toBeVisible();
    await expect(page.getByText(/Soirée reportée à Sommières/)).toBeVisible();
    // (L'en-tête du site garde sa propre région d'alerte, vide : seul le panneau compte ici.)
    await expect(page.getByRole('tabpanel').getByRole('alert')).toHaveCount(0);

    await page.goto('/admin/emails?onglet=dates');
    await expect(page.getByRole('tab', { name: 'Dates' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: /Lunel/ })).toBeVisible();
    await expect(page.getByText('3 inscrits', { exact: true })).toBeVisible();
  });

  test('l’interrupteur enregistre tout de suite, et la confirmation reste active', async ({ page }) => {
    const simulation = await ouvrirAdmin(page);
    await page.goto('/admin/emails');
    const veille = page.getByRole('switch', { name: /La veille/ });
    await expect(veille).toHaveAttribute('aria-checked', 'true');
    await veille.click();
    await expect(veille).toHaveAttribute('aria-checked', 'false');
    expect(simulation.patchsModeles).toHaveLength(1);
    expect(simulation.patchsModeles[0].corps).toEqual({ actif: false });
    expect(simulation.patchsModeles[0].url).toContain('cle=eq.veille');
    await expect(page.getByRole('switch', { name: /Confirmation de l’adresse/ })).toBeDisabled();
  });

  test('taper dans le corps met l’aperçu à jour, et {{date}} affiche la date d’exemple', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/emails?modele=j_moins_7');
    await expect(page.getByRole('heading', { name: 'Une semaine avant' })).toBeVisible({ timeout: 8000 });
    await page.getByLabel('Date d’exemple').selectOption('date-sommieres');
    await corpsDuMessage(page).fill('Bonjour {{prenom}},\n\nUn texte de test très reconnaissable. ');
    await expect(apercu(page)).toContainText('Un texte de test très reconnaissable.');
    await expect(apercu(page)).toContainText('Bonjour Camille,');
    await page.getByRole('button', { name: 'Insérer une info' }).click();
    await page.getByRole('button', { name: /\{\{date\}\}/ }).click();
    await expect(corpsDuMessage(page)).toHaveValue(/reconnaissable\. \{\{date\}\}$/);
    await expect(apercu(page)).toContainText('samedi 31 juillet 2027');
    // Une variable sans valeur dans cet email est grisée et n'insère rien.
    const vainqueur = page.getByRole('button', { name: /\{\{vainqueur\}\}/ });
    await expect(vainqueur).toHaveAttribute('aria-disabled', 'true');
    await expect(vainqueur).toContainText('pas disponible dans cet email');
    // aria-disabled : Playwright attendrait qu'il s'active ; le clic forcé vérifie qu'il n'insère rien.
    await vainqueur.click({ force: true });
    await expect(corpsDuMessage(page)).not.toHaveValue(/vainqueur/);
    // Bascule de largeur.
    await page.getByRole('radio', { name: /Ordinateur/ }).check();
    await expect(page.getByRole('radio', { name: /Ordinateur/ })).toBeChecked();
  });

  test('le corps suit l’objet, et « Enregistrer » reste visible pendant la saisie', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/emails?modele=j_moins_7');
    const objet = page.getByRole('textbox', { name: 'Objet', exact: true });
    await objet.evaluate((champ) => champ.scrollIntoView({ block: 'start' }));
    await expect(corpsDuMessage(page)).toBeInViewport({ ratio: 0.2 });
    await corpsDuMessage(page).fill(`${MODELES_DEFAUT.j_moins_7.corps}\n\nUne ligne de plus.`);
    await expect(page.getByRole('button', { name: 'Enregistrer', exact: true })).toBeInViewport();
    await expect(page.getByText('Modifications non enregistrées')).toBeInViewport();
  });

  test('un brouillon modifié n’est jamais perdu sans confirmation', async ({ page }) => {
    await ouvrirAdmin(page);
    // Ouvert depuis la frise : le retour du navigateur reste dans l'application.
    await page.goto('/admin/emails');
    await page.locator('#modifier-j_moins_7').click();
    await corpsDuMessage(page).fill('Brouillon précieux');
    await page.getByRole('tab', { name: 'Dates' }).click();
    const question = page.getByText('Vos modifications ne sont pas enregistrées. Quitter quand même ?');
    await expect(question).toBeFocused();
    await page.getByRole('button', { name: 'Rester' }).click();
    await expect(corpsDuMessage(page)).toHaveValue('Brouillon précieux');
    await expect(page.getByRole('tab', { name: 'Séquence' })).toHaveAttribute('aria-selected', 'true');
    // Retour du navigateur.
    await page.evaluate(() => history.back());
    await expect(question).toBeVisible();
    await page.getByRole('button', { name: 'Rester' }).click();
    await expect(corpsDuMessage(page)).toHaveValue('Brouillon précieux');
    // « Quitter » perd le brouillon.
    await page.getByRole('tab', { name: 'Dates' }).click();
    await page.getByRole('button', { name: 'Quitter sans enregistrer' }).click();
    await expect(page.getByRole('tab', { name: 'Dates' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Séquence' }).click();
    await page.locator('#modifier-j_moins_7').click();
    await expect(corpsDuMessage(page)).toHaveValue(MODELES_DEFAUT.j_moins_7.corps);
  });

  test('recharger la page avec un brouillon modifié demande confirmation', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/emails?modele=veille');
    await corpsDuMessage(page).click();
    await page.keyboard.type('x');
    await expect(page.getByText('Modifications non enregistrées')).toBeVisible();
    // L'écouteur est posé par un effet de la page, juste après la saisie : on l'attend.
    await page.waitForFunction(() => {
      const evenement = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(evenement);
      return evenement.defaultPrevented;
    });
    const dialogue = page.waitForEvent('dialog');
    await page.close({ runBeforeUnload: true });
    const boite = await dialogue;
    expect(boite.type()).toBe('beforeunload');
    await boite.dismiss();
  });

  test('le focus suit les confirmations et revient au déclencheur', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/emails');
    await page.locator('#modifier-j_moins_7').click();
    await expect(page.getByRole('heading', { name: 'Une semaine avant', level: 2 })).toBeFocused();
    await page.getByRole('button', { name: 'Revenir au texte d’origine' }).click();
    await expect(page.getByText(/^Remplacer l’objet, le texte d’aperçu/)).toBeFocused();
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Revenir au texte d’origine' })).toBeFocused();
    await page.getByRole('button', { name: '← Toute la séquence' }).click();
    await expect(page.locator('#modifier-j_moins_7')).toBeFocused();
  });

  test('un enregistrement refusé affiche un message lisible et garde le texte', async ({ page }) => {
    await ouvrirAdmin(page);
    const refus = [
      { status: 400, json: { code: '23514', message: 'new row violates check constraint', details: null, hint: null } },
      { status: 406, json: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: 'The result contains 0 rows', hint: null } },
    ];
    await page.route('**/rest/v1/modeles_emails*', (route) => (
      route.request().method() === 'PATCH' ? route.fulfill(refus.shift() ?? { status: 500, json: {} }) : route.fallback()
    ));
    await page.goto('/admin/emails?modele=veille');
    await corpsDuMessage(page).fill('Texte modifié');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Un champ dépasse les limites permises' })).toBeVisible();
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Enregistrement refusé' })).toBeVisible();
    await expect(corpsDuMessage(page)).toHaveValue('Texte modifié');
  });

  test('un aperçu impossible à rendre affiche l’erreur sans casser l’éditeur', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.route('**/rest/v1/calendrier*', (route) => (
      route.request().method() === 'GET'
        ? route.fulfill({ json: [DATE_PROCHE, { ...DATE_BEZOUCE, id: 'date-illisible', date_soiree: '2027-02-31' }] })
        : route.fallback()
    ));
    await page.goto('/admin/emails?modele=bienvenue');
    await page.getByLabel('Date d’exemple').selectOption('date-illisible');
    await expect(page.getByRole('alert').filter({ hasText: 'L’aperçu n’a pas pu être rendu' })).toBeVisible();
    await corpsDuMessage(page).fill('Toujours modifiable');
    await expect(corpsDuMessage(page)).toHaveValue('Toujours modifiable');
  });

  test('une variable inconnue est signalée', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/emails?modele=veille');
    await corpsDuMessage(page).fill('Bonjour {{truc}}');
    await expect(page.getByRole('alert').filter({ hasText: 'Variable inconnue' })).toContainText('{{truc}}');
  });

  test('Enregistrer envoie un PATCH avec les seuls champs éditables', async ({ page }) => {
    const simulation = await ouvrirAdmin(page);
    await page.goto('/admin/emails?modele=j_moins_7');
    await page.getByRole('textbox', { name: 'Objet', exact: true }).fill('Plus qu’une semaine avant {{ville}}');
    await page.getByLabel('Jour d’envoi').selectOption('-6');
    await page.getByLabel('Heure d’envoi').fill('09:30');
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Modèle enregistré' })).toBeVisible();
    expect(simulation.patchsModeles).toHaveLength(1);
    const { url, corps } = simulation.patchsModeles[0];
    expect(url).toContain('cle=eq.j_moins_7');
    for (const cle of Object.keys(corps)) expect(COLONNES_EDITABLES).toContain(cle);
    expect(corps).toMatchObject({ sujet: 'Plus qu’une semaine avant {{ville}}', encart: null, jours_decalage: -6, heure_envoi: '09:30' });
  });

  test('« Revenir au texte d’origine » demande confirmation avant d’écraser', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/emails?modele=j_moins_7');
    await corpsDuMessage(page).fill('Texte à jeter');
    await page.getByRole('button', { name: 'Revenir au texte d’origine' }).click();
    await expect(corpsDuMessage(page)).toHaveValue('Texte à jeter');
    await page.getByRole('button', { name: 'Remplacer par le texte d’origine' }).click();
    await expect(corpsDuMessage(page)).toHaveValue(MODELES_DEFAUT.j_moins_7.corps);
  });

  test('« M’envoyer un test » envoie le brouillon et affiche le mode', async ({ page }) => {
    const simulation = await ouvrirAdmin(page);
    await page.goto('/admin/emails?modele=bienvenue');
    await page.getByLabel('Date d’exemple').selectOption('date-sommieres');
    await corpsDuMessage(page).fill('Bienvenue {{prenom}} !');
    await page.getByRole('button', { name: 'M’envoyer un test' }).click();
    await expect(page.getByRole('status').filter({ hasText: /mode log/ })).toBeVisible();
    expect(simulation.tests).toHaveLength(1);
    expect(simulation.tests[0].autorisation).toBe(`Bearer ${SESSION.access_token}`);
    expect(simulation.tests[0].corps).toEqual({
      cle: 'bienvenue',
      brouillon: {
        sujet: MODELES_DEFAUT.bienvenue.sujet,
        preheader: MODELES_DEFAUT.bienvenue.preheader,
        corps: 'Bienvenue {{prenom}} !',
        encart: MODELES_DEFAUT.bienvenue.encart,
      },
      calendrierId: 'date-sommieres',
    });
  });

  test('Dates : infos pratiques enregistrées et message aux inscrits confirmé', async ({ page }) => {
    const simulation = await ouvrirAdmin(page);
    await page.goto('/admin/emails?onglet=dates');
    const carte = page.getByRole('article', { name: /Lunel/ });
    await carte.getByLabel('Infos pratiques').fill('Parking gratuit au stade.');
    await carte.getByRole('button', { name: 'Enregistrer les infos' }).click();
    await expect(carte.getByRole('status').filter({ hasText: 'Infos pratiques enregistrées' })).toBeVisible();
    expect(simulation.patchsCalendrier).toEqual([
      { url: expect.stringContaining('id=eq.date-proche'), corps: { infos_pratiques: 'Parking gratuit au stade.' } },
    ]);

    await carte.getByRole('button', { name: 'Écrire aux inscrits' }).click();
    // Le texte de départ n'est pas un message : il est refusé.
    await carte.getByRole('button', { name: 'Vérifier et envoyer' }).click();
    await expect(carte.getByRole('alert').filter({ hasText: 'Écrivez votre message avant d’envoyer' })).toBeVisible();
    expect(simulation.messages).toHaveLength(0);

    await carte.getByRole('textbox', { name: 'Corps du message', exact: true }).fill('Bonjour {{prenom}},\n\nLe parking change de place.');
    await expect(carte.getByRole('region', { name: /Aperçu de l’email/ })).toContainText('Le parking change de place.');
    await carte.getByRole('button', { name: 'Vérifier et envoyer' }).click();
    await expect(carte.getByText('Envoyer à 3 personnes ?')).toBeVisible();
    expect(simulation.messages).toHaveLength(0);
    await carte.getByRole('button', { name: 'Oui, envoyer' }).click();
    await expect(carte.getByRole('status').filter({ hasText: /3 personnes/ })).toBeVisible();
    expect(simulation.messages).toHaveLength(1);
    expect(simulation.messages[0].autorisation).toBe(`Bearer ${SESSION.access_token}`);
    expect(simulation.messages[0].corps).toEqual({
      calendrierId: 'date-proche',
      sujet: MODELES_DEFAUT.message.sujet,
      corps: 'Bonjour {{prenom}},\n\nLe parking change de place.',
    });
  });

  test('Envois : bilan par étape, raisons des sauts, mode et désinscrits', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/emails?onglet=envois');
    await expect(page.getByText('Simulation (log)', { exact: true })).toBeVisible({ timeout: 8000 });
    const tableau = page.getByRole('table', { name: 'Bilan des envois' });
    await expect(tableau.getByRole('row', { name: /Confirmation de l’adresse/ })).toContainText('12');
    await expect(tableau.getByRole('row', { name: /La veille/ })).toContainText('Lunel');
    await expect(tableau.getByRole('row', { name: /La veille/ })).toContainText('Dernière tentative');
    await expect(tableau.getByRole('row', { name: /Confirmation de l’adresse/ })).not.toContainText('Dernière tentative');
    await expect(page.getByText('Fenêtre d’envoi dépassée')).toBeVisible();
    await expect(page.getByText('Rendu impossible')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Désinscrits' })).toContainText('4');
    // « Actualiser » relit sur place, sans repasser par le chargement de tout l'écran.
    await page.getByRole('button', { name: 'Actualiser' }).click();
    await expect(page.getByText('Lecture des emails…')).toHaveCount(0);
    await expect(tableau).toBeVisible();
    await expect(page.getByRole('button', { name: 'Actualiser' })).toBeEnabled();
  });

  test('un message refusé par le serveur reste ouvert et se renvoie avec « Réessayer »', async ({ page }) => {
    await ouvrirAdmin(page);
    let essais = 0;
    await page.route('**/api/admin/emails/message', (route) => {
      essais += 1;
      return essais === 1
        ? route.fulfill({ status: 503, json: { error: 'planificateur_inactif' } })
        : route.fulfill({ json: { ok: true, destinataires: 3 } });
    });
    await page.goto('/admin/emails?onglet=dates');
    const carte = page.getByRole('article', { name: /Lunel/ });
    await carte.getByRole('button', { name: 'Écrire aux inscrits' }).click();
    await expect(carte.getByRole('heading', { name: 'Message aux inscrits' })).toBeFocused();
    await carte.getByRole('textbox', { name: 'Corps du message', exact: true }).fill('Bonjour,\n\nLes portes ouvrent plus tôt.');
    await carte.getByRole('button', { name: 'Vérifier et envoyer' }).click();
    await expect(carte.getByText('Envoyer à 3 personnes ?')).toBeFocused();
    await carte.getByRole('button', { name: 'Oui, envoyer' }).click();
    await expect(carte.getByRole('alert').filter({ hasText: 'L’envoi est arrêté sur le serveur' })).toBeVisible();
    await carte.getByRole('button', { name: 'Réessayer' }).click();
    await expect(carte.getByRole('status').filter({ hasText: /3 personnes/ })).toBeVisible();
    expect(essais).toBe(2);
    await expect(carte.getByRole('button', { name: 'Écrire aux inscrits' })).toBeFocused();
  });

  test('« Annuler » un message commencé demande confirmation', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/emails?onglet=dates');
    const carte = page.getByRole('article', { name: /Lunel/ });
    await carte.getByRole('button', { name: 'Écrire aux inscrits' }).click();
    // Sans changement, « Annuler » ferme tout de suite.
    await carte.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(carte.getByRole('button', { name: 'Écrire aux inscrits' })).toBeFocused();
    await carte.getByRole('button', { name: 'Écrire aux inscrits' }).click();
    await carte.getByRole('textbox', { name: 'Corps du message', exact: true }).fill('Un message commencé');
    await carte.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(carte.getByText('Abandonner ce message ?')).toBeFocused();
    await carte.getByRole('button', { name: 'Continuer le message' }).click();
    await expect(carte.getByRole('textbox', { name: 'Corps du message', exact: true })).toHaveValue('Un message commencé');
    await carte.getByRole('button', { name: 'Annuler', exact: true }).click();
    await carte.getByRole('button', { name: 'Abandonner le message' }).click();
    await expect(carte.getByRole('textbox', { name: 'Corps du message', exact: true })).toHaveCount(0);
    await expect(carte.getByRole('button', { name: 'Écrire aux inscrits' })).toBeFocused();
  });

  test('l’alerte d’une soirée reportée ouvre le message de cette date', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/emails');
    await page.getByRole('button', { name: 'Écrire aux inscrits de cette date' }).click();
    await expect(page.getByRole('tab', { name: 'Dates' })).toHaveAttribute('aria-selected', 'true');
    const carte = page.getByRole('article', { name: /Sommières/ });
    await expect(carte.getByRole('heading', { name: 'Message aux inscrits' })).toBeFocused();
    await expect(carte.getByRole('textbox', { name: 'Corps du message', exact: true })).toBeVisible();
  });

  test('aucune violation axe grave sur les quatre vues', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/emails');
    await expect(page.getByRole('list', { name: 'Étapes de la séquence' })).toBeVisible({ timeout: 8000 });
    await attendreSansViolationGrave(page);
    await page.goto('/admin/emails?modele=bienvenue');
    await expect(apercu(page)).toContainText('Bonjour Camille');
    await attendreSansViolationGrave(page);
    // Éditeur en cours de saisie : panneau des infos ouvert, barre d'actions collante, confirmation.
    await page.getByRole('button', { name: 'Insérer une info' }).click();
    await corpsDuMessage(page).fill('Bonjour {{prenom}} !');
    await page.getByRole('button', { name: 'Revenir au texte d’origine' }).click();
    await attendreSansViolationGrave(page);
    // Texte d'origine rétabli : plus rien à protéger, la navigation suivante n'est pas retenue.
    await page.getByRole('button', { name: 'Remplacer par le texte d’origine' }).click();
    await page.goto('/admin/emails?onglet=dates');
    await expect(page.getByRole('heading', { name: /Lunel/ })).toBeVisible();
    await attendreSansViolationGrave(page);
    await page.goto('/admin/emails?onglet=envois');
    await expect(page.getByRole('table', { name: 'Bilan des envois' })).toBeVisible();
    await attendreSansViolationGrave(page);
  });
});
