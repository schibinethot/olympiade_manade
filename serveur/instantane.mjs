// @ts-check
// Instantané public etat_soiree (CDC §5.2, §5.3). Recalcul au plus toutes les 5 s
// lorsque ETAT_SOIREE_REEL=true. Sans ce drapeau, l'API publique reste figée hors soirée.

import { calculerClassements, statutPublicEffectif } from './classements.mjs';

const INTERVALLE_MS = 5_000;

/**
 * @param {number | null} delai
 * @param {string | null} finPassage
 * @param {string | null} heureFin
 * @param {string | null} fermeLe
 * @param {string} modeVote
 */
function echeanceIso(delai, finPassage, heureFin, fermeLe, modeVote) {
  if (fermeLe) return fermeLe;
  if (delai == null) return null;
  const base = finPassage ?? (modeVote === 'libre' ? heureFin : null);
  if (!base) return null;
  return new Date(Date.parse(base) + delai * 60_000).toISOString();
}

/**
 * @param {{
 *   soiree: {
 *     id: string, slug: string, nom: string, lieu: string | null, date_soiree?: string, statut: string,
 *     message_public: string | null, mode_vote: 'libre' | 'deblocage',
 *     mode_classement: 'separe' | 'combine' | 'jury', methode_general: 'points' | 'moyenne',
 *     poids_jury: number, bareme_jury: number, classement_visible: boolean,
 *     vote_debut: string, vote_fin: string, delai_vote_minutes: number | null,
 *   },
 *   epreuves: { id: string, nom: string, ordre: number, notee: boolean, heure_debut: string | null, heure_fin: string | null }[],
 *   passages: { id: string, epreuve_id: string, manade_id: string, ordre: number, statut_public: string, statut_jury: string, fin_passage_le: string | null, ferme_le: string | null }[],
 *   manades: { id: string, nom: string }[],
 *   notesPublic: { passage_id: string, note: number }[],
 *   notesJury: { passage_id: string, note: number }[],
 *   maintenant?: number,
 * }} entrees
 */
export function composerInstantane(entrees) {
  const maintenant = entrees.maintenant ?? Date.now();
  const noms = new Map(entrees.manades.map((manade) => [manade.id, manade.nom]));
  const epreuves = new Map(entrees.epreuves.map((epreuve) => [epreuve.id, epreuve]));
  const notesPublic = new Map();
  const notesJury = new Map();
  for (const note of entrees.notesPublic) {
    const liste = notesPublic.get(note.passage_id) ?? [];
    liste.push(Number(note.note));
    notesPublic.set(note.passage_id, liste);
  }
  for (const note of entrees.notesJury) {
    const liste = notesJury.get(note.passage_id) ?? [];
    liste.push(Number(note.note));
    notesJury.set(note.passage_id, liste);
  }

  const passages = entrees.passages.map((passage) => {
    const epreuve = epreuves.get(passage.epreuve_id);
    const effectif = epreuve?.notee
      ? statutPublicEffectif({
        statutPublic: passage.statut_public,
        fermeLe: passage.ferme_le,
        finPassageLe: passage.fin_passage_le,
        heureFin: epreuve.heure_fin,
        delaiMinutes: entrees.soiree.delai_vote_minutes,
        modeVote: entrees.soiree.mode_vote,
      }, maintenant)
      : passage.statut_public;
    return {
      id: passage.id,
      epreuveId: passage.epreuve_id,
      epreuve: epreuve?.nom ?? '',
      epreuveOrdre: epreuve?.ordre ?? 0,
      notee: Boolean(epreuve?.notee),
      manadeId: passage.manade_id,
      manade: noms.get(passage.manade_id) ?? '',
      ordre: passage.ordre,
      statutPublic: passage.statut_public,
      statutEffectif: effectif,
      statutJury: passage.statut_jury,
      fermeLe: echeanceIso(
        entrees.soiree.delai_vote_minutes,
        passage.fin_passage_le,
        epreuve?.heure_fin ?? null,
        passage.ferme_le,
        entrees.soiree.mode_vote,
      ),
      votes: (notesPublic.get(passage.id) ?? []).length,
    };
  }).sort((a, b) => a.epreuveOrdre - b.epreuveOrdre || a.ordre - b.ordre);

  const enPiste = passages.find((passage) => passage.notee && passage.statutEffectif === 'ouvert');
  const dansFenetre = maintenant >= Date.parse(entrees.soiree.vote_debut) && maintenant < Date.parse(entrees.soiree.vote_fin);
  const etat = entrees.soiree.statut === 'reportee' || entrees.soiree.statut === 'annulee' || entrees.soiree.statut === 'brouillon' || entrees.soiree.statut === 'terminee'
    ? 'hors-soiree'
    : entrees.soiree.statut === 'en_cours' || (entrees.soiree.statut === 'publiee' && (enPiste || (entrees.soiree.mode_vote === 'libre' && dansFenetre)))
      ? 'ouvert'
      : 'hors-soiree';

  const pourCalcul = passages.filter((passage) => passage.notee).map((passage) => ({
    id: passage.id,
    epreuveId: passage.epreuveId,
    epreuveNom: passage.epreuve,
    epreuveOrdre: passage.epreuveOrdre,
    manadeId: passage.manadeId,
    manadeNom: passage.manade,
    publicOuvert: passage.statutEffectif === 'ouvert',
    juryOuvert: passage.statutJury === 'ouvert',
    notesPublic: notesPublic.get(passage.id) ?? [],
    notesJury: notesJury.get(passage.id) ?? [],
  }));
  const classements = entrees.soiree.classement_visible
    ? calculerClassements(pourCalcul, {
      mode: entrees.soiree.mode_classement,
      methode: entrees.soiree.methode_general,
      poidsJury: entrees.soiree.poids_jury,
      baremeJury: entrees.soiree.bareme_jury,
    })
    : null;

  return {
    etat,
    source: 'instantane',
    soiree: {
      id: entrees.soiree.id,
      slug: entrees.soiree.slug,
      nom: entrees.soiree.nom,
      lieu: entrees.soiree.lieu,
      dateSoiree: entrees.soiree.date_soiree ?? null,
      statut: entrees.soiree.statut,
      messagePublic: entrees.soiree.message_public,
      modeVote: entrees.soiree.mode_vote,
      classementVisible: entrees.soiree.classement_visible,
      voteDebut: entrees.soiree.vote_debut,
      voteFin: entrees.soiree.vote_fin,
      epreuveEnCours: enPiste?.epreuve ?? null,
      manadeEnPiste: enPiste?.manade ?? null,
      passages: passages.map((passage) => ({
        id: passage.id,
        epreuve: passage.epreuve,
        manade: passage.manade,
        ordre: passage.ordre,
        statutEffectif: passage.statutEffectif,
        statutJury: passage.statutJury,
        fermeLe: passage.fermeLe,
        votes: passage.votes,
      })),
      classements,
    },
  };
}

