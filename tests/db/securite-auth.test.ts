import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { commeSuperutilisateur, commeUtilisateur, dansUneTransaction } from './aide';
import { IDS, modifier, semerSoiree } from './graine';

async function identite(db: pg.Client, id: string, aal: 'aal1' | 'aal2') {
  await commeSuperutilisateur(db);
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: id, role: 'authenticated', aal }),
  ]);
}

describe('administration AAL2', () => {
  it('le rôle admin seul ne suffit pas sans second facteur', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await identite(db, IDS.admin, 'aal1');
      expect((await db.query('select prive.est_admin() as admin')).rows[0].admin).toBe(false);
      await identite(db, IDS.admin, 'aal2');
      expect((await db.query('select prive.est_admin() as admin')).rows[0].admin).toBe(true);
    }));

  it('la RLS masque une soirée brouillon à un admin AAL1 et l’ouvre en AAL2', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, "update public.soirees set statut = 'brouillon' where id = $1", [IDS.soiree]);
      await commeUtilisateur(db, IDS.admin, 'aal1');
      expect((await db.query('select id from public.soirees where id = $1', [IDS.soiree])).rows).toEqual([]);
      await commeUtilisateur(db, IDS.admin, 'aal2');
      expect((await db.query('select id from public.soirees where id = $1', [IDS.soiree])).rows).toEqual([
        { id: IDS.soiree },
      ]);
    }));

  it('un admin affecté comme juge doit aussi présenter AAL2', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, 'insert into public.soiree_juges (soiree_id, juge_id) values ($1, $2)', [
        IDS.soiree,
        IDS.admin,
      ]);
      await modifier(db, "update public.passages set statut_public = 'ouvert' where id = $1", [IDS.passageA]);
      await identite(db, IDS.admin, 'aal1');
      expect((await db.query('select prive.passage_votable_jury($1) as ok', [IDS.passageA])).rows[0].ok).toBe(false);
      await identite(db, IDS.admin, 'aal2');
      expect((await db.query('select prive.passage_votable_jury($1) as ok', [IDS.passageA])).rows[0].ok).toBe(true);
    }));
});

describe('preuve temporelle du consentement', () => {
  it('attend la confirmation email avant d’horodater le consentement', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const id = '00000000-0000-4000-8000-000000000099';
      await db.query(
        `insert into auth.users (id, email, raw_user_meta_data)
         values ($1, 'confirmation@test.fr', '{"prenom":"Léa","consentement":true}')`,
        [id],
      );
      expect((await db.query('select consentement_le from public.profils where id = $1', [id])).rows[0].consentement_le).toBeNull();
      const confirmation = '2026-10-12T18:30:00.000Z';
      await db.query('update auth.users set email_confirmed_at = $1 where id = $2', [confirmation, id]);
      expect((await db.query('select consentement_le from public.profils where id = $1', [id])).rows[0].consentement_le.toISOString()).toBe(confirmation);
    }));

  it('reprend email_confirmed_at quand Auth crée un utilisateur déjà confirmé', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const id = '00000000-0000-4000-8000-000000000098';
      const confirmation = '2026-10-12T18:31:00.000Z';
      await db.query(
        `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
         values ($1, 'confirme@test.fr', $2, '{"prenom":"Paul","consentement":true}')`,
        [id, confirmation],
      );
      expect((await db.query('select consentement_le from public.profils where id = $1', [id])).rows[0].consentement_le.toISOString()).toBe(confirmation);
    }));
});
