import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const hote = process.env.PGHOST ?? '/tmp';
export const NOM_BASE_TEST = process.env.TEST_DB_NAME ?? 'olympiade_test';

function client(base: string): pg.Client {
  return new pg.Client({ host: hote, database: base });
}

export async function recreerBaseDeTest(): Promise<void> {
  const admin = client('postgres');
  await admin.connect();
  await admin.query(`drop database if exists ${NOM_BASE_TEST} with (force)`);
  await admin.query(`create database ${NOM_BASE_TEST}`);
  await admin.end();

  const db = client(NOM_BASE_TEST);
  await db.connect();
  try {
    await db.query(readFileSync(join(racine, 'tests/db/stub-auth-supabase.sql'), 'utf8'));
    const dossier = join(racine, 'supabase/migrations');
    const fichiers = readdirSync(dossier).filter((nom) => nom.endsWith('.sql')).sort();
    for (const fichier of fichiers) {
      try {
        await db.query(readFileSync(join(dossier, fichier), 'utf8'));
      } catch (e) {
        throw new Error(`Échec de la migration ${fichier} : ${(e as Error).message}`);
      }
    }
  } finally {
    await db.end();
  }
}

export async function dansUneTransaction(fn: (db: pg.Client) => Promise<void>): Promise<void> {
  const db = client(NOM_BASE_TEST);
  await db.connect();
  await db.query('begin');
  try {
    await fn(db);
  } finally {
    await db.query('rollback');
    await db.end();
  }
}

export async function commeUtilisateur(db: pg.Client, id: string): Promise<void> {
  await db.query('reset role');
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: id, role: 'authenticated' }),
  ]);
  await db.query('set local role authenticated');
}

export async function commeVisiteur(db: pg.Client): Promise<void> {
  await db.query('reset role');
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'anon' })]);
  await db.query('set local role anon');
}

export async function commeSuperutilisateur(db: pg.Client): Promise<void> {
  await db.query('reset role');
  await db.query(`select set_config('request.jwt.claims', '', true)`);
}

export async function doitEtreRefuse(db: pg.Client, sql: string, params: unknown[] = []): Promise<string> {
  await db.query('savepoint avant_refus');
  try {
    await db.query(sql, params);
  } catch (e) {
    await db.query('rollback to savepoint avant_refus');
    return (e as { code?: string }).code ?? 'inconnu';
  }
  await db.query('release savepoint avant_refus');
  throw new Error(`Requête acceptée alors qu'elle devait être refusée : ${sql}`);
}
