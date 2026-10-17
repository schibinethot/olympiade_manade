#!/usr/bin/env node
// @ts-check
/**
 * Aperçus des 9 modèles d'e-mail par défaut de la séquence, pour relecture par un designer.
 * Rend chaque modèle (cible 'email') avec un contexte d'exemple aligné sur ce que le serveur fournit
 * (serveur/examen-envois.mjs), écrit le HTML et le texte, puis capture le HTML à 375 et 600 px (PNG,
 * pleine page). Le logo https://olympiadedesmanades.fr/email/logo.png est servi depuis public/email/.
 *
 * Lancer : node scripts/apercus-emails.mjs <dossier>   (jamais dans le dépôt)
 */

import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argv, exit } from 'node:process';
import { ETAPES, MODELES_DEFAUT, rendreEmail } from '../serveur/gabarits-emails.mjs';

/** @typedef {import('../serveur/gabarits-emails.mjs').ContexteEmail} ContexteEmail */
/** @typedef {import('../serveur/gabarits-emails.mjs').DateEnrichie} DateEnrichie */
/** @typedef {import('../serveur/gabarits-emails.mjs').DateAnnoncee} DateAnnoncee */

const ORIGINE = 'https://olympiadedesmanades.fr';
const LARGEURS = [375, 600];
const LOGO = readFileSync(fileURLToPath(new URL('../public/email/logo.png', import.meta.url)));
const DESINSCRIPTION = `${ORIGINE}/emails/desinscription?d=exemple&t=exemple`;

const dossier = argv[2] ? resolve(argv[2]) : null;
if (!dossier) {
  console.error('Usage : node scripts/apercus-emails.mjs <dossier>');
  exit(1);
}

/** @param {Partial<DateEnrichie> & { id: string }} surcharge @returns {DateEnrichie} */
const dateSoiree = (surcharge) => ({
  nom: 'Rencontre des manades',
  ville: 'Sommières',
  arenes: 'Arènes Gilles Arnaud',
  date_soiree: '2027-07-31',
  heure: '21:30',
  statut: 'confirmee',
  lien_billetterie: 'https://billetterie.exemple.fr/olympiade-sommieres',
  infos_pratiques: 'Parking gratuit derrière les arènes. Ouverture des portes à 20 h 30.',
  soiree: { slug: 'sommieres-2027', statut: 'publiee' },
  manades: ['Arlatenco', 'Vinuesa', 'Bon', 'Lagarde', 'Fabre-Mailhan', 'Saumade'],
  vainqueur: null,
  ...surcharge,
});

/** Dates à venir sans soirée ni détails : seules les listes les montrent. */
const sansDetails = { lien_billetterie: null, soiree: null, manades: [], infos_pratiques: null };

const SOMMIERES = dateSoiree({ id: 'd-sommieres' });
const MARSILLARGUES = dateSoiree({
  id: 'd-marsillargues', ville: 'Marsillargues', arenes: 'Arènes Marcel Guillarmet', date_soiree: '2027-08-06', ...sansDetails,
});
const BEAUCAIRE = dateSoiree({
  id: 'd-beaucaire', ville: 'Beaucaire', arenes: 'Arènes de Beaucaire', date_soiree: '2027-08-20', heure: '21:00', ...sansDetails,
});
const NIMES = dateSoiree({
  id: 'd-nimes', ville: 'Nîmes', arenes: 'Arènes de Nîmes', date_soiree: '2027-09-04', statut: 'previsionnelle', heure: null, ...sansDetails,
});

/** @param {DateEnrichie} d @returns {DateAnnoncee} */
const annoncee = (d) => ({ ...d, lienJeViens: `${ORIGINE}/emails/je-viens?j=${d.id}&t=exemple` });

/** Instant d'envoi : jour et heure de Paris en été (UTC+2). @param {string} jour @param {string} heure */
const instant = (jour, heure) => new Date(`${jour}T${heure}:00+02:00`);

/**
 * @param {string} jour jour d'envoi
 * @param {string} heure
 * @param {Partial<ContexteEmail>} [surcharge]
 * @returns {ContexteEmail}
 */
