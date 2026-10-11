import exec from 'k6/execution';
import encoding from 'k6/encoding';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const PROD_REF = 'khwlwpzydlrfocfpvywv';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requis(nom) {
  const valeur = __ENV[nom]?.trim();
  if (!valeur) throw new Error(`${nom} est obligatoire.`);
  return valeur;
}

function entier(nom, defaut, valeurs) {
  const valeur = Number(__ENV[nom] ?? defaut);
  if (!Number.isInteger(valeur) || !valeurs.includes(valeur)) {
    throw new Error(`${nom} doit valoir ${valeurs.join(' ou ')}.`);
  }
  return valeur;
}

function chargeJwt(jwt) {
  const parties = jwt.split('.');
  if (parties.length !== 3) throw new Error('Jeton de session non JWT.');
  try {
    return JSON.parse(encoding.b64decode(parties[1], 'rawurl', 's'));
  } catch {
    throw new Error('Charge utile JWT illisible.');
  }
}

function verifierClePublique(cle) {
  if (cle.startsWith('sb_publishable_')) return;
  const contenu = chargeJwt(cle);
  if (contenu.role !== 'anon') {
    throw new Error('SUPABASE_PUBLISHABLE_KEY doit être une clé publishable ou legacy anon; service_role est refusé.');
  }
}

if (__ENV.ALLOW_STAGING_LOAD !== 'YES_I_OWN_THIS_STAGING') {
  throw new Error('Charge refusée : poser ALLOW_STAGING_LOAD=YES_I_OWN_THIS_STAGING après contrôle de la cible.');
}
if (__ENV.TARGET_ENV !== 'staging') throw new Error('TARGET_ENV doit valoir staging.');

const SUPABASE_URL = requis('SUPABASE_URL').replace(/\/$/, '');
const PROJECT_REF = requis('EXPECTED_PROJECT_REF');
const CLE_PUBLIQUE = requis('SUPABASE_PUBLISHABLE_KEY');
const PASSAGE_ID = requis('PASSAGE_ID');
const SOIREE_ID = requis('SOIREE_ID');
const PROFIL = __ENV.PROFILE ?? 'spread60';
const VOTANTS = entier('VOTERS', 5_000, [5_000, 7_500]);

if (PROJECT_REF === PROD_REF) throw new Error('Charge refusée : EXPECTED_PROJECT_REF désigne la production connue.');
const cible = SUPABASE_URL.match(/^https:\/\/([a-z0-9-]+\.supabase\.co)$/);
if (!cible || cible[1] !== `${PROJECT_REF}.supabase.co`) {
  throw new Error('SUPABASE_URL doit être le domaine HTTPS exact du projet EXPECTED_PROJECT_REF.');
}
if (!UUID.test(PASSAGE_ID) || !UUID.test(SOIREE_ID)) throw new Error('PASSAGE_ID et SOIREE_ID doivent être des UUID.');
verifierClePublique(CLE_PUBLIQUE);

const sessions = new SharedArray('sessions-staging', () => {
  const chemin = requis('SESSIONS_FILE');
  const valeur = JSON.parse(open(chemin));
  if (!Array.isArray(valeur) || valeur.length !== VOTANTS) {
    throw new Error(`SESSIONS_FILE doit contenir exactement ${VOTANTS} sessions.`);
  }
  const ids = new Set();
  const jetons = new Set();
  const maintenant = Math.floor(Date.now() / 1_000);
  for (const [index, session] of valeur.entries()) {
    if (!session || !UUID.test(session.userId) || typeof session.accessToken !== 'string') {
      throw new Error(`Session ${index} invalide : userId UUID et accessToken sont obligatoires.`);
    }
    const jwt = chargeJwt(session.accessToken);
    if (jwt.role !== 'authenticated' || jwt.sub !== session.userId) {
      throw new Error(`Session ${index} : le JWT doit être authenticated et son sub doit correspondre à userId.`);
    }
    if (!Number.isFinite(jwt.exp) || jwt.exp < maintenant + 300) {
      throw new Error(`Session ${index} expirée ou valable moins de cinq minutes.`);
    }
    if (typeof jwt.iss !== 'string' || !jwt.iss.startsWith(`${SUPABASE_URL}/auth/v1`)) {
      throw new Error(`Session ${index} émise par un autre projet.`);
    }
    if (ids.has(session.userId) || jetons.has(session.accessToken)) {
      throw new Error(`Session ${index} dupliquée : chaque votant doit être indépendant.`);
    }
    ids.add(session.userId);
    jetons.add(session.accessToken);
  }
  return valeur;
});

const dureeEtalement = PROFIL === 'spread60' ? 60 : PROFIL === 'spread30' ? 30 : 0;
if (!['spread60', 'spread30', 'burst'].includes(PROFIL)) {
  throw new Error('PROFILE doit valoir spread60, spread30 ou burst.');
}

