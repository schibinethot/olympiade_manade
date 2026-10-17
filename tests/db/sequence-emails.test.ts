import type pg from 'pg';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  NOM_BASE_TEST,
  commeSuperutilisateur,
  commeUtilisateur,
  commeVisiteur,
  connecter,
  dansUneTransaction,
  doitEtreRefuse,
  recreerBaseDeTest,
  supprimerBaseDeTest,
} from './aide';
import { IDS, modifier, semerSoiree } from './graine';

const MIGRATION = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'supabase/migrations/20261017160000_sequence_emails.sql',
);

// Copie de CONSENTEMENT_ANNONCES_TEXTE (serveur/gabarits-emails.mjs), figée dans la migration.
const CONSENTEMENT_ANNONCES_TEXTE =
  'J’accepte de recevoir par email l’annonce des prochaines dates de l’Olympiade des Manades.';
const TEXTE_ABONNEMENT = 'J’accepte de recevoir les actualités de l’Olympiade des Manades par email.';
const VERSION_ABONNEMENT = '2026-10-17';

const TABLES_ET_VUE = [
  'modeles_emails',
  'destinataires_emails',
  'rattachements_emails',
  'messages_inscrits',
  'envois_emails',
  'bilan_envois_emails',
];

const REGLAGES_ETAPES: Record<string, [number | null, string | null]> = {
  confirmation: [null, null],
  bienvenue: [null, null],
  j_moins_7: [-7, '10:00'],
  veille: [-1, '18:00'],
  jour_j: [0, '10:00'],
  lendemain: [1, '10:00'],
  prochaines_dates: [7, '10:00'],
  annonce: [-10, '10:00'],
  message: [null, null],
};

type Statut = 'previsionnelle' | 'confirmee' | 'annulee';

interface Destinataire {
  id: string;
  email: string;
  prenom: string | null;
  profil_id: string | null;
  abonne: boolean;
  abonnement_a_confirmer: boolean;
  annonces: boolean;
  annonces_le: Date | null;
  annonces_texte: string | null;
  annonces_version: string | null;
  confirme_le: Date | null;
  desinscrit_le: Date | null;
}

interface DateRpc {
  id: string;
  nom: string;
  ville: string;
  arenes: string | null;
  date_soiree: string;
  heure: string | null;
  statut: string;
  lien_billetterie: string | null;
  infos_pratiques: string | null;
  soiree: { slug: string; statut: string } | null;
  manades: string[];
  vainqueur: string | null;
}

interface DestinataireRpc {
  id: string;
  email: string;
  abonnement_a_confirmer: boolean;
  desinscrit: boolean;
  [cle: string]: unknown;
}

interface DonneesRpc {
  modeles: Record<string, unknown>[];
  dates: DateRpc[];
  prochaines: DateRpc[];
  destinataires: DestinataireRpc[];
  rattachements: { destinataire_id: string; calendrier_id: string; origine: string; cree_le: string }[];
  envois: Record<string, unknown>[];
}

async function commeService(db: pg.Client): Promise<void> {
  await commeSuperutilisateur(db);
  await db.query('set local role service_role');
}

/** Dépôt du formulaire de l'accueil, tel que le serveur le fait en service_role (adresse non vérifiée). */
async function abonner(db: pg.Client, email: string): Promise<void> {
  await commeService(db);
  await db.query(
    `insert into public.abonnements_actualites (email, consentement_texte, consentement_version, source)
     values ($1, $2, $3, 'accueil')`,
    [email, TEXTE_ABONNEMENT, VERSION_ABONNEMENT],
  );
  await commeSuperutilisateur(db);
}

/** Clic sur le lien de confirmation : action « confirmer » du serveur, un seul PATCH en service_role. */
async function cliquer(db: pg.Client, email: string): Promise<number> {
  await commeService(db);
  const { rowCount } = await db.query(
    `update public.destinataires_emails set abonnement_a_confirmer = false
     where email = $1 and abonnement_a_confirmer`,
    [email],
  );
  await commeSuperutilisateur(db);
  return rowCount ?? 0;
}

/** Action « desinscrire » du serveur (tâche 5) : désinscription puis retrait de l'abonnement. */
async function desinscrire(db: pg.Client, email: string): Promise<void> {
  await commeService(db);
  await db.query(
    `update public.destinataires_emails set desinscrit_le = now(), annonces = false where email = $1`,
    [email],
  );
  await db.query(`delete from public.abonnements_actualites where email = $1`, [email]);
  await commeSuperutilisateur(db);
}

async function appelerRpc(db: pg.Client, maintenant: string | null = null, reel = true): Promise<DonneesRpc> {
  await commeService(db);
  const { rows } = await db.query('select public.emails_a_traiter(coalesce($1::timestamptz, now()), $2) as r', [
    maintenant,
    reel,
  ]);
  await commeSuperutilisateur(db);
  return rows[0].r as DonneesRpc;
}

/** Semis des modèles par le serveur (tâche 5) : insertion sans écraser une ligne existante. */
async function semerModeles(db: pg.Client, cles: string[]): Promise<void> {
  await commeService(db);
  for (const cle of cles) {
    const [jours, heure] = REGLAGES_ETAPES[cle];
    await db.query(
      `insert into public.modeles_emails (cle, nom, actif, sujet, preheader, corps, encart, jours_decalage, heure_envoi)
       values ($1, $2, true, 'Sujet', 'Pré-en-tête', 'Bonjour {{prenom}},', $3, $4, $5)
       on conflict (cle) do nothing`,
      [cle, `Modèle ${cle}`, cle === 'bienvenue' ? 'Encart' : null, jours, heure],
    );
  }
  await commeSuperutilisateur(db);
}

/** Retire les dates de référence : chaque test pose les siennes. */
async function viderCalendrier(db: pg.Client): Promise<void> {
  await modifier(db, 'delete from public.calendrier');
}

/** Date à `decalage` jours du jour de Paris de la transaction (now()). */
async function ajouterDate(db: pg.Client, decalage: number, statut: Statut): Promise<string> {
  await commeSuperutilisateur(db);
  const { rows } = await db.query(
    `with j as (select (now() at time zone 'Europe/Paris')::date + $1::int as d)
     insert into public.calendrier (annee, nom, ville, arenes, date_soiree, heure, statut)
     select extract(year from j.d)::smallint, 'Rencontre des manades', 'Sommières', 'Arènes Gilles Arnaud',
            j.d, '21:30', $2::public.statut_date
     from j
     returning id`,
    [decalage, statut],
  );
  return rows[0].id;
}

/** Date à un jour fixe (tests de la RPC et du jour de soirée). */
async function ajouterDateFixe(
  db: pg.Client,
  jour: string,
  statut: Statut,
  ville = 'Sommières',
  soireeId: string | null = null,
): Promise<string> {
  await commeSuperutilisateur(db);
  const { rows } = await db.query(
    `insert into public.calendrier (annee, nom, ville, arenes, date_soiree, heure, statut, soiree_id)
     values (extract(year from $1::date)::smallint, 'Olympiades camarguaises', $3, 'Arènes', $1::date,
             '21:30', $2::public.statut_date, $4)
     returning id`,
    [jour, statut, ville, soireeId],
  );
  return rows[0].id;
}

