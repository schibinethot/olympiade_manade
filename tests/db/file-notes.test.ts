import { describe, expect, it } from 'vitest';
import type pg from 'pg';
import {
  NOM_BASE_TEST,
  commeSuperutilisateur,
  commeUtilisateur,
  commeVisiteur,
  connecter,
  dansUneTransaction,
  doitEtreRefuse,
  recreerBaseDeTest,
  supprimerBaseDeTest,
} from './aide';
import { IDS, modifier, semerSoiree } from './graine';

const ACTION_1 = '50000000-0000-4000-8000-000000000001';
const ACTION_2 = '50000000-0000-4000-8000-000000000002';
const ACTION_3 = '50000000-0000-4000-8000-000000000003';

async function ouvrir(db: pg.Client, passage = IDS.passageA) {
  await modifier(db, `update public.passages set statut_public = 'ouvert' where id = $1`, [passage]);
}

async function commeWorker(db: pg.Client) {
  await db.query('reset role');
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'service_role' })]);
  await db.query('set local role service_role');
}

async function admettre(db: pg.Client, action: string, note: number, passage = IDS.passageA) {
  return (
    await db.query(
      `select * from public.mettre_note_en_file($1, $2, $3::smallint)`,
      [action, passage, note],
    )
  ).rows[0];
}

async function traiter(db: pg.Client, limite = 25, instance = 'file-1234567890abcdef12345678') {
  await commeWorker(db);
  return (await db.query(`select public.traiter_file_notes($1, $2) as resultat`, [limite, instance])).rows[0]
    .resultat;
}

