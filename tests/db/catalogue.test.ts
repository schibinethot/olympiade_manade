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

const SANS_RLS = `select c.relname as table from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity
  order by 1`;

describe('push interrompu après la migration de schéma', () => {
  // Chaque migration est appliquée dans sa propre transaction : si le push s'arrête
  // après la première, aucune table ne doit rester ouverte aux rôles de l'API.
  const base = NOM_BASE_TEST.replace(/_test$/, '_partielle_test');
  beforeAll(() => recreerBaseDeTest(base, '20261010120000_schema.sql'));
  afterAll(() => supprimerBaseDeTest(base));

  it('toutes les tables ont la RLS et anon comme authenticated n’ont aucun droit, même sur une table future', async () => {
    const db = await connecter(base);
    try {
      const tables = await db.query(
        `select count(*)::int as n from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`,
      );
      expect(tables.rows[0].n).toBe(10);
      expect((await db.query(SANS_RLS)).rows).toEqual([]);
      await db.query('create table public.table_future (x int)');
      const droits = await db.query(
        `select grantee, table_name, privilege_type from information_schema.role_table_grants
         where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
         order by 1, 2, 3`,
      );
      expect(droits.rows).toEqual([]);
    } finally {
      await db.end();
    }
  });
});

// Fonctions appelées par les politiques RLS : anon et authenticated doivent pouvoir les exécuter.
const FONCTIONS_DE_REGLES = [
  'appliquer_fenetre_automatique',
  'avis_ouvert',
  'email_verifie',
  'epreuve_visible',
  'est_admin',
  'passage_votable_jury',
  'passage_votable_public',
  'soiree_visible',
];

// Fonctions internes de prive (hors déclencheurs), appelées seulement par d'autres fonctions de prive.
const FONCTIONS_INTERNES = ['confirmation_permise', 'jour_des_soirees', 'ms', 'rattacher_prochaine_date'];

// Droits de table attendus pour les rôles de l'API, tels que les migrations RLS les accordent.
// Toute différence (droit en trop ou manquant) doit être une décision, donc une mise à jour ici.
const LECTURE = 'SELECT';
const VOTE = 'INSERT, SELECT, UPDATE';
const ADMIN = 'DELETE, INSERT, SELECT, UPDATE';
const DROITS_ATTENDUS = [
  { role: 'anon', table: 'calendrier', droits: LECTURE },
  { role: 'anon', table: 'contenus_vitrine', droits: LECTURE },
  { role: 'anon', table: 'epreuves', droits: LECTURE },
  { role: 'anon', table: 'etat_soiree', droits: LECTURE },
  { role: 'anon', table: 'identite_legale', droits: LECTURE },
  { role: 'anon', table: 'manades', droits: LECTURE },
  { role: 'anon', table: 'palmares', droits: LECTURE },
  { role: 'anon', table: 'parametres', droits: LECTURE },
  { role: 'anon', table: 'passages', droits: LECTURE },
  { role: 'anon', table: 'photos_vitrine', droits: LECTURE },
  { role: 'anon', table: 'soiree_manades', droits: LECTURE },
  { role: 'anon', table: 'soirees', droits: LECTURE },
  { role: 'authenticated', table: 'abonnements_actualites', droits: 'DELETE, SELECT' },
  { role: 'authenticated', table: 'abonnements_push', droits: ADMIN },
  { role: 'authenticated', table: 'avis_soiree', droits: VOTE },
  { role: 'authenticated', table: 'bilan_envois_emails', droits: LECTURE },
  { role: 'authenticated', table: 'calendrier', droits: ADMIN },
  { role: 'authenticated', table: 'consentements_cookies', droits: 'DELETE, SELECT' },
  { role: 'authenticated', table: 'contenus_vitrine', droits: ADMIN },
  { role: 'authenticated', table: 'destinataires_emails', droits: LECTURE },
  { role: 'authenticated', table: 'envois_emails', droits: LECTURE },
  { role: 'authenticated', table: 'epreuves', droits: ADMIN },
  { role: 'authenticated', table: 'etat_soiree', droits: LECTURE },
  { role: 'authenticated', table: 'file_notes', droits: LECTURE },
  { role: 'authenticated', table: 'identite_legale', droits: ADMIN },
  { role: 'authenticated', table: 'imports_planning', droits: ADMIN },
  { role: 'authenticated', table: 'manades', droits: ADMIN },
  { role: 'authenticated', table: 'messages_contact', droits: LECTURE },
  { role: 'authenticated', table: 'messages_inscrits', droits: LECTURE },
  { role: 'authenticated', table: 'modeles_emails', droits: LECTURE },
  { role: 'authenticated', table: 'notes_jury', droits: VOTE },
  { role: 'authenticated', table: 'notes_public', droits: VOTE },
  { role: 'authenticated', table: 'palmares', droits: ADMIN },
  { role: 'authenticated', table: 'parametres', droits: LECTURE },
  { role: 'authenticated', table: 'parametres_cookies', droits: LECTURE },
  { role: 'authenticated', table: 'passages', droits: ADMIN },
  { role: 'authenticated', table: 'photos_vitrine', droits: ADMIN },
  { role: 'authenticated', table: 'profils', droits: LECTURE },
  { role: 'authenticated', table: 'rattachements_emails', droits: LECTURE },
  { role: 'authenticated', table: 'soiree_juges', droits: ADMIN },
  { role: 'authenticated', table: 'soiree_manades', droits: ADMIN },
  { role: 'authenticated', table: 'soirees', droits: ADMIN },
];