/** Insertion directe en superutilisateur, pour poser un état précis. */
async function insererDestinataire(
  db: pg.Client,
  email: string,
  champs: {
    abonne?: boolean;
    aConfirmer?: boolean;
    annonces?: boolean;
    confirme_le?: string | null;
    inscrit_le?: string | null;
    desinscrit_le?: string | null;
  } = {},
): Promise<string> {
  await commeSuperutilisateur(db);
  const { rows } = await db.query(
    `insert into public.destinataires_emails
       (email, abonne, abonnement_a_confirmer, annonces, annonces_le, annonces_texte, annonces_version,
        confirme_le, inscrit_le, desinscrit_le)
     values ($1, $2::boolean, $8::boolean, $3::boolean,
             case when $3::boolean then now() end,
             case when $3::boolean then $7 end,
             case when $3::boolean then '2026-10-17' end,
             $4::timestamptz, coalesce($5::timestamptz, now()), $6::timestamptz)
     returning id`,
    [
      email,
      champs.abonne ?? champs.aConfirmer ?? false,
      champs.annonces ?? false,
      champs.confirme_le ?? null,
      champs.inscrit_le ?? null,
      champs.desinscrit_le ?? null,
      CONSENTEMENT_ANNONCES_TEXTE,
      champs.aConfirmer ?? false,
    ],
  );
  return rows[0].id;
}

async function insererEnvoi(
  db: pg.Client,
  destinataireId: string,
  etape: string,
  options: { calendrierId?: string | null; reel?: boolean; statut?: string; creeLe?: string | null } = {},
): Promise<void> {
  await commeSuperutilisateur(db);
  await db.query(
    `insert into public.envois_emails (destinataire_id, etape, calendrier_id, reel, statut, prevu_le, cree_le)
     values ($1, $2, $3, $4, $5, coalesce($6::timestamptz, now()), coalesce($6::timestamptz, now()))`,
    [
      destinataireId,
      etape,
      options.calendrierId ?? null,
      options.reel ?? true,
      options.statut ?? 'envoye',
      options.creeLe ?? null,
    ],
  );
}

async function creerCompte(
  db: pg.Client,
  id: string,
  email: string,
  confirmeLe: string | null,
  meta: Record<string, unknown>,
): Promise<void> {
  await commeSuperutilisateur(db);
  await db.query(
    `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ($1, $2, $3, $4)`,
    [id, email, confirmeLe, JSON.stringify(meta)],
  );
}

async function destinataires(db: pg.Client, email: string): Promise<Destinataire[]> {
  await commeSuperutilisateur(db);
  const { rows } = await db.query(
    `select id, email, prenom, profil_id, abonne, abonnement_a_confirmer, annonces, annonces_le, annonces_texte,
            annonces_version, confirme_le, desinscrit_le
     from public.destinataires_emails where email = $1`,
    [email],
  );
  return rows;
}

async function rattachementsDe(db: pg.Client, destinataireId: string): Promise<{ calendrier_id: string; origine: string }[]> {
  await commeSuperutilisateur(db);
  const { rows } = await db.query(
    `select calendrier_id, origine from public.rattachements_emails where destinataire_id = $1
     order by cree_le, calendrier_id`,
    [destinataireId],
  );
  return rows;
}

async function etapesEnvoyees(db: pg.Client, destinataireId: string): Promise<string[]> {
  await commeSuperutilisateur(db);
  const { rows } = await db.query(
    `select etape || case when reel then '' else ' (simulé)' end as etape
     from public.envois_emails where destinataire_id = $1 order by 1`,
    [destinataireId],
  );
  return rows.map((r: { etape: string }) => r.etape);
}