describe('file durable des notes publiques', () => {
  it('admet à l’heure serveur, rend l’admission idempotente et confirme seulement avec la note', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await ouvrir(db);
      await commeUtilisateur(db, IDS.spectateur);

      const premiere = await admettre(db, ACTION_1, 4);
      expect(premiere).toMatchObject({ request_id: ACTION_1, statut: 'en_attente', motif: null });
      expect(await admettre(db, ACTION_1, 4)).toEqual(premiere);
      expect(await admettre(db, ACTION_1, 8)).toMatchObject({
        request_id: ACTION_1,
        statut: 'rejetee',
        motif: 'identifiant_reutilise',
      });
      expect((await db.query(`select count(*)::int as n from public.notes_public`)).rows[0].n).toBe(0);

      expect(await doitEtreRefuse(
        db,
        `insert into public.notes_public (passage_id, votant_id, note) values ($1, $2, 9)`,
        [IDS.passageA, IDS.spectateur],
      )).toBe('55000');

      expect(await traiter(db)).toEqual({ prises: 1, confirmees: 1 });
      await commeUtilisateur(db, IDS.spectateur);
      expect((await db.query(`select note from public.notes_public where passage_id = $1`, [IDS.passageA])).rows[0].note)
        .toBe(4);
      expect((await db.query(`select * from public.lire_statuts_file_notes($1::uuid[])`, [[ACTION_1]])).rows[0])
        .toMatchObject({ request_id: ACTION_1, statut: 'confirmee', motif: null });
    }));

  it('traite strictement une tête par votant et passage, dans l’ordre des admissions', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await ouvrir(db);
      await commeUtilisateur(db, IDS.spectateur);
      await admettre(db, ACTION_1, 3);
      await admettre(db, ACTION_2, 9);

      expect(await traiter(db, 100)).toEqual({ prises: 1, confirmees: 1 });
      await commeSuperutilisateur(db);
      expect((await db.query(`select note from public.notes_public where passage_id = $1`, [IDS.passageA])).rows[0].note)
        .toBe(3);
      expect(await traiter(db, 100)).toEqual({ prises: 1, confirmees: 1 });
      await commeSuperutilisateur(db);
      expect((await db.query(`select note from public.notes_public where passage_id = $1`, [IDS.passageA])).rows[0].note)
        .toBe(9);
    }));

  it('applique après fermeture une action déjà admise, mais refuse une arrivée tardive', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await ouvrir(db);
      await commeUtilisateur(db, IDS.spectateur);
      await admettre(db, ACTION_1, 7);

      await modifier(db, `update public.passages set statut_public = 'clos' where id = $1`, [IDS.passageA]);
      await commeUtilisateur(db, IDS.spectateur2);
      expect(await admettre(db, ACTION_2, 8)).toMatchObject({ statut: 'rejetee', motif: 'vote_ferme' });

      await traiter(db);
      await commeSuperutilisateur(db);
      expect((await db.query(`select votant_id, note from public.notes_public`)).rows).toEqual([
        { votant_id: IDS.spectateur, note: 7 },
      ]);
    }));

  it('ne perd ni note ni statut si la transaction du worker est annulée', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await ouvrir(db);
      await commeUtilisateur(db, IDS.spectateur);
      await admettre(db, ACTION_1, 6);

      await db.query('savepoint avant_worker');
      await traiter(db);
      await db.query('rollback to savepoint avant_worker');
      await commeSuperutilisateur(db);
      expect((await db.query(`select count(*)::int as n from public.notes_public`)).rows[0].n).toBe(0);
      expect((await db.query(`select statut from public.file_notes where request_id = $1`, [ACTION_1])).rows[0].statut)
        .toBe('en_attente');
    }));

  it('fige le passage dès l’admission et expose seulement ses statuts au spectateur', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await ouvrir(db);
      await commeUtilisateur(db, IDS.spectateur);
      await admettre(db, ACTION_1, 5);

      await commeUtilisateur(db, IDS.spectateur2);
      await admettre(db, ACTION_2, 8);
      expect((await db.query(`select count(*)::int as n from public.file_notes`)).rows[0].n).toBe(1);
      expect((await db.query(`select * from public.lire_statuts_file_notes($1::uuid[])`, [[ACTION_1, ACTION_2]])).rows)
        .toHaveLength(1);
      expect(await doitEtreRefuse(db, `update public.file_notes set statut = 'confirmee'`)).toBe('42501');

      await commeSuperutilisateur(db);
      expect(await doitEtreRefuse(
        db,
        `update public.passages set manade_id = $1 where id = $2`,
        [IDS.manadeB, IDS.passageA],
      )).toBe('23503');
    }));

  it('refuse l’email non vérifié, les appels anonymes et les lots non bornés', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await ouvrir(db);
      await commeUtilisateur(db, IDS.nonVerifie);
      expect(await admettre(db, ACTION_1, 5)).toMatchObject({
        statut: 'rejetee',
        motif: 'email_non_verifie',
      });
      expect(await doitEtreRefuse(
        db,
        `select * from public.lire_statuts_file_notes(array_fill($1::uuid, array[101]))`,
        [ACTION_1],
      )).toBe('22023');

      await commeVisiteur(db);
      expect(await doitEtreRefuse(
        db,
        `select * from public.mettre_note_en_file($1, $2, 5::smallint)`,
        [ACTION_2, IDS.passageA],
      )).toBe('42501');
      expect(await doitEtreRefuse(db, `select public.traiter_file_notes(25, 'file-1234567890abcdef12345678')`))
        .toBe('42501');
    }));

  it('borne à 100 actions par votant et passage', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await ouvrir(db);
      await commeSuperutilisateur(db);
      await db.query(
        `insert into public.file_notes (request_id, votant_id, passage_id, note, statut, motif_rejet)
         select ('60000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
                $1, $2, 5, 'rejetee', 'vote_ferme'
         from generate_series(1, 100) n`,
        [IDS.spectateur, IDS.passageA],
      );
      await commeUtilisateur(db, IDS.spectateur);
      expect(await admettre(db, ACTION_3, 5)).toMatchObject({ statut: 'rejetee', motif: 'trop_actions' });
    }));

  it('ne prend jamais plus de 100 cibles dans un lot', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await ouvrir(db);
      await commeSuperutilisateur(db);
      await db.query(
        `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
         select ('70000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
                'charge-' || n || '@test.fr', now(), '{"prenom":"Charge"}'::jsonb
         from generate_series(1, 101) n`,
      );
      await db.query(
        `insert into public.file_notes (request_id, votant_id, passage_id, note, statut)
         select ('80000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
                ('70000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
                $1, 5, 'en_attente'
         from generate_series(1, 101) n`,
        [IDS.passageA],
      );
      expect(await traiter(db, 100)).toEqual({ prises: 100, confirmees: 100 });
      await commeSuperutilisateur(db);
      expect((await db.query(
        `select count(*) filter (where statut = 'confirmee')::int as confirmees,
                count(*) filter (where statut = 'en_attente')::int as attente
         from public.file_notes`,
      )).rows[0]).toEqual({ confirmees: 100, attente: 1 });
    }));

  it('reste exact avec deux workers PostgreSQL concurrents', async () => {
    const base = NOM_BASE_TEST.replace(/_test$/, '_file_concurrence_test');
    await recreerBaseDeTest(base);
    const preparation = await connecter(base);
    try {
      await preparation.query('begin');
      await semerSoiree(preparation);
      await ouvrir(preparation);
      await commeUtilisateur(preparation, IDS.spectateur);
      await admettre(preparation, ACTION_1, 2);
      await admettre(preparation, ACTION_2, 8);
      await commeUtilisateur(preparation, IDS.spectateur2);
      await admettre(preparation, ACTION_3, 3);
      await admettre(preparation, '50000000-0000-4000-8000-000000000004', 9);
      await preparation.query('commit');
    } finally {
      await preparation.end();
    }

    const executerPaire = async (suffixe: string) => {
      const workers = await Promise.all([connecter(base), connecter(base)]);
      try {
        return await Promise.all(workers.map(async (db, i) => {
          await db.query('begin');
          await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'service_role' })]);
          await db.query('set local role service_role');
          const resultat = (await db.query(
            `select public.traiter_file_notes(100, $1) as resultat`,
            [`file-${suffixe}${String(i).padStart(2, '0')}`],
          )).rows[0].resultat;
          await db.query('commit');
          return resultat.confirmees as number;
        }));
      } finally {
        await Promise.all(workers.map((db) => db.end()));
      }
    };

    try {
      // Les 24 caractères après « file- » incluent le suffixe et l'index du worker.
      const premiere = await executerPaire('1111111111111111111111');
      const seconde = await executerPaire('2222222222222222222222');
      expect([...premiere, ...seconde].reduce((total, n) => total + n, 0)).toBe(4);
      const verification = await connecter(base);
      try {
        expect((await verification.query(
          `select votant_id, note from public.notes_public where passage_id = $1 order by votant_id`,
          [IDS.passageA],
        )).rows).toEqual([
          { votant_id: IDS.spectateur, note: 8 },
          { votant_id: IDS.spectateur2, note: 9 },
        ]);
        expect((await verification.query(
          `select count(*)::int as n from public.file_notes where statut <> 'confirmee'`,
        )).rows[0].n).toBe(0);
      } finally {
        await verification.end();
      }
    } finally {
      await supprimerBaseDeTest(base);
    }
  }, 15_000);

  it('réserve le worker au service_role et expose sa présence seulement en agrégat admin', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await ouvrir(db);
      await commeUtilisateur(db, IDS.spectateur);
      await admettre(db, ACTION_1, 10);
      expect(await doitEtreRefuse(
        db,
        `select public.traiter_file_notes(25, 'file-1234567890abcdef12345678')`,
      )).toBe('42501');

      await traiter(db);
      await commeUtilisateur(db, IDS.spectateur);
      expect(await doitEtreRefuse(db, `select public.lire_statistiques_file_notes()`)).toBe('42501');
      await commeUtilisateur(db, IDS.admin);
      expect((await db.query(`select public.lire_statistiques_file_notes() as stats`)).rows[0].stats)
        .toMatchObject({ queued: 0, confirmedLast5m: 1, workersActive: 1 });
    }));
});
