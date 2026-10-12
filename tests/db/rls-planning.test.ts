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
      await commeUtilisateur(db, IDS.admin, 'aal2');
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
      await commeUtilisateur(db, IDS.admin, 'aal2');
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
      await commeUtilisateur(db, IDS.admin, 'aal2');
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
      await commeUtilisateur(db, IDS.admin, 'aal2');
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
      await commeUtilisateur(db, IDS.admin, 'aal2');
      expect(await compter(db, 'soiree_juges')).toBe(1);
    }));

  it('ni un juge ni un spectateur ne s’auto-rattachent à une soirée', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      for (const id of [IDS.jugeNonRattache, IDS.spectateur]) {
        await commeUtilisateur(db, id);
        expect(
          await doitEtreRefuse(db, `insert into public.soiree_juges (soiree_id, juge_id) values ($1, $2)`, [
            IDS.soiree,
            id,
          ]),
        ).toBe('42501');
      }
    }));

  it('même un admin ne change pas un rôle via l’API', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeUtilisateur(db, IDS.admin, 'aal2');
      expect(
        await doitEtreRefuse(db, `update public.profils set role = 'admin' where id = $1`, [IDS.spectateur]),
      ).toBe('42501');
    }));
});