describe('séquence d’e-mails : droits', () => {
  it('anon et un authentifié non admin ne lisent rien, la RPC refuse anon et authenticated', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db); // Léa et Paul, spectateurs confirmés et consentants, deviennent destinataires
      await semerModeles(db, ['bienvenue', 'veille']);
      await viderCalendrier(db);
      const date = await ajouterDate(db, 10, 'confirmee'); // première date confirmée : Léa et Paul y sont rattachés
      const [lea] = await destinataires(db, 'lea@test.fr');
      await modifier(
        db,
        `insert into public.messages_inscrits (calendrier_id, sujet, corps, cree_par, destinataires)
         values ($1, 'Changement d’horaire', 'La soirée commence à 21 h.', $2, 2)`,
        [date, IDS.admin],
      );
      await insererEnvoi(db, lea.id, 'bienvenue');

      await commeSuperutilisateur(db);
      for (const table of TABLES_ET_VUE) {
        const { rows } = await db.query(`select count(*)::int as n from public.${table}`);
        expect(rows[0].n, table).toBeGreaterThan(0);
      }

      const rpc = 'select public.emails_a_traiter(now(), true)';
      await commeVisiteur(db);
      for (const table of TABLES_ET_VUE) {
        expect(await doitEtreRefuse(db, `select 1 from public.${table}`), table).toBe('42501');
      }
      expect(await doitEtreRefuse(db, rpc)).toBe('42501');

      await commeUtilisateur(db, IDS.spectateur);
      for (const table of TABLES_ET_VUE) {
        expect((await db.query(`select 1 from public.${table}`)).rows, table).toEqual([]);
      }
      expect((await db.query(`update public.modeles_emails set sujet = 'Piraté'`)).rowCount).toBe(0);
      expect(await doitEtreRefuse(db, rpc)).toBe('42501');

      await commeUtilisateur(db, IDS.admin, 'aal1');
      for (const table of TABLES_ET_VUE) {
        expect((await db.query(`select 1 from public.${table}`)).rows, table).toEqual([]);
      }
      expect((await db.query(`update public.modeles_emails set sujet = 'AAL1'`)).rowCount).toBe(0);

      await commeUtilisateur(db, IDS.admin, 'aal2');
      for (const table of TABLES_ET_VUE) {
        expect((await db.query(`select 1 from public.${table}`)).rows.length, table).toBeGreaterThan(0);
      }
      expect(await doitEtreRefuse(db, rpc)).toBe('42501');
    }));

  it('un admin AAL2 modifie les textes et réglages d’un modèle, sans insérer, supprimer ni changer la clé', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await semerModeles(db, ['confirmation', 'bienvenue', 'veille']);
      await commeUtilisateur(db, IDS.admin, 'aal2');
      const maj = await db.query(
        `update public.modeles_emails
           set sujet = 'C’est demain !', preheader = '', corps = 'À demain.', actif = false,
               jours_decalage = -2, heure_envoi = '21:00'
         where cle = 'veille'`,
      );
      expect(maj.rowCount).toBe(1);
      const { rows } = await db.query(
        `select sujet, actif, jours_decalage, heure_envoi, modifie_par from public.modeles_emails where cle = 'veille'`,
      );
      expect(rows).toEqual([
        { sujet: 'C’est demain !', actif: false, jours_decalage: -2, heure_envoi: '21:00:00', modifie_par: IDS.admin },
      ]);
      expect((await db.query(`update public.modeles_emails set encart = '' where cle = 'bienvenue'`)).rowCount).toBe(1);
      expect(
        (await db.query(`update public.modeles_emails set sujet = 'Confirmez' where cle = 'confirmation'`)).rowCount,
      ).toBe(1);

      expect(
        await doitEtreRefuse(
          db,
          `insert into public.modeles_emails (cle, nom, sujet, preheader, corps) values ('message', 'n', 's', '', 'c')`,
        ),
      ).toBe('42501');
      expect(await doitEtreRefuse(db, `delete from public.modeles_emails where cle = 'veille'`)).toBe('42501');
      expect(await doitEtreRefuse(db, `update public.modeles_emails set cle = 'jour_j' where cle = 'veille'`)).toBe('42501');
      expect(await doitEtreRefuse(db, `update public.modeles_emails set nom = 'Autre' where cle = 'veille'`)).toBe('42501');
      expect(
        await doitEtreRefuse(db, `update public.modeles_emails set modifie_par = $1 where cle = 'veille'`, [IDS.juge]),
      ).toBe('42501');
      expect(
        await doitEtreRefuse(db, `update public.modeles_emails set modifie_le = '2020-01-01' where cle = 'veille'`),
      ).toBe('42501');

      const horsBornes: [string, string][] = [
        ['veille', `sujet = ''`],
        ['veille', `sujet = repeat('x', 201)`],
        ['veille', `preheader = repeat('x', 201)`],
        ['veille', `corps = ' '`],
        ['veille', `corps = repeat('x', 8001)`],
        ['bienvenue', `encart = repeat('x', 4001)`],
        ['veille', `encart = 'Encart hors bienvenue'`],
        ['veille', 'jours_decalage = 31'],
        ['veille', 'jours_decalage = -31'],
        ['veille', 'jours_decalage = null'],
        ['veille', `heure_envoi = '06:59'`],
        ['veille', `heure_envoi = '21:01'`],
        // Le double opt-in ne se coupe pas.
        ['confirmation', 'actif = false'],
      ];
      for (const [cle, affectation] of horsBornes) {
        expect(
          await doitEtreRefuse(db, `update public.modeles_emails set ${affectation} where cle = $1`, [cle]),
          `${cle} : ${affectation}`,
        ).toBe('23514');
      }
    }));

  it('service_role a exactement les droits du planificateur, et l’admin aucun droit d’écriture hors modèles', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const tables = await db.query(
        `select t.nom as table, string_agg(p.droit, ', ' order by p.droit) as droits
         from (values ('abonnements_actualites'), ('bilan_envois_emails'), ('destinataires_emails'),
                      ('envois_emails'), ('messages_inscrits'), ('modeles_emails'), ('rattachements_emails')) as t (nom)
         cross join (values ('DELETE'), ('INSERT'), ('REFERENCES'), ('SELECT'), ('TRIGGER'), ('TRUNCATE'), ('UPDATE')) as p (droit)
         where has_table_privilege('service_role', 'public.' || t.nom, p.droit)
         group by t.nom order by 1`,
      );
      expect(tables.rows).toEqual([
        { table: 'abonnements_actualites', droits: 'DELETE' },
        { table: 'destinataires_emails', droits: 'DELETE, SELECT' },
        { table: 'envois_emails', droits: 'DELETE, INSERT, SELECT' },
        { table: 'messages_inscrits', droits: 'INSERT, SELECT' },
        { table: 'modeles_emails', droits: 'SELECT' },
        { table: 'rattachements_emails', droits: 'INSERT, SELECT' },
      ]);

      const colonnes = async (table: string, droit: string, role = 'service_role') =>
        (
          await db.query(
            `select a.attname as colonne from pg_attribute a
             where a.attrelid = ('public.' || $1)::regclass and a.attnum > 0 and not a.attisdropped
               and has_column_privilege($3, a.attrelid, a.attnum, $2)
             order by a.attname collate "C"`,
            [table, droit, role],
          )
        ).rows.map((r: { colonne: string }) => r.colonne);

      expect(await colonnes('destinataires_emails', 'UPDATE')).toEqual([
        'abonnement_a_confirmer',
        'annonces',
        'annonces_le',
        'annonces_texte',
        'annonces_version',
        'confirme_le',
        'desinscrit_le',
      ]);
      expect(await colonnes('destinataires_emails', 'INSERT')).toEqual([]);
      expect(await colonnes('envois_emails', 'UPDATE')).toEqual(['envoye_le', 'prevu_le', 'raison', 'statut', 'tentatives']);
      expect(await colonnes('modeles_emails', 'INSERT')).toEqual([
        'actif',
        'cle',
        'corps',
        'encart',
        'heure_envoi',
        'jours_decalage',
        'nom',
        'preheader',
        'sujet',
      ]);
      expect(await colonnes('modeles_emails', 'UPDATE')).toEqual([]);
      // La suppression par adresse (désinscription) doit pouvoir filtrer sur email.
      expect(await colonnes('abonnements_actualites', 'SELECT')).toEqual(['email']);
      expect(await colonnes('modeles_emails', 'UPDATE', 'authenticated')).toEqual([
        'actif',
        'corps',
        'encart',
        'heure_envoi',
        'jours_decalage',
        'preheader',
        'sujet',
      ]);
      for (const table of ['destinataires_emails', 'rattachements_emails', 'messages_inscrits', 'envois_emails']) {
        for (const droit of ['INSERT', 'UPDATE']) {
          expect(await colonnes(table, droit, 'authenticated'), `${table} ${droit}`).toEqual([]);
        }
      }
      const rpc = await db.query(
        `select r.role,
                has_function_privilege(r.role, 'public.emails_a_traiter(timestamptz, boolean)', 'execute') as execute
         from (values ('anon'), ('authenticated'), ('service_role')) as r (role) order by 1`,
      );
      expect(rpc.rows).toEqual([
        { role: 'anon', execute: false },
        { role: 'authenticated', execute: false },
        { role: 'service_role', execute: true },
      ]);
    }));
});

