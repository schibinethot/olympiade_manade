# Lot 0A : schéma, règles de vote et RLS. Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser la base de données de l'app (tables, règles de vote, sécurité par ligne) et prouver par des tests automatisés que la base refuse seule tout vote illégal.

**Architecture:** Migrations SQL au format Supabase dans `supabase/migrations/`. Les règles de vote sont des fonctions SQL `security definer` appelées par les politiques RLS. Les tests Vitest tournent sur le Postgres local (sans Docker) : une base `olympiade_test` est recréée à chaque lancement, avec un bouchon minimal de Supabase Auth (`auth.users`, `auth.uid()`, `auth.jwt()`, rôles `anon` et `authenticated`). Chaque test s'exécute dans une transaction annulée à la fin.

**Tech Stack:** PostgreSQL 17+ (Supabase) testé sur PostgreSQL 18 local, Vitest, `pg`, TypeScript, pnpm.

**Spec:** `docs/CDC-MASTER.md` (v0.4), sections 3, 4.4, 4.5, 4.9, 5.2 et 8 (critères 2 à 5).

## Global Constraints

- Noms SQL en français, en `snake_case`. Noms TypeScript en français, en `camelCase`
- Compatible PostgreSQL 17 (version de Supabase) : aucune fonctionnalité propre à PostgreSQL 18
- Pas de Docker sur la machine : tests contre le Postgres local (socket `/tmp`, port 5432), base `olympiade_test`
- Le bouchon `tests/db/stub-auth-supabase.sql` ne va **jamais** dans `supabase/migrations/`
- RLS activée sur **toutes** les tables du schéma `public`
- Toute fonction `security definer` porte `set search_path = ''` et qualifie chaque nom (`public.`, `auth.`)
- Pas de compte anonyme : tout spectateur a un profil créé à l'inscription et un email vérifié pour voter
- Note du public : entier de 1 à 10. Note du jury : demi-points, de 0 au barème de la soirée (10 ou 20)
- Heure du serveur (`now()`) seule référence pour les fenêtres de vote. Borne de fin **exclue**
- Aucun tiret cadratin dans les fichiers texte (hook bernard)
- Commits : message en français, sans trailer `Co-Authored-By`, fichiers ajoutés **nommément** (jamais `git add -A` : le dépôt est partagé avec d'autres sessions)
- Travail dans le worktree `/Users/tpmge/Dev/olympiade_manade-lot0a`, branche `feat/lot0a-socle`, créée depuis `main`

## Review Focus

1. **Vote reçu exactement à l'heure de fin** (`now() = vote_fin`) : refusé, la borne de fin est exclue. Test dans la Task 3
2. **Soirée passée en `annulee`, `reportee` ou `terminee` alors que des passages sont encore ouverts** : plus aucun vote accepté. Test dans la Task 3
3. **Revote après la fermeture d'un passage** (`insert ... on conflict do update`) : refusé, et l'ancienne note reste intacte. Test dans la Task 5
4. **Suppression d'une manade qui a déjà couru** : refusée, l'historique des notes est préservé. Test dans la Task 2
5. **Juge retiré de la soirée en cours de route** : ne peut plus noter. Test dans la Task 3

## Hors de ce plan

- Lot 0B (plan séparé, demande un GO) : création du projet Supabase, envoi des migrations, configuration Auth (code à 6 chiffres par email, SMTP Brevo, limites d'envoi, Turnstile)
- Tables des lots suivants : `imports_planning` (lot 3), `etat_soiree` (lot 2), `abonnements_push` (lot 8), `palmares`, `photos`, `contenus`, `messages_contact` (lot 7)
- Calcul des classements (lot 2)

## Structure des fichiers

```
package.json                                   scripts test, dépendances de dev
tsconfig.json                                  vérification de types des tests
vitest.config.ts                               préparation globale + exécution en série
supabase/migrations/
  20261010120000_schema.sql                    types, tables, déclencheurs (Task 2)
  20261010120100_regles_vote.sql               fonctions de règles de vote (Task 3)
  20261010120200_rls_planning.sql              RLS planning + profils (Task 4)
  20261010120300_rls_votes_public.sql          RLS notes du public + avis (Task 5)
  20261010120400_rls_jury.sql                  RLS notes du jury (Task 6)
tests/db/
  stub-auth-supabase.sql                       bouchon minimal de Supabase Auth (Task 1)
  aide.ts                                      création de la base, transactions, identités (Task 1)
  preparation-globale.ts                       recrée la base avant la suite (Task 1)
  graine.ts                                    jeu de données de référence (Task 2)
  harnais.test.ts                              tests du harnais (Task 1)
  schema.test.ts                               contraintes du schéma (Task 2)
  regles-vote.test.ts                          fonctions de règles (Task 3)
  rls-planning.test.ts                         visibilité et droits admin (Task 4)
  rls-votes-public.test.ts                     votes du public et avis (Task 5)
  rls-jury.test.ts                             notes du jury (Task 6)
```

---

### Task 1 : outillage et harnais de test de la base

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `tests/db/stub-auth-supabase.sql`, `tests/db/aide.ts`, `tests/db/preparation-globale.ts`
- Create: `supabase/migrations/.gitkeep`
- Test: `tests/db/harnais.test.ts`

**Interfaces:**
- Consumes: rien
- Produces (dans `tests/db/aide.ts`) :
  - `NOM_BASE_TEST: string`
  - `recreerBaseDeTest(): Promise<void>` : supprime et recrée la base, applique le bouchon puis chaque migration par ordre alphabétique
  - `dansUneTransaction(fn: (db: pg.Client) => Promise<void>): Promise<void>` : ouvre une connexion, `begin`, exécute, `rollback`
  - `commeUtilisateur(db: pg.Client, id: string): Promise<void>` : rôle `authenticated`, jeton `{ sub: id }`
  - `commeVisiteur(db: pg.Client): Promise<void>` : rôle `anon`, sans identifiant
  - `commeSuperutilisateur(db: pg.Client): Promise<void>` : retour au rôle de connexion (contourne la RLS)
  - `doitEtreRefuse(db: pg.Client, sql: string, params?: unknown[]): Promise<string>` : exécute dans un point de sauvegarde, renvoie le code d'erreur Postgres, échoue si la requête passe

- [ ] **Step 1 : se placer dans le worktree**

Le worktree est créé par l'orchestrateur avant la Task 1, avec le CDC et ce plan déjà commités. S'il n'existe pas :

```bash
cd /Users/tpmge/Dev/olympiade_manade
git fetch origin
git worktree add -b feat/lot0a-socle /Users/tpmge/Dev/olympiade_manade-lot0a origin/main
```

Puis : `cd /Users/tpmge/Dev/olympiade_manade-lot0a`

- [ ] **Step 2 : initialiser le paquet**

Créer `package.json` :

```json
{
  "name": "olympiade-manade",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:db": "vitest run tests/db",
    "typecheck": "tsc"
  }
}
```

Run : `pnpm add -D vitest typescript pg @types/pg @types/node`
Expected : `devDependencies` rempli, `pnpm-lock.yaml` créé.

Créer `tsconfig.json` :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["tests", "vitest.config.ts"]
}
```

Créer `vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/db/preparation-globale.ts'],
    fileParallelism: false,
  },
});
```

- [ ] **Step 3 : écrire le test du harnais**

Créer `tests/db/harnais.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { commeUtilisateur, commeVisiteur, dansUneTransaction, doitEtreRefuse } from './aide';

const ID = '00000000-0000-4000-8000-000000000001';