describe('catalogue : tables et droits', () => {
  it('aucune table de public sans RLS', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      expect((await db.query(SANS_RLS)).rows).toEqual([]);
    }));

  it('anon et authenticated ont exactement les droits de table attendus, PUBLIC aucun', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select grantee as role, table_name as table, string_agg(privilege_type, ', ' order by privilege_type) as droits
         from information_schema.role_table_grants
         where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
         group by grantee, table_name
         order by 1, 2`,
      );
      expect(rows).toEqual(DROITS_ATTENDUS);
    }));

  it('les seuls droits de colonne concernent les updates administrés', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select c.relname as table, a.attname as colonne, coalesce(r.rolname, 'PUBLIC') as role,
                d.privilege_type as droit
         from pg_attribute a
         join pg_class c on c.oid = a.attrelid
         cross join lateral aclexplode(a.attacl) d
         left join pg_roles r on r.oid = d.grantee
         where c.relnamespace = 'public'::regnamespace and a.attacl is not null
           and (d.grantee = 0 or r.rolname in ('anon', 'authenticated'))
         order by 1, 2, 3, 4`,
      );
      const COLONNES_PARAMETRES_COOKIES = [
        'description',
        'duree_consentement_jours',
        'mesure_active',
        'mesure_description',
        'mesure_titre',
        'publicite_active',
        'publicite_description',
        'publicite_titre',
        'texte_enregistrer',
        'texte_personnaliser',
        'texte_refuser',
        'texte_tout_accepter',
        'titre',
        'url_confidentialite',
      ];
      const COLONNES_MODELES_EMAILS = [
        'actif',
        'corps',
        'encart',
        'heure_envoi',
        'jours_decalage',
        'preheader',
        'sujet',
      ];
      expect(rows).toEqual([
        { table: 'messages_contact', colonne: 'traite', role: 'authenticated', droit: 'UPDATE' },
        ...COLONNES_MODELES_EMAILS.map((colonne) => ({
          table: 'modeles_emails',
          colonne,
          role: 'authenticated',
          droit: 'UPDATE',
        })),
        { table: 'parametres', colonne: 'app_ouverte_au_public', role: 'authenticated', droit: 'UPDATE' },
        ...COLONNES_PARAMETRES_COOKIES.map((colonne) => ({
          table: 'parametres_cookies',
          colonne,
          role: 'authenticated',
          droit: 'UPDATE',
        })),
        { table: 'profils', colonne: 'prenom', role: 'authenticated', droit: 'UPDATE' },
      ]);
    }));

  it('anon et authenticated n’ont aucun INSERT de colonne sur messages_contact', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select rolname as role,
                has_column_privilege(rolname, 'public.messages_contact', 'prenom', 'INSERT') as prenom,
                has_column_privilege(rolname, 'public.messages_contact', 'email', 'INSERT') as email,
                has_column_privilege(rolname, 'public.messages_contact', 'message', 'INSERT') as message
           from pg_roles where rolname in ('anon', 'authenticated') order by rolname`,
      );
      expect(rows).toEqual([
        { role: 'anon', prenom: false, email: false, message: false },
        { role: 'authenticated', prenom: false, email: false, message: false },
      ]);
    }));

  it('service_role lit et écrit les tables de la vitrine', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select t.table_name as table, string_agg(p.droit, ', ' order by p.droit) as droits
         from (values ('calendrier'), ('messages_contact'), ('palmares')) as t (table_name)
         cross join (values ('DELETE'), ('INSERT'), ('SELECT'), ('UPDATE')) as p (droit)
         where has_table_privilege('service_role', 'public.' || t.table_name, p.droit)
         group by t.table_name order by 1`,
      );
      expect(rows).toEqual(
        ['calendrier', 'messages_contact', 'palmares'].map((table) => ({ table, droits: ADMIN })),
      );
    }));

  it('ni anon ni authenticated n’ont TRUNCATE, REFERENCES ou TRIGGER', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select grantee, table_schema, table_name, privilege_type from information_schema.role_table_grants
         where grantee in ('anon', 'authenticated', 'PUBLIC') and table_schema in ('public', 'prive')
           and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
         order by 1, 2, 3, 4`,
      );
      expect(rows).toEqual([]);
    }));
});

describe('catalogue : index', () => {
  it('les notes et les avis sont indexés par votant et par juge (suppression de compte)', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select c.relname as table, a.attname as colonne
         from pg_index i
         join pg_class c on c.oid = i.indrelid
         join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
         where c.relnamespace = 'public'::regnamespace
           and (c.relname, a.attname) in (('notes_public', 'votant_id'), ('notes_jury', 'juge_id'),
                                          ('avis_soiree', 'votant_id'))
         order by 1, 2`,
      );
      expect(rows).toEqual([
        { table: 'avis_soiree', colonne: 'votant_id' },
        { table: 'notes_jury', colonne: 'juge_id' },
        { table: 'notes_public', colonne: 'votant_id' },
      ]);
    }));
});

