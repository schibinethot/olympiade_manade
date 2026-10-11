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
      expect(cal.rows[0].n).toBe(18);
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
        { annee: 2026, vainqueur: 'Arlatenco', statut: 'confirme' },
      ]);
    }));

  it('les vérifications de sources et les décisions du 11/10 sont en place', () =>
    dansUneTransaction(async (db) => {
      const nimes2024 = await db.query(
        `select detail from public.palmares where annee = 2024 and ville = 'Nîmes' and evenement like '%Grandes Olympiades%'`,
      );
      expect(nimes2024.rows[0].detail).toContain('Lescot, Aubanel et Robert Michel');
      expect(nimes2024.rows[0].detail).not.toContain('Benabent');
      const manades = await db.query(
        `select nom from public.manades where nom in ('Bon', 'Du Juge', 'Labourayre') order by nom`,
      );
      expect(manades.rows.map((r) => r.nom)).toEqual(['Bon', 'Du Juge', 'Labourayre']);
      const defaut = await db.query(
        `select column_default from information_schema.columns where table_schema = 'public' and table_name = 'soirees' and column_name = 'methode_general'`,
      );
      expect(defaut.rows[0].column_default).toBe(`'points'::methode_general`);
    }));

  it('les compléments du 10/10 sont en place', () =>
    dansUneTransaction(async (db) => {
      await commeVisiteur(db);
      const arles = await db.query(
        `select statut::text as s, date_soiree::text as d, heure::text as h from public.calendrier where annee = 2027 and ville = 'Arles'`,
      );
      expect(arles.rows).toEqual([{ s: 'previsionnelle', d: '2027-05-01', h: '15:30:00' }]);
      const beaucaire = await db.query(
        `select date_soiree::text as d from public.calendrier where annee = 2027 and ville = 'Beaucaire'`,
      );
      expect(beaucaire.rows).toEqual([{ d: '2027-07-20' }]);
      const total = await db.query(`select count(*)::int as n from public.calendrier where annee = 2027`);
      expect(total.rows[0].n).toBe(18);
      const pal = await db.query(
        `select count(*)::int as n, count(*) filter (where statut = 'confirme')::int as confirmes, count(*) filter (where statut = 'a_confirmer' and ville = 'Bezouce')::int as bezouce from public.palmares where annee = 2026`,
      );
      expect(pal.rows).toEqual([{ n: 10, confirmes: 9, bezouce: 1 }]);
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

  it('refuse de contourner les bornes de longueur avec des blancs', () =>
    dansUneTransaction(async (db) => {
      await commeVisiteur(db);
      expect(await doitEtreRefuse(db, DEPOSER, ['A'.repeat(61), 'a@b.fr', 'Message assez long'])).toBe('23514');
      expect(await doitEtreRefuse(db, DEPOSER, [' '.repeat(100000) + 'A', 'a@b.fr', 'Message assez long'])).toBe(
        '23514',
      );
      expect(
        await doitEtreRefuse(db, DEPOSER, ['A', 'a@b.fr', ' '.repeat(5000) + 'Message assez long']),
      ).toBe('23514');
      expect(await doitEtreRefuse(db, DEPOSER, ['A', 'a@b.fr', '\n'.repeat(10)])).toBe('23514');
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