export const INSTANTANE_FIGE = Object.freeze({ etat: 'hors-soiree', source: 'fige', soiree: null });

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {number} statut
 * @param {unknown} corps
 */
function repondreJson(req, res, statut, corps) {
  const texte = JSON.stringify(corps);
  res.writeHead(statut, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(texte)),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(req.method === 'HEAD' ? undefined : texte);
}

/**
 * @param {{ reel?: boolean, lire?: (slug: string | null) => Promise<unknown> }} [options]
 */
export function creerEtatSoiree(options = {}) {
  const reel = options.reel === true;
  const lire = options.lire ?? (async () => null);

  return {
    /** @param {string | undefined} url */
    estRoute(url) {
      try { return new URL(url ?? '/', 'http://serveur').pathname === '/api/etat-soiree'; }
      catch { return false; }
    },
    /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
    async repondre(req, res) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return repondreJson(req, res, 405, { error: 'Méthode non autorisée.' });
      }
      if (!reel) return repondreJson(req, res, 200, INSTANTANE_FIGE);
      let slug = null;
      try { slug = new URL(req.url ?? '/', 'http://serveur').searchParams.get('slug'); }
      catch { slug = null; }
      try {
        const instantane = await lire(slug);
        return repondreJson(req, res, 200, instantane ?? INSTANTANE_FIGE);
      } catch {
        return repondreJson(req, res, 200, INSTANTANE_FIGE);
      }
    },
  };
}

/** @param {string | null | undefined} valeur */
function origine(valeur) {
  if (!valeur) return null;
  try {
    const url = new URL(valeur);
    if (url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) {
      return url.origin;
    }
  } catch { /* configuration inutilisable */ }
  return null;
}

/**
 * @param {string} urlBase
 * @param {string} cleService
 * @param {string} chemin
 * @param {typeof fetch} demander
 */
