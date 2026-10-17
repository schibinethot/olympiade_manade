import { describe, expect, it } from 'vitest';
import { commeSuperutilisateur, commeUtilisateur, commeVisiteur, dansUneTransaction, doitEtreRefuse } from './aide';
import { IDS, semerSoiree } from './graine';

const DEPOSER = `insert into public.abonnements_actualites
  (email, consentement_texte, consentement_version, source) values ($1, $2, $3, 'accueil')`;

async function commeService(db: Parameters<typeof dansUneTransaction>[0] extends (db: infer T) => unknown ? T : never) {
  await commeSuperutilisateur(db);
  await db.query('set local role service_role');
}

describe('abonnements aux actualités', () => {
  it('la base date la preuve et l’unicité préserve le consentement initial', () =>
    dansUneTransaction(async (db) => {
      await commeService(db);
      await db.query(DEPOSER, ['lea@exemple.fr', 'Consentement explicite', '2026-10-17']);
      expect(await doitEtreRefuse(db, DEPOSER, ['lea@exemple.fr', 'Autre texte', 'v2'])).toBe('23505');
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select email, consentement_texte, consentement_version, source,
                consentement_le is not null as datee, cree_le is not null as cree
         from public.abonnements_actualites`,
      );
      expect(rows).toEqual([{
        email: 'lea@exemple.fr',
        consentement_texte: 'Consentement explicite',
        consentement_version: '2026-10-17',
        source: 'accueil',
        datee: true,
        cree: true,
      }]);
    }));

  it('la base refuse un email non normalisé ou invalide et le serveur ne choisit pas la date', () =>
    dansUneTransaction(async (db) => {
      await commeService(db);
      for (const email of ['Lea@exemple.fr', ' lea@exemple.fr ', 'pas-un-email']) {
        expect(await doitEtreRefuse(db, DEPOSER, [email, 'Consentement', 'v1']), email).toBe('23514');
      }
      expect(
        await doitEtreRefuse(
          db,
          `insert into public.abonnements_actualites
             (email, consentement_le, consentement_texte, consentement_version, source)
           values ('lea@exemple.fr', '2020-01-01', 'Consentement', 'v1', 'accueil')`,
        ),
      ).toBe('42501');
    }));

  it('anon et authenticated ne peuvent ni déposer ni voir la liste', () =>
    dansUneTransaction(async (db) => {
      await commeVisiteur(db);
      expect(await doitEtreRefuse(db, DEPOSER, ['visiteur@exemple.fr', 'Consentement', 'v1'])).toBe('42501');
      expect(await doitEtreRefuse(db, 'select * from public.abonnements_actualites')).toBe('42501');

      await semerSoiree(db);
      await commeService(db);
      await db.query(DEPOSER, ['lea@exemple.fr', 'Consentement', 'v1']);
      await commeUtilisateur(db, IDS.spectateur);
      expect((await db.query('select * from public.abonnements_actualites')).rows).toEqual([]);
      expect((await db.query('delete from public.abonnements_actualites')).rowCount).toBe(0);
    }));

  it('un admin AAL2 lit et supprime, tandis qu’un admin AAL1 ne voit aucune ligne', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeService(db);
      await db.query(DEPOSER, ['lea@exemple.fr', 'Consentement', 'v1']);

      await commeUtilisateur(db, IDS.admin, 'aal1');
      expect((await db.query('select email from public.abonnements_actualites')).rows).toEqual([]);
      expect((await db.query('delete from public.abonnements_actualites')).rowCount).toBe(0);

      await commeUtilisateur(db, IDS.admin, 'aal2');
      expect((await db.query('select email from public.abonnements_actualites')).rows).toEqual([{ email: 'lea@exemple.fr' }]);
      expect((await db.query('delete from public.abonnements_actualites')).rowCount).toBe(1);
    }));
});
