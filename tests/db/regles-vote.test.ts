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
