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

/** Un passage du planificateur sans transport : RPC, décodage, calcul, réservation, puis « simule » (ou « envoye »). */
async function passer(db: pg.Client, reel = false) {
  await commeService(db);
  const { rows: [{ maintenant }] } = await db.query('select now() as maintenant');
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
    `update public.envois_emails set statut = case when reel then 'envoye' else 'simule' end, envoye_le = now()
     where statut = 'en_attente' and reel = $1`,
    [reel],
  );
  await commeSuperutilisateur(db);
  return { donnees, calcul, reservees: reservees.map((l: { etape: string; statut: string }) => `${l.etape}:${l.statut}`).sort() };
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
});
