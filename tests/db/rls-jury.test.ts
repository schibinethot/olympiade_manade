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
      await commeUtilisateur(db, IDS.admin, 'aal2');
      expect((await db.query('select count(*)::int as n from public.notes_jury')).rows[0].n).toBe(2);
    }));

  it('un update direct sur un passage verrouillé ne touche aucune ligne', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await commeUtilisateur(db, IDS.juge);
      await db.query(NOTER, [IDS.passageA, IDS.juge, 15, null]);
      await modifier(db, `update public.passages set statut_jury = 'verrouille' where id = $1`, [IDS.passageA]);
      await commeUtilisateur(db, IDS.juge);
      const res = await db.query('update public.notes_jury set note = 1 where passage_id = $1', [IDS.passageA]);
      expect(res.rowCount).toBe(0);
      expect(await notesJuryEnBase(db)).toEqual([{ juge_id: IDS.juge, note: '15' }]);
    }));

  it('le juge ne peut pas déplacer sa note vers un autre passage', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await modifier(db, ouvrir(IDS.passageB));
      await commeUtilisateur(db, IDS.juge);
      await db.query(NOTER, [IDS.passageA, IDS.juge, 15, null]);
      expect(
        await doitEtreRefuse(db, 'update public.notes_jury set passage_id = $1 where passage_id = $2', [
          IDS.passageB,
          IDS.passageA,
        ]),
      ).toBe('42501');
    }));

  it('le juge ne peut pas supprimer sa note', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await commeUtilisateur(db, IDS.juge);
      await db.query(NOTER, [IDS.passageA, IDS.juge, 15, null]);
      expect(await doitEtreRefuse(db, 'delete from public.notes_jury where passage_id = $1', [IDS.passageA])).toBe(
        '42501',
      );
    }));
});
