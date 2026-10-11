import { describe, expect, it } from 'vitest';
import {
  commeSuperutilisateur,
  commeUtilisateur,
  commeVisiteur,
  dansUneTransaction,
  doitEtreRefuse,
} from './aide';
import { IDS, semerSoiree } from './graine';

describe('présence authentifiée', () => {
  it('lie le signal à auth.uid(), refuse anon et masque la table à tous les clients', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeVisiteur(db);
      expect(await doitEtreRefuse(db, `select public.enregistrer_presence()`)).toBe('42501');

      await commeUtilisateur(db, IDS.spectateur);
      await db.query(`select public.enregistrer_presence()`);
      expect(await doitEtreRefuse(db, `select * from public.presences_authentifiees`)).toBe('42501');
      expect(
        await doitEtreRefuse(
          db,
          `insert into public.presences_authentifiees (utilisateur_id) values ($1)`,
          [IDS.admin],
        ),
      ).toBe('42501');

      await commeSuperutilisateur(db);
      expect(
        (await db.query(`select utilisateur_id from public.presences_authentifiees`)).rows,
      ).toEqual([{ utilisateur_id: IDS.spectateur }]);
    }));

  it('n’écrit qu’une fois par minute puis accepte un nouveau signal', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeUtilisateur(db, IDS.spectateur);
      await db.query(`select public.enregistrer_presence()`);
      await commeSuperutilisateur(db);
      const premier = (
        await db.query(`select dernier_signal from public.presences_authentifiees where utilisateur_id = $1`, [
          IDS.spectateur,
        ])
      ).rows[0].dernier_signal;

      await commeUtilisateur(db, IDS.spectateur);
      await db.query(`select public.enregistrer_presence()`);
      await commeSuperutilisateur(db);
      const second = (
        await db.query(`select dernier_signal from public.presences_authentifiees where utilisateur_id = $1`, [
          IDS.spectateur,
        ])
      ).rows[0].dernier_signal;
      expect(second).toEqual(premier);

      await db.query(
        `update public.presences_authentifiees set dernier_signal = clock_timestamp() - interval '61 seconds'
         where utilisateur_id = $1`,
        [IDS.spectateur],
      );
      await commeUtilisateur(db, IDS.spectateur);
      await db.query(`select public.enregistrer_presence()`);
      await commeSuperutilisateur(db);
      const recent = await db.query(
        `select dernier_signal > clock_timestamp() - interval '5 seconds' as recent
         from public.presences_authentifiees where utilisateur_id = $1`,
        [IDS.spectateur],
      );
      expect(recent.rows[0].recent).toBe(true);
    }));
});

describe('statistiques administrateur', () => {
  it('refuse le snapshot au spectateur et ne l’accorde qu’au rôle admin stocké', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeUtilisateur(db, IDS.spectateur);
      expect(await doitEtreRefuse(db, `select public.lire_supervision(1)`)).toBe('42501');
      await commeVisiteur(db);
      expect(await doitEtreRefuse(db, `select public.lire_supervision(1)`)).toBe('42501');

      await commeUtilisateur(db, IDS.admin);
      const snapshot = (await db.query(`select public.lire_supervision(1) as valeur`)).rows[0].valeur;
      expect(snapshot.activeUsers.profilesTotal).toBe(6);
      expect(snapshot.activeUsers.authenticatedLast2m).toBe(0);
      expect(snapshot.votes.public.total).toBe(0);
      expect(snapshot.votes.jury.total).toBe(0);
      expect(snapshot.database.sizeBytes).toBeGreaterThan(0);
      expect(snapshot.database.connections.current).toBeGreaterThan(0);
      expect(snapshot.database.connections.max).toBeGreaterThan(0);
      expect(snapshot.serverHistory).toEqual([]);
    }));

  it('agrège les instances, calcule le p95 par histogramme et échantillonne les actifs', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeUtilisateur(db, IDS.spectateur);
      await db.query(`select public.enregistrer_presence()`);

      await commeSuperutilisateur(db);
      await db.query(`set local role service_role`);
      const minute = new Date();
      minute.setUTCSeconds(0, 0);
      for (const [instance, histogramme] of [
        ['srv-a', [0, 0, 0, 95, 5, 0, 0, 0, 0]],
        ['srv-b', [0, 0, 0, 0, 0, 95, 5, 0, 0]],
      ] as const) {
        await db.query(
          `select public.enregistrer_metrique_serveur(
             $1, $2, 100, 2, 4096, 25, 1000000, 3.5, 4, 8, $3::integer[]
           )`,
          [minute.toISOString(), instance, histogramme],
        );
      }

      await commeUtilisateur(db, IDS.admin);
      const snapshot = (await db.query(`select public.lire_supervision(1) as valeur`)).rows[0].valeur;
      expect(snapshot.activeUsers.authenticatedLast2m).toBe(1);
      expect(snapshot.serverHistory).toHaveLength(1);
      expect(snapshot.serverHistory[0]).toMatchObject({
        requests: 200,
        errors5xx: 4,
        responseBytes: 8192,
        instances: 2,
        authenticatedActiveUsers: 1,
        httpConnectionsMax: 16,
        p95Ms: 500,
      });
      expect(snapshot.serverTotals).toEqual({
        requests: 200,
        errors5xx: 4,
        responseBytes: 8192,
        cpuMs: 50,
        p95: 500,
      });
    }));

  it('conserve 30 jours et refuse tout accès direct aux métriques depuis un JWT', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeSuperutilisateur(db);
      await db.query(`set local role service_role`);
      const latences = [1, 0, 0, 0, 0, 0, 0, 0, 0];
      await db.query(
        `select public.enregistrer_metrique_serveur(
           date_trunc('minute', clock_timestamp()) - interval '31 days', 'ancien',
           1, 0, 1, 1, 1, 1, 1, 1, $1::integer[]
         )`,
        [latences],
      );
      await db.query(
        `select public.enregistrer_metrique_serveur(
           date_trunc('minute', clock_timestamp()) - interval '29 days', 'recent',
           1, 0, 1, 1, 1, 1, 1, 1, $1::integer[]
         )`,
        [latences],
      );
      await db.query(
        `insert into public.presences_authentifiees (utilisateur_id, dernier_signal)
         values ($1, date_trunc('minute', clock_timestamp()) - interval '31 days')`,
        [IDS.spectateur],
      );
      expect((await db.query(`select public.nettoyer_metriques_serveur() as n`)).rows[0].n).toBe(2);
      await commeSuperutilisateur(db);
      expect((await db.query(`select count(*)::int as n from public.supervision_serveur_minutes`)).rows[0].n).toBe(1);
      expect((await db.query(`select count(*)::int as n from public.presences_authentifiees`)).rows[0].n).toBe(0);

      await commeUtilisateur(db, IDS.admin);
      expect(await doitEtreRefuse(db, `select * from public.supervision_serveur_minutes`)).toBe('42501');
      expect(await doitEtreRefuse(db, `select public.nettoyer_metriques_serveur()`)).toBe('42501');
      expect(
        await doitEtreRefuse(
          db,
          `select public.enregistrer_metrique_serveur(
             date_trunc('minute', clock_timestamp()), 'faux', 0, 0, 0, 0, 0, 0, 0, 0,
             array[0,0,0,0,0,0,0,0,0]
           )`,
        ),
      ).toBe('42501');
    }));
});