describe('harnais de test de la base', () => {
  it('auth.uid() renvoie l’identifiant du jeton simulé', () =>
    dansUneTransaction(async (db) => {
      await commeUtilisateur(db, ID);
      const { rows } = await db.query('select auth.uid() as uid, current_user as role');
      expect(rows[0]).toEqual({ uid: ID, role: 'authenticated' });
    }));

  it('un visiteur n’a pas d’identifiant', () =>
    dansUneTransaction(async (db) => {
      await commeVisiteur(db);
      const { rows } = await db.query('select auth.uid() as uid, current_user as role');
      expect(rows[0]).toEqual({ uid: null, role: 'anon' });
    }));

  it('doitEtreRefuse renvoie le code d’erreur et laisse la transaction utilisable', () =>
    dansUneTransaction(async (db) => {
      const code = await doitEtreRefuse(db, 'select 1 / 0');
      expect(code).toBe('22012');
      const { rows } = await db.query('select 1 as ok');
      expect(rows[0].ok).toBe(1);
    }));

  it('doitEtreRefuse échoue si la requête passe', () =>
    dansUneTransaction(async (db) => {
      await expect(doitEtreRefuse(db, 'select 1')).rejects.toThrow('devait être refusée');
    }));
});
```

- [ ] **Step 4 : lancer le test pour le voir échouer**

Run : `pnpm test`
Expected : FAIL, `Cannot find module './aide'` (ou fichier de préparation globale introuvable).

- [ ] **Step 5 : écrire le bouchon d'Auth**

Créer `tests/db/stub-auth-supabase.sql` :

```sql
-- Reproduit le strict nécessaire de Supabase Auth pour tester les migrations
-- sur un Postgres local, sans Docker. Ne jamais appliquer sur un projet Supabase :
-- ces objets y existent déjà.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key,
  email text unique,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

create function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
```

- [ ] **Step 6 : écrire les aides de test**

Créer `tests/db/aide.ts` :

```ts
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
```

Créer `tests/db/preparation-globale.ts` :

```ts
import { recreerBaseDeTest } from './aide';

export default async function preparationGlobale(): Promise<void> {
  await recreerBaseDeTest();
}
```

Créer le dossier des migrations : `mkdir -p supabase/migrations && touch supabase/migrations/.gitkeep`

- [ ] **Step 7 : lancer les tests pour les voir passer**

Run : `pnpm test && pnpm typecheck`
Expected : 4 tests PASS, aucune erreur de types.

- [ ] **Step 8 : commiter**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.ts supabase/migrations/.gitkeep \
  tests/db/stub-auth-supabase.sql tests/db/aide.ts tests/db/preparation-globale.ts tests/db/harnais.test.ts
git commit -m "Outillage de test de la base sur le Postgres local, avec bouchon de Supabase Auth"
```

---

### Task 2 : schéma de base

**Files:**
- Create: `supabase/migrations/20261010120000_schema.sql`
- Create: `tests/db/graine.ts`
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Consumes: `dansUneTransaction`, `doitEtreRefuse`, `commeSuperutilisateur` (Task 1)
- Produces :
  - Types `public.role_profil` (`admin`, `juge`, `spectateur`), `public.mode_vote` (`libre`, `deblocage`), `public.mode_classement`, `public.methode_general`, `public.statut_soiree` (`brouillon`, `publiee`, `en_cours`, `terminee`, `reportee`, `annulee`), `public.statut_vote` (`a_venir`, `ouvert`, `clos`), `public.statut_jury` (`a_venir`, `ouvert`, `clos`, `verrouille`)
  - Tables `public.profils`, `manades`, `soirees`, `soiree_manades`, `soiree_juges`, `epreuves`, `passages`, `notes_public`, `notes_jury`, `avis_soiree` (colonnes ci-dessous)
  - Déclencheur : tout insert dans `auth.users` crée un profil `spectateur` (prénom lu dans `raw_user_meta_data.prenom`, consentement daté si `raw_user_meta_data.consentement = true`)
  - Dans `tests/db/graine.ts` : `IDS` (identifiants fixes), `semerSoiree(db)`, `modifier(db, sql, params?)`

- [ ] **Step 1 : écrire la graine de test**

Créer `tests/db/graine.ts` :

```ts
import type pg from 'pg';
import { commeSuperutilisateur } from './aide';

export const IDS = {
  admin: '00000000-0000-4000-8000-00000000000a',
  juge: '00000000-0000-4000-8000-00000000000b',
  jugeNonRattache: '00000000-0000-4000-8000-00000000000c',
  spectateur: '00000000-0000-4000-8000-00000000000d',
  spectateur2: '00000000-0000-4000-8000-00000000000e',
  nonVerifie: '00000000-0000-4000-8000-00000000000f',
  manadeA: '10000000-0000-4000-8000-00000000000a',
  manadeB: '10000000-0000-4000-8000-00000000000b',
  manadeHors: '10000000-0000-4000-8000-00000000000c',
  soiree: '20000000-0000-4000-8000-00000000000a',
  epreuve: '30000000-0000-4000-8000-00000000000a',
  demonstration: '30000000-0000-4000-8000-00000000000b',
  passageA: '40000000-0000-4000-8000-00000000000a',
  passageB: '40000000-0000-4000-8000-00000000000b',
  passageDemo: '40000000-0000-4000-8000-00000000000c',
} as const;

/**
 * Soirée « en cours » en mode déblocage, fenêtre de vote de maintenant - 1 h à maintenant + 2 h.
 * Manades A et B engagées, manade « Hors » non engagée.
 * Une épreuve notée (passages A et B, statut a_venir) et une démonstration (passage A).
 * Le juge est rattaché à la soirée, le juge non rattaché ne l'est pas.
 * Le compte « nonVerifie » n'a pas validé son email.
 */
export async function semerSoiree(db: pg.Client): Promise<void> {
  await commeSuperutilisateur(db);
  await db.query(`
    insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
      ('${IDS.admin}', 'admin@test.fr', now(), '{"prenom": "Admin"}'),
      ('${IDS.juge}', 'juge@test.fr', now(), '{"prenom": "Juge"}'),
      ('${IDS.jugeNonRattache}', 'juge2@test.fr', now(), '{"prenom": "Juge2"}'),
      ('${IDS.spectateur}', 'lea@test.fr', now(), '{"prenom": "Léa", "consentement": true}'),
      ('${IDS.spectateur2}', 'paul@test.fr', now(), '{"prenom": "Paul", "consentement": true}'),
      ('${IDS.nonVerifie}', 'zoe@test.fr', null, '{"prenom": "Zoé", "consentement": true}');
    update public.profils set role = 'admin' where id = '${IDS.admin}';
    update public.profils set role = 'juge' where id in ('${IDS.juge}', '${IDS.jugeNonRattache}');
    insert into public.manades (id, nom) values
      ('${IDS.manadeA}', 'Vinuesa'), ('${IDS.manadeB}', 'Lafon'), ('${IDS.manadeHors}', 'Gillet');
    insert into public.soirees (id, slug, nom, date_soiree, vote_debut, vote_fin, mode_vote, statut) values
      ('${IDS.soiree}', 'test-2027', 'Soirée test', current_date,
       now() - interval '1 hour', now() + interval '2 hours', 'deblocage', 'en_cours');
    insert into public.soiree_manades (soiree_id, manade_id, ordre) values
      ('${IDS.soiree}', '${IDS.manadeA}', 1), ('${IDS.soiree}', '${IDS.manadeB}', 2);
    insert into public.soiree_juges (soiree_id, juge_id) values ('${IDS.soiree}', '${IDS.juge}');
    insert into public.epreuves (id, soiree_id, ordre, nom, notee) values
      ('${IDS.epreuve}', '${IDS.soiree}', 1, 'Ferrade en piste', true),
      ('${IDS.demonstration}', '${IDS.soiree}', 2, 'Bandido', false);
    insert into public.passages (id, epreuve_id, manade_id, ordre) values
      ('${IDS.passageA}', '${IDS.epreuve}', '${IDS.manadeA}', 1),
      ('${IDS.passageB}', '${IDS.epreuve}', '${IDS.manadeB}', 2),
      ('${IDS.passageDemo}', '${IDS.demonstration}', '${IDS.manadeA}', 1);
  `);
}

/** Exécute une requête de mise en place en superutilisateur (RLS contournée). */
export async function modifier(db: pg.Client, sql: string, params: unknown[] = []): Promise<void> {
  await commeSuperutilisateur(db);
  await db.query(sql, params);
}
```

