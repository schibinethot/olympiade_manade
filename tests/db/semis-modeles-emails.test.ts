import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { lignesModelesParDefaut } from '../../serveur/emails.mjs';
import { ETAPES } from '../../serveur/gabarits-emails.mjs';
import { commeSuperutilisateur, dansUneTransaction } from './aide';

// Semis des modèles par le serveur (demarrer) face aux vraies contraintes de la migration : le corps est
// celui du POST /rest/v1/modeles_emails?on_conflict=cle, inséré comme PostgREST le fait
// (json_populate_recordset, colonnes du corps, ON CONFLICT DO NOTHING pour resolution=ignore-duplicates),
// en service_role.

const INSERTION = `
  insert into public.modeles_emails (cle, nom, actif, sujet, preheader, corps, encart, jours_decalage, heure_envoi)
  select cle, nom, actif, sujet, preheader, corps, encart, jours_decalage, heure_envoi
  from json_populate_recordset(null::public.modeles_emails, $1::json)
  on conflict (cle) do nothing`;

async function commeService(db: pg.Client): Promise<void> {
  await commeSuperutilisateur(db);
  await db.query('set local role service_role');
}

describe('semis des modèles d’e-mails', () => {
  it('les 9 MODELES_DEFAUT passent les contraintes en service_role, et un second semis n’écrase rien', () =>
    dansUneTransaction(async (db) => {
      const lignes = lignesModelesParDefaut();
      expect(lignes.map((ligne) => ligne.cle)).toEqual([...ETAPES]);

      await commeService(db);
      const premier = await db.query(INSERTION, [JSON.stringify(lignes)]);
      expect(premier.rowCount).toBe(9);

      // L'admin a modifié un texte entre-temps : le semis suivant (redémarrage) ne le touche pas.
      await commeSuperutilisateur(db);
      await db.query(`update public.modeles_emails set sujet = 'Sujet de l’admin' where cle = 'veille'`);
      await commeService(db);
      const second = await db.query(INSERTION, [JSON.stringify(lignes)]);
      expect(second.rowCount).toBe(0);

      await commeSuperutilisateur(db);
      const { rows } = await db.query<{ cle: string; sujet: string; actif: boolean; jours_decalage: number | null; heure_envoi: string | null; encart: string | null }>(
        `select cle, sujet, actif, jours_decalage, heure_envoi::text as heure_envoi, encart from public.modeles_emails`,
      );
      const parCle = new Map(rows.map((ligne) => [ligne.cle, ligne]));
      expect(parCle.size).toBe(9);
      expect(parCle.get('veille')).toMatchObject({ sujet: 'Sujet de l’admin', jours_decalage: -1, heure_envoi: '18:00:00', encart: null });
      expect(parCle.get('bienvenue')?.encart).not.toBeNull();
      expect(parCle.get('annonce')).toMatchObject({ jours_decalage: -10, heure_envoi: '10:00:00' });
      expect(rows.every((ligne) => ligne.actif)).toBe(true);
    }));
});
