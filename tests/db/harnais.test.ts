import { describe, expect, it } from 'vitest';
import { commeUtilisateur, commeVisiteur, dansUneTransaction, doitEtreRefuse } from './aide';

const ID = '00000000-0000-4000-8000-000000000001';

describe('harnais de test de la base', () => {
  it('auth.uid() renvoie l’identifiant du jeton simulé', () =>
    dansUneTransaction(async (db) => {
      await commeUtilisateur(db, ID);
      const { rows } = await db.query('select auth.uid() as uid, current_user as role');
      expect(rows[0]).toEqual({ uid: ID, role: 'authenticated' });
    }));

  it('un visiteur n’a pas d’identifiant', () =>
    dansUneTransaction(async (db) => {
      await commeVisiteur(db);
      const { rows } = await db.query('select auth.uid() as uid, current_user as role');
      expect(rows[0]).toEqual({ uid: null, role: 'anon' });
    }));

  it('doitEtreRefuse renvoie le code d’erreur et laisse la transaction utilisable', () =>
    dansUneTransaction(async (db) => {
      const code = await doitEtreRefuse(db, 'select 1 / 0');
      expect(code).toBe('22012');
      const { rows } = await db.query('select 1 as ok');
      expect(rows[0].ok).toBe(1);
    }));

  it('doitEtreRefuse échoue si la requête passe', () =>
    dansUneTransaction(async (db) => {
      await expect(doitEtreRefuse(db, 'select 1')).rejects.toThrow('devait être refusée');
    }));
});