describe('séquence d’e-mails : abonnés aux actualités', () => {
  it('un dépôt ne change rien d’effectif ; le clic confirme, active les annonces et rattache à la prochaine date confirmée', () =>
    dansUneTransaction(async (db) => {
      await viderCalendrier(db);
      await ajouterDate(db, -2, 'confirmee');
      await ajouterDate(db, 3, 'previsionnelle');
      await ajouterDate(db, 5, 'annulee');
      const cible = await ajouterDate(db, 10, 'confirmee');
      await ajouterDate(db, 20, 'confirmee');

      await abonner(db, 'lea@exemple.fr');
      const [depot] = await destinataires(db, 'lea@exemple.fr');
      expect(depot).toMatchObject({
        prenom: null,
        profil_id: null,
        abonne: true,
        abonnement_a_confirmer: true,
        annonces: false,
        annonces_le: null,
        annonces_texte: null,
        annonces_version: null,
        confirme_le: null,
        desinscrit_le: null,
      });
      expect(await rattachementsDe(db, depot.id)).toEqual([]);

      expect(await cliquer(db, 'lea@exemple.fr')).toBe(1);
      const [lea] = await destinataires(db, 'lea@exemple.fr');
      expect(lea).toMatchObject({
        abonne: true,
        abonnement_a_confirmer: false,
        annonces: true,
        annonces_texte: TEXTE_ABONNEMENT,
        annonces_version: VERSION_ABONNEMENT,
        desinscrit_le: null,
      });
      expect(lea.confirme_le).not.toBeNull();
      expect(lea.annonces_le).not.toBeNull();
      expect(await rattachementsDe(db, lea.id)).toEqual([{ calendrier_id: cible, origine: 'inscription' }]);
      // Un second clic (lien rouvert) ne trouve plus rien à confirmer.
      expect(await cliquer(db, 'lea@exemple.fr')).toBe(0);

      // Une date plus proche confirmée ensuite, puis une nouvelle écriture de confirme_le : déjà confirmée,
      // l'adresse n'est pas rattachée une seconde fois.
      const plusProche = await ajouterDate(db, 4, 'confirmee');
      await commeService(db);
      await db.query(`update public.destinataires_emails set confirme_le = now() where email = $1`, ['lea@exemple.fr']);
      expect(await rattachementsDe(db, lea.id)).toEqual([{ calendrier_id: cible, origine: 'inscription' }]);
      expect(plusProche).not.toBe(cible);
    }));

  it('adresse désinscrite sans profil qui se réabonne : désinscrite jusqu’au clic, une nouvelle confirmation peut partir', () =>
    dansUneTransaction(async (db) => {
      await viderCalendrier(db);
      const date = await ajouterDate(db, 10, 'confirmee');
      await abonner(db, 'lea@exemple.fr');
      await cliquer(db, 'lea@exemple.fr');
      const [lea] = await destinataires(db, 'lea@exemple.fr');
      await insererEnvoi(db, lea.id, 'confirmation');
      await insererEnvoi(db, lea.id, 'confirmation', { reel: false, statut: 'simule' });
      await insererEnvoi(db, lea.id, 'bienvenue');
      await insererEnvoi(db, lea.id, 'j_moins_7', { calendrierId: date });

      await desinscrire(db, 'lea@exemple.fr');
      const [opposition] = await destinataires(db, 'lea@exemple.fr');
      expect(opposition).toMatchObject({ id: lea.id, abonne: false, abonnement_a_confirmer: false, annonces: false });
      expect(opposition.desinscrit_le).not.toBeNull();

      // Une date plus proche est confirmée pendant la désinscription : personne d'opposé n'y est rattaché.
      const plusProche = await ajouterDate(db, 4, 'confirmee');

      await abonner(db, 'lea@exemple.fr');
      const lignes = await destinataires(db, 'lea@exemple.fr');
      expect(lignes).toHaveLength(1);
      expect(lignes[0]).toMatchObject({
        id: lea.id,
        abonne: true,
        abonnement_a_confirmer: true,
        annonces: false,
        desinscrit_le: opposition.desinscrit_le,
        confirme_le: lea.confirme_le,
      });
      // Les anciennes confirmations sont supprimées ; la bienvenue ne part qu'une fois par adresse.
      expect(await etapesEnvoyees(db, lea.id)).toEqual(['bienvenue', 'j_moins_7']);
      await insererEnvoi(db, lea.id, 'confirmation');
      expect(await etapesEnvoyees(db, lea.id)).toEqual(['bienvenue', 'confirmation', 'j_moins_7']);

      // Avant le clic : présente pour sa seule confirmation, désinscrite, sans rattachement exposé.
      const avant = await appelerRpc(db);
      const elle = avant.destinataires.find((d) => d.id === lea.id);
      expect(elle).toMatchObject({ abonnement_a_confirmer: true, desinscrit: true });
      expect(avant.rattachements.filter((r) => r.destinataire_id === lea.id)).toEqual([]);

      // Le clic lève la désinscription ; sa date encore active est gardée, sans en ajouter une autre.
      expect(await cliquer(db, 'lea@exemple.fr')).toBe(1);
      const [apres] = await destinataires(db, 'lea@exemple.fr');
      expect(apres).toMatchObject({ abonnement_a_confirmer: false, annonces: true, desinscrit_le: null });
      expect(apres.confirme_le).toEqual(lea.confirme_le);
      expect(await rattachementsDe(db, lea.id)).toEqual([{ calendrier_id: date, origine: 'inscription' }]);
      expect(plusProche).not.toBe(date);
      const leve = await appelerRpc(db);
      expect(leve.destinataires.find((d) => d.id === lea.id)).toMatchObject({ desinscrit: false });
      expect(leve.rattachements.filter((r) => r.destinataire_id === lea.id).map((r) => r.calendrier_id)).toEqual([date]);
    }));

  it('scénario de la revue : un tiers réabonne un spectateur désinscrit, qui reste désinscrit jusqu’à son propre clic', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await viderCalendrier(db);
      await desinscrire(db, 'lea@test.fr');
      const date = await ajouterDate(db, 10, 'confirmee'); // Paul y est rattaché, pas Léa, désinscrite
      const [avant] = await destinataires(db, 'lea@test.fr');
      expect(await rattachementsDe(db, avant.id)).toEqual([]);

      await abonner(db, 'lea@test.fr'); // formulaire public, adresse non vérifiée
      const [depot] = await destinataires(db, 'lea@test.fr');
      expect(depot).toMatchObject({
        profil_id: IDS.spectateur,
        abonne: true,
        abonnement_a_confirmer: true,
        annonces: false,
        desinscrit_le: avant.desinscrit_le,
      });
      expect(depot.desinscrit_le).not.toBeNull();
      expect(await rattachementsDe(db, depot.id)).toEqual([]);

      const r = await appelerRpc(db);
      expect(r.destinataires.find((d) => d.id === depot.id)).toMatchObject({
        abonnement_a_confirmer: true,
        desinscrit: true,
      });
      expect(r.rattachements.filter((x) => x.destinataire_id === depot.id)).toEqual([]);
      expect(r.envois.filter((e) => e.destinataire_id === depot.id)).toEqual([]); // la confirmation est due

      // Le clic, depuis sa boîte, lève la désinscription et la rattache à la prochaine date.
      expect(await cliquer(db, 'lea@test.fr')).toBe(1);
      const [lea] = await destinataires(db, 'lea@test.fr');
      expect(lea).toMatchObject({ desinscrit_le: null, annonces: true, annonces_texte: TEXTE_ABONNEMENT });
      expect(lea.confirme_le).toEqual(avant.confirme_le);
      expect(await rattachementsDe(db, lea.id)).toEqual([{ calendrier_id: date, origine: 'inscription' }]);
    }));

  it('spectateur vérifié sans annonces puis dépôt : annonces seulement au clic, les rappels de sa date continuent', () =>
    dansUneTransaction(async (db) => {
      await viderCalendrier(db);
      const date = await ajouterDate(db, 10, 'confirmee');
      const confirmation = '2026-10-12T18:30:00.000Z';
      const id = '00000000-0000-4000-8000-0000000000c6';
      await creerCompte(db, id, 'lou@exemple.fr', confirmation, { prenom: 'Lou', consentement: true });
      const [spectateur] = await destinataires(db, 'lou@exemple.fr');
      expect(spectateur.annonces).toBe(false);

      await abonner(db, 'lou@exemple.fr');
      const lignes = await destinataires(db, 'lou@exemple.fr');
      expect(lignes).toHaveLength(1);
      expect(lignes[0]).toMatchObject({
        id: spectateur.id,
        prenom: 'Lou',
        profil_id: id,
        abonne: true,
        abonnement_a_confirmer: true,
        annonces: false,
      });
      expect(lignes[0].confirme_le?.toISOString()).toBe(confirmation);
      const r = await appelerRpc(db);
      expect(r.destinataires.find((d) => d.id === spectateur.id)).toMatchObject({ abonnement_a_confirmer: true });
      expect(r.rattachements.filter((x) => x.destinataire_id === spectateur.id).map((x) => x.calendrier_id)).toEqual([date]);

      expect(await cliquer(db, 'lou@exemple.fr')).toBe(1);
      const [lou] = await destinataires(db, 'lou@exemple.fr');
      expect(lou).toMatchObject({ annonces: true, annonces_texte: TEXTE_ABONNEMENT, abonnement_a_confirmer: false });
      expect(lou.confirme_le?.toISOString()).toBe(confirmation);
      expect(await rattachementsDe(db, lou.id)).toEqual([{ calendrier_id: date, origine: 'inscription' }]);
    }));

  it('l’admin efface un abonné : sans profil la ligne disparaît, un spectateur perd les annonces de l’abonnement, un clic tardif n’a plus d’effet', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await abonner(db, 'inconnu@exemple.fr');
      await abonner(db, 'lea@test.fr');
      await cliquer(db, 'lea@test.fr');
      await abonner(db, 'paul@test.fr'); // pas encore cliqué
      const [avant] = await destinataires(db, 'lea@test.fr');
      expect(avant).toMatchObject({ abonne: true, annonces: true, profil_id: IDS.spectateur });

      await commeUtilisateur(db, IDS.admin, 'aal2');
      expect(
        (
          await db.query(
            `delete from public.abonnements_actualites
             where email in ('inconnu@exemple.fr', 'lea@test.fr', 'paul@test.fr')`,
          )
        ).rowCount,
      ).toBe(3);

      expect(await destinataires(db, 'inconnu@exemple.fr')).toEqual([]);
      const [lea] = await destinataires(db, 'lea@test.fr');
      expect(lea).toMatchObject({ abonne: false, annonces: false, profil_id: IDS.spectateur, desinscrit_le: null });
      expect(lea.confirme_le).not.toBeNull();
      const [paul] = await destinataires(db, 'paul@test.fr');
      expect(paul).toMatchObject({ abonne: false, abonnement_a_confirmer: false, annonces: false });

      // Lien de confirmation reçu avant l'effacement : la demande a été annulée, rien ne change.
      expect(await cliquer(db, 'paul@test.fr')).toBe(0);
      await commeService(db);
      await db.query(`update public.destinataires_emails set abonnement_a_confirmer = false where email = 'paul@test.fr'`);
      expect((await destinataires(db, 'paul@test.fr'))[0]).toMatchObject({ annonces: false, annonces_texte: null });
    }));
});

