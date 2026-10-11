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

describe('modification et suppression directes', () => {
  const MODIF_NOTE = 'update public.notes_public set note = 1 where votant_id = $1';

  it('notes : une note ne peut plus être modifiée sur un passage clos', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await voter(db, IDS.spectateur, IDS.passageA, 8);
      await modifier(db, `update public.passages set statut_public = 'clos' where id = $1`, [IDS.passageA]);
      await commeUtilisateur(db, IDS.spectateur);
      expect((await db.query(MODIF_NOTE, [IDS.spectateur])).rowCount).toBe(0);
      expect(await notesEnBase(db)).toEqual([{ votant_id: IDS.spectateur, note: 8 }]);
    }));

  it('notes : refuse de déplacer une note vers un autre passage', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await modifier(db, ouvrir(IDS.passageB));
      await voter(db, IDS.spectateur, IDS.passageA, 8);
      await commeUtilisateur(db, IDS.spectateur);
      expect(
        await doitEtreRefuse(db, 'update public.notes_public set passage_id = $1 where passage_id = $2', [
          IDS.passageB,
          IDS.passageA,
        ]),
      ).toBe('42501');
    }));

  it('notes : refuse de changer le votant', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await voter(db, IDS.spectateur, IDS.passageA, 8);
      await commeUtilisateur(db, IDS.spectateur);
      expect(
        await doitEtreRefuse(db, 'update public.notes_public set votant_id = $1 where votant_id = $2', [
          IDS.spectateur2,
          IDS.spectateur,
        ]),
      ).toBe('42501');
    }));

  it('notes : aucune suppression possible', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, ouvrir(IDS.passageA));
      await voter(db, IDS.spectateur, IDS.passageA, 8);
      await commeUtilisateur(db, IDS.spectateur);
      expect(await doitEtreRefuse(db, 'delete from public.notes_public')).toBe('42501');
    }));

  it('avis : non modifiable quand la soirée n’est plus terminée', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, `update public.soirees set statut = 'terminee' where id = $1`, [IDS.soiree]);
      await commeUtilisateur(db, IDS.spectateur);
      await db.query(DONNER_AVIS, [IDS.soiree, IDS.spectateur, 5, 'Super']);
      await modifier(db, `update public.soirees set statut = 'annulee' where id = $1`, [IDS.soiree]);
      await commeUtilisateur(db, IDS.spectateur);
      expect((await db.query('update public.avis_soiree set etoiles = 1')).rowCount).toBe(0);
      await commeSuperutilisateur(db);
      expect((await db.query('select etoiles from public.avis_soiree')).rows).toEqual([{ etoiles: 5 }]);
    }));

  it('avis : refuse de déplacer un avis vers une autre soirée', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, `update public.soirees set statut = 'terminee' where id = $1`, [IDS.soiree]);
      await commeUtilisateur(db, IDS.spectateur);
      await db.query(DONNER_AVIS, [IDS.soiree, IDS.spectateur, 5, 'Super']);
      expect(
        await doitEtreRefuse(db, 'update public.avis_soiree set soiree_id = $1', [
          '20000000-0000-4000-8000-0000000000ff',
        ]),
      ).toBe('42501');
    }));

  it('avis : refuse de déplacer un avis vers une autre soirée terminée', () =>
    dansUneTransaction(async (db) => {
      const autreSoiree = '20000000-0000-4000-8000-0000000000fe';
      await semerSoiree(db);
      await modifier(
        db,
        `insert into public.soirees (id, slug, nom, date_soiree, vote_debut, vote_fin, statut)
         values ($1, 'autre-2026', 'Autre soirée', current_date - 30,
                 now() - interval '30 days', now() - interval '29 days', 'terminee')`,
        [autreSoiree],
      );
      await modifier(db, `update public.soirees set statut = 'terminee' where id = $1`, [IDS.soiree]);
      await commeUtilisateur(db, IDS.spectateur);
      await db.query(DONNER_AVIS, [IDS.soiree, IDS.spectateur, 5, 'Super']);
      expect(
        await doitEtreRefuse(db, 'update public.avis_soiree set soiree_id = $1', [autreSoiree]),
      ).toBe('42501');
      await commeSuperutilisateur(db);
      expect((await db.query('select soiree_id from public.avis_soiree')).rows).toEqual([{ soiree_id: IDS.soiree }]);
    }));
});
