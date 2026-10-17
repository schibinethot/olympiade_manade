#!/usr/bin/env node
/**
 * Smoke HTTP production — administration (sans identifiants).
 * Usage : pnpm smoke:prod-admin
 * Override : PROD_URL=https://… node scripts/smoke-prod-admin.mjs
 */

const BASE = (process.env.PROD_URL ?? 'https://olympiadedesmanades.fr').replace(/\/$/, '');

const pages = ['/admin', '/admin/statistiques'];
const apis = ['/api/admin/supervision', '/api/admin/supervision?heures=24'];

let echecs = 0;

async function verifier(chemin, attendu, libelle) {
  const url = `${BASE}${chemin}`;
  const reponse = await fetch(url, { redirect: 'follow' });
  const corps = await reponse.text();
  if (reponse.status !== attendu.statut) {
    console.error(`KO ${libelle} ${url} → HTTP ${reponse.status} (attendu ${attendu.statut})`);
    echecs += 1;
    return;
  }
  if (attendu.corps && !corps.includes(attendu.corps)) {
    console.error(`KO ${libelle} ${url} → corps sans « ${attendu.corps} »`);
    echecs += 1;
    return;
  }
  if (attendu.json) {
    try {
      const data = JSON.parse(corps);
      for (const [cle, valeur] of Object.entries(attendu.json)) {
        if (data[cle] !== valeur) {
          console.error(`KO ${libelle} ${url} → JSON ${cle}=${JSON.stringify(data[cle])} (attendu ${JSON.stringify(valeur)})`);
          echecs += 1;
          return;
        }
      }
    } catch {
      console.error(`KO ${libelle} ${url} → réponse non JSON`);
      echecs += 1;
      return;
    }
  }
  console.log(`OK ${libelle} ${url} → ${reponse.status}`);
}

console.log(`Smoke admin prod — ${BASE}\n`);

for (const chemin of pages) {
  await verifier(chemin, { statut: 200, corps: '<div' }, 'page');
}

for (const chemin of apis) {
  await verifier(chemin, { statut: 401, json: { error: 'authentication_required' } }, 'API anonyme');
}

if (echecs) {
  console.error(`\n${echecs} échec(s).`);
  process.exit(1);
}
console.log('\nTous les contrôles smoke admin sont passés.');
