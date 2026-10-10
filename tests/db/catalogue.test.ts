import { describe, expect, it } from 'vitest';
import { commeSuperutilisateur, dansUneTransaction } from './aide';

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