describe('séquence d’e-mails : spectateurs', () => {
  it('un spectateur confirmé et consentant aux annonces entre, rattaché ; un juge sans consentement jamais', () =>
    dansUneTransaction(async (db) => {
      await viderCalendrier(db);
      const cible = await ajouterDate(db, 10, 'confirmee');
      const confirmation = '2026-10-12T18:30:00.000Z';
      const camille = '00000000-0000-4000-8000-0000000000c1';
      await creerCompte(db, camille, 'camille@exemple.fr', confirmation, {
        prenom: '\u0007 Camille\n',
        consentement: true,
        annonces: true,
      });
      const [ligne] = await destinataires(db, 'camille@exemple.fr');
      expect(ligne).toMatchObject({
        prenom: 'Camille',
        profil_id: camille,
        abonne: false,
        abonnement_a_confirmer: false,
        annonces: true,
        annonces_texte: CONSENTEMENT_ANNONCES_TEXTE,
        annonces_version: '2026-10-17',
        desinscrit_le: null,
      });
      expect(ligne.confirme_le?.toISOString()).toBe(confirmation);
      expect(ligne.annonces_le?.toISOString()).toBe(confirmation);
      expect(await rattachementsDe(db, ligne.id)).toEqual([{ calendrier_id: cible, origine: 'inscription' }]);

      // Caractères de contrôle au milieu du prénom : remplacés par une espace.
      await creerCompte(db, '00000000-0000-4000-8000-0000000000c2', 'paul@exemple.fr', confirmation, {
        prenom: 'Jean\u001bPaul\r\nBcc: x@y.fr',
        consentement: true,
      });
      expect((await destinataires(db, 'paul@exemple.fr'))[0]).toMatchObject({
        prenom: 'Jean Paul  Bcc: x@y.fr',
        annonces: false,
        annonces_le: null,
        annonces_texte: null,
        annonces_version: null,
      });
      expect(
        await doitEtreRefuse(
          db,
          `insert into public.destinataires_emails (email, prenom) values ('controle@exemple.fr', E'Zo\\u0007é')`,
        ),
      ).toBe('23514');

      // Juge créé par l'admin : pas de case de consentement.
      await creerCompte(db, '00000000-0000-4000-8000-0000000000c3', 'juge@exemple.fr', confirmation, { prenom: 'Juge' });
      expect(await destinataires(db, 'juge@exemple.fr')).toEqual([]);

      // Adresse inutilisable : le compte est créé, sans ligne de destinataire.
      await creerCompte(db, '00000000-0000-4000-8000-0000000000c4', 'Pas Une Adresse', confirmation, {
        consentement: true,
      });
      await commeSuperutilisateur(db);
      expect(
        (await db.query(`select count(*)::int as n from auth.users where id = '00000000-0000-4000-8000-0000000000c4'`)).rows[0].n,
      ).toBe(1);
      expect(
        (
          await db.query(
            `select count(*)::int as n from public.destinataires_emails where profil_id = '00000000-0000-4000-8000-0000000000c4'`,
          )
        ).rows[0].n,
      ).toBe(0);
    }));

  it('la confirmation de l’adresse inscrit le spectateur, et une confirmation rejouée ne réactive pas les annonces', () =>
    dansUneTransaction(async (db) => {
      await viderCalendrier(db);
      const id = '00000000-0000-4000-8000-0000000000c5';
      await creerCompte(db, id, 'zoe@exemple.fr', null, { prenom: 'Zoé', consentement: true, annonces: true });
      expect(await destinataires(db, 'zoe@exemple.fr')).toEqual([]);

      const confirmation = '2026-10-12T18:30:00.000Z';
      await modifier(db, 'update auth.users set email_confirmed_at = $1 where id = $2', [confirmation, id]);
      const [zoe] = await destinataires(db, 'zoe@exemple.fr');
      expect(zoe).toMatchObject({ prenom: 'Zoé', profil_id: id, annonces: true });
      expect(zoe.confirme_le?.toISOString()).toBe(confirmation);

      // « arreter_annonces » (tâche 5), puis Auth réécrit email_confirmed_at.
      await commeService(db);
      await db.query(`update public.destinataires_emails set annonces = false where id = $1`, [zoe.id]);
      await modifier(db, `update auth.users set email_confirmed_at = '2026-10-13T08:00:00Z' where id = $1`, [id]);
      const [apres] = await destinataires(db, 'zoe@exemple.fr');
      expect(apres.annonces).toBe(false);
      expect(apres.confirme_le?.toISOString()).toBe(confirmation);
    }));

  it('même adresse abonnée puis spectateur : une seule ligne, confirmée par le code et rattachée, abonnement toujours à confirmer', () =>
    dansUneTransaction(async (db) => {
      await viderCalendrier(db);
      const cible = await ajouterDate(db, 10, 'confirmee');
      await abonner(db, 'noe@exemple.fr');
      const [abonne] = await destinataires(db, 'noe@exemple.fr');
      expect(abonne.confirme_le).toBeNull();

      const confirmation = '2026-10-12T18:30:00.000Z';
      const id = '00000000-0000-4000-8000-0000000000c7';
      await creerCompte(db, id, 'noe@exemple.fr', confirmation, { prenom: 'Noé', consentement: true, annonces: true });
      const lignes = await destinataires(db, 'noe@exemple.fr');
      expect(lignes).toHaveLength(1);
      expect(lignes[0]).toMatchObject({
        id: abonne.id,
        prenom: 'Noé',
        profil_id: id,
        abonne: true,
        abonnement_a_confirmer: true,
        annonces: true,
        annonces_texte: CONSENTEMENT_ANNONCES_TEXTE,
      });
      expect(lignes[0].confirme_le?.toISOString()).toBe(confirmation);
      expect(await rattachementsDe(db, abonne.id)).toEqual([{ calendrier_id: cible, origine: 'inscription' }]);
    }));

  it('suppression d’un compte : ligne supprimée s’il n’est pas abonné, gardée sans profil ni prénom s’il l’est', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db);
      await abonner(db, 'paul@test.fr');
      expect(await destinataires(db, 'lea@test.fr')).toHaveLength(1);
      expect((await destinataires(db, 'paul@test.fr'))[0].prenom).toBe('Paul');

      await modifier(db, 'delete from auth.users where id in ($1, $2)', [IDS.spectateur, IDS.spectateur2]);
      expect(await destinataires(db, 'lea@test.fr')).toEqual([]);
      const [paul] = await destinataires(db, 'paul@test.fr');
      expect(paul).toMatchObject({ profil_id: null, prenom: null, abonne: true, abonnement_a_confirmer: true });
      expect(paul.confirme_le).not.toBeNull();
    }));
});

