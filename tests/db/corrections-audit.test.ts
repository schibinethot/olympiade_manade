import { describe, expect, it } from 'vitest';
import { dansUneTransaction } from './aide';
import { IDS, semerSoiree } from './graine';

describe('corrections de l’audit fonctionnel', () => {
  it('les deux manades citées au palmarès font partie de l’annuaire', () =>
    dansUneTransaction(async (db) => {
      const { rows } = await db.query("select nom from public.manades where nom in ('Bon', 'Labourayre') order by nom");
      expect(rows).toEqual([{ nom: 'Bon' }, { nom: 'Labourayre' }]);
    }));

  it('une soirée publiée en mode libre ouvre ses avis dès la fin des votes', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await db.query(`update public.soirees set statut = 'publiee', mode_vote = 'libre',
        vote_debut = now() - interval '2 hours', vote_fin = now() where id = $1`, [IDS.soiree]);
      expect((await db.query('select prive.avis_ouvert($1) as ouvert', [IDS.soiree])).rows[0].ouvert).toBe(true);
      for (const statut of ['brouillon', 'reportee', 'annulee']) {
        await db.query('update public.soirees set statut = $1 where id = $2', [statut, IDS.soiree]);
        expect((await db.query('select prive.avis_ouvert($1) as ouvert', [IDS.soiree])).rows[0].ouvert).toBe(false);
      }
    }));

  it('en déblocage, l’heure de fin ne suffit pas : tous les passages notés doivent être clos', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await db.query(`update public.soirees set vote_debut = now() - interval '2 hours', vote_fin = now() where id = $1`, [IDS.soiree]);
      const ouvert = async () => (await db.query('select prive.avis_ouvert($1) as ouvert', [IDS.soiree])).rows[0].ouvert;
      expect(await ouvert()).toBe(false);
      await db.query("update public.passages set statut_public = 'clos' where id = $1", [IDS.passageA]);
      expect(await ouvert()).toBe(false);
      await db.query("update public.passages set statut_public = 'ouvert' where id = $1", [IDS.passageB]);
      expect(await ouvert()).toBe(false);
      await db.query("update public.passages set statut_public = 'clos' where id = $1", [IDS.passageB]);
      // La démonstration non notée reste à venir et ne bloque pas les avis.
      expect(await ouvert()).toBe(true);
    }));
});
