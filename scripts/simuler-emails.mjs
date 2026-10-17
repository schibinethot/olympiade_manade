// Simulation de la séquence d'e-mails sur le calendrier réel, sans rien écrire.
//
// Lit le calendrier public (clé publishable, lecture anonyme), crée 4 destinataires fictifs rattachés à la
// prochaine date confirmée, puis rejoue calculerEnvois toutes les 15 minutes sur 30 jours, comme le
// planificateur (chaque envoi prévu est considéré comme parti). Affiche le tableau des envois prévus et
// des étapes sautées.
//
// Usage : node --env-file=.env.local scripts/simuler-emails.mjs [--depuis=AAAA-MM-JJ] [--jours=30] [--supposer-confirmees]
//   Variables lues : VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (publiques).
//   --depuis : début de la simulation (00:00, Paris). Par défaut : 9 jours avant la prochaine date
//   confirmée, ou maintenant si elle est plus proche.
//   --supposer-confirmees : hypothèse affichée en tête, les dates prévisionnelles à venir sont traitées
//   comme confirmées (avant l'ouverture de la saison, aucune date ne l'est encore).

import { calculerEnvois, echeance } from '../serveur/echeances-emails.mjs';
import { CONSENTEMENT_ANNONCES_TEXTE, ETAPES, MODELES_DEFAUT } from '../serveur/gabarits-emails.mjs';

const PAS_MS = 15 * 60_000;
const JOUR_MS = 86_400_000;
const PARIS = 'Europe/Paris';
const JOUR_PARIS = new Intl.DateTimeFormat('en-CA', { timeZone: PARIS, year: 'numeric', month: '2-digit', day: '2-digit' });
const AFFICHAGE = new Intl.DateTimeFormat('fr-FR', {
  timeZone: PARIS, weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

/** @param {number} ms */
const jourParis = (ms) => JOUR_PARIS.format(ms);
/** Jour des soirées (comme prive.jour_des_soirees) : avant 06:00, l'instant compte pour la veille. @param {number} ms */
const jourDesSoirees = (ms) => JOUR_PARIS.format(ms - 6 * 3_600_000);
/** @param {string} jour @param {number} n */
const decaler = (jour, n) => new Date(Date.parse(`${jour}T00:00:00Z`) + n * JOUR_MS).toISOString().slice(0, 10);
/** Instant Paris d'un jour et d'une heure : réutilise le calcul des échéances (changements d'heure compris). @param {string} jour @param {string} heure */
const instantParis = (jour, heure) => /** @type {Date} */ (echeance({ cle: 'veille', jours_decalage: 0, heure_envoi: heure }, { date_soiree: jour })).getTime();

function options() {
  const arguments_ = process.argv.slice(2);
  const lues = Object.fromEntries(arguments_.map((a) => /^--([a-z]+)=(.*)$/.exec(a)).filter(Boolean).map((m) => [m[1], m[2]]));
  const jours = Number(lues.jours ?? 30);
  if (!Number.isInteger(jours) || jours < 1 || jours > 90) throw new Error('--jours : entier de 1 à 90.');
  if (lues.depuis !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(lues.depuis)) throw new Error('--depuis : AAAA-MM-JJ.');
  return { jours, depuis: lues.depuis ?? null, supposer: arguments_.includes('--supposer-confirmees') };
}

/** Lecture anonyme du calendrier ; les colonnes et la soirée embarquée sont facultatives (migration pas encore déployée, RLS). */
async function lireCalendrier() {
  const base = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, '');
  const cle = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !cle) {
    throw new Error('VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY sont requises (node --env-file=.env.local scripts/simuler-emails.mjs).');
  }
  const colonnes = 'id,nom,ville,arenes,date_soiree,heure,statut,lien_billetterie';
  for (const select of [`${colonnes},infos_pratiques,soirees(slug,statut)`, `${colonnes},soirees(slug,statut)`, colonnes]) {
    const reponse = await fetch(`${base}/rest/v1/calendrier?select=${select}&order=date_soiree.asc,heure.asc.nullslast,id.asc`, {
      headers: { apikey: cle },
      signal: AbortSignal.timeout(10_000),
    });
    if (reponse.ok) {
      const lignes = await reponse.json();
      return lignes.map((/** @type {Record<string, any>} */ l) => ({
        id: l.id, nom: l.nom, ville: l.ville, arenes: l.arenes ?? null, date_soiree: l.date_soiree, heure: l.heure ?? null,
        statut: l.statut, lien_billetterie: l.lien_billetterie ?? null, infos_pratiques: l.infos_pratiques ?? null,
        soiree: l.soirees ? { slug: l.soirees.slug, statut: l.soirees.statut } : null, manades: [], vainqueur: null,
      }));
    }
    if (reponse.status !== 400) throw new Error(`Lecture du calendrier impossible (HTTP ${reponse.status}).`);
  }
  throw new Error('Lecture du calendrier impossible.');
}

