import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { commeSuperutilisateur, dansUneTransaction } from './aide';
import { modifier } from './graine';
import { calculerEnvois, dateDeBienvenue, lireEmailsATraiter } from '../../serveur/echeances-emails.mjs';
import { lignesModelesParDefaut, lignesReservees } from '../../serveur/planificateur-emails.mjs';

// Couture SQL ↔ JS (revue QA) : les vrais déclencheurs et la vraie RPC nourrissent calculerEnvois, et ses envois
// prévus sont réservés dans la vraie table (contraintes, unicité NULLS NOT DISTINCT, plafond des confirmations,
// droits service_role), avec la même forme de ligne que le planificateur (lignesReservees).

const TEXTE = 'J’accepte de recevoir les actualités de l’Olympiade des Manades par email.';

async function commeService(db: pg.Client) {
  await commeSuperutilisateur(db);
  await db.query('set local role service_role');
}

/**
 * Un passage du planificateur sans transport : RPC, décodage, calcul, réservation, puis « simule » (ou « envoye »).
 * `instant` : l'heure du passage (par défaut, celle de la transaction).
 */
async function passer(db: pg.Client, reel = false, instant?: string) {
  await commeService(db);
  const { rows: [{ maintenant }] } = await db.query('select coalesce($1::timestamptz, now()) as maintenant', [instant ?? null]);
  const { rows: [{ r }] } = await db.query('select public.emails_a_traiter($1, $2) as r', [maintenant, reel]);
  const donnees = lireEmailsATraiter(r);
  const calcul = calculerEnvois(donnees, new Date(maintenant));
  const aReserver = [
    ...calcul.aEnvoyer.flatMap((e) => lignesReservees(e, 'en_attente', reel)),
    ...calcul.sautes.flatMap((e) => lignesReservees(e, 'saute', reel)),
  ];
  const { rows: reservees } = await db.query(
    `insert into public.envois_emails (destinataire_id, etape, calendrier_id, message_id, reel, statut, raison, prevu_le)
     select destinataire_id, etape, calendrier_id, message_id, reel, statut, raison, prevu_le
     from jsonb_to_recordset($1::jsonb) as x (destinataire_id uuid, etape text, calendrier_id uuid, message_id uuid,
       reel boolean, statut text, raison text, prevu_le timestamptz)
     on conflict (destinataire_id, etape, calendrier_id, message_id, reel) do nothing
     returning etape, statut`,
    [JSON.stringify(aReserver)],
  );
  await db.query(
    `update public.envois_emails set statut = case when reel then 'envoye' else 'simule' end, envoye_le = $2
     where statut = 'en_attente' and reel = $1`,
    [reel, maintenant],
  );
  await commeSuperutilisateur(db);
  return { donnees, calcul, reservees: reservees.map((l: { etape: string; statut: string }) => `${l.etape}:${l.statut}`).sort() };
}

async function semerModeles(db: pg.Client) {
  await commeService(db);
  for (const m of lignesModelesParDefaut()) {
    await db.query(
      `insert into public.modeles_emails (cle, nom, actif, sujet, preheader, corps, encart, jours_decalage, heure_envoi)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict (cle) do nothing`,
      [m.cle, m.nom, m.actif, m.sujet, m.preheader, m.corps, m.encart, m.jours_decalage, m.heure_envoi],
    );
  }
  await commeSuperutilisateur(db);
}

async function deposer(db: pg.Client, email: string) {
  await commeService(db);
  await db.query(
    `insert into public.abonnements_actualites (email, consentement_texte, consentement_version, source)
     values ($1, $2, '2026-10-17', 'accueil')`,
    [email, TEXTE],
  );
}

