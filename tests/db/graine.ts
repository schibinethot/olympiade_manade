import type pg from 'pg';
import { commeSuperutilisateur } from './aide';

export const IDS = {
  admin: '00000000-0000-4000-8000-00000000000a',
  juge: '00000000-0000-4000-8000-00000000000b',
  jugeNonRattache: '00000000-0000-4000-8000-00000000000c',
  spectateur: '00000000-0000-4000-8000-00000000000d',
  spectateur2: '00000000-0000-4000-8000-00000000000e',
  nonVerifie: '00000000-0000-4000-8000-00000000000f',
  manadeA: '10000000-0000-4000-8000-00000000000a',
  manadeB: '10000000-0000-4000-8000-00000000000b',
  manadeHors: '10000000-0000-4000-8000-00000000000c',
  soiree: '20000000-0000-4000-8000-00000000000a',
  epreuve: '30000000-0000-4000-8000-00000000000a',
  demonstration: '30000000-0000-4000-8000-00000000000b',
  passageA: '40000000-0000-4000-8000-00000000000a',
  passageB: '40000000-0000-4000-8000-00000000000b',
  passageDemo: '40000000-0000-4000-8000-00000000000c',
} as const;

/**
 * Soirée « en cours » en mode déblocage, fenêtre de vote de maintenant - 1 h à maintenant + 2 h.
 * Manades A et B engagées, manade « Hors » non engagée.
 * Une épreuve notée (passages A et B, statut a_venir) et une démonstration (passage A).
 * Le juge est rattaché à la soirée, le juge non rattaché ne l'est pas.
 * Le compte « nonVerifie » n'a pas validé son email.
 */
export async function semerSoiree(db: pg.Client): Promise<void> {
  await commeSuperutilisateur(db);
  await db.query(`
    insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
      ('${IDS.admin}', 'admin@test.fr', now(), '{"prenom": "Admin"}'),
      ('${IDS.juge}', 'juge@test.fr', now(), '{"prenom": "Juge"}'),
      ('${IDS.jugeNonRattache}', 'juge2@test.fr', now(), '{"prenom": "Juge2"}'),
      ('${IDS.spectateur}', 'lea@test.fr', now(), '{"prenom": "Léa", "consentement": true}'),
      ('${IDS.spectateur2}', 'paul@test.fr', now(), '{"prenom": "Paul", "consentement": true}'),
      ('${IDS.nonVerifie}', 'zoe@test.fr', null, '{"prenom": "Zoé", "consentement": true}');
    update public.profils set role = 'admin' where id = '${IDS.admin}';
    update public.profils set role = 'juge' where id in ('${IDS.juge}', '${IDS.jugeNonRattache}');
    insert into public.manades (id, nom) values
      ('${IDS.manadeA}', 'Vinuesa'), ('${IDS.manadeB}', 'Lafon'), ('${IDS.manadeHors}', 'Gillet');
    insert into public.soirees (id, slug, nom, date_soiree, vote_debut, vote_fin, mode_vote, statut) values
      ('${IDS.soiree}', 'test-2027', 'Soirée test', current_date,
       now() - interval '1 hour', now() + interval '2 hours', 'deblocage', 'en_cours');
    insert into public.soiree_manades (soiree_id, manade_id, ordre) values
      ('${IDS.soiree}', '${IDS.manadeA}', 1), ('${IDS.soiree}', '${IDS.manadeB}', 2);
    insert into public.soiree_juges (soiree_id, juge_id) values ('${IDS.soiree}', '${IDS.juge}');
    insert into public.epreuves (id, soiree_id, ordre, nom, notee) values
      ('${IDS.epreuve}', '${IDS.soiree}', 1, 'Ferrade en piste', true),
      ('${IDS.demonstration}', '${IDS.soiree}', 2, 'Bandido', false);
    insert into public.passages (id, epreuve_id, manade_id, ordre) values
      ('${IDS.passageA}', '${IDS.epreuve}', '${IDS.manadeA}', 1),
      ('${IDS.passageB}', '${IDS.epreuve}', '${IDS.manadeB}', 2),
      ('${IDS.passageDemo}', '${IDS.demonstration}', '${IDS.manadeA}', 1);
  `);
}

/** Exécute une requête de mise en place en superutilisateur (RLS contournée). */
export async function modifier(db: pg.Client, sql: string, params: unknown[] = []): Promise<void> {
  await commeSuperutilisateur(db);
  await db.query(sql, params);
}
