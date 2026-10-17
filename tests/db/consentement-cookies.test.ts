import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { commeSuperutilisateur, commeUtilisateur, commeVisiteur, dansUneTransaction, doitEtreRefuse } from './aide';
import { IDS, semerSoiree } from './graine';

const DEPOT_JOURNAL = `insert into public.consentements_cookies
  (visiteur_id, ip_hachee, agent_utilisateur, consentement_donne, mesure_acceptee,
   publicite_acceptee, action, url_page, provenance)
  values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`;

const DEPOT_PAR_DEFAUT = [
  'v_test_1',
  '0123456789abcdef',
  'Mozilla/5.0',
  true,
  true,
  false,
  'custom',
  'https://olympiadedesmanades.fr/noter',
  null,
] as const;

async function commeService(db: pg.Client): Promise<void> {
  await commeSuperutilisateur(db);
  await db.query('set local role service_role');
}

describe('consentement cookies : paramètres', () => {
  it('la ligne par défaut est présente avec les valeurs CNIL par défaut', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select id, titre, duree_consentement_jours, mesure_active, publicite_active,
                url_confidentialite from public.parametres_cookies`,
      );
      expect(rows).toEqual([
        {
          id: 1,
          titre: 'Confidentialité',
          duree_consentement_jours: 365,
          mesure_active: true,
          publicite_active: true,
          url_confidentialite: '/confidentialite',
        },
      ]);
    }));

  it('anon ne lit ni ne modifie la table', () =>
    dansUneTransaction(async (db) => {
      await commeVisiteur(db);
      expect(await doitEtreRefuse(db, 'select * from public.parametres_cookies')).toBe('42501');
      expect(
        await doitEtreRefuse(
          db,
          'update public.parametres_cookies set titre = $1 where id = 1',
          ['Attaque'],
        ),
      ).toBe('42501');
    }));

  it('un utilisateur authentifié non admin ne voit rien et ne peut rien modifier', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeUtilisateur(db, IDS.spectateur);
      expect((await db.query('select * from public.parametres_cookies')).rows).toEqual([]);
      expect(
        (await db.query('update public.parametres_cookies set titre = $1 where id = 1', ['Attaque'])).rowCount,
      ).toBe(0);
    }));

  it('un admin AAL2 lit et met à jour ; un admin AAL1 ne voit aucune ligne', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeUtilisateur(db, IDS.admin, 'aal1');
      expect((await db.query('select id from public.parametres_cookies')).rows).toEqual([]);
      expect(
        (await db.query('update public.parametres_cookies set titre = $1 where id = 1', ['AAL1'])).rowCount,
      ).toBe(0);

      await commeUtilisateur(db, IDS.admin, 'aal2');
      const avant = await db.query('select titre, duree_consentement_jours from public.parametres_cookies');
      expect(avant.rows[0]).toEqual({ titre: 'Confidentialité', duree_consentement_jours: 365 });
      const maj = await db.query(
        `update public.parametres_cookies
           set titre = $1, duree_consentement_jours = $2, modifie_par = $3, modifie_le = now()
         where id = 1`,
        ['Vos préférences', 180, IDS.admin],
      );
      expect(maj.rowCount).toBe(1);
      const apres = await db.query(
        'select titre, duree_consentement_jours, modifie_par from public.parametres_cookies',
      );
      expect(apres.rows[0]).toEqual({
        titre: 'Vos préférences',
        duree_consentement_jours: 180,
        modifie_par: IDS.admin,
      });
    }));

  it('service_role lit la configuration mais ne peut pas la modifier', () =>
    dansUneTransaction(async (db) => {
      await commeService(db);
      const { rows } = await db.query(
        'select titre, duree_consentement_jours from public.parametres_cookies',
      );
      expect(rows).toEqual([{ titre: 'Confidentialité', duree_consentement_jours: 365 }]);
      expect(
        await doitEtreRefuse(
          db,
          'update public.parametres_cookies set titre = $1 where id = 1',
          ['Via serveur'],
        ),
      ).toBe('42501');
    }));

  it('refuse une URL ouverte (// ou absolue), une durée hors bornes et un titre vide', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      for (const url of ['//evil.example', 'https://evil.example', 'confidentialite', '']) {
        expect(
          await doitEtreRefuse(
            db,
            'update public.parametres_cookies set url_confidentialite = $1 where id = 1',
            [url],
          ),
          url || '(vide)',
        ).toBe('23514');
      }
      for (const duree of [0, -1, 400]) {
        expect(
          await doitEtreRefuse(
            db,
            'update public.parametres_cookies set duree_consentement_jours = $1 where id = 1',
            [duree],
          ),
          String(duree),
        ).toBe('23514');
      }
      expect(
        await doitEtreRefuse(
          db,
          'update public.parametres_cookies set titre = $1 where id = 1',
          [''],
        ),
      ).toBe('23514');
    }));

  it('aucune seconde ligne n’est acceptée (id = 1 figé)', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      expect(
        await doitEtreRefuse(db, 'insert into public.parametres_cookies (id) values (2)'),
      ).toBe('23514');
    }));
});

describe('consentement cookies : journal', () => {
  it('service_role dépose une entrée avec IP hachée et url nettoyée', () =>
    dansUneTransaction(async (db) => {
      await commeService(db);
      await db.query(DEPOT_JOURNAL, [...DEPOT_PAR_DEFAUT]);
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select visiteur_id, ip_hachee, action, mesure_acceptee, publicite_acceptee,
                consentement_donne, url_page
         from public.consentements_cookies`,
      );
      expect(rows).toEqual([
        {
          visiteur_id: 'v_test_1',
          ip_hachee: '0123456789abcdef',
          action: 'custom',
          mesure_acceptee: true,
          publicite_acceptee: false,
          consentement_donne: true,
          url_page: 'https://olympiadedesmanades.fr/noter',
        },
      ]);
    }));

  it('refuse une action inconnue, une IP mal formée ou un visiteur vide', () =>
    dansUneTransaction(async (db) => {
      await commeService(db);
      const invalide = (champ: number, valeur: unknown) => {
        const champs = [...DEPOT_PAR_DEFAUT] as unknown[];
        champs[champ] = valeur;
        return champs;
      };
      expect(await doitEtreRefuse(db, DEPOT_JOURNAL, invalide(6, 'autre'))).toBe('23514');
      expect(await doitEtreRefuse(db, DEPOT_JOURNAL, invalide(1, 'ZZZZ'))).toBe('23514');
      expect(await doitEtreRefuse(db, DEPOT_JOURNAL, invalide(0, ''))).toBe('23514');
      expect(await doitEtreRefuse(db, DEPOT_JOURNAL, invalide(7, 'x'.repeat(600)))).toBe('23514');
    }));

  it('anon et un authentifié non admin ne lisent ni ne suppriment le journal', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeService(db);
      await db.query(DEPOT_JOURNAL, [...DEPOT_PAR_DEFAUT]);

      await commeVisiteur(db);
      expect(await doitEtreRefuse(db, 'select * from public.consentements_cookies')).toBe('42501');
      expect(
        await doitEtreRefuse(db, DEPOT_JOURNAL, [...DEPOT_PAR_DEFAUT]),
      ).toBe('42501');

      await commeUtilisateur(db, IDS.spectateur);
      expect((await db.query('select * from public.consentements_cookies')).rows).toEqual([]);
      expect((await db.query('delete from public.consentements_cookies')).rowCount).toBe(0);
    }));

  it('un admin AAL2 lit et supprime, un admin AAL1 ne voit rien', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeService(db);
      await db.query(DEPOT_JOURNAL, [...DEPOT_PAR_DEFAUT]);

      await commeUtilisateur(db, IDS.admin, 'aal1');
      expect((await db.query('select visiteur_id from public.consentements_cookies')).rows).toEqual([]);
      expect((await db.query('delete from public.consentements_cookies')).rowCount).toBe(0);

      await commeUtilisateur(db, IDS.admin, 'aal2');
      expect(
        (await db.query('select visiteur_id from public.consentements_cookies')).rows,
      ).toEqual([{ visiteur_id: 'v_test_1' }]);
      expect((await db.query('delete from public.consentements_cookies')).rowCount).toBe(1);
    }));

  it('service_role ne peut pas lire ni modifier le journal', () =>
    dansUneTransaction(async (db) => {
      await commeService(db);
      expect(await doitEtreRefuse(db, 'select * from public.consentements_cookies')).toBe('42501');
      expect(
        await doitEtreRefuse(db, 'delete from public.consentements_cookies'),
      ).toBe('42501');
    }));
});
