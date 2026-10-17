// @ts-check
// Un seul rafraîchissement du planning public par instance et par période de 5 s.
// Les votes et l'identité ne transitent jamais dans ce cache partagé.

const CHEMIN = '/api/notation/planning';
const TTL_MS = 5000;
const LIMITE_OCTETS = 1_000_000;

/** @param {{url?: string, clePublique?: string, fileActive?: boolean, fetch?: typeof globalThis.fetch, maintenant?: () => number}} options */
export function creerPlanningNotation({ url, clePublique, fileActive = false, fetch: demander = globalThis.fetch, maintenant = Date.now }) {
  /** @type {{generatedAt: string, fileActive: boolean, soirees: unknown[]} | null} */
  let cache = null;
  let prochaineLecture = 0;
  /** @type {Promise<void> | null} */
  let lecture = null;

  async function actualiser() {
    if (!url || !clePublique) throw new Error('configuration absente');
    const adresse = new URL('/rest/v1/soirees', url);
    adresse.searchParams.set('select', 'id,nom,date_soiree,mode_vote,vote_debut,vote_fin,statut,message_public,delai_vote_minutes,epreuves(id,nom,ordre,notee,heure_fin,passages(id,ordre,statut_public,fin_passage_le,ferme_le,manades(nom)))');
    adresse.searchParams.set('statut', 'in.(publiee,en_cours)');
    adresse.searchParams.set('vote_fin', `gte.${new Date(maintenant() - 86_400_000).toISOString()}`);
    adresse.searchParams.set('order', 'date_soiree.asc');
    adresse.searchParams.set('limit', '6');
    adresse.searchParams.set('epreuves.order', 'ordre.asc');
    adresse.searchParams.set('epreuves.limit', '60');
    adresse.searchParams.set('epreuves.passages.order', 'ordre.asc');
    adresse.searchParams.set('epreuves.passages.limit', '30');
    const reponse = await demander(adresse, {
      // La clé publique seule applique les droits anon, sans session ni clé service_role.
      headers: { apikey: clePublique }, signal: AbortSignal.timeout(4000),
    });
    if (!reponse.ok || Number(reponse.headers.get('content-length')) > LIMITE_OCTETS) throw new Error('planning indisponible');
    const lecteur = reponse.body?.getReader();
    if (!lecteur) throw new Error('planning vide');
    const morceaux = [];
    let longueur = 0;
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      longueur += value.length;
      if (longueur > LIMITE_OCTETS) { await lecteur.cancel(); throw new Error('planning trop volumineux'); }
      morceaux.push(value);
    }
    const soirees = JSON.parse(Buffer.concat(morceaux).toString('utf8'));
    if (!Array.isArray(soirees) || soirees.length > 6) throw new Error('planning invalide');
    cache = { generatedAt: new Date(maintenant()).toISOString(), fileActive, soirees };
  }

  return {
    /** @param {string | undefined} adresse */
    estRoute(adresse) { return adresse?.split('?')[0] === CHEMIN; },
    /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
    async repondre(req, res) {
      const entetes = { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" };
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { ...entetes, Allow: 'GET, HEAD', 'Cache-Control': 'no-store' }); res.end(); return;
      }
      if (!lecture && maintenant() >= prochaineLecture) {
        lecture = actualiser().catch(() => { cache = null; }).finally(() => {
          // Même une panne est amortie : pas 5 000 tentatives vers Supabase en même temps.
          prochaineLecture = maintenant() + TTL_MS;
          lecture = null;
        });
      }
      if (lecture) await lecture;
      const corps = JSON.stringify(cache ?? { error: 'Le planning est momentanément indisponible.' });
      res.writeHead(cache ? 200 : 503, { ...entetes,
        'Cache-Control': cache ? 'public, max-age=5, s-maxage=5' : 'no-store',
        ...(cache ? {} : { 'Retry-After': '5' }), 'Content-Length': Buffer.byteLength(corps),
      });
      res.end(req.method === 'HEAD' ? undefined : corps);
    },
  };
}

/** @param {NodeJS.ProcessEnv} env */
export function planningNotationDepuisEnvironnement(env) {
  return creerPlanningNotation({ url: env.VITE_SUPABASE_URL, clePublique: env.VITE_SUPABASE_PUBLISHABLE_KEY, fileActive: env.FILE_NOTES_ACTIVE === 'true' && !!env.SUPABASE_SERVICE_ROLE_KEY });
}
