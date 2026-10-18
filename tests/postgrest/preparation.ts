import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import type { TestProject } from 'vitest/node';
import { connecter, recreerBaseDeTest, supprimerBaseDeTest } from '../db/aide';

// Banc PostgREST réel : une base de test locale migrée (comme les tests db), un rôle « authenticator » qui bascule
// vers anon ou service_role selon le JWT (comme Supabase), et le binaire postgrest. Le serveur des e-mails parle
// à ce PostgREST avec un vrai fetch ; seul le préfixe /rest/v1 de la passerelle Supabase est retiré.

declare module 'vitest' {
  export interface ProvidedContext {
    postgrestUrl: string;
    jetonService: string;
    baseDonnees: string;
  }
}

const BASE = (process.env.TEST_DB_NAME ?? 'olympiade_test').replace(/_test$/, '_postgrest_test');

/** JWT HS256 signé localement par le secret de test (jamais un secret réel). */
function jwt(secret: string, charge: Record<string, unknown>) {
  const b64 = (valeur: unknown) => Buffer.from(JSON.stringify(valeur)).toString('base64url');
  const corps = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(charge)}`;
  return `${corps}.${createHmac('sha256', secret).update(corps).digest('base64url')}`;
}

function portLibre(): Promise<number> {
  return new Promise((ok, ko) => {
    const serveur = createServer();
    serveur.once('error', ko);
    serveur.listen(0, '127.0.0.1', () => {
      const { port } = serveur.address() as { port: number };
      serveur.close(() => ok(port));
    });
  });
}

let processus: ChildProcess | null = null;

export default async function preparation(projet: TestProject) {
  try {
    execFileSync('postgrest', ['--version'], { stdio: 'pipe' });
  } catch {
    throw new Error(
      'Banc PostgREST : binaire « postgrest » introuvable. Installer PostgREST (brew install postgrest) ; '
      + 'sans lui, la recette en mode log sur la base migrée reste obligatoire avant le passage en smtp.',
    );
  }
  await recreerBaseDeTest(BASE);
  const db = await connecter(BASE);
  try {
    // Sur Supabase, service_role contourne la RLS (BYPASSRLS). Le rôle local peut avoir été créé sans cet attribut
    // (le bouchon d'Auth ne le recrée pas s'il existe) : le banc utilise un rôle dédié, membre de service_role
    // (mêmes droits) et BYPASSRLS, sans modifier le rôle partagé du cluster local.
    await db.query(`do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'authenticator') then
        create role authenticator login noinherit;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role_banc') then
        create role service_role_banc nologin bypassrls inherit;
      end if;
    end $$`);
    await db.query('grant service_role to service_role_banc');
    await db.query('grant anon, authenticated, service_role_banc to authenticator');
  } finally {
    await db.end();
  }

  const secret = randomBytes(32).toString('hex');
  const port = await portLibre();
  const sortie: string[] = [];
  processus = spawn('postgrest', [], {
    env: {
      ...process.env,
      PGRST_DB_URI: `postgres://authenticator@/${BASE}?host=/tmp`,
      PGRST_DB_SCHEMAS: 'public',
      PGRST_DB_ANON_ROLE: 'anon',
      PGRST_JWT_SECRET: secret,
      PGRST_SERVER_HOST: '127.0.0.1',
      PGRST_SERVER_PORT: String(port),
      PGRST_DB_CHANNEL_ENABLED: 'false',
      PGRST_LOG_LEVEL: 'error',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  processus.stdout?.on('data', (morceau) => sortie.push(String(morceau)));
  processus.stderr?.on('data', (morceau) => sortie.push(String(morceau)));
  const url = `http://127.0.0.1:${port}`;
  const limite = Date.now() + 20_000;
  for (;;) {
    try {
      const reponse = await fetch(`${url}/`);
      if (reponse.ok) break;
    } catch {
      // pas encore prêt
    }
    if (processus.exitCode !== null || Date.now() > limite) {
      throw new Error(`Banc PostgREST : démarrage impossible.\n${sortie.join('')}`);
    }
    await new Promise((ok) => setTimeout(ok, 100));
  }

  projet.provide('postgrestUrl', url);
  projet.provide('jetonService', jwt(secret, { role: 'service_role_banc', exp: Math.floor(Date.now() / 1000) + 3600 }));
  projet.provide('baseDonnees', BASE);

  return async () => {
    processus?.kill('SIGTERM');
    await new Promise((ok) => (processus && processus.exitCode === null ? processus.once('exit', ok) : ok(null)));
    await supprimerBaseDeTest(BASE);
  };
}