- [ ] **Step 2 : écrire les tests du schéma**

Créer `tests/db/schema.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { dansUneTransaction, doitEtreRefuse } from './aide';
import { IDS, modifier, semerSoiree } from './graine';

describe('schéma', () => {
  it('la graine se charge et chaque compte reçoit un profil', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      const { rows } = await db.query(
        'select role::text, count(*)::int as n from public.profils group by role order by role',
      );
      expect(rows).toEqual([
        { role: 'admin', n: 1 },
        { role: 'juge', n: 2 },
        { role: 'spectateur', n: 3 },
      ]);
    }));

  it('un compte créé reçoit un profil spectateur avec prénom et consentement', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      const { rows } = await db.query(
        'select prenom, role::text, consentement_le is not null as consenti from public.profils where id = $1',
        [IDS.spectateur],
      );
      expect(rows[0]).toEqual({ prenom: 'Léa', role: 'spectateur', consenti: true });
    }));

  it('un prénom absent devient « Spectateur », un prénom trop long est tronqué à 60 caractères', () =>
    dansUneTransaction(async (db) => {
      await modifier(
        db,
        `insert into auth.users (id, raw_user_meta_data) values
          ('50000000-0000-4000-8000-000000000001', '{}'),
          ('50000000-0000-4000-8000-000000000002', $1::jsonb)`,
        [JSON.stringify({ prenom: 'x'.repeat(80) })],
      );
      const { rows } = await db.query(
        'select prenom, length(prenom)::int as longueur, consentement_le from public.profils order by id',
      );
      expect(rows).toEqual([
        { prenom: 'Spectateur', longueur: 10, consentement_le: null },
        { prenom: 'x'.repeat(60), longueur: 60, consentement_le: null },
      ]);
    }));

  it('refuse un passage pour une manade non engagée dans la soirée', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      const code = await doitEtreRefuse(
        db,
        'insert into public.passages (epreuve_id, manade_id, ordre) values ($1, $2, 3)',
        [IDS.epreuve, IDS.manadeHors],
      );
      expect(code).toBe('23514');
    }));

  it('refuse de supprimer une manade qui a déjà couru', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      const code = await doitEtreRefuse(db, 'delete from public.manades where id = $1', [IDS.manadeA]);
      expect(code).toBe('23503');
    }));

  it('refuse une note du public hors de 1 à 10', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      for (const note of [0, 11]) {
        const code = await doitEtreRefuse(
          db,
          'insert into public.notes_public (passage_id, votant_id, note) values ($1, $2, $3)',
          [IDS.passageA, IDS.spectateur, note],
        );
        expect(code).toBe('23514');
      }
    }));

  it('accepte une note de jury au demi-point et refuse les autres valeurs', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await db.query('insert into public.notes_jury (passage_id, juge_id, note) values ($1, $2, 17.5)', [
        IDS.passageA,
        IDS.juge,
      ]);
      for (const note of [7.25, -1, 20.5]) {
        const code = await doitEtreRefuse(
          db,
          'insert into public.notes_jury (passage_id, juge_id, note) values ($1, $2, $3)',
          [IDS.passageB, IDS.juge, note],
        );
        expect(code).toBe('23514');
      }
    }));

  it('applique le barème sur 10 quand la soirée le demande', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await db.query('update public.soirees set bareme_jury = 10 where id = $1', [IDS.soiree]);
      const code = await doitEtreRefuse(
        db,
        'insert into public.notes_jury (passage_id, juge_id, note) values ($1, $2, 12)',
        [IDS.passageA, IDS.juge],
      );
      expect(code).toBe('23514');
    }));

  it('refuse une fenêtre de vote inversée et un slug invalide', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      expect(
        await doitEtreRefuse(
          db,
          `update public.soirees set vote_fin = vote_debut - interval '1 minute' where id = $1`,
          [IDS.soiree],
        ),
      ).toBe('23514');
      expect(
        await doitEtreRefuse(db, `update public.soirees set slug = 'Nîmes 2027' where id = $1`, [IDS.soiree]),
      ).toBe('23514');
    }));
});
```

- [ ] **Step 3 : lancer les tests pour les voir échouer**

Run : `pnpm test tests/db/schema.test.ts`
Expected : FAIL, `relation "public.profils" does not exist` (code 42P01).

- [ ] **Step 4 : écrire la migration du schéma**

Créer `supabase/migrations/20261010120000_schema.sql` :