const lecturesParSeconde = Math.ceil(VOTANTS / 10);
export const options = {
  discardResponseBodies: true,
  scenarios: {
    votes: {
      executor: 'per-vu-iterations',
      exec: 'voter',
      vus: VOTANTS,
      iterations: 1,
      startTime: '5s',
      maxDuration: `${Math.max(45, dureeEtalement + 30)}s`,
      gracefulStop: '0s',
    },
    lectures: {
      executor: 'constant-arrival-rate',
      exec: 'lireEtat',
      rate: lecturesParSeconde,
      timeUnit: '1s',
      duration: `${Math.max(45, dureeEtalement + 15)}s`,
      preAllocatedVUs: Math.min(500, lecturesParSeconde),
      maxVUs: Math.min(2_000, VOTANTS),
    },
    presences: {
      executor: 'constant-arrival-rate',
      exec: 'signalerPresence',
      // Un signal par utilisateur toutes les 67,5 s en moyenne (jitter client 60–75 s).
      rate: VOTANTS,
      timeUnit: '67.5s',
      duration: `${Math.max(45, dureeEtalement + 15)}s`,
      preAllocatedVUs: 100,
      maxVUs: Math.min(1_000, VOTANTS),
    },
  },
  thresholds: {
    // Un vote accepté mais absent à la relecture est un vote perdu : tolérance zéro.
    'http_req_failed{kind:vote}': ['rate==0'],
    'http_req_duration{kind:vote}': ['p(95)<1000'],
    'http_req_failed{kind:verification}': ['rate==0'],
    'http_req_failed{kind:etat}': ['rate<0.001'],
    'http_req_failed{kind:presence}': ['rate<0.001'],
    'dropped_iterations': ['count==0'],
    'checks': ['rate==1'],
  },
};

function entetes(session) {
  return {
    apikey: CLE_PUBLIQUE,
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  };
}

export function voter() {
  // L'identifiant de VU est global à tous les scénarios (les lecteurs en consomment aussi).
  // L'itération est, elle, numérotée de 0 à VOTANTS-1 dans ce scénario à une itération par VU.
  const index = exec.scenario.iterationInTest;
  const session = sessions[index];
  if (!session) throw new Error(`Aucune session pour l'itération de vote ${index}.`);
  if (dureeEtalement > 0 && VOTANTS > 1) sleep((index * dureeEtalement) / (VOTANTS - 1));
  const reponse = http.post(
    `${SUPABASE_URL}/rest/v1/notes_public?on_conflict=passage_id,votant_id`,
    JSON.stringify({ passage_id: PASSAGE_ID, votant_id: session.userId, note: 8 }),
    {
      headers: { ...entetes(session), Prefer: 'resolution=merge-duplicates,return=minimal' },
      tags: { kind: 'vote' },
      timeout: '10s',
    },
  );
  const accepte = check(reponse, { 'vote accepté': (r) => [200, 201, 204].includes(r.status) });
  if (!accepte) return;

  const verification = http.get(
    `${SUPABASE_URL}/rest/v1/notes_public?passage_id=eq.${encodeURIComponent(PASSAGE_ID)}` +
      `&votant_id=eq.${encodeURIComponent(session.userId)}&select=votant_id,note`,
    {
      headers: entetes(session),
      tags: { kind: 'verification' },
      timeout: '10s',
      responseType: 'text',
    },
  );
  check(verification, {
    'vote relu exactement': (r) => {
      if (r.status !== 200) return false;
      try {
        const lignes = JSON.parse(r.body);
        return lignes.length === 1 && lignes[0].votant_id === session.userId && lignes[0].note === 8;
      } catch {
        return false;
      }
    },
  });
}

export function lireEtat() {
  const index = exec.scenario.iterationInTest % sessions.length;
  const session = sessions[index];
  const reponse = http.get(
    `${SUPABASE_URL}/rest/v1/etat_soiree?soiree_id=eq.${encodeURIComponent(SOIREE_ID)}&select=soiree_id,instantane,calcule_le`,
    { headers: entetes(session), tags: { kind: 'etat' }, timeout: '10s', responseType: 'text' },
  );
  check(reponse, { 'instantané lisible': (r) => r.status === 200 && r.body !== '[]' });
}

export function signalerPresence() {
  const index = exec.scenario.iterationInTest % sessions.length;
  const session = sessions[index];
  const reponse = http.post(`${SUPABASE_URL}/rest/v1/rpc/enregistrer_presence`, '{}', {
    headers: entetes(session),
    tags: { kind: 'presence' },
    timeout: '10s',
  });
  check(reponse, { 'présence acceptée': (r) => [200, 204].includes(r.status) });
}