describe('couture SQL ↔ calculerEnvois', () => {
  it('dépôt → confirmation simulée → clic → bienvenue avec encart → rien de plus ; réabonnement après désinscription → nouvelle confirmation', () =>
    dansUneTransaction(async (db) => {
      await modifier(db, 'delete from public.calendrier');
      await commeSuperutilisateur(db);
      const { rows: [{ id: date }] } = await db.query(
        `insert into public.calendrier (annee, nom, ville, arenes, date_soiree, heure, statut)
         select extract(year from j)::smallint, 'Rencontre des manades', 'Sommières', 'Arènes', j, '21:30', 'confirmee'
         from (select (now() at time zone 'Europe/Paris')::date + 5 as j) s returning id`,
      );
      await commeService(db);
      for (const m of lignesModelesParDefaut()) {
        await db.query(
          `insert into public.modeles_emails (cle, nom, actif, sujet, preheader, corps, encart, jours_decalage, heure_envoi)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9) on conflict (cle) do nothing`,
          [m.cle, m.nom, m.actif, m.sujet, m.preheader, m.corps, m.encart, m.jours_decalage, m.heure_envoi],
        );
      }
      await db.query(`delete from public.destinataires_emails`);
      await deposer(db, 'lea@exemple.fr');

      // 1. Dépôt : seule la confirmation, réservée une fois.
      expect((await passer(db)).reservees).toEqual(['confirmation:en_attente']);
      expect((await passer(db)).reservees).toEqual([]);

      // 2. Clic (action « confirmer ») : le déclencheur rattache à la date, la bienvenue part avec l'encart.
      await commeService(db);
      await db.query(`update public.destinataires_emails set abonnement_confirme_le = now()
                      where email = 'lea@exemple.fr' and abonnement_a_confirmer`);
      const apresClic = await passer(db);
      const bienvenue = apresClic.calcul.aEnvoyer.find((e) => e.etape === 'bienvenue');
      expect(bienvenue?.encartDateProche).toBe(true);
      const [lea] = apresClic.donnees.destinataires;
      expect(dateDeBienvenue(apresClic.donnees, lea).date?.id).toBe(date);
      // Le J-7 était déjà passé au clic (rattachement de moins de 48 h) : sauté, enregistré sans erreur de contrainte.
      expect(apresClic.reservees).toEqual(['bienvenue:en_attente', 'j_moins_7:saute']);
      expect((await passer(db)).reservees).toEqual([]);

      // 3. Désinscription (ordre du serveur : PATCH puis RPC de retrait) puis nouveau dépôt : une nouvelle
      //    confirmation simulée (le plafond ne vaut que pour les envois réels), rien d'autre.
      await commeService(db);
      const { rows: [{ id }] } = await db.query(
        `update public.destinataires_emails set desinscrit_le = now(), annonces = false where email = 'lea@exemple.fr' returning id`,
      );
      await db.query('select public.retirer_abonnement_destinataire($1)', [id]);
      await deposer(db, 'lea@exemple.fr');
      expect((await passer(db)).reservees).toEqual(['confirmation:en_attente']);

      // 4. Passage en smtp : la confirmation réelle part une fois, la simulée ne la bloque pas.
      expect((await passer(db, true)).reservees).toEqual(['confirmation:en_attente']);
      // 5. Désinscrite : plus de demande réelle ce mois-ci (C6), même après un nouveau dépôt.
      await commeService(db);
      await db.query('select public.retirer_abonnement_destinataire($1)', [id]);
      await deposer(db, 'lea@exemple.fr');
      expect((await passer(db, true)).reservees).toEqual([]);
    }));

  it('date reportée de 2 semaines : le J-7 sauté se réserve pour la nouvelle date, aucun plafond pris par un fantôme (QA B1)', () =>
    dansUneTransaction(async (db) => {
      await modifier(db, 'delete from public.calendrier');
      await semerModeles(db);
      await commeSuperutilisateur(db);
      await db.query('delete from public.destinataires_emails');
      // Léa s'inscrit à J-3 de la date A (30/07) ; Bruno suit A depuis juin (son J-7 est parti le 23/07) et la date B
      // (05/08), dont le lendemain tombe le 06/08 à 10:00, comme le nouveau J-7 de A une fois reportée au 13/08.
      const { rows: personnes } = await db.query(
        `insert into public.destinataires_emails (email, confirme_le) values
           ('lea@exemple.fr', '2027-06-01T10:00:00Z'), ('bruno@exemple.fr', '2027-06-01T10:00:00Z')
         returning id, email`,
      );
      const id = (email: string) => personnes.find((p: { email: string }) => p.email === email).id as string;
      const { rows: dates } = await db.query(
        `insert into public.calendrier (annee, nom, ville, date_soiree, heure, statut) values
           (2027, 'Rencontre A', 'Sommières', '2027-07-30', '21:30', 'confirmee'),
           (2027, 'Rencontre B', 'Lunel', '2027-08-05', '21:30', 'confirmee')
         returning id, nom`,
      );
      const [a, b] = ['Rencontre A', 'Rencontre B'].map((nom) => dates.find((d: { nom: string }) => d.nom === nom).id as string);
      await db.query('delete from public.rattachements_emails');
      await db.query(
        `insert into public.rattachements_emails (destinataire_id, calendrier_id, origine, cree_le) values
           ($1, $3, 'inscription', '2027-07-27T08:00:00Z'), ($2, $3, 'inscription', '2027-06-01T10:00:00Z'),
           ($2, $4, 'je_viens', '2027-06-01T10:00:00Z')`,
        [id('lea@exemple.fr'), id('bruno@exemple.fr'), a, b],
      );
      await db.query(
        `insert into public.envois_emails (destinataire_id, etape, calendrier_id, reel, statut, prevu_le, envoye_le) values
           ($1, 'bienvenue', null, true, 'envoye', '2027-06-01T10:05:00Z', '2027-06-01T10:05:00Z'),
           ($1, 'j_moins_7', $2, true, 'envoye', '2027-07-23T08:00:00Z', '2027-07-23T08:00:00Z'),
           ($1, 'j_moins_7', $3, true, 'envoye', '2027-07-29T08:00:00Z', '2027-07-29T08:00:00Z'),
           ($1, 'veille', $3, true, 'envoye', '2027-08-04T16:00:00Z', '2027-08-04T16:00:00Z'),
           ($1, 'jour_j', $3, true, 'envoye', '2027-08-05T08:00:00Z', '2027-08-05T08:00:00Z'),
           ($4, 'bienvenue', null, true, 'envoye', '2027-06-01T10:05:00Z', '2027-06-01T10:05:00Z')`,
        [id('bruno@exemple.fr'), a, b, id('lea@exemple.fr')],
      );

      // 1. Le 27/07 à 10:05 (Paris), juste après l'inscription : le J-7 de A, déjà passé, est enregistré sauté.
      expect((await passer(db, true, '2027-07-27T08:05:00Z')).reservees).toEqual(['j_moins_7:saute']);

      // 2. A est reportée au 13/08 : le saut de Léa est effacé, le J-7 parti de Bruno reste (pas de second envoi).
      await db.query(`update public.calendrier set date_soiree = '2027-08-13' where id = $1`, [a]);
      const { rows: restantes } = await db.query(
        `select d.email, e.etape, e.statut from public.envois_emails e join public.destinataires_emails d on d.id = e.destinataire_id
         where e.calendrier_id = $1 order by 1, 2`,
        [a],
      );
      expect(restantes).toEqual([{ email: 'bruno@exemple.fr', etape: 'j_moins_7', statut: 'envoye' }]);

      // 3. Le 06/08 à 10:05 : le nouveau J-7 de Léa se réserve ; pour Bruno, le J-7 parti 14 jours plus tôt est vu par
      //    le calcul (aucun fantôme) et son lendemain de B garde la place du jour au lieu d'être sauté « plafond_jour ».
      const passage = await passer(db, true, '2027-08-06T08:05:00Z');
      expect(passage.reservees).toEqual(['j_moins_7:en_attente', 'lendemain:en_attente']);
      expect(passage.calcul.aEnvoyer.map((e) => `${e.destinataireId === id('lea@exemple.fr') ? 'lea' : 'bruno'}:${e.etape}`).sort())
        .toEqual(['bruno:lendemain', 'lea:j_moins_7']);
      expect(passage.calcul.sautes).toEqual([]);
      expect(passage.calcul.aEnvoyer.find((e) => e.etape === 'j_moins_7')).toMatchObject({
        calendrierIds: [a], prevuLe: '2027-08-06T08:00:00.000Z',
      });
    }));
});