```sql
-- Lot 0A : schéma de base (CDC section 5.2).

create type public.role_profil as enum ('admin', 'juge', 'spectateur');
create type public.mode_vote as enum ('libre', 'deblocage');
create type public.mode_classement as enum ('separe', 'combine', 'jury');
create type public.methode_general as enum ('moyenne', 'points');
create type public.statut_soiree as enum ('brouillon', 'publiee', 'en_cours', 'terminee', 'reportee', 'annulee');
create type public.statut_vote as enum ('a_venir', 'ouvert', 'clos');
create type public.statut_jury as enum ('a_venir', 'ouvert', 'clos', 'verrouille');

create table public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  prenom text not null check (length(btrim(prenom)) between 1 and 60),
  role public.role_profil not null default 'spectateur',
  consentement_le timestamptz,
  cree_le timestamptz not null default now()
);

create table public.manades (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique check (length(btrim(nom)) > 0),
  ville text,
  logo_url text
);

create table public.soirees (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nom text not null check (length(btrim(nom)) > 0),
  date_soiree date not null,
  lieu text,
  vote_debut timestamptz not null,
  vote_fin timestamptz not null,
  mode_vote public.mode_vote not null default 'deblocage',
  bareme_jury smallint not null default 20 check (bareme_jury in (10, 20)),
  mode_classement public.mode_classement not null default 'separe',
  methode_general public.methode_general not null default 'moyenne',
  poids_jury smallint not null default 70 check (poids_jury between 0 and 100),
  classement_visible boolean not null default true,
  statut public.statut_soiree not null default 'brouillon',
  message_public text,
  cree_le timestamptz not null default now(),
  check (vote_fin > vote_debut)
);

create table public.soiree_manades (
  soiree_id uuid not null references public.soirees (id) on delete cascade,
  manade_id uuid not null references public.manades (id) on delete restrict,
  ordre smallint not null check (ordre > 0),
  primary key (soiree_id, manade_id)
);

create table public.soiree_juges (
  soiree_id uuid not null references public.soirees (id) on delete cascade,
  juge_id uuid not null references public.profils (id) on delete cascade,
  primary key (soiree_id, juge_id)
);

create table public.epreuves (
  id uuid primary key default gen_random_uuid(),
  soiree_id uuid not null references public.soirees (id) on delete cascade,
  ordre smallint not null check (ordre > 0),
  nom text not null check (length(btrim(nom)) > 0),
  description text,
  description_ia boolean not null default false,
  notee boolean not null default true,
  heure_debut timestamptz,
  heure_fin timestamptz,
  constraint epreuves_ordre_unique unique (soiree_id, ordre) deferrable initially deferred
);

create table public.passages (
  id uuid primary key default gen_random_uuid(),
  epreuve_id uuid not null references public.epreuves (id) on delete cascade,
  manade_id uuid not null references public.manades (id) on delete restrict,
  ordre smallint not null check (ordre > 0),
  statut_public public.statut_vote not null default 'a_venir',
  statut_jury public.statut_jury not null default 'a_venir',
  jury_lie_au_public boolean not null default true,
  constraint passages_manade_unique unique (epreuve_id, manade_id),
  constraint passages_ordre_unique unique (epreuve_id, ordre) deferrable initially deferred
);

create table public.notes_public (
  passage_id uuid not null references public.passages (id) on delete cascade,
  votant_id uuid not null references public.profils (id) on delete cascade,
  note smallint not null check (note between 1 and 10),
  maj_le timestamptz not null default now(),
  primary key (passage_id, votant_id)
);

create table public.notes_jury (
  passage_id uuid not null references public.passages (id) on delete cascade,
  juge_id uuid not null references public.profils (id) on delete cascade,
  note numeric not null check (note >= 0 and note * 2 = trunc(note * 2)),
  commentaire text check (length(commentaire) <= 1000),
  maj_le timestamptz not null default now(),
  primary key (passage_id, juge_id)
);

create table public.avis_soiree (
  soiree_id uuid not null references public.soirees (id) on delete cascade,
  votant_id uuid not null references public.profils (id) on delete cascade,
  etoiles smallint not null check (etoiles between 1 and 5),
  commentaire text check (length(commentaire) <= 500),
  maj_le timestamptz not null default now(),
  primary key (soiree_id, votant_id)
);

-- Horodatage des modifications
create function public.horodater_maj() returns trigger
language plpgsql
as $$
begin
  new.maj_le := now();
  return new;
end;
$$;

create trigger notes_public_horodatage before update on public.notes_public
  for each row execute function public.horodater_maj();
create trigger notes_jury_horodatage before update on public.notes_jury
  for each row execute function public.horodater_maj();
create trigger avis_soiree_horodatage before update on public.avis_soiree
  for each row execute function public.horodater_maj();

-- Un passage ne concerne qu'une manade engagée dans la soirée de l'épreuve
create function public.verifier_manade_du_passage() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.epreuves e
    join public.soiree_manades sm on sm.soiree_id = e.soiree_id
    where e.id = new.epreuve_id and sm.manade_id = new.manade_id
  ) then
    raise exception 'La manade % ne participe pas à la soirée de cette épreuve', new.manade_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger passages_manade_participante
  before insert or update of epreuve_id, manade_id on public.passages
  for each row execute function public.verifier_manade_du_passage();

-- Une note de jury ne dépasse pas le barème de la soirée
create function public.verifier_bareme_note_jury() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_bareme smallint;
begin
  select s.bareme_jury into v_bareme
  from public.passages p
  join public.epreuves e on e.id = p.epreuve_id
  join public.soirees s on s.id = e.soiree_id
  where p.id = new.passage_id;

  if new.note > v_bareme then
    raise exception 'Note % supérieure au barème de la soirée (%)', new.note, v_bareme
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger notes_jury_bareme
  before insert or update of note, passage_id on public.notes_jury
  for each row execute function public.verifier_bareme_note_jury();

-- Chaque compte créé reçoit un profil spectateur.
-- Le prénom et le consentement viennent des métadonnées envoyées à l'inscription.
-- Les rôles admin et juge sont attribués ensuite, par le serveur.
create function public.creer_profil_spectateur() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profils (id, prenom, role, consentement_le)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'prenom'), ''), 'Spectateur'), 60),
    'spectateur',
    case when (new.raw_user_meta_data ->> 'consentement') = 'true' then now() end
  );
  return new;
end;
$$;

create trigger auth_users_creer_profil after insert on auth.users
  for each row execute function public.creer_profil_spectateur();
```

- [ ] **Step 5 : lancer les tests pour les voir passer**

Run : `pnpm test && pnpm typecheck`
Expected : 13 tests PASS (4 du harnais, 9 du schéma).

- [ ] **Step 6 : commiter**

```bash
git add supabase/migrations/20261010120000_schema.sql tests/db/graine.ts tests/db/schema.test.ts
git commit -m "Schéma de base : soirées, épreuves, passages, notes du public et du jury, avis"
```

---

### Task 3 : règles de vote

**Files:**
- Create: `supabase/migrations/20261010120100_regles_vote.sql`
- Test: `tests/db/regles-vote.test.ts`

**Interfaces:**
- Consumes: tables et `IDS`, `semerSoiree`, `modifier` (Task 2), `commeUtilisateur`, `dansUneTransaction` (Task 1)
- Produces (fonctions SQL, toutes `stable`, appelables par `anon` et `authenticated`) :
  - `public.est_admin() returns boolean` : le compte connecté a le rôle `admin`
  - `public.email_verifie() returns boolean` : le compte connecté a un `email_confirmed_at`
  - `public.passage_votable_public(p_passage_id uuid) returns boolean`
  - `public.passage_votable_jury(p_passage_id uuid) returns boolean` : dépend du compte connecté (rattachement à la soirée)
  - `public.avis_ouvert(p_soiree_id uuid) returns boolean`

- [ ] **Step 1 : écrire les tests des règles**

Créer `tests/db/regles-vote.test.ts` :

