import { describe, expect, it } from 'vitest';
import { commeSuperutilisateur, commeUtilisateur, dansUneTransaction, doitEtreRefuse } from './aide';
import { IDS, modifier, semerSoiree } from './graine';

describe('reste du CDC', () => {
  it('laisse l’identité vide et la coque Android fermée', () =>
    dansUneTransaction(async (db) => {
      const identite = await db.query('select count(*)::int as n from public.identite_legale');
      expect(identite.rows[0].n).toBe(0);
      const drapeau = await db.query('select app_ouverte_au_public from public.parametres');
      expect(drapeau.rows[0].app_ouverte_au_public).toBe(false);
    }));

  it('enregistre un brouillon d’import sans modifier les épreuves', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      const avant = await db.query('select count(*)::int as n from public.epreuves');
      await commeUtilisateur(db, IDS.admin, 'aal2');
      await db.query(
        `insert into public.imports_planning (soiree_id, nom_fichier, type_fichier, empreinte, statut, resultat)
         values ($1, 'planning.csv', 'csv', $2, 'brouillon', '{"manades":["Essai"]}'::jsonb)`,
        [IDS.soiree, 'ab'.repeat(32)],
      );
      await commeSuperutilisateur(db);
      const apres = await db.query('select count(*)::int as n from public.epreuves');
      const statut = await db.query('select statut from public.imports_planning');
      expect(apres.rows[0].n).toBe(avant.rows[0].n);
      expect(statut.rows).toEqual([{ statut: 'brouillon' }]);
    }));

  it('horodate le consentement et ignore une écriture directe', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeSuperutilisateur(db);
      await db.query(
        `update public.profils set notifications_choix = 'accepte', notifications_choix_le = now() where id = $1`,
        [IDS.spectateur],
      );
      const direct = await db.query(
        'select notifications_choix, notifications_choix_le from public.profils where id = $1',
        [IDS.spectateur],
      );
      expect(direct.rows[0]).toEqual({ notifications_choix: null, notifications_choix_le: null });
      await commeUtilisateur(db, IDS.spectateur);
      const le = await db.query(`select public.enregistrer_choix_notifications('accepte') as le`);
      expect(le.rows[0].le).toBeTruthy();
      await commeSuperutilisateur(db);
      const choisi = await db.query(
        'select notifications_choix, notifications_choix_le is not null as horodate from public.profils where id = $1',
        [IDS.spectateur],
      );
      expect(choisi.rows[0]).toEqual({ notifications_choix: 'accepte', horodate: true });
    }));

  it('purge seulement les spectateurs inactifs, et pas depuis un rôle authentifié', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await db.query('reset role');
      await db.query('set local role service_role');
      const frais = await db.query('select public.purger_spectateurs_inactifs() as n');
      expect(frais.rows[0].n).toBe(0);
      await commeUtilisateur(db, IDS.admin, 'aal2');
      expect(await doitEtreRefuse(db, 'select public.purger_spectateurs_inactifs()')).toBe('42501');
      await modifier(db, `update public.profils set cree_le = now() - interval '25 months' where id = $1`, [IDS.spectateur2]);
      await db.query('reset role');
      await db.query('set local role service_role');
      const vieux = await db.query('select public.purger_spectateurs_inactifs() as n');
      expect(vieux.rows[0].n).toBe(1);
      await commeSuperutilisateur(db);
      const reste = await db.query('select count(*)::int as n from auth.users where id = $1', [IDS.spectateur2]);
      expect(reste.rows[0].n).toBe(0);
    }));
});