describe('séquence d’e-mails : dates et envois', () => {
  it('sans date confirmée, la première date qui passe à confirmée rattache les confirmés sans date active', () =>
    dansUneTransaction(async (db) => {
      await semerSoiree(db); // admin AAL2 pour la mise à jour du calendrier
      await viderCalendrier(db);
      const recente = await ajouterDate(db, -3, 'previsionnelle');
      const ancienne = await ajouterDate(db, -10, 'previsionnelle');
      const sansDate = await insererDestinataire(db, 'sans-date@exemple.fr', { confirme_le: '2026-10-01T10:00:00Z' });
      const active = await insererDestinataire(db, 'active@exemple.fr', { confirme_le: '2026-10-01T10:00:00Z' });
      const expiree = await insererDestinataire(db, 'expiree@exemple.fr', { confirme_le: '2026-10-01T10:00:00Z' });
      const nonConfirme = await insererDestinataire(db, 'attente@exemple.fr', { aConfirmer: true });
      const desinscrit = await insererDestinataire(db, 'stop@exemple.fr', {
        confirme_le: '2026-10-01T10:00:00Z',
        desinscrit_le: '2026-10-02T10:00:00Z',
      });
      await modifier(
        db,
        `insert into public.rattachements_emails (destinataire_id, calendrier_id, origine) values
           ($1, $2, 'inscription'), ($3, $4, 'inscription')`,
        [active, recente, expiree, ancienne],
      );
      for (const id of [sansDate, active, expiree, nonConfirme, desinscrit]) {
        expect((await rattachementsDe(db, id)).filter((r) => r.origine === 'premiere_confirmation'), id).toEqual([]);
      }

      const proche = await ajouterDate(db, 5, 'previsionnelle');
      const lointaine = await ajouterDate(db, 12, 'previsionnelle');
      // L'admin passe la date à confirmée depuis l'admin Vitrine (rôle authenticated, AAL2).
      await commeUtilisateur(db, IDS.admin, 'aal2');
      expect((await db.query(`update public.calendrier set statut = 'confirmee' where id = $1`, [proche])).rowCount).toBe(1);
      // Un confirmé resté sans date, puis une autre date confirmée qui n'est pas la prochaine : il n'y est pas rattaché.
      const tardif = await insererDestinataire(db, 'tardif@exemple.fr', { confirme_le: '2026-10-01T10:00:00Z' });
      expect(await rattachementsDe(db, tardif)).toEqual([{ calendrier_id: proche, origine: 'inscription' }]);
      await modifier(db, 'delete from public.rattachements_emails where destinataire_id = $1', [tardif]);
      await commeUtilisateur(db, IDS.admin, 'aal2');
      expect((await db.query(`update public.calendrier set statut = 'confirmee' where id = $1`, [lointaine])).rowCount).toBe(1);
      expect(await rattachementsDe(db, tardif)).toEqual([]);
      // Réenregistrer la prochaine date, déjà confirmée, ne rattache personne : elle ne « passe » pas à confirmée.
      expect(
        (await db.query(`update public.calendrier set statut = 'confirmee', heure = '22:00' where id = $1`, [proche]))
          .rowCount,
      ).toBe(1);
      expect(await rattachementsDe(db, tardif)).toEqual([]);

      const premieres = async (id: string) =>
        (await rattachementsDe(db, id)).filter((r) => r.origine === 'premiere_confirmation');
      expect(await premieres(sansDate)).toEqual([{ calendrier_id: proche, origine: 'premiere_confirmation' }]);
      expect(await premieres(expiree)).toEqual([{ calendrier_id: proche, origine: 'premiere_confirmation' }]);
      expect(await premieres(active)).toEqual([]);
      expect(await premieres(nonConfirme)).toEqual([]);
      expect(await premieres(desinscrit)).toEqual([]);
      const [lea] = await destinataires(db, 'lea@test.fr');
      expect(await premieres(lea.id)).toEqual([{ calendrier_id: proche, origine: 'premiere_confirmation' }]);

      // Une date insérée directement en confirmée, plus proche, devient la prochaine : seuls les confirmés
      // sans date active y sont rattachés.
      const plusProche = await ajouterDate(db, 2, 'confirmee');
      expect(await rattachementsDe(db, tardif)).toEqual([{ calendrier_id: plusProche, origine: 'premiere_confirmation' }]);
      expect(await premieres(sansDate)).toEqual([{ calendrier_id: proche, origine: 'premiere_confirmation' }]);

      // Un nouveau confirmé suit désormais la date la plus proche.
      const nouveau = await insererDestinataire(db, 'nouveau@exemple.fr');
      expect(await rattachementsDe(db, nouveau)).toEqual([]);
      await modifier(
        db,
        `update public.destinataires_emails set confirme_le = '2026-10-01T10:00:00Z' where id = $1`,
        [nouveau],
      );
      expect(await rattachementsDe(db, nouveau)).toEqual([{ calendrier_id: plusProche, origine: 'inscription' }]);
    }));

  it('une inscription après minuit, pendant la soirée, suit encore la date de la veille jusqu’à 06:00', () =>
    dansUneTransaction(async (db) => {
      await viderCalendrier(db);
      const veille = await ajouterDateFixe(db, '2027-07-31', 'confirmee');
      const suivante = await ajouterDateFixe(db, '2027-08-05', 'confirmee');
      await commeSuperutilisateur(db);
      const jours = await db.query(
        `select i as instant, prive.jour_des_soirees(i::timestamptz)::text as jour
         from unnest(array['2027-07-31T22:30:00Z', '2027-08-01T03:59:00Z', '2027-08-01T04:00:00Z',
                           '2027-12-01T04:59:00Z', '2027-12-01T05:00:00Z']) as i
         order by 1`,
      );
      expect(jours.rows.map((r: { jour: string }) => r.jour)).toEqual([
        '2027-07-31', // 01/08 à 00:30 (Paris, heure d'été)
        '2027-07-31', // 01/08 à 05:59
        '2027-08-01', // 01/08 à 06:00
        '2027-11-30', // 01/12 à 05:59 (heure d'hiver)
        '2027-12-01', // 01/12 à 06:00
      ]);

      const nuit = await insererDestinataire(db, 'nuit@exemple.fr');
      const matin = await insererDestinataire(db, 'matin@exemple.fr');
      await db.query(`select prive.rattacher_prochaine_date($1, 'inscription', '2027-07-31T22:30:00Z')`, [nuit]);
      await db.query(`select prive.rattacher_prochaine_date($1, 'inscription', '2027-08-01T04:30:00Z')`, [matin]);
      expect(await rattachementsDe(db, nuit)).toEqual([{ calendrier_id: veille, origine: 'inscription' }]);
      expect(await rattachementsDe(db, matin)).toEqual([{ calendrier_id: suivante, origine: 'inscription' }]);
    }));

  it('deux envois identiques avec calendrier_id et message_id nuls : le second est rejeté en 23505', () =>
    dansUneTransaction(async (db) => {
      const id = await insererDestinataire(db, 'lea@exemple.fr', { aConfirmer: true });
      await viderCalendrier(db);
      const date = await ajouterDate(db, 10, 'confirmee');
      await commeService(db);
      const reserver = `insert into public.envois_emails (destinataire_id, etape, calendrier_id, message_id, reel, statut, prevu_le)
                        values ($1, $2, $3, null, $4, 'en_attente', now())`;
      await db.query(reserver, [id, 'confirmation', null, true]);
      expect(await doitEtreRefuse(db, reserver, [id, 'confirmation', null, true])).toBe('23505');
      // Réservation du planificateur (PostgREST on_conflict + ignore-duplicates) : aucune erreur, aucune ligne.
      const ignore = await db.query(
        `insert into public.envois_emails (destinataire_id, etape, calendrier_id, message_id, reel, statut, prevu_le)
         values ($1, 'confirmation', null, null, true, 'en_attente', now())
         on conflict (destinataire_id, etape, calendrier_id, message_id, reel) do nothing returning id`,
        [id],
      );
      expect(ignore.rows).toEqual([]);
      // Mode log puis smtp : la simulation ne bloque pas l'envoi réel.
      await db.query(reserver, [id, 'confirmation', null, false]);
      await db.query(reserver, [id, 'j_moins_7', date, true]);
      expect(await doitEtreRefuse(db, reserver, [id, 'j_moins_7', date, true])).toBe('23505');
      // Une étape de date sans date, un message sans message, une confirmation ou une bienvenue avec une date :
      // refusés (la date contournerait l'unicité).
      expect(await doitEtreRefuse(db, reserver, [id, 'veille', null, true])).toBe('23514');
      expect(await doitEtreRefuse(db, reserver, [id, 'message', date, true])).toBe('23514');
      expect(await doitEtreRefuse(db, reserver, [id, 'confirmation', date, true])).toBe('23514');
      expect(await doitEtreRefuse(db, reserver, [id, 'bienvenue', date, true])).toBe('23514');
      expect(await doitEtreRefuse(db, reserver, [id, 'inconnue', null, true])).toBe('23514');

      await commeService(db);
      const maj = await db.query(
        `update public.envois_emails set statut = 'echec', tentatives = 3, raison = 'smtp_refuse', envoye_le = null
         where destinataire_id = $1 and etape = 'confirmation' and reel`,
        [id],
      );
      expect(maj.rowCount).toBe(1);
      expect(
        await doitEtreRefuse(db, `update public.envois_emails set etape = 'bienvenue' where destinataire_id = $1`, [id]),
      ).toBe('42501');
      expect(
        await doitEtreRefuse(db, `update public.envois_emails set statut = 'perdu' where destinataire_id = $1`, [id]),
      ).toBe('23514');

      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select etape, reel, statut, nombre from public.bilan_envois_emails order by etape, reel, statut`,
      );
      expect(rows).toEqual([
        { etape: 'confirmation', reel: false, statut: 'en_attente', nombre: 1 },
        { etape: 'confirmation', reel: true, statut: 'echec', nombre: 1 },
        { etape: 'j_moins_7', reel: true, statut: 'en_attente', nombre: 1 },
      ]);
    }));
});

describe('séquence d’e-mails : RPC emails_a_traiter', () => {
  it('à une date fixe, renvoie les dates de J-8 à J+17, les 6 prochaines dates et les seuls destinataires utiles', () =>
    dansUneTransaction(async (db) => {
      // 22/07/2027 à 10:00 heure de Paris.
      const maintenant = '2027-07-22T08:00:00.000Z';
      const ilYa = (h: number) => new Date(Date.parse(maintenant) - h * 3600_000).toISOString();

      await semerModeles(db, ['veille', 'bienvenue', 'confirmation']);
      await viderCalendrier(db);
      await commeSuperutilisateur(db);
      const soiree = (
        await db.query(
          `insert into public.soirees (slug, nom, date_soiree, vote_debut, vote_fin, statut)
           values ('marsillargues-2027', 'Marsillargues 2027', '2027-07-30',
                   '2027-07-30T19:00:00Z', '2027-07-30T23:00:00Z', 'publiee')
           returning id`,
        )
      ).rows[0].id;
      await db.query(
        `insert into public.soiree_manades (soiree_id, manade_id, ordre)
         select $1, m.id, case m.nom when 'Lafon' then 1 else 2 end
         from public.manades m where m.nom in ('Lafon', 'Vinuesa')`,
        [soiree],
      );
      await db.query(
        `insert into public.palmares (annee, evenement, ville, date_soiree, vainqueur, statut) values
           (2027, 'Olympiades camarguaises', 'Marsillargues', '2027-07-30', 'Lafon', 'confirme'),
           (2027, 'Olympiades camarguaises', 'Sommières', '2027-07-30', 'Gillet', 'confirme'),
           (2027, 'Olympiades camarguaises', 'Sommières', '2027-07-14', 'Agu', 'a_confirmer')`,
      );

      const avant = await ajouterDateFixe(db, '2027-07-13', 'confirmee'); // J-9 : hors fenêtre
      const debut = await ajouterDateFixe(db, '2027-07-14', 'confirmee'); // J-8
      const aujourdhui = await ajouterDateFixe(db, '2027-07-22', 'annulee');
      const proche = await ajouterDateFixe(db, '2027-07-30', 'confirmee', 'Marsillargues', soiree); // J+8
      const fin = await ajouterDateFixe(db, '2027-08-08', 'previsionnelle'); // J+17
      const apres = await ajouterDateFixe(db, '2027-08-09', 'confirmee'); // J+18 : hors fenêtre
      const septembre: string[] = [];
      for (const jour of ['2027-09-01', '2027-09-02', '2027-09-03', '2027-09-04', '2027-09-05']) {
        septembre.push(await ajouterDateFixe(db, jour, 'confirmee'));
      }
      await db.query(
        `update public.calendrier set infos_pratiques = 'Parking des arènes ouvert dès 19 h.',
                lien_billetterie = 'https://billetterie.exemple.fr'
         where id = $1`,
        [proche],
      );

      const rattache = await insererDestinataire(db, 'rattache@exemple.fr', { confirme_le: ilYa(24 * 60) });
      const horsFenetre = await insererDestinataire(db, 'hors@exemple.fr', { confirme_le: ilYa(24 * 60) });
      await insererDestinataire(db, 'recent@exemple.fr', { aConfirmer: true, inscrit_le: ilYa(24 * 29) });
      const abonneAncien = await insererDestinataire(db, 'ancien@exemple.fr', { aConfirmer: true, inscrit_le: ilYa(24 * 31) });
      const abonneEnAttente = await insererDestinataire(db, 'attente@exemple.fr', {
        aConfirmer: true,
        inscrit_le: ilYa(24 * 90),
      });
      const echecAncien = await insererDestinataire(db, 'echec-ancien@exemple.fr', {
        aConfirmer: true,
        inscrit_le: ilYa(24 * 40),
      });
      const echecRecent = await insererDestinataire(db, 'echec-recent@exemple.fr', {
        aConfirmer: true,
        inscrit_le: ilYa(24 * 40),
      });
      // Désinscrite, réabonnée par un dépôt : présente pour sa seule confirmation.
      const opposee = await insererDestinataire(db, 'opposee@exemple.fr', {
        aConfirmer: true,
        confirme_le: ilYa(24 * 60),
        inscrit_le: ilYa(24 * 90),
        desinscrit_le: ilYa(24 * 5),
      });
      await insererDestinataire(db, 'hier@exemple.fr', { confirme_le: ilYa(23) });
      await insererDestinataire(db, 'avant-hier@exemple.fr', { confirme_le: ilYa(25) });
      await insererDestinataire(db, 'annonces@exemple.fr', { annonces: true, confirme_le: ilYa(24 * 60) });
      const desinscrit = await insererDestinataire(db, 'stop@exemple.fr', {
        confirme_le: ilYa(24 * 60),
        desinscrit_le: ilYa(24 * 2),
      });

      // État exact des rattachements, sans ceux posés par les déclencheurs pendant la mise en place.
      await db.query('delete from public.rattachements_emails');
      await db.query(
        `insert into public.rattachements_emails (destinataire_id, calendrier_id, origine, cree_le) values
           ($1, $2, 'inscription', $5), ($3, $4, 'inscription', $5), ($6, $2, 'je_viens', $5), ($7, $2, 'inscription', $5)`,
        [rattache, debut, horsFenetre, avant, ilYa(24 * 20), desinscrit, opposee],
      );
      await insererEnvoi(db, rattache, 'j_moins_7', { calendrierId: debut, creeLe: ilYa(24 * 15) }); // date de la fenêtre
      await insererEnvoi(db, rattache, 'veille', { calendrierId: avant, creeLe: ilYa(24 * 20) }); // trop ancien
      await insererEnvoi(db, rattache, 'annonce', { calendrierId: avant, creeLe: ilYa(24 * 5) }); // moins de 10 jours
      await insererEnvoi(db, rattache, 'bienvenue', { creeLe: ilYa(24 * 60) }); // toujours renvoyé
      await insererEnvoi(db, abonneAncien, 'confirmation', { creeLe: ilYa(24 * 31) });
      await insererEnvoi(db, abonneEnAttente, 'confirmation', { reel: false, statut: 'simule', creeLe: ilYa(24 * 89) });
      await insererEnvoi(db, echecAncien, 'confirmation', { statut: 'echec', creeLe: ilYa(24 * 31) });
      await insererEnvoi(db, echecRecent, 'confirmation', { statut: 'echec', creeLe: ilYa(24 * 10) });
      await insererEnvoi(db, desinscrit, 'j_moins_7', { calendrierId: debut, creeLe: ilYa(24 * 15) });

      // Le résultat ne dépend pas du fuseau de la session.
      await commeService(db);
      await db.query(`set local timezone = 'Pacific/Kiritimati'`);
      const r = await appelerRpc(db, maintenant, true);

      expect(Object.keys(r).sort()).toEqual(['dates', 'destinataires', 'envois', 'modeles', 'prochaines', 'rattachements']);

      expect(r.modeles.map((m) => m.cle)).toEqual(['confirmation', 'bienvenue', 'veille']);
      expect(r.modeles[2]).toEqual({
        cle: 'veille',
        nom: 'Modèle veille',
        actif: true,
        sujet: 'Sujet',
        preheader: 'Pré-en-tête',
        corps: 'Bonjour {{prenom}},',
        encart: null,
        jours_decalage: -1,
        heure_envoi: '18:00:00',
      });

      expect(r.dates.map((d) => d.id)).toEqual([debut, aujourdhui, proche, fin]);
      expect(r.dates.map((d) => d.date_soiree)).toEqual(['2027-07-14', '2027-07-22', '2027-07-30', '2027-08-08']);
      expect(r.dates.find((d) => d.id === proche)).toEqual({
        id: proche,
        nom: 'Olympiades camarguaises',
        ville: 'Marsillargues',
        arenes: 'Arènes',
        date_soiree: '2027-07-30',
        heure: '21:30:00',
        statut: 'confirmee',
        lien_billetterie: 'https://billetterie.exemple.fr',
        infos_pratiques: 'Parking des arènes ouvert dès 19 h.',
        soiree: { slug: 'marsillargues-2027', statut: 'publiee' },
        manades: ['Lafon', 'Vinuesa'],
        vainqueur: 'Lafon',
      });
      expect(r.dates.find((d) => d.id === debut)).toMatchObject({ soiree: null, manades: [], vainqueur: null });

      expect(r.prochaines.map((d) => d.id)).toEqual([proche, apres, ...septembre.slice(0, 4)]);
      expect(r.prochaines[0]).toEqual(r.dates.find((d) => d.id === proche));

      expect(r.destinataires.map((d) => d.email).sort()).toEqual([
        'annonces@exemple.fr',
        'attente@exemple.fr',
        'echec-recent@exemple.fr',
        'hier@exemple.fr',
        'opposee@exemple.fr',
        'rattache@exemple.fr',
        'recent@exemple.fr',
      ]);
      expect(Object.keys(r.destinataires[0]).sort()).toEqual([
        'abonne',
        'abonnement_a_confirmer',
        'annonces',
        'confirme_le',
        'desinscrit',
        'email',
        'id',
        'inscrit_le',
        'prenom',
        'profil_id',
      ]);
      const parEmail = new Map(r.destinataires.map((d) => [d.email, d]));
      expect(parEmail.get('opposee@exemple.fr')).toMatchObject({ desinscrit: true, abonnement_a_confirmer: true });
      expect(parEmail.get('rattache@exemple.fr')).toMatchObject({ desinscrit: false, abonnement_a_confirmer: false });

      // Les rattachements d'une adresse désinscrite ne sont jamais renvoyés.
      expect(r.rattachements).toEqual([
        { destinataire_id: rattache, calendrier_id: debut, origine: 'inscription', cree_le: expect.any(String) },
      ]);
      expect(Date.parse(r.rattachements[0].cree_le)).toBe(Date.parse(ilYa(24 * 20)));

      const libelle = new Map(r.destinataires.map((d) => [d.id, d.email.replace('@exemple.fr', '')]));
      const envois = (donnees: DonneesRpc) =>
        donnees.envois.map((e) => `${e.etape}:${libelle.get(e.destinataire_id as string)}`).sort();
      expect(envois(r)).toEqual([
        'annonce:rattache',
        'bienvenue:rattache',
        'confirmation:echec-recent',
        'j_moins_7:rattache',
      ]);
      expect(Object.keys(r.envois[0]).sort()).toEqual([
        'calendrier_id',
        'cree_le',
        'destinataire_id',
        'envoye_le',
        'etape',
        'id',
        'message_id',
        'prevu_le',
        'raison',
        'reel',
        'statut',
        'tentatives',
      ]);
      // Mode log : seuls les envois simulés.
      expect(envois(await appelerRpc(db, maintenant, false))).toEqual(['confirmation:attente']);

      // Annonces : il faut une date confirmée à venir dans la fenêtre. Au 01/06/2027, la fenêtre ne contient
      // qu'une date confirmée déjà passée (28/05) et une date prévisionnelle à venir (10/06).
      const passee = await ajouterDateFixe(db, '2027-05-28', 'confirmee');
      await ajouterDateFixe(db, '2027-06-10', 'previsionnelle');
      await db.query('delete from public.rattachements_emails where calendrier_id = $1', [passee]);
      const juin = await appelerRpc(db, '2027-06-01T08:00:00.000Z', true);
      expect(juin.destinataires.map((d) => d.email)).not.toContain('annonces@exemple.fr');
      // La même date prévisionnelle confirmée (pas la prochaine : personne n'y est rattaché) suffit.
      await db.query(`update public.calendrier set statut = 'confirmee' where date_soiree = '2027-06-10'`);
      const juinConfirme = await appelerRpc(db, '2027-06-01T08:00:00.000Z', true);
      expect(juinConfirme.destinataires.map((d) => d.email)).toContain('annonces@exemple.fr');
    }));
});

describe('séquence d’e-mails : reprise des abonnés existants', () => {
  const base = NOM_BASE_TEST.replace(/_test$/, '_reprise_emails_test');
  beforeAll(() => recreerBaseDeTest(base, '20261017140000_consentement_cookies.sql'));
  afterAll(() => supprimerBaseDeTest(base));

  it('la migration reprend chaque abonné déjà inscrit, en attente de son clic de confirmation', async () => {
    const db = await connecter(base);
    try {
      await db.query(
        `insert into public.abonnements_actualites (email, consentement_le, consentement_texte, consentement_version, cree_le)
         values ('deja@exemple.fr', '2026-10-17T08:00:00Z', $1, $2, '2026-10-17T08:00:00Z')`,
        [TEXTE_ABONNEMENT, VERSION_ABONNEMENT],
      );
      await db.query(readFileSync(MIGRATION, 'utf8'));
      const { rows } = await db.query(
        `select email, abonne, abonnement_a_confirmer, annonces, annonces_le, annonces_texte, annonces_version,
                confirme_le, inscrit_le
         from public.destinataires_emails`,
      );
      expect(rows).toEqual([
        {
          email: 'deja@exemple.fr',
          abonne: true,
          abonnement_a_confirmer: true,
          annonces: false,
          annonces_le: null,
          annonces_texte: null,
          annonces_version: null,
          confirme_le: null,
          inscrit_le: new Date('2026-10-17T08:00:00Z'),
        },
      ]);
    } finally {
      await db.end();
    }
  });
});