```ts
import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { commeUtilisateur, dansUneTransaction } from './aide';
import { IDS, modifier, semerSoiree } from './graine';

async function votablePublic(db: pg.Client, passage: string): Promise<boolean> {
  await commeUtilisateur(db, IDS.spectateur);
  const { rows } = await db.query('select public.passage_votable_public($1) as ok', [passage]);
  return rows[0].ok;
}

async function votableJury(db: pg.Client, juge: string, passage: string): Promise<boolean> {
  await commeUtilisateur(db, juge);
  const { rows } = await db.query('select public.passage_votable_jury($1) as ok', [passage]);
  return rows[0].ok;
}

async function avisOuvert(db: pg.Client): Promise<boolean> {
  await commeUtilisateur(db, IDS.spectateur);
  const { rows } = await db.query('select public.avis_ouvert($1) as ok', [IDS.soiree]);
  return rows[0].ok;
}

const ouvrir = (id: string) => `update public.passages set statut_public = 'ouvert' where id = '${id}'`;

describe('vote du public, mode déblocage', () => {
  it('seul un passage débloqué est votable', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      expect(await votablePublic(db, IDS.passageA)).toBe(false);
      await modifier(db, ouvrir(IDS.passageA));
      expect(await votablePublic(db, IDS.passageA)).toBe(true);
      expect(await votablePublic(db, IDS.passageB)).toBe(false);
      await modifier(db, `update public.passages set statut_public = 'clos' where id = $1`, [IDS.passageA]);
      expect(await votablePublic(db, IDS.passageA)).toBe(false);
    }));

  it('une démonstration n’est jamais votable', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageDemo));
      expect(await votablePublic(db, IDS.passageDemo)).toBe(false);
    }));

  it('une soirée brouillon, reportée, annulée ou terminée bloque tout vote', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      for (const statut of ['brouillon', 'reportee', 'annulee', 'terminee']) {
        await modifier(db, 'update public.soirees set statut = $1::public.statut_soiree where id = $2', [
          statut,
          IDS.soiree,
        ]);
        expect(await votablePublic(db, IDS.passageA)).toBe(false);
      }
    }));
});

describe('vote du public, mode libre', () => {
  it('tout passage noté est votable pendant la fenêtre, même à venir', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, `update public.soirees set mode_vote = 'libre' where id = $1`, [IDS.soiree]);
      expect(await votablePublic(db, IDS.passageA)).toBe(true);
      expect(await votablePublic(db, IDS.passageB)).toBe(true);
      expect(await votablePublic(db, IDS.passageDemo)).toBe(false);
    }));

  it('rien n’est votable avant l’ouverture ni à partir de l’heure de fin exacte', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(
        db,
        `update public.soirees set mode_vote = 'libre', vote_debut = now() + interval '1 minute' where id = $1`,
        [IDS.soiree],
      );
      expect(await votablePublic(db, IDS.passageA)).toBe(false);
      await modifier(
        db,
        `update public.soirees set vote_debut = now() - interval '2 hours', vote_fin = now() where id = $1`,
        [IDS.soiree],
      );
      expect(await votablePublic(db, IDS.passageA)).toBe(false);
    }));
});

describe('vote du jury', () => {
  it('le juge rattaché note un passage ouvert, le juge non rattaché jamais', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      expect(await votableJury(db, IDS.juge, IDS.passageA)).toBe(false);
      await modifier(db, ouvrir(IDS.passageA));
      expect(await votableJury(db, IDS.juge, IDS.passageA)).toBe(true);
      expect(await votableJury(db, IDS.jugeNonRattache, IDS.passageA)).toBe(false);
      expect(await votableJury(db, IDS.spectateur, IDS.passageA)).toBe(false);
    }));

  it('un jury dissocié suit son propre statut', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(
        db,
        `update public.passages set jury_lie_au_public = false, statut_public = 'clos', statut_jury = 'ouvert'
         where id = $1`,
        [IDS.passageA],
      );
      expect(await votableJury(db, IDS.juge, IDS.passageA)).toBe(true);
      await modifier(db, `update public.passages set statut_jury = 'clos' where id = $1`, [IDS.passageA]);
      expect(await votableJury(db, IDS.juge, IDS.passageA)).toBe(false);
    }));

  it('un passage verrouillé n’est plus notable par le jury', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(
        db,
        `update public.passages set statut_public = 'ouvert', statut_jury = 'verrouille' where id = $1`,
        [IDS.passageA],
      );
      expect(await votableJury(db, IDS.juge, IDS.passageA)).toBe(false);
    }));

  it('un juge retiré de la soirée ne peut plus noter', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      expect(await votableJury(db, IDS.juge, IDS.passageA)).toBe(true);
      await modifier(db, 'delete from public.soiree_juges where juge_id = $1', [IDS.juge]);
      expect(await votableJury(db, IDS.juge, IDS.passageA)).toBe(false);
    }));
});

describe('avis sur la soirée', () => {
  it('fermés pendant les votes, ouverts après l’heure de fin ou quand la soirée est terminée', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      expect(await avisOuvert(db)).toBe(false);
      await modifier(
        db,
        `update public.soirees set vote_debut = now() - interval '3 hours', vote_fin = now() - interval '1 minute'
         where id = $1`,
        [IDS.soiree],
      );
      expect(await avisOuvert(db)).toBe(true);
      await modifier(db, `update public.soirees set statut = 'terminee' where id = $1`, [IDS.soiree]);
      expect(await avisOuvert(db)).toBe(true);
      await modifier(db, `update public.soirees set statut = 'annulee' where id = $1`, [IDS.soiree]);
      expect(await avisOuvert(db)).toBe(false);
    }));
});

describe('identité du compte connecté', () => {
  it('est_admin et email_verifie reflètent le compte connecté', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      const lire = async (id: string) => {
        await commeUtilisateur(db, id);
        const { rows } = await db.query('select public.est_admin() as admin, public.email_verifie() as verifie');
        return rows[0];
      };
      expect(await lire(IDS.admin)).toEqual({ admin: true, verifie: true });
      expect(await lire(IDS.spectateur)).toEqual({ admin: false, verifie: true });
      expect(await lire(IDS.nonVerifie)).toEqual({ admin: false, verifie: false });
    }));
});
```

- [ ] **Step 2 : lancer les tests pour les voir échouer**

Run : `pnpm test tests/db/regles-vote.test.ts`
Expected : FAIL, `function public.passage_votable_public(uuid) does not exist` (code 42883).

- [ ] **Step 3 : écrire la migration des règles**

Créer `supabase/migrations/20261010120100_regles_vote.sql` :

```sql
-- Lot 0A : règles de vote (CDC sections 4.4, 4.5 et 4.9).
-- Fonctions appelées par les politiques RLS. security definer pour lire les tables
-- sans dépendre des droits de l'appelant, search_path vide contre le détournement de noms.

create function public.est_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profils where id = auth.uid() and role = 'admin'
  )
$$;

create function public.email_verifie() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null
  )
$$;

-- Mode libre : fenêtre de la soirée, borne de fin exclue. Mode déblocage : statut du passage.
create function public.passage_votable_public(p_passage_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.passages p
    join public.epreuves e on e.id = p.epreuve_id
    join public.soirees s on s.id = e.soiree_id
    where p.id = p_passage_id
      and e.notee
      and s.statut in ('publiee', 'en_cours')
      and case s.mode_vote
            when 'libre' then now() >= s.vote_debut and now() < s.vote_fin
            else p.statut_public = 'ouvert'
          end
  )
$$;

-- Le jury suit le vote du public, sauf si l'admin l'a dissocié. Un passage verrouillé est figé.
create function public.passage_votable_jury(p_passage_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.passages p
    join public.epreuves e on e.id = p.epreuve_id
    join public.soirees s on s.id = e.soiree_id
    join public.soiree_juges sj on sj.soiree_id = s.id and sj.juge_id = auth.uid()
    where p.id = p_passage_id
      and e.notee
      and s.statut in ('publiee', 'en_cours')
      and p.statut_jury <> 'verrouille'
      and case
            when not p.jury_lie_au_public then p.statut_jury = 'ouvert'
            when s.mode_vote = 'libre' then now() >= s.vote_debut and now() < s.vote_fin
            else p.statut_public = 'ouvert'
          end
  )
$$;

-- Avis : après l'heure de fin des votes, ou une fois la soirée terminée.
create function public.avis_ouvert(p_soiree_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.soirees s
    where s.id = p_soiree_id
      and (s.statut = 'terminee' or (s.statut = 'en_cours' and now() >= s.vote_fin))
  )
$$;
```

- [ ] **Step 4 : lancer les tests pour les voir passer**

Run : `pnpm test && pnpm typecheck`
Expected : 24 tests PASS.

- [ ] **Step 5 : commiter**

```bash
git add supabase/migrations/20261010120100_regles_vote.sql tests/db/regles-vote.test.ts
git commit -m "Règles de vote : fenêtre libre, déblocage, jury rattaché, verrouillage, avis"
```

---

### Task 4 : RLS du planning et des profils

**Files:**
- Create: `supabase/migrations/20261010120200_rls_planning.sql`
- Test: `tests/db/rls-planning.test.ts`

**Interfaces:**
- Consumes: `public.est_admin()` (Task 3), graine (Task 2), aides (Task 1)
- Produces :
  - RLS activée sur les 10 tables
  - `public.soiree_visible(p_soiree_id uuid) returns boolean`, `public.epreuve_visible(p_epreuve_id uuid) returns boolean`
  - Lecture publique (`anon`, `authenticated`) du planning des soirées non brouillon. Écriture du planning réservée à l'admin
  - Profils : chacun lit le sien et ne peut modifier que son prénom. L'admin lit tout. Les rôles ne changent que côté serveur (`service_role`)

- [ ] **Step 1 : écrire les tests**

Créer `tests/db/rls-planning.test.ts` :

