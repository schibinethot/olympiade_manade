import { readFile, readdir } from 'node:fs/promises';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOTE = process.env.PGHOST ?? '/tmp';
const BASE = process.env.CHARGE_DB_NAME ?? 'olympiade_charge_test';
const UTILISATEURS = entier('CHARGE_USERS', 5_000, 1, 7_500);
const CONCURRENCE = entier('CHARGE_CONCURRENCY', 32, 1, 64);
const AVEC_FILE = process.env.CHARGE_QUEUE === 'true';
const DERNIERE_MIGRATION = AVEC_FILE ? '20261011140000_file_notes.sql' : '20261011120000_plafonds.sql';
const PASSAGE_ID = '40000000-0000-4000-8000-00000000c001';

function entier(nom, valeurParDefaut, minimum, maximum) {
  const brut = process.env[nom];
  const valeur = brut === undefined ? valeurParDefaut : Number(brut);
  if (!Number.isInteger(valeur) || valeur < minimum || valeur > maximum) {
    throw new Error(`${nom} doit être un entier entre ${minimum} et ${maximum}.`);
  }
  return valeur;
}

function verifierCible() {
  if (!(HOTE.startsWith('/') || HOTE === 'localhost' || HOTE === '127.0.0.1')) {
    throw new Error(`PGHOST distant refusé : « ${HOTE} ». Ce script détruit et recrée une base locale jetable.`);
  }
  if (!/^[a-z0-9_]+_charge_test$/.test(BASE)) {
    throw new Error(`CHARGE_DB_NAME refusé : « ${BASE} » doit finir par _charge_test.`);
  }
}

function client(base) {
  return new pg.Client({ host: HOTE, database: base });
}

async function recreerBase() {
  const admin = client('postgres');
  await admin.connect();
  try {
    await admin.query(`drop database if exists ${BASE} with (force)`);
    await admin.query(`create database ${BASE}`);
  } finally {
    await admin.end();
  }

  const db = client(BASE);
  await db.connect();
  try {
    await db.query(await readFile(join(RACINE, 'tests/db/stub-auth-supabase.sql'), 'utf8'));
    const dossier = join(RACINE, 'supabase/migrations');
    const migrations = (await readdir(dossier))
      .filter((nom) => nom.endsWith('.sql') && nom <= DERNIERE_MIGRATION)
      .sort();
    for (const migration of migrations) {
      await db.query(await readFile(join(dossier, migration), 'utf8'));
    }
  } finally {
    await db.end();
  }
}

async function supprimerBase() {
  const admin = client('postgres');
  await admin.connect();
  try {
    await admin.query(`drop database if exists ${BASE} with (force)`);
  } finally {
    await admin.end();
  }
}

async function semer() {
  const db = client(BASE);
  await db.connect();
  try {
    await db.query(
      `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
       select ('00000000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid,
              'charge-' || n || '@example.test', now(),
              jsonb_build_object('prenom', 'Charge ' || n, 'consentement', true)
       from generate_series(1, $1) n`,
      [UTILISATEURS],
    );
    await db.query(`
      insert into public.manades (id, nom) values
        ('10000000-0000-4000-8000-00000000c001', 'Charge locale');
      insert into public.soirees
        (id, slug, nom, date_soiree, vote_debut, vote_fin, mode_vote, statut)
      values
        ('20000000-0000-4000-8000-00000000c001', 'charge-locale', 'Charge locale', current_date,
         now() - interval '1 hour', now() + interval '1 hour', 'deblocage', 'en_cours');
      insert into public.soiree_manades (soiree_id, manade_id, ordre) values
        ('20000000-0000-4000-8000-00000000c001', '10000000-0000-4000-8000-00000000c001', 1);
      insert into public.epreuves (id, soiree_id, ordre, nom, notee) values
        ('30000000-0000-4000-8000-00000000c001', '20000000-0000-4000-8000-00000000c001', 1,
         'Épreuve de charge', true);
      insert into public.passages (id, epreuve_id, manade_id, ordre, statut_public) values
        ('${PASSAGE_ID}', '30000000-0000-4000-8000-00000000c001',
         '10000000-0000-4000-8000-00000000c001', 1, 'ouvert');
    `);
  } finally {
    await db.end();
  }
}

function idUtilisateur(numero) {
  return `00000000-0000-4000-8000-${numero.toString(16).padStart(12, '0')}`;
}

const VOTE = `insert into public.notes_public (passage_id, votant_id, note)
  values ($1, $2, $3)
  on conflict (passage_id, votant_id) do update set note = excluded.note`;

function idAction(numero, phase) {
  return `${phase === 'insertion' ? 'a' : 'b'}0000000-0000-4000-8000-${numero.toString(16).padStart(12, '0')}`;
}

async function unVote(pool, numero, phase) {
  const debut = performance.now();
  const db = await pool.connect();
  try {
    await db.query('begin');
    const id = idUtilisateur(numero);
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: id, role: 'authenticated' }),
    ]);
    await db.query('set local role authenticated');
    if (AVEC_FILE) {
      const { rows } = await db.query('select * from mettre_note_en_file($1,$2,$3::smallint)', [idAction(numero, phase), PASSAGE_ID, phase === 'insertion' ? 8 : 6]);
      if (rows[0]?.statut !== 'en_attente' && rows[0]?.statut !== 'confirmee') throw new Error('Admission refusée');
    } else await db.query(VOTE, [PASSAGE_ID, id, phase === 'insertion' ? 8 : 6]);
    await db.query('commit');
  } catch (erreur) {
    await db.query('rollback').catch(() => undefined);
    throw erreur;
  } finally {
    db.release();
  }
  return performance.now() - debut;
}

