/**
 * Admin /admin/emails : frise de la séquence, éditeur des modèles (aperçu en direct, variables,
 * enregistrement, test), dates (infos pratiques, message aux inscrits) et bilan des envois.
 *
 * Session admin AAL2 factice et routes REST simulées, comme admin-cookies-aide.spec.ts. Les
 * endpoints /api/admin/emails/* (tâche 5) sont simulés eux aussi.
 */

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '../outils/test-e2e';
import { ETAPES, formaterDate, MODELES_DEFAUT } from '../../serveur/gabarits-emails.mjs';

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
// Dates relatives au jour du test (et non figées) : l'admin filtre sur l'horloge réelle, une date
// passée sortirait des listes et ferait échouer les tests (revue QA, « bombe de date »).
const DATE_SOMMIERES = {
  id: 'date-sommieres', nom: 'Olympiade des Manades', ville: 'Sommières', arenes: 'Arènes Gilles Arnaud',
  date_soiree: jourParis(30), heure: '21:30:00', statut: 'confirmee', lien_billetterie: 'https://billetterie.exemple.fr',
  infos_pratiques: 'Parking derrière les arènes.', soiree_id: 'soiree-sommieres',
  soiree: { slug: 'sommieres-2027', statut: 'reportee', soiree_manades: [{ ordre: 1, manades: { nom: 'Vinuesa' } }] },
};
const DATE_BEZOUCE = {
  id: 'date-bezouce', nom: 'Olympiade des Manades', ville: 'Bezouce', arenes: null,
  date_soiree: jourParis(35), heure: null, statut: 'previsionnelle', lien_billetterie: null,
  infos_pratiques: null, soiree_id: null, soiree: null,
};
/** « samedi 31 juillet 2027 » : la date de Sommières telle que le rendu l'écrit. */
const SOMMIERES_EN_TOUTES_LETTRES = formaterDate(DATE_SOMMIERES.date_soiree, DATE_SOMMIERES.heure).date;

const IDENTITE = {
  raison_sociale: 'Association des Manades', forme_juridique: 'Association loi 1901', adresse: '1 place des Arènes, Sommières',
  telephone: null, email: 'contact@exemple.fr', immatriculation: null, capital: null, tva: null, directeur_publication: null,
};

/** État du serveur d'envoi (contrat C-0.3) : simulation prête, passage d'il y a une minute. */
function etatServeur(champs: Record<string, unknown> = {}) {
  return {
    mode: 'log', pret: true, raisonsInactif: [], cleLiens: true, barriereActive: false,
    dernierPassage: new Date(Date.now() - 60_000).toISOString(),
    dernierBilan: { reserves: 3, envoyes: 0, simules: 3, echecs: 0, sautes: 1 }, derniereErreur: null,
    ...champs,
  };
}

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
  /** Requêtes sur envois_emails : l'onglet Envois n'en fait plus (vue du bilan, contrat C-0.4). */
  lecturesEnvois: string[];
};

type Options = { etat?: Record<string, unknown>; identite?: unknown[] };

function compter(route: Route, nombre: number) {
  return route.fulfill({
    status: 200,
    headers: { 'content-range': `*/${nombre}`, 'access-control-expose-headers': 'content-range' },
    contentType: 'application/json',
    body: route.request().method() === 'HEAD' ? '' : '[]',
  });
}