const contexte = (jour, heure, surcharge = {}) => ({
  prenom: 'Camille',
  maintenant: instant(jour, heure),
  origine: ORIGINE,
  date: SOMMIERES,
  prochaines: [MARSILLARGUES, BEAUCAIRE, NIMES].map(annoncee),
  annoncees: [],
  encartDateProche: false,
  liens: { desinscription: DESINSCRIPTION, confirmation: null, jeViens: null },
  ...surcharge,
});

/** Un e-mail par entrée ; la bienvenue en a deux (avec et sans encart de date proche). */
const APERCUS = [
  { fichier: 'confirmation', etape: 'confirmation', ctx: contexte('2027-07-01', '14:00', {
    date: null, prochaines: [],
    liens: { desinscription: DESINSCRIPTION, confirmation: `${ORIGINE}/emails/confirmation?j=exemple&t=exemple`, jeViens: null },
  }) },
  { fichier: 'bienvenue-date-proche', etape: 'bienvenue', ctx: contexte('2027-07-27', '15:00', { encartDateProche: true }) },
  { fichier: 'bienvenue-sans-encart', etape: 'bienvenue', ctx: contexte('2027-06-01', '15:00') },
  { fichier: 'j_moins_7', etape: 'j_moins_7', ctx: contexte('2027-07-24', '10:00') },
  { fichier: 'veille', etape: 'veille', ctx: contexte('2027-07-30', '18:00') },
  { fichier: 'jour_j', etape: 'jour_j', ctx: contexte('2027-07-31', '10:00') },
  { fichier: 'lendemain', etape: 'lendemain', ctx: contexte('2027-08-01', '10:00', {
    date: { ...SOMMIERES, vainqueur: 'Manade Vinuesa', soiree: { slug: 'sommieres-2027', statut: 'terminee' } },
  }) },
  { fichier: 'prochaines_dates', etape: 'prochaines_dates', ctx: contexte('2027-08-07', '10:00') },
  { fichier: 'annonce', etape: 'annonce', ctx: contexte('2027-07-27', '10:00', {
    date: MARSILLARGUES, prochaines: [], annoncees: [MARSILLARGUES, BEAUCAIRE].map(annoncee),
    liens: { desinscription: DESINSCRIPTION, confirmation: null, jeViens: annoncee(MARSILLARGUES).lienJeViens },
  }) },
  { fichier: 'message', etape: 'message', ctx: contexte('2027-07-29', '10:00') },
];

// Garde-fou : chaque étape de la séquence a au moins un aperçu.
const manquantes = ETAPES.filter((etape) => !APERCUS.some((a) => a.etape === etape));
if (manquantes.length) throw new Error(`Étapes sans aperçu : ${manquantes.join(', ')}`);

mkdirSync(dossier, { recursive: true });
const navigateur = await chromium.launch();
/** @type {string[]} */
const produits = [];
try {
  const page = await navigateur.newPage();
  await page.route(`${ORIGINE}/email/logo.png`, (route) => route.fulfill({ body: LOGO, contentType: 'image/png' }));
  // Toute autre requête réseau échoue : la capture ne dépend pas d'internet.
  await page.route((url) => url.protocol.startsWith('http') && url.href !== `${ORIGINE}/email/logo.png`, (route) => route.abort());

  for (const [i, { fichier, etape, ctx }] of APERCUS.entries()) {
    const base = `${String(i + 1).padStart(2, '0')}-${fichier}`;
    const rendu = rendreEmail(MODELES_DEFAUT[etape], ctx, { cible: 'email' });
    writeFileSync(join(dossier, `${base}.html`), rendu.html);
    writeFileSync(join(dossier, `${base}.txt`), `Sujet : ${rendu.sujet}\n\n${rendu.texte}`);
    produits.push(`${base}.html`, `${base}.txt`);
    for (const largeur of LARGEURS) {
      await page.setViewportSize({ width: largeur, height: 800 });
      await page.setContent(rendu.html, { waitUntil: 'load' });
      const png = `${base}-${largeur}.png`;
      await page.screenshot({ path: join(dossier, png), fullPage: true });
      produits.push(png);
    }
  }
} finally {
  await navigateur.close();
}

console.log(`${produits.length} fichiers dans ${dossier} :`);
for (const f of produits) console.log(`  ${f}`);