/** @param {any[]} dates @param {number} instant */
function prochaineConfirmee(dates, instant) {
  const jour = jourDesSoirees(instant);
  return dates.find((d) => d.statut === 'confirmee' && d.date_soiree >= jour) ?? null;
}

async function principal() {
  const { jours, depuis, supposer } = options();
  const maintenant = Date.now();
  const lues = await lireCalendrier();
  const parStatut = lues.reduce((/** @type {Record<string, number>} */ n, d) => ({ ...n, [d.statut]: (n[d.statut] ?? 0) + 1 }), {});
  const aujourdhui = jourParis(maintenant);
  const dates = supposer
    ? lues.map((d) => (d.statut === 'previsionnelle' && d.date_soiree >= aujourdhui ? { ...d, statut: 'confirmee' } : d))
    : lues;
  const cible = prochaineConfirmee(dates, maintenant);
  if (!cible) {
    console.log(`Aucune date confirmée à venir (${lues.length} dates lues : ${JSON.stringify(parStatut)}) : rien à simuler.`);
    console.log('Relancer avec --supposer-confirmees pour simuler la saison comme si les dates prévisionnelles à venir étaient confirmées.');
    return;
  }
  if (supposer) console.log(`HYPOTHÈSE : les dates prévisionnelles à venir sont traitées comme confirmées (${JSON.stringify(parStatut)} en base).`);
  const debutParDefaut = Math.max(maintenant, instantParis(decaler(cible.date_soiree, -9), '00:00'));
  const debut = depuis ? instantParis(depuis, '00:00') : debutParDefaut;
  const fin = debut + jours * JOUR_MS;
  const a = (/** @type {number} */ decalageJours, /** @type {string} */ heure) => instantParis(decaler(cible.date_soiree, decalageJours), heure);

  // Les 4 personnes fictives : spectateurs (adresse vérifiée), la dernière consent aux annonces.
  const personnes = [
    { id: '00000000-0000-4000-8000-000000000001', libelle: 'Inscrite à J-8', inscrit: a(-8, '12:00'), annonces: false },
    { id: '00000000-0000-4000-8000-000000000002', libelle: 'Inscrite à J-3, 20:00', inscrit: a(-3, '20:00'), annonces: false },
    { id: '00000000-0000-4000-8000-000000000003', libelle: 'Inscrite la veille, 20:00', inscrit: a(-1, '20:00'), annonces: false },
    { id: '00000000-0000-4000-8000-000000000004', libelle: 'Consent aux annonces', inscrit: debut + 9 * 3_600_000, annonces: true },
  ];
  const libelle = new Map(personnes.map((p) => [p.id, p.libelle]));
  const parId = new Map(dates.map((d) => [d.id, d]));
  /** @type {Map<string, { destinataire_id: string, calendrier_id: string, origine: 'inscription', cree_le: string }>} */
  const rattachements = new Map();
  /** @type {any[]} */
  const envois = [];
  /** @type {{ instant: number, qui: string, etape: string, dates: string }[]} */
  const prevus = [];
  /** @type {{ instant: number, qui: string, etape: string, dates: string, raison: string }[]} */
  const sautes = [];
  const modeles = ETAPES.map((cle) => ({ cle, actif: true, ...MODELES_DEFAUT[cle] }));
  const nomDates = (/** @type {string[]} */ ids) => ids.map((id) => {
    const d = parId.get(id);
    return d ? `${d.ville} ${d.date_soiree}` : id;
  }).join(' + ') || '—';

  for (let t = debut; t <= fin; t += PAS_MS) {
    const jour = jourParis(t);
    const visibles = personnes.filter((p) => p.inscrit <= t);
    for (const p of visibles) {
      if (rattachements.has(p.id)) continue;
      const date = prochaineConfirmee(dates, p.inscrit);
      if (date) rattachements.set(p.id, { destinataire_id: p.id, calendrier_id: date.id, origine: 'inscription', cree_le: new Date(p.inscrit).toISOString() });
    }
    const fenetre = dates.filter((d) => d.date_soiree >= decaler(jour, -8) && d.date_soiree <= decaler(jour, 17));
    const donnees = {
      modeles,
      dates: fenetre,
      prochaines: dates.filter((d) => d.statut === 'confirmee' && d.date_soiree > jour).slice(0, 6),
      destinataires: visibles.map((p) => ({
        id: p.id, email: `${p.id}@exemple.invalid`, prenom: 'Camille', profil_id: p.id, abonne: false, abonnement_a_confirmer: false,
        desinscrit: false, annonces: p.annonces, confirme_le: new Date(p.inscrit).toISOString(), inscrit_le: new Date(p.inscrit).toISOString(),
      })),
      rattachements: [...rattachements.values()].filter((r) => fenetre.some((d) => d.id === r.calendrier_id)),
      envois,
    };
    const { aEnvoyer, sautes: sautesDuPas } = calculerEnvois(/** @type {any} */ (donnees), new Date(t));
    for (const [liste, statut] of /** @type {const} */ ([[aEnvoyer, 'simule'], [sautesDuPas, 'saute']])) {
      for (const envoi of liste) {
        for (const calendrierId of envoi.calendrierIds.length ? envoi.calendrierIds : [null]) {
          envois.push({
            id: `${envois.length}`, destinataire_id: envoi.destinataireId, etape: envoi.etape, calendrier_id: calendrierId, message_id: null,
            reel: false, statut, raison: envoi.raison ?? null, tentatives: 0, prevu_le: envoi.prevuLe, envoye_le: statut === 'simule' ? new Date(t).toISOString() : null,
            cree_le: new Date(t).toISOString(),
          });
        }
        const ligne = { instant: statut === 'simule' ? t : Date.parse(envoi.prevuLe), qui: libelle.get(envoi.destinataireId) ?? '?', etape: envoi.etape, dates: nomDates(envoi.calendrierIds) };
        if (statut === 'simule') prevus.push(ligne);
        else sautes.push({ ...ligne, raison: envoi.raison ?? '' });
      }
    }
  }

  console.log(`Date suivie : ${cible.nom}, ${cible.ville}, ${cible.date_soiree}${cible.heure ? ` à ${cible.heure.slice(0, 5)}` : ''} (prochaine date confirmée).`);
  console.log(`Période : ${AFFICHAGE.format(debut)} → ${AFFICHAGE.format(fin)} (heure de Paris), ${dates.length} dates lues, ${dates.filter((d) => d.statut === 'confirmee').length} confirmées pour la simulation.`);
  console.log(`Consentement aux annonces de la 4e personne : « ${CONSENTEMENT_ANNONCES_TEXTE} »`);
  console.log('');
  console.log(`Envois prévus (${prevus.length}) :`);
  console.table(prevus.map((p) => ({ quand: AFFICHAGE.format(p.instant), personne: p.qui, etape: p.etape, dates: p.dates })));
  console.log(`Étapes sautées (${sautes.length}) :`);
  console.table(sautes.map((s) => ({ echeance: AFFICHAGE.format(s.instant), personne: s.qui, etape: s.etape, dates: s.dates, raison: s.raison })));
}

principal().catch((erreur) => {
  console.error(erreur instanceof Error ? erreur.message : 'Simulation impossible.');
  process.exit(1);
});
