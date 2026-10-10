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

  it('refuse de retirer une manade qui a des passages, accepte sinon', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      const code = await doitEtreRefuse(
        db,
        'delete from public.soiree_manades where soiree_id = $1 and manade_id = $2',
        [IDS.soiree, IDS.manadeA],
      );
      expect(code).toBe('23503');
      await db.query('insert into public.soiree_manades (soiree_id, manade_id, ordre) values ($1, $2, 3)', [
        IDS.soiree,
        IDS.manadeHors,
      ]);
      const { rowCount } = await db.query(
        'delete from public.soiree_manades where soiree_id = $1 and manade_id = $2',
        [IDS.soiree, IDS.manadeHors],
      );
      expect(rowCount).toBe(1);
    }));

  it('refuse de déplacer une épreuve vers une autre soirée', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      const { rows } = await db.query(
        `insert into public.soirees (slug, nom, date_soiree, vote_debut, vote_fin)
         values ('autre-2027', 'Autre', current_date, now(), now() + interval '1 hour') returning id`,
      );
      const code = await doitEtreRefuse(db, 'update public.epreuves set soiree_id = $1 where id = $2', [
        rows[0].id,
        IDS.epreuve,
      ]);
      expect(code).toBe('23514');
    }));

  it('refuse de baisser le barème sous une note de jury existante', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await db.query('insert into public.notes_jury (passage_id, juge_id, note) values ($1, $2, 15)', [
        IDS.passageA,
        IDS.juge,
      ]);
      const code = await doitEtreRefuse(db, 'update public.soirees set bareme_jury = 10 where id = $1', [
        IDS.soiree,
      ]);
      expect(code).toBe('23514');
      await db.query('update public.notes_jury set note = 10 where passage_id = $1', [IDS.passageA]);
      const { rowCount } = await db.query('update public.soirees set bareme_jury = 10 where id = $1', [
        IDS.soiree,
      ]);
      expect(rowCount).toBe(1);
    }));

  it('supprime une soirée avec ses passages en cascade', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await db.query('delete from public.soirees where id = $1', [IDS.soiree]);
      const { rows } = await db.query(
        `select (select count(*) from public.passages)::int as passages,
                (select count(*) from public.soiree_manades where soiree_id = $1)::int as engagements`,
        [IDS.soiree],
      );
      expect(rows[0]).toEqual({ passages: 0, engagements: 0 });
    }));

  it('refuse de remplacer une manade qui a des passages dans soiree_manades', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      const code = await doitEtreRefuse(
        db,
        'update public.soiree_manades set manade_id = $1 where soiree_id = $2 and manade_id = $3',
        [IDS.manadeHors, IDS.soiree, IDS.manadeA],
      );
      expect(code).toBe('23503');
    }));
});
