import type pg from 'pg';
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

  it('le barème ne change plus dès qu’une note de jury existe, quelle que soit sa valeur', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      const PASSER_A_10 = 'update public.soirees set bareme_jury = 10 where id = $1';
      await db.query('insert into public.notes_jury (passage_id, juge_id, note) values ($1, $2, 15)', [
        IDS.passageA,
        IDS.juge,
      ]);
      expect(await doitEtreRefuse(db, PASSER_A_10, [IDS.soiree])).toBe('23514');
      // Une note de 9 saisie sur 20 se lirait 9/10 : refusé aussi.
      await db.query('update public.notes_jury set note = 9 where passage_id = $1', [IDS.passageA]);
      expect(await doitEtreRefuse(db, PASSER_A_10, [IDS.soiree])).toBe('23514');
      // Réécrire la même valeur n'est pas un changement.
      expect((await db.query('update public.soirees set bareme_jury = 20 where id = $1', [IDS.soiree])).rowCount).toBe(1);
      await db.query('delete from public.notes_jury where passage_id = $1', [IDS.passageA]);
      expect((await db.query(PASSER_A_10, [IDS.soiree])).rowCount).toBe(1);
    }));

  it('accepte une note de jury égale au barème de 20', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      const { rowCount } = await db.query(
        'insert into public.notes_jury (passage_id, juge_id, note) values ($1, $2, 20)',
        [IDS.passageA, IDS.juge],
      );
      expect(rowCount).toBe(1);
    }));

  it('accepte une note de jury égale au barème de 10', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await db.query('update public.soirees set bareme_jury = 10 where id = $1', [IDS.soiree]);
      const { rowCount } = await db.query(
        'insert into public.notes_jury (passage_id, juge_id, note) values ($1, $2, 10)',
        [IDS.passageA, IDS.juge],
      );
      expect(rowCount).toBe(1);
    }));

  it('horodate les notes et les avis à l’insertion, en écrasant un maj_le fourni', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await db.query(
        `insert into public.notes_public (passage_id, votant_id, note, maj_le) values ($1, $2, 8, '2020-01-01')`,
        [IDS.passageA, IDS.spectateur],
      );
      await db.query(
        `insert into public.notes_jury (passage_id, juge_id, note, maj_le) values ($1, $2, 15, '2020-01-01')`,
        [IDS.passageA, IDS.juge],
      );
      await db.query(
        `insert into public.avis_soiree (soiree_id, votant_id, etoiles, maj_le) values ($1, $2, 5, '2020-01-01')`,
        [IDS.soiree, IDS.spectateur],
      );
      const { rows } = await db.query(
        `select (select maj_le = now() from public.notes_public) as notes_public,
                (select maj_le = now() from public.notes_jury) as notes_jury,
                (select maj_le = now() from public.avis_soiree) as avis_soiree`,
      );
      expect(rows[0]).toEqual({ notes_public: true, notes_jury: true, avis_soiree: true });
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

describe('planning modifié après les votes', () => {
  const NOTE_PUBLIC = 'insert into public.notes_public (passage_id, votant_id, note) values ($1, $2, 8)';
  const NOTE_JURY = 'insert into public.notes_jury (passage_id, juge_id, note) values ($1, $2, 15)';
  const CHANGER_MANADE = 'update public.passages set manade_id = $1 where id = $2';
  const engagerManadeHors = (db: pg.Client) =>
    db.query('insert into public.soiree_manades (soiree_id, manade_id, ordre) values ($1, $2, 3)', [
      IDS.soiree,
      IDS.manadeHors,
    ]);

  it('refuse de changer la manade d’un passage noté par le public', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await engagerManadeHors(db);
      await db.query(NOTE_PUBLIC, [IDS.passageA, IDS.spectateur]);
      expect(await doitEtreRefuse(db, CHANGER_MANADE, [IDS.manadeHors, IDS.passageA])).toBe('23503');
    }));

  it('refuse de changer la manade d’un passage noté par le jury', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await engagerManadeHors(db);
      await db.query(NOTE_JURY, [IDS.passageA, IDS.juge]);
      expect(await doitEtreRefuse(db, CHANGER_MANADE, [IDS.manadeHors, IDS.passageA])).toBe('23503');
    }));

  it('refuse de changer l’épreuve d’un passage noté', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      const { rows } = await db.query(
        `insert into public.epreuves (soiree_id, ordre, nom) values ($1, 3, 'Abrivado') returning id`,
        [IDS.soiree],
      );
      await db.query(NOTE_PUBLIC, [IDS.passageA, IDS.spectateur]);
      expect(
        await doitEtreRefuse(db, 'update public.passages set epreuve_id = $1 where id = $2', [rows[0].id, IDS.passageA]),
      ).toBe('23503');
    }));

  it('accepte de changer la manade d’un passage sans note, si la manade cible est engagée', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await db.query(NOTE_PUBLIC, [IDS.passageA, IDS.spectateur]);
      expect(await doitEtreRefuse(db, CHANGER_MANADE, [IDS.manadeHors, IDS.passageB])).toBe('23514');
      await engagerManadeHors(db);
      expect((await db.query(CHANGER_MANADE, [IDS.manadeHors, IDS.passageB])).rowCount).toBe(1);
    }));

  it('refuse de supprimer une épreuve notée', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await db.query(NOTE_PUBLIC, [IDS.passageA, IDS.spectateur]);
      expect(await doitEtreRefuse(db, 'delete from public.epreuves where id = $1', [IDS.epreuve])).toBe('23503');
    }));

  it('refuse de supprimer un passage noté, par le public comme par le jury', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await db.query(NOTE_PUBLIC, [IDS.passageA, IDS.spectateur]);
      await db.query(NOTE_JURY, [IDS.passageB, IDS.juge]);
      for (const passage of [IDS.passageA, IDS.passageB]) {
        expect(await doitEtreRefuse(db, 'delete from public.passages where id = $1', [passage])).toBe('23503');
      }
    }));

  it('refuse de supprimer une soirée qui a des votes : elle s’annule', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await db.query(NOTE_JURY, [IDS.passageA, IDS.juge]);
      expect(await doitEtreRefuse(db, 'delete from public.soirees where id = $1', [IDS.soiree])).toBe('23503');
    }));
});