```ts
import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { commeSuperutilisateur, commeUtilisateur, commeVisiteur, dansUneTransaction, doitEtreRefuse } from './aide';
import { IDS, modifier, semerSoiree } from './graine';

async function compter(db: pg.Client, table: string): Promise<number> {
  const { rows } = await db.query(`select count(*)::int as n from public.${table}`);
  return rows[0].n;
}

async function planningVisible(db: pg.Client) {
  return {
    soirees: await compter(db, 'soirees'),
    epreuves: await compter(db, 'epreuves'),
    passages: await compter(db, 'passages'),
    engagees: await compter(db, 'soiree_manades'),
  };
}

const debloquer = `update public.passages set statut_public = 'ouvert' where id = '${IDS.passageA}'`;

describe('visibilité du planning', () => {
  it('un visiteur sans compte voit le planning d’une soirée publiée et l’annuaire', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeVisiteur(db);
      expect(await planningVisible(db)).toEqual({ soirees: 1, epreuves: 2, passages: 3, engagees: 2 });
      expect(await compter(db, 'manades')).toBe(3);
    }));

  it('une soirée brouillon n’est visible que par l’admin', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, `update public.soirees set statut = 'brouillon' where id = $1`, [IDS.soiree]);
      const vide = { soirees: 0, epreuves: 0, passages: 0, engagees: 0 };
      await commeVisiteur(db);
      expect(await planningVisible(db)).toEqual(vide);
      await commeUtilisateur(db, IDS.spectateur);
      expect(await planningVisible(db)).toEqual(vide);
      await commeUtilisateur(db, IDS.admin);
      expect(await planningVisible(db)).toEqual({ soirees: 1, epreuves: 2, passages: 3, engagees: 2 });
    }));
});

describe('écriture du planning', () => {
  it('seul l’admin débloque un passage', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      for (const id of [IDS.spectateur, IDS.juge]) {
        await commeUtilisateur(db, id);
        expect((await db.query(debloquer)).rowCount).toBe(0);
      }
      await commeSuperutilisateur(db);
      const avant = await db.query('select statut_public::text from public.passages where id = $1', [IDS.passageA]);
      expect(avant.rows[0].statut_public).toBe('a_venir');
      await commeUtilisateur(db, IDS.admin);
      expect((await db.query(debloquer)).rowCount).toBe(1);
    }));

  it('un spectateur ne crée pas de soirée, un visiteur n’écrit rien', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeUtilisateur(db, IDS.spectateur);
      expect(
        await doitEtreRefuse(
          db,
          `insert into public.soirees (slug, nom, date_soiree, vote_debut, vote_fin)
           values ('pirate', 'Pirate', current_date, now(), now() + interval '1 hour')`,
        ),
      ).toBe('42501');
      await commeVisiteur(db);
      expect(await doitEtreRefuse(db, `insert into public.manades (nom) values ('Pirate')`)).toBe('42501');
    }));

  it('l’admin crée une soirée', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeUtilisateur(db, IDS.admin);
      const { rowCount } = await db.query(
        `insert into public.soirees (slug, nom, date_soiree, vote_debut, vote_fin)
         values ('nimes-2027', 'Nîmes 2027', current_date, now(), now() + interval '3 hours')`,
      );
      expect(rowCount).toBe(1);
    }));
});

describe('profils et juges', () => {
  it('chacun lit son profil, l’admin lit tous les profils', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeUtilisateur(db, IDS.spectateur);
      expect(await compter(db, 'profils')).toBe(1);
      await commeUtilisateur(db, IDS.admin);
      expect(await compter(db, 'profils')).toBe(6);
    }));

  it('un spectateur change son prénom mais jamais son rôle', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeUtilisateur(db, IDS.spectateur);
      const { rowCount } = await db.query(`update public.profils set prenom = 'Léonie' where id = $1`, [
        IDS.spectateur,
      ]);
      expect(rowCount).toBe(1);
      expect(
        await doitEtreRefuse(db, `update public.profils set role = 'admin' where id = $1`, [IDS.spectateur]),
      ).toBe('42501');
      expect((await db.query(`update public.profils set prenom = 'X' where id = $1`, [IDS.spectateur2])).rowCount).toBe(0);
    }));

  it('un juge voit son rattachement, pas celui des autres', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeUtilisateur(db, IDS.juge);
      expect(await compter(db, 'soiree_juges')).toBe(1);
      await commeUtilisateur(db, IDS.jugeNonRattache);
      expect(await compter(db, 'soiree_juges')).toBe(0);
      await commeUtilisateur(db, IDS.admin);
      expect(await compter(db, 'soiree_juges')).toBe(1);
    }));
});
```

- [ ] **Step 2 : lancer les tests pour les voir échouer**

Run : `pnpm test tests/db/rls-planning.test.ts`
Expected : FAIL. Sans droits accordés, `permission denied for table soirees` (42501) dès le premier test.

- [ ] **Step 3 : écrire la migration**

Créer `supabase/migrations/20261010120200_rls_planning.sql` :

```sql
-- Lot 0A : sécurité par ligne du planning et des profils (CDC section 5.2).

alter table public.profils enable row level security;
alter table public.manades enable row level security;
alter table public.soirees enable row level security;
alter table public.soiree_manades enable row level security;
alter table public.soiree_juges enable row level security;
alter table public.epreuves enable row level security;
alter table public.passages enable row level security;
alter table public.notes_public enable row level security;
alter table public.notes_jury enable row level security;
alter table public.avis_soiree enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.manades, public.soirees, public.soiree_manades, public.epreuves, public.passages
  to anon, authenticated;
grant insert, update, delete on public.manades, public.soirees, public.soiree_manades,
  public.epreuves, public.passages, public.soiree_juges to authenticated;
grant select on public.profils, public.soiree_juges to authenticated;
-- Seul le prénom est modifiable depuis l'app. Les rôles changent côté serveur (service_role).
grant update (prenom) on public.profils to authenticated;

create function public.soiree_visible(p_soiree_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.soirees s
    where s.id = p_soiree_id and (s.statut <> 'brouillon' or public.est_admin())
  )
$$;

create function public.epreuve_visible(p_epreuve_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.epreuves e
    where e.id = p_epreuve_id and public.soiree_visible(e.soiree_id)
  )
$$;

-- Profils
create policy profils_lecture on public.profils for select to authenticated
  using (id = (select auth.uid()) or (select public.est_admin()));
create policy profils_modification on public.profils for update to authenticated
  using (id = (select auth.uid()) or (select public.est_admin()))
  with check (id = (select auth.uid()) or (select public.est_admin()));

-- Annuaire des manades
create policy manades_lecture on public.manades for select to anon, authenticated
  using (true);
create policy manades_admin on public.manades for all to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));

-- Soirées
create policy soirees_lecture on public.soirees for select to anon, authenticated
  using (statut <> 'brouillon' or (select public.est_admin()));
create policy soirees_admin on public.soirees for all to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));

-- Manades engagées
create policy soiree_manades_lecture on public.soiree_manades for select to anon, authenticated
  using (public.soiree_visible(soiree_id));
create policy soiree_manades_admin on public.soiree_manades for all to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));

-- Épreuves
create policy epreuves_lecture on public.epreuves for select to anon, authenticated
  using (public.soiree_visible(soiree_id));
create policy epreuves_admin on public.epreuves for all to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));

-- Passages
create policy passages_lecture on public.passages for select to anon, authenticated
  using (public.epreuve_visible(epreuve_id));
create policy passages_admin on public.passages for all to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));

-- Juges rattachés
create policy soiree_juges_lecture on public.soiree_juges for select to authenticated
  using (juge_id = (select auth.uid()) or (select public.est_admin()));
create policy soiree_juges_admin on public.soiree_juges for all to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));
```

- [ ] **Step 4 : lancer les tests pour les voir passer**

Run : `pnpm test && pnpm typecheck`
Expected : 32 tests PASS. Les tests des Tasks 2 et 3 passent toujours : ils s'exécutent en superutilisateur, qui contourne la RLS.

- [ ] **Step 5 : commiter**

```bash
git add supabase/migrations/20261010120200_rls_planning.sql tests/db/rls-planning.test.ts
git commit -m "RLS du planning et des profils : lecture publique, écriture admin, rôles figés"
```

---

### Task 5 : RLS des votes du public et des avis

**Files:**
- Create: `supabase/migrations/20261010120300_rls_votes_public.sql`
- Test: `tests/db/rls-votes-public.test.ts`

**Interfaces:**
- Consumes: `public.passage_votable_public`, `public.email_verifie`, `public.avis_ouvert`, `public.est_admin` (Task 3), RLS activée (Task 4)
- Produces : le front (lot 2) vote avec un upsert `insert into notes_public (passage_id, votant_id, note) values (...) on conflict (passage_id, votant_id) do update set note = excluded.note`, et laisse son avis avec le même schéma sur `avis_soiree (soiree_id, votant_id, etoiles, commentaire)`