describe('catalogue : schéma prive', () => {
  // Politiques et déclencheurs référencent les fonctions par identifiant interne : l'usage du schéma
  // n'est vérifié qu'à la résolution des noms, jamais à l'exécution. Seul service_role le garde.
  it('anon et authenticated n’ont pas l’usage du schéma prive, service_role si', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select r.role, has_schema_privilege(r.role, 'prive', 'usage') as usage
         from (values ('anon'), ('authenticated'), ('service_role')) as r (role)
         order by 1`,
      );
      expect(rows).toEqual([
        { role: 'anon', usage: false },
        { role: 'authenticated', usage: false },
        { role: 'service_role', usage: true },
      ]);
    }));

  it('un appel direct à une fonction de prive par son nom est refusé à anon et à authenticated', () =>
    dansUneTransaction(async (db) => {
      await commeVisiteur(db);
      expect(await doitEtreRefuse(db, 'select prive.est_admin()')).toBe('42501');
      await commeUtilisateur(db, '00000000-0000-4000-8000-000000000001');
      expect(await doitEtreRefuse(db, 'select prive.est_admin()')).toBe('42501');
    }));
});

describe('catalogue : fonctions', () => {
  it('seules les RPC de supervision et de file prévues vivent dans le schéma public exposé par la Data API', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select p.oid::regprocedure::text as fonction from pg_proc p
         where p.pronamespace = 'public'::regnamespace order by 1`,
      );
      expect(rows).toEqual([
        { fonction: 'emails_a_traiter(timestamp with time zone,boolean)' },
        { fonction: 'enregistrer_choix_notifications(text)' },
        {
          fonction:
            'enregistrer_metrique_serveur(timestamp with time zone,text,integer,integer,bigint,integer,bigint,numeric,integer,integer,integer[])',
        },
        { fonction: 'enregistrer_presence()' },
        { fonction: 'lire_participants()' },
        { fonction: 'lire_statistiques_file_notes()' },
        { fonction: 'lire_statuts_file_notes(uuid[])' },
        { fonction: 'lire_supervision(integer)' },
        { fonction: 'mettre_note_en_file(uuid,uuid,smallint)' },
        { fonction: 'nettoyer_metriques_serveur()' },
        { fonction: 'purger_demandes_non_confirmees(timestamp with time zone,integer)' },
        { fonction: 'purger_spectateurs_inactifs()' },
        { fonction: 'renvoyer_confirmation_email(text,timestamp with time zone)' },
        { fonction: 'retirer_abonnement_destinataire(uuid)' },
        { fonction: 'traiter_file_notes(integer,text)' },
      ]);
    }));

  it('toute fonction security definer de prive porte un search_path', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select p.proname as fonction from pg_proc p
         where p.pronamespace = 'prive'::regnamespace and p.prosecdef
           and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')
         order by 1`,
      );
      expect(rows).toEqual([]);
    }));

  it('toute fonction de prive fixe un search_path vide', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select p.proname as fonction from pg_proc p
         where p.pronamespace = 'prive'::regnamespace
           and not coalesce('search_path=""' = any (p.proconfig), false)
         order by 1`,
      );
      expect(rows).toEqual([]);
    }));

  it('les fonctions déclencheurs de prive ne sont exécutables ni par anon ni par authenticated', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select p.proname as fonction, r.role from pg_proc p
         cross join (values ('anon'), ('authenticated')) as r (role)
         where p.pronamespace = 'prive'::regnamespace and p.prorettype = 'trigger'::regtype
           and has_function_privilege(r.role, p.oid, 'execute')
         order by 1, 2`,
      );
      expect(rows).toEqual([]);
    }));

  it('seules les fonctions de règles de prive sont exécutables par anon et authenticated', () =>
    dansUneTransaction(async (db) => {
      await commeSuperutilisateur(db);
      const { rows } = await db.query(
        `select p.proname as fonction,
                has_function_privilege('anon', p.oid, 'execute') as anon,
                has_function_privilege('authenticated', p.oid, 'execute') as authenticated
         from pg_proc p
         where p.pronamespace = 'prive'::regnamespace and p.prorettype <> 'trigger'::regtype
         order by 1`,
      );
      expect(rows).toEqual(
        [
          ...FONCTIONS_DE_REGLES.map((fonction) => ({ fonction, anon: true, authenticated: true })),
          ...FONCTIONS_INTERNES.map((fonction) => ({ fonction, anon: false, authenticated: false })),
        ].sort((a, b) => (a.fonction < b.fonction ? -1 : 1)),
      );
    }));
});