async function lireJson(urlBase, cleService, chemin, demander) {
  const reponse = await demander(`${urlBase}${chemin}`, {
    headers: { apikey: cleService, Authorization: `Bearer ${cleService}` },
  });
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
  return reponse.json();
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 * @param {{ fetchFn?: typeof fetch, maintenant?: () => number }} [deps]
 */
export function instantaneDepuisEnvironnement(env, deps = {}) {
  if (env.ETAT_SOIREE_REEL !== 'true') return null;
  const base = origine(env.VITE_SUPABASE_URL);
  const cle = typeof env.SUPABASE_SERVICE_ROLE_KEY === 'string' ? env.SUPABASE_SERVICE_ROLE_KEY.trim() : '';
  const publique = typeof env.VITE_SUPABASE_PUBLISHABLE_KEY === 'string' ? env.VITE_SUPABASE_PUBLISHABLE_KEY.trim() : '';
  if (!base || !cle) return null;
  const urlBase = base;
  const cleService = cle;
  const demander = deps.fetchFn ?? fetch;
  const maintenant = deps.maintenant ?? Date.now;
  let enCours = false;

  async function publierUneFois() {
    if (enCours) return;
    enCours = true;
    try {
      const soirees = await lireJson(urlBase, cleService, '/rest/v1/soirees?select=id,slug,nom,lieu,date_soiree,statut,message_public,mode_vote,mode_classement,methode_general,poids_jury,bareme_jury,classement_visible,vote_debut,vote_fin,delai_vote_minutes&statut=in.(publiee,en_cours,reportee,annulee)', demander);
      if (!Array.isArray(soirees)) return;
      for (const soiree of soirees) {
        if (!soiree || typeof soiree.id !== 'string') continue;
        const id = encodeURIComponent(soiree.id);
        const [epreuves, manadesLien] = await Promise.all([
          lireJson(urlBase, cleService, `/rest/v1/epreuves?select=id,nom,ordre,notee,heure_debut,heure_fin&soiree_id=eq.${id}`, demander),
          lireJson(urlBase, cleService, `/rest/v1/soiree_manades?select=manade_id,manades(id,nom)&soiree_id=eq.${id}`, demander),
        ]);
        const epreuveIds = Array.isArray(epreuves) ? epreuves.map((e) => e.id).filter((v) => typeof v === 'string') : [];
        const passages = epreuveIds.length
          ? await lireJson(urlBase, cleService, `/rest/v1/passages?select=id,epreuve_id,manade_id,ordre,statut_public,statut_jury,fin_passage_le,ferme_le&epreuve_id=in.(${epreuveIds.join(',')})`, demander)
          : [];
        const passageIds = Array.isArray(passages) ? passages.map((p) => p.id).filter((v) => typeof v === 'string') : [];
        const filtreNotes = passageIds.length ? `passage_id=in.(${passageIds.join(',')})` : 'passage_id=eq.00000000-0000-4000-8000-000000000000';
        const [notesP, notesJ] = await Promise.all([
          lireJson(urlBase, cleService, `/rest/v1/notes_public?select=passage_id,note&${filtreNotes}`, demander),
          lireJson(urlBase, cleService, `/rest/v1/notes_jury?select=passage_id,note&${filtreNotes}`, demander),
        ]);
        const manades = Array.isArray(manadesLien)
          ? manadesLien.flatMap((lien) => (lien.manades ? [lien.manades] : []))
          : [];
        const instantane = composerInstantane({
          soiree,
          epreuves: Array.isArray(epreuves) ? epreuves : [],
          passages: Array.isArray(passages) ? passages : [],
          manades,
          notesPublic: Array.isArray(notesP) ? notesP : [],
          notesJury: Array.isArray(notesJ) ? notesJ : [],
          maintenant: maintenant(),
        });
        const ecriture = await demander(`${urlBase}/rest/v1/etat_soiree?on_conflict=soiree_id`, {
          method: 'POST',
          headers: {
            apikey: cleService,
            Authorization: `Bearer ${cleService}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({ soiree_id: soiree.id, instantane, calcule_le: new Date(maintenant()).toISOString() }),
        });
        if (!ecriture.ok) throw new Error(`écriture instantané HTTP ${ecriture.status}`);
      }
    } finally {
      enCours = false;
    }
  }

  /** @type {ReturnType<typeof setInterval> | null} */
  let minuteur = null;
  return {
    publierUneFois,
    demarrer() {
      if (minuteur) return;
      void publierUneFois().catch(() => undefined);
      minuteur = setInterval(() => { void publierUneFois().catch(() => undefined); }, INTERVALLE_MS);
      minuteur.unref?.();
    },
    arreter() {
      if (minuteur) clearInterval(minuteur);
      minuteur = null;
    },
    /** @param {string | null} slug */
    async lire(slug) {
      if (!publique) return null;
      const reponse = await demander(`${urlBase}/rest/v1/etat_soiree?select=instantane,calcule_le&order=calcule_le.desc`, {
        headers: { apikey: publique, Authorization: `Bearer ${publique}` },
      });
      if (!reponse.ok) return null;
      const lignes = await reponse.json();
      if (!Array.isArray(lignes)) return null;
      const choisis = lignes
        .map((ligne) => (ligne.instantane && typeof ligne.instantane === 'object'
          ? { ...ligne.instantane, calculeLe: ligne.calcule_le ?? null }
          : null))
        .filter((instantane) => instantane && typeof instantane === 'object');
      if (slug) {
        return choisis.find((instantane) => instantane.soiree?.slug === slug) ?? null;
      }
      return choisis.find((instantane) => instantane.etat === 'ouvert') ?? choisis[0] ?? null;
    },
  };
}
