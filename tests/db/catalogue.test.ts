import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  NOM_BASE_TEST,
  commeSuperutilisateur,
  connecter,
  dansUneTransaction,
  recreerBaseDeTest,
  supprimerBaseDeTest,
} from './aide';

const SANS_RLS = `select c.relname as table from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity
  order by 1`;

describe('push interrompu après la migration de schéma', () => {
  // Chaque migration est appliquée dans sa propre transaction : si le push s'arrête
  // après la première, aucune table ne doit rester ouverte aux rôles de l'API.
  const base = NOM_BASE_TEST.replace(/_test$/, '_partielle_test');
  beforeAll(() => recreerBaseDeTest(base, '20261010120000_schema.sql'));
  afterAll(() => supprimerBaseDeTest(base));

  it('toutes les tables ont la RLS et anon comme authenticated n’ont aucun droit, même sur une table future', async () => {
    const db = await connecter(base);
    try {
      const tables = await db.query(
        `select count(*)::int as n from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`,
      );
      expect(tables.rows[0].n).toBe(10);
      expect((await db.query(SANS_RLS)).rows).toEqual([]);
      await db.query('create table public.table_future (x int)');
      const droits = await db.query(
        `select grantee, table_name, privilege_type from information_schema.role_table_grants
         where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
         order by 1, 2, 3`,
      );
      expect(droits.rows).toEqual([]);
    } finally {
      await db.end();
    }
  });
});

// Fonctions appelées par les politiques RLS : anon et authenticated doivent pouvoir les exécuter.
const FONCTIONS_DE_REGLES = [
  'avis_ouvert',
  'email_verifie',
  'epreuve_visible',
  'est_admin',
  'passage_votable_jury',
  'passage_votable_public',
  'soiree_visible',
];

describe('catalogue : index', () => {
  it('les notes et les avis sont indexés par votant et par juge (suppression de compte)', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select c.relname as table, a.attname as colonne
         from pg_index i
         join pg_class c on c.oid = i.indrelid
         join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
         where c.relnamespace = 'public'::regnamespace
           and (c.relname, a.attname) in (('notes_public', 'votant_id'), ('notes_jury', 'juge_id'),
                                          ('avis_soiree', 'votant_id'))
         order by 1, 2`,
      );
      expect(rows).toEqual([
        { table: 'avis_soiree', colonne: 'votant_id' },
        { table: 'notes_jury', colonne: 'juge_id' },
        { table: 'notes_public', colonne: 'votant_id' },
      ]);
    }));
});

describe('catalogue : fonctions', () => {
  it('aucune fonction dans le schéma public exposé par la Data API', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select p.oid::regprocedure::text as fonction from pg_proc p
         where p.pronamespace = 'public'::regnamespace order by 1`,
      );
      expect(rows).toEqual([]);
    }));

  it('toute fonction security definer de prive porte un search_path', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select p.proname as fonction from pg_proc p
         where p.pronamespace = 'prive'::regnamespace and p.prosecdef
           and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')
         order by 1`,
      );
      expect(rows).toEqual([]);
    }));

  it('toute fonction de prive fixe un search_path vide', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select p.proname as fonction from pg_proc p
         where p.pronamespace = 'prive'::regnamespace
           and not coalesce('search_path=""' = any (p.proconfig), false)
         order by 1`,
      );
      expect(rows).toEqual([]);
    }));

  it('les fonctions déclencheurs de prive ne sont exécutables ni par anon ni par authenticated', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select p.proname as fonction, r.role from pg_proc p
         cross join (values ('anon'), ('authenticated')) as r (role)
         where p.pronamespace = 'prive'::regnamespace and p.prorettype = 'trigger'::regtype
           and has_function_privilege(r.role, p.oid, 'execute')
         order by 1, 2`,
      );
      expect(rows).toEqual([]);
    }));

  it('les fonctions de règles de prive restent exécutables par anon et authenticated', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select p.proname as fonction,
                has_function_privilege('anon', p.oid, 'execute') as anon,
                has_function_privilege('authenticated', p.oid, 'execute') as authenticated
         from pg_proc p
         where p.pronamespace = 'prive'::regnamespace and p.prorettype <> 'trigger'::regtype
         order by 1`,
      );
      expect(rows).toEqual(
        FONCTIONS_DE_REGLES.map((fonction) => ({ fonction, anon: true, authenticated: true })),
      );
    }));
});