- [ ] **Step 1 : écrire les tests**

Créer `tests/db/rls-votes-public.test.ts` :

```ts
import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { commeSuperutilisateur, commeUtilisateur, commeVisiteur, dansUneTransaction, doitEtreRefuse } from './aide';
import { IDS, modifier, semerSoiree } from './graine';

const VOTER = `insert into public.notes_public (passage_id, votant_id, note) values ($1, $2, $3)
  on conflict (passage_id, votant_id) do update set note = excluded.note`;

const DONNER_AVIS = `insert into public.avis_soiree (soiree_id, votant_id, etoiles, commentaire) values ($1, $2, $3, $4)
  on conflict (soiree_id, votant_id) do update set etoiles = excluded.etoiles, commentaire = excluded.commentaire`;

async function voter(db: pg.Client, votant: string, passage: string, note: number): Promise<void> {
  await commeUtilisateur(db, votant);
  await db.query(VOTER, [passage, votant, note]);
}

async function notesEnBase(db: pg.Client): Promise<{ votant_id: string; note: number }[]> {
  await commeSuperutilisateur(db);
  const { rows } = await db.query('select votant_id, note from public.notes_public order by votant_id');
  return rows;
}

const ouvrir = (id: string) => `update public.passages set statut_public = 'ouvert' where id = '${id}'`;

describe('vote du public', () => {
  it('accepte une note sur un passage débloqué', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await voter(db, IDS.spectateur, IDS.passageA, 8);
      expect(await notesEnBase(db)).toEqual([{ votant_id: IDS.spectateur, note: 8 }]);
    }));

  it('refuse une note sur un passage non débloqué, même par un appel direct', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeUtilisateur(db, IDS.spectateur);
      expect(await doitEtreRefuse(db, VOTER, [IDS.passageA, IDS.spectateur, 8])).toBe('42501');
      expect(await notesEnBase(db)).toEqual([]);
    }));

  it('un second vote remplace le premier', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await voter(db, IDS.spectateur, IDS.passageA, 8);
      await voter(db, IDS.spectateur, IDS.passageA, 3);
      expect(await notesEnBase(db)).toEqual([{ votant_id: IDS.spectateur, note: 3 }]);
    }));

  it('refuse un revote après la fermeture et garde l’ancienne note', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await voter(db, IDS.spectateur, IDS.passageA, 8);
      await modifier(db, `update public.passages set statut_public = 'clos' where id = $1`, [IDS.passageA]);
      await commeUtilisateur(db, IDS.spectateur);
      expect(await doitEtreRefuse(db, VOTER, [IDS.passageA, IDS.spectateur, 2])).toBe('42501');
      expect(await notesEnBase(db)).toEqual([{ votant_id: IDS.spectateur, note: 8 }]);
    }));

  it('refuse de voter au nom d’un autre', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await commeUtilisateur(db, IDS.spectateur);
      expect(await doitEtreRefuse(db, VOTER, [IDS.passageA, IDS.spectateur2, 10])).toBe('42501');
    }));

  it('refuse un compte dont l’email n’est pas vérifié', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await commeUtilisateur(db, IDS.nonVerifie);
      expect(await doitEtreRefuse(db, VOTER, [IDS.passageA, IDS.nonVerifie, 7])).toBe('42501');
    }));

  it('un visiteur sans compte ne peut pas voter', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await commeVisiteur(db);
      expect(await doitEtreRefuse(db, VOTER, [IDS.passageA, IDS.spectateur, 7])).toBe('42501');
    }));

  it('chacun ne lit que ses notes, l’admin lit tout', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await voter(db, IDS.spectateur, IDS.passageA, 8);
      await voter(db, IDS.spectateur2, IDS.passageA, 5);
      await commeUtilisateur(db, IDS.spectateur);
      expect((await db.query('select note from public.notes_public')).rows).toEqual([{ note: 8 }]);
      await commeUtilisateur(db, IDS.admin);
      expect((await db.query('select count(*)::int as n from public.notes_public')).rows[0].n).toBe(2);
    }));

  it('en mode libre, un passage à venir est votable pendant la fenêtre et pas après', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, `update public.soirees set mode_vote = 'libre' where id = $1`, [IDS.soiree]);
      await voter(db, IDS.spectateur, IDS.passageB, 9);
      await modifier(
        db,
        `update public.soirees set vote_debut = now() - interval '3 hours', vote_fin = now() - interval '1 minute'
         where id = $1`,
        [IDS.soiree],
      );
      await commeUtilisateur(db, IDS.spectateur);
      expect(await doitEtreRefuse(db, VOTER, [IDS.passageA, IDS.spectateur, 9])).toBe('42501');
      expect(await notesEnBase(db)).toEqual([{ votant_id: IDS.spectateur, note: 9 }]);
    }));
});

describe('avis sur la soirée', () => {
  it('refusé pendant les votes, accepté après, un seul par spectateur', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeUtilisateur(db, IDS.spectateur);
      expect(await doitEtreRefuse(db, DONNER_AVIS, [IDS.soiree, IDS.spectateur, 5, 'Super'])).toBe('42501');
      await modifier(db, `update public.soirees set statut = 'terminee' where id = $1`, [IDS.soiree]);
      await commeUtilisateur(db, IDS.spectateur);
      await db.query(DONNER_AVIS, [IDS.soiree, IDS.spectateur, 5, 'Super']);
      await db.query(DONNER_AVIS, [IDS.soiree, IDS.spectateur, 4, 'Bien']);
      expect((await db.query('select etoiles, commentaire from public.avis_soiree')).rows).toEqual([
        { etoiles: 4, commentaire: 'Bien' },
      ]);
      await commeUtilisateur(db, IDS.spectateur2);
      expect((await db.query('select count(*)::int as n from public.avis_soiree')).rows[0].n).toBe(0);
      await commeUtilisateur(db, IDS.admin);
      expect((await db.query('select count(*)::int as n from public.avis_soiree')).rows[0].n).toBe(1);
    }));
});
```

- [ ] **Step 2 : lancer les tests pour les voir échouer**

Run : `pnpm test tests/db/rls-votes-public.test.ts`
Expected : FAIL. RLS activée sans politique ni droit : `permission denied for table notes_public` (42501) dans le premier test, qui attend un vote accepté.

- [ ] **Step 3 : écrire la migration**

Créer `supabase/migrations/20261010120300_rls_votes_public.sql` :

```sql
-- Lot 0A : sécurité par ligne des notes du public et des avis (CDC sections 4.4 et 4.9).

grant select, insert, update on public.notes_public, public.avis_soiree to authenticated;

create policy notes_public_lecture on public.notes_public for select to authenticated
  using (votant_id = (select auth.uid()) or (select public.est_admin()));

create policy notes_public_insertion on public.notes_public for insert to authenticated
  with check (
    votant_id = (select auth.uid())
    and (select public.email_verifie())
    and public.passage_votable_public(passage_id)
  );

create policy notes_public_modification on public.notes_public for update to authenticated
  using (votant_id = (select auth.uid()))
  with check (
    votant_id = (select auth.uid())
    and (select public.email_verifie())
    and public.passage_votable_public(passage_id)
  );

create policy avis_lecture on public.avis_soiree for select to authenticated
  using (votant_id = (select auth.uid()) or (select public.est_admin()));

create policy avis_insertion on public.avis_soiree for insert to authenticated
  with check (
    votant_id = (select auth.uid())
    and (select public.email_verifie())
    and public.avis_ouvert(soiree_id)
  );

create policy avis_modification on public.avis_soiree for update to authenticated
  using (votant_id = (select auth.uid()))
  with check (votant_id = (select auth.uid()) and public.avis_ouvert(soiree_id));
```

