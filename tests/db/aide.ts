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

/** La base est supprimée puis recréée : on refuse toute cible qui ne soit pas une base de test locale. */
function verifierCibleLocale(base: string): void {
  if (!(hote.startsWith('/') || hote === 'localhost' || hote === '127.0.0.1')) {
    throw new Error(
      `Base de test refusée : l'hôte « ${hote} » n'est ni un socket local (chemin absolu), ni localhost, ni 127.0.0.1. ` +
        'Le harnais supprime puis recrée la base, il ne vise jamais un serveur distant.',
    );
  }
  if (!/^[a-z0-9_]+_test$/.test(base)) {
    throw new Error(
      `Base de test refusée : le nom « ${base} » ne correspond pas à /^[a-z0-9_]+_test$/. ` +
        "Le harnais supprime puis recrée la base, il ne vise qu'une base dont le nom finit par _test.",
    );
  }
}

/**
 * Recrée une base de test locale, y applique le bouchon d'Auth puis les migrations dans l'ordre.
 * `derniereMigration` arrête l'application après ce fichier, comme un push interrompu.
 */
export async function recreerBaseDeTest(base: string = NOM_BASE_TEST, derniereMigration?: string): Promise<void> {
  verifierCibleLocale(base);
  const admin = client('postgres');
  await admin.connect();
  await admin.query(`drop database if exists ${base} with (force)`);
  await admin.query(`create database ${base}`);
  await admin.end();

  const db = client(base);
  await db.connect();
  try {
    await db.query(readFileSync(join(racine, 'tests/db/stub-auth-supabase.sql'), 'utf8'));
    const dossier = join(racine, 'supabase/migrations');
    const fichiers = readdirSync(dossier)
      .filter((nom) => nom.endsWith('.sql') && (derniereMigration === undefined || nom <= derniereMigration))
      .sort();
    if (derniereMigration !== undefined && !fichiers.includes(derniereMigration)) {
      throw new Error(`Migration introuvable : ${derniereMigration}`);
    }
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

export async function supprimerBaseDeTest(base: string): Promise<void> {
  verifierCibleLocale(base);
  const admin = client('postgres');
  await admin.connect();
  try {
    await admin.query(`drop database if exists ${base} with (force)`);
  } finally {
    await admin.end();
  }
}

/** Connexion superutilisateur à une base de test, hors transaction. À fermer par l'appelant. */
export async function connecter(base: string): Promise<pg.Client> {
  const db = client(base);
  await db.connect();
  return db;
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

export async function commeUtilisateur(db: pg.Client, id: string, aal: 'aal1' | 'aal2' = 'aal1'): Promise<void> {
  await db.query('reset role');
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: id, role: 'authenticated', aal }),
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
