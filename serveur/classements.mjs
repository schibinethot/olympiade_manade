// @ts-check
// Moteur de classements (CDC §4.6). Tous les classements sont calculés, quel que soit le mode affiché.
// Une note absente ne vaut jamais zéro : la manade est exclue de cette épreuve.
// Égalité : même rang (classement de compétition, le rang suivant saute).
// Points de place : N = manades classées sur l'épreuve, le rang r reçoit N − r + 1.

/**
 * @typedef {{
 *   id: string,
 *   epreuveId: string,
 *   epreuveNom: string,
 *   epreuveOrdre: number,
 *   manadeId: string,
 *   manadeNom: string,
 *   publicOuvert: boolean,
 *   juryOuvert: boolean,
 *   notesPublic: number[],
 *   notesJury: number[],
 * }} PassageCalcul
 */

/**
 * @typedef {{
 *   mode: 'separe' | 'combine' | 'jury',
 *   methode: 'points' | 'moyenne',
 *   poidsJury: number,
 *   baremeJury: number,
 * }} ReglagesClassement
 */

/**
 * @typedef {{
 *   manadeId: string,
 *   manadeNom: string,
 *   score: number,
 *   votes: number | null,
 *   rang: number,
 *   points: number,
 * }} LigneEpreuve
 */

/**
 * @typedef {{
 *   manadeId: string,
 *   manadeNom: string,
 *   total: number,
 *   epreuves: number,
 *   rang: number,
 * }} LigneGeneral
 */

/**
 * @typedef {{
 *   provisoire: boolean,
 *   officiel: 'separe' | 'combine' | 'jury',
 *   methode: 'points' | 'moyenne',
 *   parEpreuve: {
 *     epreuveId: string,
 *     nom: string,
 *     ordre: number,
 *     public: LigneEpreuve[] | null,
 *     jury: LigneEpreuve[] | null,
 *     combine: LigneEpreuve[] | null,
 *   }[],
 *   general: {
 *     public: LigneGeneral[] | null,
 *     jury: LigneGeneral[] | null,
 *     combine: LigneGeneral[] | null,
 *   },
 * }} ResultatClassements
 */

/** @param {number} a @param {number} b */
function presqueEgal(a, b) {
  return Math.abs(a - b) < 1e-9;
}

/** @param {number[]} notes */
function moyenne(notes) {
  if (notes.length === 0) return null;
  return notes.reduce((somme, note) => somme + note, 0) / notes.length;
}

/**
 * @param {{ manadeId: string, manadeNom: string, score: number, votes: number | null }[]} lignes
 * @returns {LigneEpreuve[]}
 */
function classerEpreuve(lignes) {
  const tries = [...lignes].sort((a, b) => b.score - a.score || a.manadeNom.localeCompare(b.manadeNom, 'fr'));
  const n = tries.length;
  let rang = 1;
  return tries.map((ligne, index) => {
    if (index > 0 && !presqueEgal(ligne.score, tries[index - 1].score)) rang = index + 1;
    return { ...ligne, rang, points: n - rang + 1 };
  });
}

/**
 * @param {Map<string, { manadeId: string, manadeNom: string, scores: number[], points: number }>} parManade
 * @param {'points' | 'moyenne'} methode
 * @returns {LigneGeneral[]}
 */
function classerGeneral(parManade, methode) {
  /** @type {{ manadeId: string, manadeNom: string, total: number, epreuves: number }[]} */
  const lignes = [];
  for (const manade of parManade.values()) {
    if (manade.scores.length === 0 && manade.points === 0 && methode === 'moyenne') continue;
    if (methode === 'moyenne' && manade.scores.length === 0) continue;
    const total = methode === 'points'
      ? manade.points
      : manade.scores.reduce((somme, score) => somme + score, 0) / manade.scores.length;
    lignes.push({ manadeId: manade.manadeId, manadeNom: manade.manadeNom, total, epreuves: manade.scores.length });
  }
  const tries = lignes.sort((a, b) => b.total - a.total || a.manadeNom.localeCompare(b.manadeNom, 'fr'));
  let rang = 1;
  return tries.map((ligne, index) => {
    if (index > 0 && !presqueEgal(ligne.total, tries[index - 1].total)) rang = index + 1;
    return { ...ligne, rang };
  });
}

/**
 * @param {PassageCalcul[]} passages
 * @param {'public' | 'jury' | 'combine'} canal
 * @param {ReglagesClassement} reglages
 */
function scoresEpreuve(passages, canal, reglages) {
  /** @type {{ manadeId: string, manadeNom: string, score: number, votes: number | null }[]} */
  const lignes = [];
  for (const passage of passages) {
    const publicMoyenne = moyenne(passage.notesPublic);
    const juryBrut = moyenne(passage.notesJury);
    const juryDix = juryBrut === null || reglages.baremeJury <= 0 ? null : juryBrut * (10 / reglages.baremeJury);
    let score = null;
    let votes = null;
    if (canal === 'public') {
      score = publicMoyenne;
      votes = passage.notesPublic.length;
    } else if (canal === 'jury') {
      score = juryDix;
      votes = passage.notesJury.length;
    } else if (publicMoyenne !== null && juryDix !== null) {
      const poids = Math.min(100, Math.max(0, reglages.poidsJury)) / 100;
      score = poids * juryDix + (1 - poids) * publicMoyenne;
      votes = passage.notesPublic.length;
    }
    if (score === null) continue;
    lignes.push({ manadeId: passage.manadeId, manadeNom: passage.manadeNom, score, votes });
  }
  return classerEpreuve(lignes);
}