async function ouvrirAdmin(page: Page, options: Options = {}): Promise<Simulation> {
  const simulation: Simulation = { patchsModeles: [], patchsCalendrier: [], tests: [], messages: [], lecturesEnvois: [] };
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
  // Vue du bilan regroupée par raison (contrat C-0.4) : bilan et raisons en une seule lecture.
  await page.route('**/rest/v1/bilan_envois_emails*', (route) => route.fulfill({
    json: [
      { etape: 'confirmation', calendrier_id: null, reel: false, statut: 'simule', raison: null, nombre: 12, dernier_envoi: '2026-10-16T08:00:00Z' },
      { etape: 'bienvenue', calendrier_id: null, reel: false, statut: 'simule', raison: null, nombre: 9, dernier_envoi: '2026-10-16T08:05:00Z' },
      { etape: 'veille', calendrier_id: 'date-proche', reel: false, statut: 'saute', raison: 'fenetre_depassee', nombre: 2, dernier_envoi: null },
      { etape: 'jour_j', calendrier_id: 'date-proche', reel: false, statut: 'saute', raison: 'rendu_invalide', nombre: 1, dernier_envoi: null },
      // En attente ou en échec, dernier_envoi est l'heure de la dernière tentative (tâche 5).
      { etape: 'veille', calendrier_id: 'date-proche', reel: false, statut: 'echec', raison: null, nombre: 1, dernier_envoi: '2026-10-17T07:30:00Z' },
    ],
  }));
  await page.route('**/rest/v1/envois_emails*', (route) => {
    simulation.lecturesEnvois.push(route.request().url());
    return compter(route, 0);
  });
  await page.route('**/rest/v1/messages_inscrits*', (route) => route.fulfill({
    json: [{ id: 'message-1', calendrier_id: 'date-proche', sujet: 'Le parking change de place', cree_le: '2026-10-15T16:00:00Z', destinataires: 3 }],
  }));
  await page.route('**/rest/v1/identite_legale*', (route) => route.fulfill({ json: options.identite ?? [IDENTITE] }));
  await page.route('**/rest/v1/destinataires_emails*', (route) => {
    const parametres = new URL(route.request().url()).searchParams;
    if (parametres.get('desinscrit_le') === 'not.is.null') return compter(route, 4);
    if (parametres.get('abonnement_a_confirmer') === 'eq.true') return compter(route, 2);
    if (parametres.get('annonces') === 'eq.true') return compter(route, 7);
    return compter(route, 15);
  });
  await page.route('**/api/admin/emails/etat', (route) => route.fulfill({ json: etatServeur(options.etat) }));
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
    await expect(apercu(page)).toContainText(SOMMIERES_EN_TOUTES_LETTRES);
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
    // Sortie confirmée depuis un onglet : le focus est sur l'onglet de destination.
    await expect(page.getByRole('tab', { name: 'Dates' })).toBeFocused();
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

  test('après un enregistrement, la barre reste visible et le résultat du test s’affiche', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/emails?modele=j_moins_7');
    await corpsDuMessage(page).fill(`${MODELES_DEFAUT.j_moins_7.corps}\n\nUne ligne de plus.`);
    const enregistrer = page.getByRole('button', { name: 'Enregistrer', exact: true });
    await enregistrer.click();
    await expect(page.getByRole('status').filter({ hasText: 'Modèle enregistré' })).toBeVisible();
    // Le bouton garde le focus (aria-disabled pendant l'envoi), et la barre reste collée au bas de l'écran.
    await expect(enregistrer).toBeFocused();
    await expect(enregistrer).toBeInViewport();
    await page.getByRole('button', { name: 'M’envoyer un test' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Test simulé (mode log)' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Modèle enregistré' })).toHaveCount(0);
  });

  test('le vainqueur n’est proposé qu’aux emails partis après la soirée', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/emails?modele=lendemain');
    await page.getByRole('button', { name: 'Insérer une info' }).click();
    const vainqueur = page.getByRole('button', { name: /\{\{vainqueur\}\}/ });
    await expect(vainqueur).not.toHaveAttribute('aria-disabled', 'true');
    // Le lendemain avancé au jour même : la soirée n'est pas finie, plus de vainqueur.
    await page.getByLabel('Jour d’envoi').selectOption('0');
    await expect(vainqueur).toHaveAttribute('aria-disabled', 'true');
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

  test('des infos pratiques non enregistrées sont protégées', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/emails?onglet=dates');
    const carte = page.getByRole('article', { name: /Lunel/ });
    await carte.getByLabel('Infos pratiques').fill('Parking derrière la mairie.');
    await page.getByRole('tab', { name: 'Envois' }).click();
    await expect(page.getByText('Vos modifications ne sont pas enregistrées. Quitter quand même ?')).toBeFocused();
    await page.getByRole('button', { name: 'Rester' }).click();
    await expect(carte.getByLabel('Infos pratiques')).toHaveValue('Parking derrière la mairie.');
    // Une fois enregistrées, plus rien n'est retenu.
    await carte.getByRole('button', { name: 'Enregistrer les infos' }).click();
    await expect(carte.getByRole('status').filter({ hasText: 'Infos pratiques enregistrées' })).toBeVisible();
    await page.getByRole('tab', { name: 'Envois' }).click();
    await expect(page.getByRole('tab', { name: 'Envois' })).toHaveAttribute('aria-selected', 'true');
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
      cle: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
    });
    // Le message rejoint l'historique de la date, au-dessus des anciens.
    const historique = carte.getByRole('region', { name: 'Messages envoyés' }).getByRole('listitem');
    await expect(historique).toHaveCount(2);
    await expect(historique.first()).toContainText(MODELES_DEFAUT.message.sujet);
    await expect(historique.first()).toContainText('3 personnes');
  });

  test('Envois : bilan par étape, raisons des sauts, mode et désinscrits', async ({ page }) => {
    const simulation = await ouvrirAdmin(page);
    await page.goto('/admin/emails?onglet=envois');
    await expect(page.getByText('Simulation (log)', { exact: true })).toBeVisible({ timeout: 8000 });
    const tableau = page.getByRole('table', { name: 'Bilan des envois' });
    await expect(tableau.getByRole('row', { name: /Confirmation de l’adresse/ })).toContainText('12');
    await expect(tableau.getByRole('row', { name: /La veille/ })).toContainText('Lunel');
    await expect(tableau.getByRole('row', { name: /La veille/ })).toContainText('Dernière tentative');
    await expect(tableau.getByRole('row', { name: /Confirmation de l’adresse/ })).not.toContainText('Dernière tentative');
    await expect(page.getByText('Fenêtre d’envoi dépassée')).toBeVisible();
    await expect(page.getByText('Rendu impossible')).toBeVisible();
    await expect(page.getByText('Autre raison (échec du serveur d’envoi après 3 essais…)')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Désinscrits' })).toContainText('4');
    // Raisons lues dans la vue du bilan : plus aucune requête sur envois_emails.
    expect(simulation.lecturesEnvois).toEqual([]);
    // « Actualiser » relit sur place, sans repasser par le chargement de tout l'écran.
    await page.getByRole('button', { name: 'Actualiser' }).click();
    await expect(page.getByText('Lecture des emails…')).toHaveCount(0);
    await expect(tableau).toBeVisible();
    await expect(page.getByRole('button', { name: 'Actualiser' })).toBeEnabled();
  });

  test('un message refusé par le serveur reste ouvert et se renvoie avec « Réessayer », avec la même clé', async ({ page }) => {
    await ouvrirAdmin(page);
    let essais = 0;
    const cles: unknown[] = [];
    await page.route('**/api/admin/emails/message', (route) => {
      essais += 1;
      cles.push((route.request().postDataJSON() as { cle?: unknown }).cle);
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
    // Idempotence (contrat C-0.7) : la clé tirée à l'ouverture part avec chaque essai.
    expect(typeof cles[0]).toBe('string');
    expect(cles[1]).toBe(cles[0]);
    await expect(carte.getByRole('button', { name: 'Écrire aux inscrits' })).toBeFocused();
    // Un nouveau message a une nouvelle clé.
    await carte.getByRole('button', { name: 'Écrire aux inscrits' }).click();
    await carte.getByRole('textbox', { name: 'Corps du message', exact: true }).fill('Bonjour,\n\nAutre info.');
    await carte.getByRole('button', { name: 'Vérifier et envoyer' }).click();
    await carte.getByRole('button', { name: 'Oui, envoyer' }).click();
    await expect.poll(() => cles.length).toBe(3);
    expect(cles[2]).not.toBe(cles[0]);
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

  test('les bandeaux disent chaque raison d’inactivité, et « pour de vrai » seulement prêt en smtp', async ({ page }) => {
    await ouvrirAdmin(page, { etat: { mode: 'smtp', pret: false, raisonsInactif: ['barriere', 'identite'], barriereActive: true } });
    await page.goto('/admin/emails');
    const panneau = page.getByRole('tabpanel');
    await expect(panneau.getByText('L’envoi réel est demandé, mais aucun email ne part.')).toBeVisible({ timeout: 8000 });
    await expect(panneau.getByText('Le site est encore privé (barrière d’accès) : aucun email réel ne part.')).toBeVisible();
    await expect(panneau.getByText(/^Identité de l’organisateur manquante\s:\saucun email réel ne partira/)).toBeVisible();
    await page.getByRole('tab', { name: 'Envois' }).click();
    const serveur = page.getByRole('region', { name: 'Serveur d’envoi' });
    await expect(serveur).toContainText('Envoi réel (smtp)');
    await expect(serveur).not.toContainText('Les emails partent pour de vrai.');
    await expect(serveur).toContainText('Active : le site est privé');
    await expect(serveur.getByRole('listitem')).toHaveCount(2);
  });

  test('prêt en smtp : « les emails partent pour de vrai », sans bandeau', async ({ page }) => {
    await ouvrirAdmin(page, { etat: { mode: 'smtp', pret: true } });
    await page.goto('/admin/emails?onglet=envois');
    await expect(page.getByRole('region', { name: 'Serveur d’envoi' })).toContainText('Les emails partent pour de vrai.', { timeout: 8000 });
    await expect(page.getByText('Aucun email ne part réellement.')).toHaveCount(0);
    await expect(page.getByText('Le planificateur ne passe plus.')).toHaveCount(0);
  });

  test('une panne du planificateur est signalée, avec l’heure et le message de la dernière erreur', async ({ page }) => {
    const ilYA = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
    await ouvrirAdmin(page, { etat: { dernierPassage: ilYA(25), derniereErreur: { instant: ilYA(1), message: 'Supabase injoignable' } } });
    await page.goto('/admin/emails');
    await expect(page.getByText('Le planificateur ne passe plus.')).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('tabpanel')).toContainText('il y a plus de 10 minutes');
    await page.getByRole('tab', { name: 'Envois' }).click();
    const serveur = page.getByRole('region', { name: 'Serveur d’envoi' });
    await expect(serveur).toContainText('Supabase injoignable');
    await expect(page.getByRole('tabpanel').getByText('Le planificateur ne passe plus.')).toBeVisible();
  });

  test('« Titre » fait de la ligne courante le titre de l’email', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/emails?modele=veille');
    await corpsDuMessage(page).fill('Bonjour {{prenom}},\n\nRendez-vous ce soir');
    await corpsDuMessage(page).evaluate((champ: HTMLTextAreaElement) => champ.setSelectionRange(champ.value.length, champ.value.length));
    await page.getByRole('group', { name: 'Mise en forme' }).getByRole('button', { name: 'Titre' }).click();
    await expect(corpsDuMessage(page)).toHaveValue('Bonjour {{prenom}},\n\n# Rendez-vous ce soir');
    await expect(page.getByText(/Une ligne qui commence par «\s#\s» devient le titre de l’email/)).toBeVisible();
  });

  test('garde-fous : confirmation sans promotion, message réservé aux infos pratiques, infos publiques', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/emails?modele=confirmation');
    await expect(page.getByText('Cet email ne doit contenir aucune promotion : il sert seulement à vérifier l’adresse.')).toBeVisible({ timeout: 8000 });
    await page.goto('/admin/emails?modele=veille');
    await expect(page.getByRole('heading', { name: 'La veille', level: 2 })).toBeVisible();
    await expect(page.getByText(/aucune promotion/)).toHaveCount(0);
    await page.goto('/admin/emails?onglet=dates');
    const carte = page.getByRole('article', { name: /Lunel/ });
    await expect(carte.getByText('Ces infos sont publiques (visibles sur le site) : n’y mettez rien de privé.')).toBeVisible();
    await expect(carte.getByLabel('Infos pratiques')).toHaveAccessibleDescription(/Ces infos sont publiques/);
    await carte.getByRole('button', { name: 'Écrire aux inscrits' }).click();
    await expect(carte.getByText('Réservé aux informations pratiques (horaire, report, annulation). Une autre date s’annonce par l’annonce.')).toBeVisible();
    // Historique des messages de la date : objet, moment, nombre de destinataires.
    const historique = carte.getByRole('region', { name: 'Messages envoyés' });
    await expect(historique.getByRole('listitem')).toHaveCount(1);
    await expect(historique).toContainText('Le parking change de place');
    await expect(historique).toContainText('3 personnes');
    await expect(page.getByRole('article', { name: /Sommières/ }).getByText('Aucun message envoyé pour cette date.')).toBeVisible();
  });

  test('l’aperçu suit la bascule des annonces, et avertit quand l’identité de l’organisateur manque', async ({ page }) => {
    await ouvrirAdmin(page, { identite: [] });
    const nimes = { ...DATE_BEZOUCE, id: 'date-nimes', ville: 'Nîmes', date_soiree: jourParis(20), statut: 'confirmee' };
    await page.route('**/rest/v1/calendrier*', (route) => (
      route.request().method() === 'GET' ? route.fulfill({ json: [DATE_PROCHE, nimes, DATE_SOMMIERES, DATE_BEZOUCE] }) : route.fallback()
    ));
    await page.goto('/admin/emails?modele=veille');
    const bascule = page.getByLabel('Aperçu pour une personne qui a accepté les annonces');
    await expect(bascule).not.toBeChecked();
    await expect(page.getByText('Identité de l’organisateur manquante : aucun email réel ne partira tant qu’elle n’est pas renseignée.')).toBeVisible();
    await corpsDuMessage(page).fill('Bonjour,\n\nLes autres dates :\n\n{{prochaines_dates}}');
    await expect(apercu(page)).not.toContainText('Nîmes');
    await bascule.check();
    await expect(apercu(page)).toContainText('Nîmes');
    // Comme l'envoi : une date dont la soirée liée est reportée n'est pas proposée.
    await expect(apercu(page)).not.toContainText('Sommières');
    // L'annonce et les prochaines dates ne partent qu'aux consentants : la bascule part cochée.
    await page.goto('/admin/emails?modele=prochaines_dates');
    await expect(page.getByLabel('Aperçu pour une personne qui a accepté les annonces')).toBeChecked();
    await page.goto('/admin/emails?modele=confirmation');
    await expect(page.getByRole('heading', { name: /Confirmation/, level: 2 })).toBeVisible();
    await expect(page.getByLabel('Aperçu pour une personne qui a accepté les annonces')).toHaveCount(0);
  });

  test('avec l’identité renseignée, l’aperçu ne montre pas d’avertissement', async ({ page }) => {
    await ouvrirAdmin(page);
    await page.goto('/admin/emails?modele=veille');
    await expect(apercu(page)).toContainText('Bonjour Camille');
    await expect(page.getByText(/Identité de l’organisateur manquante/)).toHaveCount(0);
  });

  test('l’interrupteur garde le focus pendant l’écriture (aria-disabled)', async ({ page }) => {
    await ouvrirAdmin(page);
    let liberer: () => void = () => {};
    const attente = new Promise<void>((resolve) => { liberer = resolve; });
    await page.route('**/rest/v1/modeles_emails*', async (route) => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      await attente;
      return route.fallback();
    });
    await page.goto('/admin/emails');
    const veille = page.getByRole('switch', { name: /La veille/ });
    await veille.click();
    await expect(veille).toHaveAttribute('aria-disabled', 'true');
    await expect(veille).toBeFocused();
    liberer();
    await expect(veille).toHaveAttribute('aria-checked', 'false');
    await expect(veille).not.toHaveAttribute('aria-disabled', 'true');
    await expect(veille).toBeFocused();
  });

  test('la page des abonnés affiche l’état de confirmation de chacun, sans adresse dans les URL', async ({ page }) => {
    await ouvrirAdmin(page);
    const entetes = (total: number) => ({ 'content-range': `0-${total - 1}/${total}`, 'access-control-expose-headers': 'content-range' });
    const abonnes = ['lea', 'paul', 'zoe', 'max'].map((prenom, index) => ({
      id: `a${index}`, email: `${prenom}@exemple.fr`, consentement_le: `2026-10-1${6 - index}T08:00:00Z`,
    }));
    await page.route('**/rest/v1/abonnements_actualites*', (route) => route.fulfill({ headers: entetes(4), json: abonnes }));
    const lectures: string[] = [];
    await page.route('**/rest/v1/destinataires_emails*', (route) => {
      lectures.push(route.request().url());
      return route.fulfill({
        headers: entetes(3),
        json: [
          { email: 'lea@exemple.fr', abonnement_a_confirmer: false, desinscrit_le: null },
          { email: 'paul@exemple.fr', abonnement_a_confirmer: true, desinscrit_le: '2026-09-01T00:00:00Z' },
          { email: 'zoe@exemple.fr', abonnement_a_confirmer: true, desinscrit_le: null },
        ],
      });
    });
    await page.goto('/admin/abonnes');
    const liste = page.getByRole('region', { name: 'Liste des abonnés' });
    const ligne = (email: string) => liste.getByRole('listitem').filter({ hasText: email });
    await expect(ligne('lea@exemple.fr')).toContainText('Confirmé', { timeout: 8000 });
    await expect(ligne('paul@exemple.fr')).toContainText('Désinscrit, nouvelle demande en attente de confirmation');
    await expect(ligne('zoe@exemple.fr')).toContainText('En attente de confirmation');
    await expect(ligne('max@exemple.fr')).toContainText('État d’envoi inconnu');
    await expect(liste).toContainText('Chaque nouvelle adresse reçoit d’abord un email de confirmation');
    expect(lectures).toHaveLength(1);
    expect(lectures[0]).toContain('abonne=eq.true');
    expect(lectures.some((url) => url.includes('exemple.fr'))).toBe(false);
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
