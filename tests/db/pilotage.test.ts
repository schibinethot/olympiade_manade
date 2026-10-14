import { describe, expect, it } from 'vitest';
import { commeUtilisateur, commeVisiteur, dansUneTransaction, doitEtreRefuse } from './aide';
import { IDS, modifier, semerSoiree } from './graine';

describe('pilotage : délai de vote et fenêtre automatique', () => {
  it('refuse une note publique après le délai et l’accepte de nouveau après prolongation', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, `update public.passages set statut_public = 'ouvert', fin_passage_le = now() - interval '6 minutes' where id = $1`, [IDS.passageA]);
      await commeUtilisateur(db, IDS.spectateur);
      expect(await doitEtreRefuse(
        db,
        `insert into public.notes_public (passage_id, votant_id, note) values ($1, $2, 8)`,
        [IDS.passageA, IDS.spectateur],
      )).not.toBe('00000');
      await modifier(db, `update public.passages set ferme_le = now() + interval '10 minutes' where id = $1`, [IDS.passageA]);
      await commeUtilisateur(db, IDS.spectateur);
      const note = await db.query(
        `insert into public.notes_public (passage_id, votant_id, note) values ($1, $2, 8) returning note`,
        [IDS.passageA, IDS.spectateur],
      );
      expect(note.rows[0].note).toBe(8);
    }));

  it('repousse la fin de la fenêtre automatique quand le planning est décalé', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, `update public.soirees set mode_fenetre = 'automatique', mode_vote = 'libre', delai_vote_minutes = 5 where id = $1`, [IDS.soiree]);
      await modifier(db, `update public.epreuves set heure_debut = now() - interval '20 minutes', heure_fin = now() + interval '20 minutes' where id = $1`, [IDS.epreuve]);
      const avant = await db.query(`select vote_fin from public.soirees where id = $1`, [IDS.soiree]);
      await modifier(db, `update public.epreuves set heure_fin = heure_fin + interval '10 minutes' where id = $1`, [IDS.epreuve]);
      const apres = await db.query(`select vote_fin > $1::timestamptz as plus_tard, vote_fin > now() as encore_ouverte from public.soirees where id = $2`, [avant.rows[0].vote_fin, IDS.soiree]);
      expect(apres.rows[0]).toEqual({ plus_tard: true, encore_ouverte: true });
      await modifier(db, `update public.epreuves set heure_fin = now() - interval '10 minutes' where id = $1`, [IDS.epreuve]);
      await commeUtilisateur(db, IDS.spectateur);
      expect(await doitEtreRefuse(
        db,
        `insert into public.notes_public (passage_id, votant_id, note) values ($1, $2, 7)`,
        [IDS.passageA, IDS.spectateur],
      )).not.toBe('00000');
    }));
});

describe('pilotage : instantané et participants', () => {
  it('laisse lire l’instantané d’une soirée visible et le refuse en écriture au public', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await modifier(db, `insert into public.etat_soiree (soiree_id, instantane) values ($1, '{"etat":"ouvert"}')`, [IDS.soiree]);
      await commeVisiteur(db);
      const lu = await db.query(`select instantane->>'etat' as etat from public.etat_soiree where soiree_id = $1`, [IDS.soiree]);
      expect(lu.rows).toEqual([{ etat: 'ouvert' }]);
      expect(await doitEtreRefuse(db, `insert into public.etat_soiree (soiree_id, instantane) values ($1, '{}')`, [IDS.soiree])).toBe('42501');
    }));

  it('ne montre les emails qu’à un administrateur AAL2', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeVisiteur(db);
      expect(await doitEtreRefuse(db, 'select * from public.lire_participants()')).toBe('42501');
      await commeUtilisateur(db, IDS.admin, 'aal1');
      expect((await db.query('select * from public.lire_participants()')).rowCount).toBe(0);
      await commeUtilisateur(db, IDS.admin, 'aal2');
      const lignes = await db.query(`select email, role::text from public.lire_participants() where id = $1`, [IDS.spectateur]);
      expect(lignes.rows).toEqual([{ email: 'lea@test.fr', role: 'spectateur' }]);
    }));
});