/**
 * @param {PassageCalcul[]} passages
 * @param {ReglagesClassement} reglages
 * @returns {ResultatClassements}
 */
export function calculerClassements(passages, reglages) {
  const groupes = new Map();
  for (const passage of passages) {
    const liste = groupes.get(passage.epreuveId) ?? [];
    liste.push(passage);
    groupes.set(passage.epreuveId, liste);
  }
  const epreuves = [...groupes.entries()]
    .map(([epreuveId, liste]) => ({
      epreuveId,
      nom: liste[0]?.epreuveNom ?? '',
      ordre: liste[0]?.epreuveOrdre ?? 0,
      passages: liste,
    }))
    .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, 'fr'));

  /** @type {ResultatClassements['parEpreuve']} */
  const parEpreuve = [];
  /** @type {Map<string, Map<string, { manadeId: string, manadeNom: string, scores: number[], points: number }>>} */
  const cumuls = new Map([
    ['public', new Map()],
    ['jury', new Map()],
    ['combine', new Map()],
  ]);

  for (const epreuve of epreuves) {
    /** @type {Record<'public' | 'jury' | 'combine', LigneEpreuve[]>} */
    const canaux = {
      public: scoresEpreuve(epreuve.passages, 'public', reglages),
      jury: scoresEpreuve(epreuve.passages, 'jury', reglages),
      combine: scoresEpreuve(epreuve.passages, 'combine', reglages),
    };
    for (const canal of /** @type {const} */ (['public', 'jury', 'combine'])) {
      const cumul = cumuls.get(canal);
      if (!cumul) continue;
      for (const ligne of canaux[canal]) {
        const existant = cumul.get(ligne.manadeId) ?? {
          manadeId: ligne.manadeId, manadeNom: ligne.manadeNom, scores: [], points: 0,
        };
        existant.scores.push(ligne.score);
        existant.points += ligne.points;
        cumul.set(ligne.manadeId, existant);
      }
    }
    parEpreuve.push({
      epreuveId: epreuve.epreuveId,
      nom: epreuve.nom,
      ordre: epreuve.ordre,
      public: canaux.public,
      jury: canaux.jury,
      combine: canaux.combine,
    });
  }

  const provisoire = passages.some((passage) =>
    passage.publicOuvert || passage.juryOuvert || passage.notesJury.length === 0);

  return {
    provisoire,
    officiel: reglages.mode,
    methode: reglages.methode,
    parEpreuve,
    general: {
      public: classerGeneral(cumuls.get('public') ?? new Map(), reglages.methode),
      jury: classerGeneral(cumuls.get('jury') ?? new Map(), reglages.methode),
      combine: classerGeneral(cumuls.get('combine') ?? new Map(), reglages.methode),
    },
  };
}

/** @param {string} valeur */
function celluleCsv(valeur) {
  if (/[;"\r\n]/.test(valeur)) return `"${valeur.replaceAll('"', '""')}"`;
  return valeur;
}

/** Export des classements calculés, séparateur point-virgule, comme la supervision. @param {ResultatClassements} resultat */
export function exporterClassementsCsv(resultat) {
  const entete = 'portee;epreuve;canal;rang;manade;score;votes_ou_epreuves;points;provisoire';
  /** @type {string[]} */
  const lignes = [];
  for (const epreuve of resultat.parEpreuve) {
    for (const canal of /** @type {const} */ (['public', 'jury', 'combine'])) {
      for (const ligne of epreuve[canal] ?? []) {
        lignes.push([
          'epreuve', epreuve.nom, canal, String(ligne.rang), ligne.manadeNom,
          String(ligne.score), String(ligne.votes ?? ''), String(ligne.points),
          resultat.provisoire ? 'oui' : 'non',
        ].map(celluleCsv).join(';'));
      }
    }
  }
  for (const canal of /** @type {const} */ (['public', 'jury', 'combine'])) {
    for (const ligne of resultat.general[canal] ?? []) {
      lignes.push([
        'general', '', canal, String(ligne.rang), ligne.manadeNom,
        String(ligne.total), String(ligne.epreuves), '',
        resultat.provisoire ? 'oui' : 'non',
      ].map(celluleCsv).join(';'));
    }
  }
  return `\uFEFF${[entete, ...lignes].join('\r\n')}`;
}

/**
 * Statut public effectif : un passage encore « ouvert » dont l'échéance est passée s'affiche fermé.
 * @param {{ statutPublic: string, fermeLe: string | null, finPassageLe: string | null, heureFin: string | null, delaiMinutes: number | null, modeVote: string }} passage
 * @param {number} maintenant
 */
export function statutPublicEffectif(passage, maintenant) {
  if (passage.statutPublic !== 'ouvert' && passage.modeVote !== 'libre') return passage.statutPublic;
  const echeance = passage.fermeLe
    ?? (passage.delaiMinutes == null
      ? null
      : passage.finPassageLe
        ? new Date(new Date(passage.finPassageLe).getTime() + passage.delaiMinutes * 60_000).toISOString()
        : passage.modeVote === 'libre' && passage.heureFin
          ? new Date(new Date(passage.heureFin).getTime() + passage.delaiMinutes * 60_000).toISOString()
          : null);
  if (echeance && maintenant >= Date.parse(echeance)) return 'clos';
  if (passage.modeVote === 'libre') return 'ouvert';
  return passage.statutPublic;
}
