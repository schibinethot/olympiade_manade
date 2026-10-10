import { describe, expect, it } from 'vitest';
import { commeUtilisateur, commeVisiteur, dansUneTransaction, doitEtreRefuse } from './aide';
import { IDS, modifier, semerSoiree } from './graine';

const DEPOSER = `insert into public.messages_contact (prenom, email, message) values ($1, $2, $3)`;

describe('vitrine : calendrier et palmarès', () => {
  it('un visiteur lit le calendrier et le palmarès de référence', () =>
    dansUneTransaction(async (db) => {
      await commeVisiteur(db);
      const cal = await db.query(
        `select count(*)::int as n from public.calendrier where annee = 2027 and statut = 'previsionnelle'`,
      );
      expect(cal.rows[0].n).toBe(10);
      const nimes = await db.query(
        `select date_soiree::text as d from public.calendrier where annee = 2027 and ville = 'Nîmes'`,
      );
      expect(nimes.rows).toEqual([{ d: '2027-08-20' }]);
      const pal = await db.query(
        `select annee, vainqueur, statut::text from public.palmares where evenement like '%Grandes Olympiades%' order by annee`,
      );
      expect(pal.rows).toEqual([
        { annee: 2023, vainqueur: 'Vinuesa', statut: 'confirme' },
        { annee: 2024, vainqueur: 'Vinuesa', statut: 'confirme' },
        { annee: 2025, vainqueur: 'Vinuesa', statut: 'a_confirmer' },
      ]);
    }));

  it('un visiteur et un spectateur ne modifient ni le calendrier ni le palmarès', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeVisiteur(db);
      expect(await doitEtreRefuse(db, `delete from public.palmares`)).toBe('42501');
      await commeUtilisateur(db, IDS.spectateur);
      expect((await db.query(`update public.calendrier set ville = 'X'`)).rowCount).toBe(0);
      expect(
        await doitEtreRefuse(
          db,
          `insert into public.palmares (annee, evenement, ville, vainqueur) values (2027, 'Faux', 'X', 'Y')`,
        ),
      ).toBe('42501');
    }));

  it('l’admin met à jour le palmarès et le calendrier', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeUtilisateur(db, IDS.admin);
      const r = await db.query(
        `update public.palmares set statut = 'confirme' where annee = 2025 and evenement like '%Grandes Olympiades%'`,
      );
      expect(r.rowCount).toBe(1);
      const c = await db.query(
        `update public.calendrier set statut = 'confirmee' where annee = 2027 and ville = 'Nîmes'`,
      );
      expect(c.rowCount).toBe(1);
    }));
});

describe('vitrine : messages de contact', () => {
  it('un visiteur dépose un message mais ne peut pas le relire', () =>
    dansUneTransaction(async (db) => {
      await commeVisiteur(db);
      await db.query(DEPOSER, ['Léa', 'lea@exemple.fr', 'Bonjour, quelle est la date 2027 ?']);
      expect(await doitEtreRefuse(db, `select * from public.messages_contact`)).toBe('42501');
    }));

  it('un visiteur ne choisit ni la date ni le statut traité', () =>
    dansUneTransaction(async (db) => {
      await commeVisiteur(db);
      expect(
        await doitEtreRefuse(
          db,
          `insert into public.messages_contact (prenom, email, message, traite) values ('A', 'a@b.fr', 'Message assez long', true)`,
        ),
      ).toBe('42501');
    }));

  it('refuse un email invalide et un message trop court ou trop long', () =>
    dansUneTransaction(async (db) => {
      await commeVisiteur(db);
      expect(await doitEtreRefuse(db, DEPOSER, ['A', 'pas-un-email', 'Message assez long'])).toBe('23514');
      expect(await doitEtreRefuse(db, DEPOSER, ['A', 'a@b.fr', 'court'])).toBe('23514');
      expect(await doitEtreRefuse(db, DEPOSER, ['A', 'a@b.fr', 'x'.repeat(2001)])).toBe('23514');
    }));

  it('l’admin lit les messages et les marque traités, un spectateur non', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await commeVisiteur(db);
      await db.query(DEPOSER, ['Léa', 'lea@exemple.fr', 'Bonjour, quelle est la date 2027 ?']);
      await commeUtilisateur(db, IDS.spectateur);
      expect((await db.query(`select * from public.messages_contact`)).rowCount).toBe(0);
      await commeUtilisateur(db, IDS.admin);
      expect((await db.query(`select * from public.messages_contact`)).rowCount).toBe(1);
      expect((await db.query(`update public.messages_contact set traite = true`)).rowCount).toBe(1);
      expect(await doitEtreRefuse(db, `update public.messages_contact set message = 'modifié par admin'`)).toBe(
        '42501',
      );
    }));
});
