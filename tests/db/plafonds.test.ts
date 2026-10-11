import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { commeSuperutilisateur, commeUtilisateur, commeVisiteur, dansUneTransaction, doitEtreRefuse } from './aide';
import { IDS, semerSoiree } from './graine';

// Migration 20261011120000_plafonds.sql : plafond des messages de contact (garde-fou en base, pas
// l'anti-robot) et longueur brute du prénom des profils.

const DEPOSER = `insert into public.messages_contact (prenom, email, message) values ('Léa', 'lea@exemple.fr', 'Bonjour, quelle est la date 2027 ?')`;

/** SQLSTATE du plafond : PostgREST répond 429 (Too Many Requests) aux codes « PT429 ». */
const PLAFOND_ATTEINT = 'PT429';

async function deposer(db: pg.Client, nombre: number): Promise<void> {
  for (let i = 0; i < nombre; i++) await db.query(DEPOSER);
}

/** Message de l'erreur levée par une requête refusée (la transaction est reprise au point de sauvegarde). */
async function messageDuRefus(db: pg.Client, sql: string): Promise<string> {
  await db.query('savepoint refus');
  try {
    await db.query(sql);
  } catch (e) {
    await db.query('rollback to savepoint refus');
    return (e as Error).message;
  }
  throw new Error(`Requête acceptée alors qu'elle devait être refusée : ${sql}`);
}

describe('plafond des messages de contact', () => {
  it('10 dépôts anonymes en 10 minutes passent, le 11e est refusé avec un message clair', () =>
    dansUneTransaction(async (db) => {
      await commeVisiteur(db);
      await deposer(db, 10);
      expect(await doitEtreRefuse(db, DEPOSER)).toBe(PLAFOND_ATTEINT);
      expect(await messageDuRefus(db, DEPOSER)).toMatch(/Trop de messages de contact/);
      await commeSuperutilisateur(db);
      expect((await db.query(`select count(*)::int as n from public.messages_contact`)).rows[0].n).toBe(10);
    }));

  it('tous visiteurs confondus : les dépôts des visiteurs et des spectateurs connectés comptent ensemble', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeVisiteur(db);
      await deposer(db, 6);
      await commeUtilisateur(db, IDS.spectateur);
      await deposer(db, 4);
      expect(await doitEtreRefuse(db, DEPOSER)).toBe(PLAFOND_ATTEINT);
      await commeVisiteur(db);
      expect(await doitEtreRefuse(db, DEPOSER)).toBe(PLAFOND_ATTEINT);
    }));

  it('un message créé il y a plus de 10 minutes ne compte pas', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      await db.query(
        `insert into public.messages_contact (prenom, email, message, cree_le)
         select 'Ancien', 'ancien@exemple.fr', 'Message déposé plus tôt', now() - interval '10 minutes 1 second'
         from generate_series(1, 10)`,
      );
      await commeVisiteur(db);
      await deposer(db, 10);
      expect(await doitEtreRefuse(db, DEPOSER)).toBe(PLAFOND_ATTEINT);
    }));

  it('déclencheur before insert, fonction security definer de prive, index sur cree_le', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select t.tgname as declencheur, p.proname as fonction, p.pronamespace::regnamespace::text as schema,
                p.prosecdef as definer, 'search_path=""' = any (p.proconfig) as chemin_vide,
                has_function_privilege('anon', p.oid, 'execute') as anon,
                has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
                (t.tgtype & 2) <> 0 as avant, (t.tgtype & 4) <> 0 as insertion
         from pg_trigger t join pg_proc p on p.oid = t.tgfoid
         where t.tgrelid = 'public.messages_contact'::regclass and not t.tgisinternal`,
      );
      expect(rows).toEqual([
        {
          declencheur: 'messages_contact_plafond',
          fonction: 'plafonner_messages_contact',
          schema: 'prive',
          definer: true,
          chemin_vide: true,
          anon: false,
          authenticated: false,
          avant: true,
          insertion: true,
        },
      ]);
      const index = await db.query(
        `select count(*)::int as n from pg_index i
         join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
         where i.indrelid = 'public.messages_contact'::regclass and a.attname = 'cree_le'`,
      );
      expect(index.rows[0].n).toBe(1);
    }));
});

describe('prénom des profils : longueur brute', () => {
  const RENOMMER = `update public.profils set prenom = $1 where id = $2`;

  it('le spectateur ne peut pas enregistrer plus de 60 caractères, blancs compris', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeUtilisateur(db, IDS.spectateur);
      expect(await doitEtreRefuse(db, RENOMMER, ['A' + ' '.repeat(100), IDS.spectateur])).toBe('23514');
      expect(await doitEtreRefuse(db, RENOMMER, ['x'.repeat(61), IDS.spectateur])).toBe('23514');
      expect(await doitEtreRefuse(db, RENOMMER, ['   ', IDS.spectateur])).toBe('23514');
    }));

  it('60 caractères et un prénom ordinaire restent acceptés', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeUtilisateur(db, IDS.spectateur);
      expect((await db.query(RENOMMER, ['é'.repeat(60), IDS.spectateur])).rowCount).toBe(1);
      expect((await db.query(RENOMMER, ['Léonie', IDS.spectateur])).rowCount).toBe(1);
    }));
});