- [ ] **Step 4 : lancer les tests pour les voir passer**

Run : `pnpm test && pnpm typecheck`
Expected : 42 tests PASS.

- [ ] **Step 5 : commiter**

```bash
git add supabase/migrations/20261010120300_rls_votes_public.sql tests/db/rls-votes-public.test.ts
git commit -m "RLS des votes du public et des avis : email vérifié, passage votable, une note par personne"
```

---

### Task 6 : RLS des notes du jury

**Files:**
- Create: `supabase/migrations/20261010120400_rls_jury.sql`
- Test: `tests/db/rls-jury.test.ts`

**Interfaces:**
- Consumes: `public.passage_votable_jury`, `public.est_admin` (Task 3), RLS activée (Task 4)
- Produces : le front jury (lot 4) note avec `insert into notes_jury (passage_id, juge_id, note, commentaire) values (...) on conflict (passage_id, juge_id) do update set note = excluded.note, commentaire = excluded.commentaire`

- [ ] **Step 1 : écrire les tests**

Créer `tests/db/rls-jury.test.ts` :

```ts
import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { commeSuperutilisateur, commeUtilisateur, dansUneTransaction, doitEtreRefuse } from './aide';
import { IDS, modifier, semerSoiree } from './graine';

const NOTER = `insert into public.notes_jury (passage_id, juge_id, note, commentaire) values ($1, $2, $3, $4)
  on conflict (passage_id, juge_id) do update set note = excluded.note, commentaire = excluded.commentaire`;

async function notesJuryEnBase(db: pg.Client): Promise<{ juge_id: string; note: string }[]> {
  await commeSuperutilisateur(db);
  const { rows } = await db.query('select juge_id, note::text as note from public.notes_jury order by juge_id');
  return rows;
}

const ouvrir = (id: string) => `update public.passages set statut_public = 'ouvert' where id = '${id}'`;

describe('notes du jury', () => {
  it('le juge rattaché note un passage ouvert, avec un commentaire privé', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await commeUtilisateur(db, IDS.juge);
      await db.query(NOTER, [IDS.passageA, IDS.juge, 17.5, 'Belle ferrade']);
      expect(await notesJuryEnBase(db)).toEqual([{ juge_id: IDS.juge, note: '17.5' }]);
    }));

  it('un spectateur ne peut pas écrire de note de jury', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await commeUtilisateur(db, IDS.spectateur);
      expect(await doitEtreRefuse(db, NOTER, [IDS.passageA, IDS.spectateur, 20, null])).toBe('42501');
      expect(await doitEtreRefuse(db, NOTER, [IDS.passageA, IDS.juge, 20, null])).toBe('42501');
    }));

  it('un juge non rattaché à la soirée ne peut pas noter', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await commeUtilisateur(db, IDS.jugeNonRattache);
      expect(await doitEtreRefuse(db, NOTER, [IDS.passageA, IDS.jugeNonRattache, 12, null])).toBe('42501');
    }));

  it('un juge ne note pas au nom d’un autre juge', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await modifier(db, 'insert into public.soiree_juges (soiree_id, juge_id) values ($1, $2)', [
        IDS.soiree,
        IDS.jugeNonRattache,
      ]);
      await commeUtilisateur(db, IDS.juge);
      expect(await doitEtreRefuse(db, NOTER, [IDS.passageA, IDS.jugeNonRattache, 12, null])).toBe('42501');
    }));

  it('le juge corrige tant que c’est ouvert, plus après le verrouillage', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await commeUtilisateur(db, IDS.juge);
      await db.query(NOTER, [IDS.passageA, IDS.juge, 15, null]);
      await db.query(NOTER, [IDS.passageA, IDS.juge, 16.5, null]);
      await modifier(db, `update public.passages set statut_jury = 'verrouille' where id = $1`, [IDS.passageA]);
      await commeUtilisateur(db, IDS.juge);
      expect(await doitEtreRefuse(db, NOTER, [IDS.passageA, IDS.juge, 20, null])).toBe('42501');
      expect(await notesJuryEnBase(db)).toEqual([{ juge_id: IDS.juge, note: '16.5' }]);
    }));

  it('un juge ne lit pas les notes des autres juges, l’admin lit tout', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await modifier(db, 'insert into public.soiree_juges (soiree_id, juge_id) values ($1, $2)', [
        IDS.soiree,
        IDS.jugeNonRattache,
      ]);
      await commeUtilisateur(db, IDS.juge);
      await db.query(NOTER, [IDS.passageA, IDS.juge, 14, null]);
      await commeUtilisateur(db, IDS.jugeNonRattache);
      await db.query(NOTER, [IDS.passageA, IDS.jugeNonRattache, 18, null]);
      expect((await db.query('select note::text from public.notes_jury')).rows).toEqual([{ note: '18' }]);
      await commeUtilisateur(db, IDS.admin);
      expect((await db.query('select count(*)::int as n from public.notes_jury')).rows[0].n).toBe(2);
    }));
});
```

- [ ] **Step 2 : lancer les tests pour les voir échouer**

Run : `pnpm test tests/db/rls-jury.test.ts`
Expected : FAIL, `permission denied for table notes_jury` (42501) dans le premier test.

- [ ] **Step 3 : écrire la migration**

Créer `supabase/migrations/20261010120400_rls_jury.sql` :

```sql
-- Lot 0A : sécurité par ligne des notes du jury (CDC section 4.5).

grant select, insert, update on public.notes_jury to authenticated;

create policy notes_jury_lecture on public.notes_jury for select to authenticated
  using (juge_id = (select auth.uid()) or (select public.est_admin()));

create policy notes_jury_insertion on public.notes_jury for insert to authenticated
  with check (juge_id = (select auth.uid()) and public.passage_votable_jury(passage_id));

create policy notes_jury_modification on public.notes_jury for update to authenticated
  using (juge_id = (select auth.uid()))
  with check (juge_id = (select auth.uid()) and public.passage_votable_jury(passage_id));
```

- [ ] **Step 4 : lancer les tests pour les voir passer**

Run : `pnpm test && pnpm typecheck`
Expected : 48 tests PASS.

- [ ] **Step 5 : commiter**

```bash
git add supabase/migrations/20261010120400_rls_jury.sql tests/db/rls-jury.test.ts
git commit -m "RLS des notes du jury : juge rattaché, passage ouvert, verrouillage"
```

---

### Task 7 : vérification de fin de lot

**Files:**
- Aucun nouveau fichier

- [ ] **Step 1 : relancer toute la suite deux fois de suite**

Run : `pnpm test && pnpm test && pnpm typecheck`
Expected : 48 tests PASS à chaque passage. La base est recréée à chaque lancement, donc aucun état ne fuit d'un passage à l'autre.

- [ ] **Step 2 : vérifier qu'aucune table n'échappe à la RLS**

Run :

```bash
psql -h /tmp -d olympiade_test -Atc "select tablename from pg_tables where schemaname = 'public' and not rowsecurity"
```

Expected : aucune ligne.

- [ ] **Step 3 : vérifier les fonctions security definer**

Run :

```bash
psql -h /tmp -d olympiade_test -Atc "select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef and not coalesce(array_to_string(p.proconfig, ',') like '%search_path=%', false)"
```

Expected : aucune ligne (toutes les fonctions `security definer` fixent leur `search_path`).

- [ ] **Step 4 : vérifier l'absence de tiret cadratin**

Run : `grep -rn $'\xe2\x80\x94' supabase tests docs/CDC-MASTER.md || echo "aucun"`
Expected : `aucun`.

- [ ] **Step 5 : rebaser sur main et rejouer**

```bash
git fetch origin
git rebase origin/main
pnpm test && pnpm typecheck
```

Expected : rebase sans conflit, 48 tests PASS.