function percentile(valeursTriees, quantile) {
  return valeursTriees[Math.min(valeursTriees.length - 1, Math.ceil(valeursTriees.length * quantile) - 1)];
}

async function mesurerPhase(pool, phase) {
  let suivant = 1;
  const latences = new Array(UTILISATEURS);
  const debut = performance.now();
  await Promise.all(
    Array.from({ length: CONCURRENCE }, async () => {
      while (true) {
        const numero = suivant++;
        if (numero > UTILISATEURS) return;
        latences[numero - 1] = await unVote(pool, numero, phase);
      }
    }),
  );
  const dureeMs = performance.now() - debut;
  latences.sort((a, b) => a - b);
  return {
    phase,
    operations: UTILISATEURS,
    concurrency: CONCURRENCE,
    durationMs: Number(dureeMs.toFixed(1)),
    throughputPerSecond: Number(((UTILISATEURS * 1_000) / dureeMs).toFixed(1)),
    latencyMs: {
      p50: Number(percentile(latences, 0.5).toFixed(1)),
      p95: Number(percentile(latences, 0.95).toFixed(1)),
      p99: Number(percentile(latences, 0.99).toFixed(1)),
      max: Number(latences.at(-1).toFixed(1)),
    },
  };
}

async function viderFile() {
  const debut = performance.now();
  const nombres = await Promise.all([1, 2].map(async (n) => {
    const db = client(BASE); await db.connect();
    let total = 0;
    try {
      await db.query(`select set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
      await db.query('set role service_role');
      for (;;) {
        const { rows } = await db.query('select traiter_file_notes(100,$1) as resultat', [`file-${String(n).padStart(24, '0')}`]);
        const nombre = rows[0].resultat.confirmees;
        total += nombre;
        if (nombre === 0) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } finally { await db.end(); }
    return total;
  }));
  return { workers: 2, batchSize: 100, intervalMs: 250, confirmed: nombres.reduce((a, b) => a + b, 0), durationMs: Number((performance.now() - debut).toFixed(1)) };
}

async function main() {
  verifierCible();
  const debut = new Date().toISOString();
  await recreerBase();
  try {
    await semer();
    const pool = new pg.Pool({ host: HOTE, database: BASE, max: CONCURRENCE });
    let insertions;
    let modifications;
    const traitements = [];
    try {
      insertions = await mesurerPhase(pool, 'insertion');
      if (AVEC_FILE) {
        // Toutes les notes sont admises, puis le vote ferme avant leur matérialisation.
        await pool.query('update passages set statut_public=\'clos\' where id=$1', [PASSAGE_ID]);
        traitements.push(await viderFile());
        await pool.query('update passages set statut_public=\'ouvert\' where id=$1', [PASSAGE_ID]);
      }
      modifications = await mesurerPhase(pool, 'modification');
      if (AVEC_FILE) {
        traitements.push(await viderFile());
        // Rejouer l'ancienne note après sa correction ne doit jamais rétablir la valeur 8.
        await unVote(pool, 1, 'insertion');
      }
    } finally {
      await pool.end();
    }

    const controle = client(BASE);
    await controle.connect();
    const { rows } = await controle.query(
      `select count(*)::int as notes, min(note)::int as note_min, max(note)::int as note_max
       from public.notes_public`,
    );
    const { rows: version } = await controle.query('select version()');
    const file = AVEC_FILE ? (await controle.query(`select count(*)::int as actions, count(*) filter (where statut='en_attente')::int as attente, count(*) filter (where statut='confirmee')::int as confirmees from file_notes`)).rows[0] : null;
    await controle.end();

    if (rows[0].notes !== UTILISATEURS || rows[0].note_min !== 6 || rows[0].note_max !== 6) {
      throw new Error(`Intégrité invalide après charge : ${JSON.stringify(rows[0])}`);
    }
    if (AVEC_FILE && (file.actions !== UTILISATEURS * 2 || file.attente !== 0 || file.confirmees !== UTILISATEURS * 2)) throw new Error('Intégrité de la file invalide');

    console.log(
      JSON.stringify(
        {
          measuredAt: debut,
          scope: 'Postgres local direct, transactions avec rôle authenticated et claims JWT simulés; sans HTTP/Auth/Realtime/réseau',
          database: { version: version[0].version, host: HOTE, name: BASE, migrationThrough: DERNIERE_MIGRATION },
          machine: { logicalCpuCount: cpus().length, node: process.version },
          insertions,
          modifications,
          ...(AVEC_FILE ? { traitements, file, mode: 'Admissions en rafale puis vidage après fermeture, avec deux workers; pas une simulation HTTP complète.' } : {}),
          integrity: rows[0],
        },
        null,
        2,
      ),
    );
  } finally {
    await supprimerBase();
  }
}

await main();
