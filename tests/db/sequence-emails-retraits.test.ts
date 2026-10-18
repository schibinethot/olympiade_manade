import type pg from 'pg';
import { describe, expect, it } from 'vitest';
import { commeSuperutilisateur, dansUneTransaction, doitEtreRefuse } from './aide';
import { modifier } from './graine';

// Vague finale de la séquence d'e-mails : plafond des confirmations (C6, I3), RPC de retrait et de renvoi
// (I2), purge des demandes jamais confirmées (C5, M7), date déplacée (B1 QA), bilan par raison, clé
// d'idempotence des messages (M3).

const TEXTE = 'J’accepte de recevoir les actualités de l’Olympiade des Manades par email.';

async function commeService(db: pg.Client): Promise<void> {
  await commeSuperutilisateur(db);
  await db.query('set local role service_role');
}

/** Dépôt du formulaire (service_role) ; `ilYa` recule la date du dépôt (cree_le de l'abonnement). */
async function abonner(db: pg.Client, email: string, ilYaJours = 0): Promise<string> {
  await commeService(db);
  await db.query(
    `insert into public.abonnements_actualites (email, consentement_texte, consentement_version, source)
     values ($1, $2, '2026-10-17', 'accueil')`,
    [email, TEXTE],
  );
  await commeSuperutilisateur(db);
  if (ilYaJours) {
    await db.query(`update public.abonnements_actualites set cree_le = now() - make_interval(days => $2) where email = $1`, [email, ilYaJours]);
  }
  const { rows } = await db.query('select id from public.destinataires_emails where email = $1', [email]);
  return rows[0].id;
}

/** Réservation d'une confirmation par le planificateur (service_role, ignore les doublons). */
async function reserverConfirmation(db: pg.Client, id: string, reel = true): Promise<boolean> {
  await commeService(db);
  const { rows } = await db.query(
    `insert into public.envois_emails (destinataire_id, etape, reel, statut, prevu_le)
     values ($1, 'confirmation', $2, 'en_attente', now())
     on conflict (destinataire_id, etape, calendrier_id, message_id, reel) do nothing returning id`,
    [id, reel],
  );
  await commeSuperutilisateur(db);
  return rows.length === 1;
}

async function confirmations(db: pg.Client, id: string): Promise<string[]> {
  await commeSuperutilisateur(db);
  const { rows } = await db.query(
    `select statut || case when reel then '' else ' (simulé)' end as s from public.envois_emails
     where destinataire_id = $1 and etape = 'confirmation' order by 1`,
    [id],
  );
  return rows.map((r: { s: string }) => r.s);
}

async function marquer(db: pg.Client, id: string, statut: string, ilYaHeures = 0): Promise<void> {
  await modifier(
    db,
    `update public.envois_emails set statut = $2, envoye_le = now() - make_interval(hours => $3), cree_le = now() - make_interval(hours => $3)
     where destinataire_id = $1 and etape = 'confirmation' and reel`,
    [id, statut, ilYaHeures],
  );
}

/** Confirmation réclamée il y a `ilYaHeures`, puis soldée « interrompu » (bail dépassé, ou corps sans réponse). */
async function interrompre(db: pg.Client, id: string, ilYaHeures: number): Promise<void> {
  await marquer(db, id, 'echec', ilYaHeures);
  await modifier(db, `update public.envois_emails set raison = 'interrompu' where destinataire_id = $1 and etape = 'confirmation'`, [id]);
}

async function renvoyer(db: pg.Client, email: string): Promise<void> {
  await commeService(db);
  await db.query('select public.renvoyer_confirmation_email($1, now())', [email]);
  await commeSuperutilisateur(db);
}

async function compteur(db: pg.Client, id: string): Promise<{ demandes_confirmation: number; premiere_demande_le: Date | null }> {
  await commeSuperutilisateur(db);
  const { rows } = await db.query(
    'select demandes_confirmation, premiere_demande_le from public.destinataires_emails where id = $1',
    [id],
  );
  return rows[0];
}

describe('séquence d’e-mails : plafond des confirmations (C6)', () => {
  it('au plus 3 demandes réelles par 30 jours pour une adresse non désinscrite, puis la fenêtre se rouvre', () =>
    dansUneTransaction(async (db) => {
      const id = await abonner(db, 'lea@exemple.fr');
      for (let i = 1; i <= 3; i += 1) {
        expect(await reserverConfirmation(db, id), `demande ${i}`).toBe(true);
        expect((await compteur(db, id)).demandes_confirmation).toBe(i);
        await marquer(db, id, 'envoye', 25);
        await renvoyer(db, ' LEA@exemple.fr\t'); // adresse normalisée par la RPC
        // Les deux premiers renvois libèrent la place ; au plafond, la dernière confirmation (et son lien) reste.
        expect(await confirmations(db, id), `renvoi ${i}`).toEqual(i < 3 ? [] : ['envoye']);
      }
      // Quatrième demande du mois, même si un autre chemin a supprimé la troisième : refusée sans erreur, comme
      // un doublon ignoré.
      await modifier(db, `delete from public.envois_emails where destinataire_id = $1`, [id]);
      expect(await reserverConfirmation(db, id)).toBe(false);
      expect(await confirmations(db, id)).toEqual([]);
      expect((await compteur(db, id)).demandes_confirmation).toBe(3);
      // Le mode simulé n'est pas plafonné (aucun email réel) et ne compte pas.
      expect(await reserverConfirmation(db, id, false)).toBe(true);
      expect((await compteur(db, id)).demandes_confirmation).toBe(3);

      // 30 jours après la première demande, la fenêtre se rouvre : une nouvelle demande, comptée 1.
      await modifier(db, `update public.destinataires_emails set premiere_demande_le = now() - interval '30 days' where id = $1`, [id]);
      expect(await reserverConfirmation(db, id)).toBe(true);
      expect(await compteur(db, id)).toMatchObject({ demandes_confirmation: 1 });
      expect(Date.now() - (await compteur(db, id)).premiere_demande_le!.getTime()).toBeLessThan(86_400_000);

      // Une réservation en double (deux instances) n'est pas comptée.
      expect(await reserverConfirmation(db, id)).toBe(false);
      expect((await compteur(db, id)).demandes_confirmation).toBe(1);
    }));

  it('au plus 1 demande par 30 jours pour une adresse désinscrite, même redéposée par un tiers (I3)', () =>
    dansUneTransaction(async (db) => {
      const id = await abonner(db, 'stop@exemple.fr');
      expect(await reserverConfirmation(db, id)).toBe(true);
      await marquer(db, id, 'envoye', 48);
      // Désinscription depuis le lien de la confirmation, puis nouveau dépôt du même jour par un tiers.
      await commeService(db);
      await db.query(`update public.destinataires_emails set desinscrit_le = now(), annonces = false where id = $1`, [id]);
      await db.query('select public.retirer_abonnement_destinataire($1)', [id]);
      await abonner(db, 'stop@exemple.fr');
      // Plafond atteint : l'ancienne confirmation reste (son lien reste le seul valable), aucune nouvelle.
      expect(await confirmations(db, id)).toEqual(['envoye']);
      await renvoyer(db, 'stop@exemple.fr');
      expect(await confirmations(db, id)).toEqual(['envoye']);
      await modifier(db, `delete from public.envois_emails where destinataire_id = $1`, [id]);
      expect(await reserverConfirmation(db, id)).toBe(false);
      // Le planificateur ne la propose même plus (a_demander faux en mode réel).
      await commeService(db);
      const { rows } = await db.query('select public.emails_a_traiter(now(), true) as r');
      const ligne = (rows[0].r.destinataires as unknown[][]).find((l) => l[0] === id);
      expect(ligne?.slice(1, 3)).toEqual([false, true]);
    }));

  it('le renvoi ne supprime ni une confirmation en attente ni une confirmation de moins de 24 h', () =>
    dansUneTransaction(async (db) => {
      const id = await abonner(db, 'lou@exemple.fr');
      await reserverConfirmation(db, id);
      await renvoyer(db, 'lou@exemple.fr');
      expect(await confirmations(db, id)).toEqual(['en_attente']);
      await marquer(db, id, 'envoye', 23);
      await renvoyer(db, 'lou@exemple.fr');
      expect(await confirmations(db, id)).toEqual(['envoye']);
      await marquer(db, id, 'echec', 1);
      await renvoyer(db, 'lou@exemple.fr');
      expect(await confirmations(db, id)).toEqual([]);
      // Une adresse déjà confirmée n'a plus rien à renvoyer.
      await reserverConfirmation(db, id);
      await marquer(db, id, 'saute', 1);
      await commeService(db);
      await db.query(`update public.destinataires_emails set abonnement_confirme_le = now() where id = $1`, [id]);
      await renvoyer(db, 'lou@exemple.fr');
      expect(await confirmations(db, id)).toEqual(['saute']);
    }));
});

describe('séquence d’e-mails : renvoi d’une confirmation peut-être partie', () => {
  it('une confirmation interrompue attend 24 h avant qu’un nouveau dépôt la remplace (mineur n° 5)', () =>
    dansUneTransaction(async (db) => {
      const id = await abonner(db, 'lente@exemple.fr');
      await reserverConfirmation(db, id);
      // Relais muet après le corps, il y a une heure : peut-être remise, elle n'est pas remplacée.
      await interrompre(db, id, 1);
      await renvoyer(db, 'lente@exemple.fr');
      expect(await confirmations(db, id)).toEqual(['echec']);
      // Après 25 h, comme une confirmation partie : supprimée, une nouvelle peut partir.
      await interrompre(db, id, 25);
      await renvoyer(db, 'lente@exemple.fr');
      expect(await confirmations(db, id)).toEqual([]);
      // Un échec certain (refus, essais épuisés) se remplace tout de suite, comme avant.
      expect(await reserverConfirmation(db, id)).toBe(true);
      await marquer(db, id, 'echec', 1);
      await modifier(db, `update public.envois_emails set raison = 'envoi_impossible' where destinataire_id = $1`, [id]);
      await renvoyer(db, 'lente@exemple.fr');
      expect(await confirmations(db, id)).toEqual([]);
    }));
});

describe('séquence d’e-mails : retrait et purge', () => {
  it('retirer_abonnement_destinataire : par identifiant, les déclencheurs gardent opposition et spectateur', () =>
    dansUneTransaction(async (db) => {
      const inconnu = await abonner(db, 'inconnu@exemple.fr');
      const oppose = await abonner(db, 'oppose@exemple.fr');
      await modifier(db, `update public.destinataires_emails set desinscrit_le = now() where id = $1`, [oppose]);
      await commeService(db);
      for (const id of [inconnu, oppose, '00000000-0000-4000-8000-000000000000']) {
        await db.query('select public.retirer_abonnement_destinataire($1)', [id]);
      }
      await commeSuperutilisateur(db);
      const { rows: abonnes } = await db.query('select email from public.abonnements_actualites order by 1');
      expect(abonnes).toEqual([]);
      const { rows } = await db.query('select email, abonne, abonnement_a_confirmer from public.destinataires_emails order by 1');
      expect(rows).toEqual([{ email: 'oppose@exemple.fr', abonne: false, abonnement_a_confirmer: false }]);
      // anon et authenticated ne peuvent pas l'appeler.
      await db.query('set local role authenticated');
      expect(await doitEtreRefuse(db, 'select public.retirer_abonnement_destinataire($1)', [oppose])).toBe('42501');
    }));

  it('purge des demandes jamais confirmées : 30 jours après l’envoi réel, ou après la dernière tentative si rien n’est parti', () =>
    dansUneTransaction(async (db) => {
      // A. Confirmation partie il y a 31 jours, jamais cliquée : purgée. Partie il y a 29 jours : gardée.
      const partie = await abonner(db, 'partie@exemple.fr', 40);
      await reserverConfirmation(db, partie);
      await marquer(db, partie, 'envoye', 31 * 24);
      const recente = await abonner(db, 'recente@exemple.fr', 40);
      await reserverConfirmation(db, recente);
      await marquer(db, recente, 'envoye', 29 * 24);
      // A. Interrompue (peut-être partie) : comme une confirmation partie, 30 jours après sa réclamation (envoye_le).
      const interrompueVieille = await abonner(db, 'interrompue-vieille@exemple.fr', 40);
      await reserverConfirmation(db, interrompueVieille);
      await interrompre(db, interrompueVieille, 31 * 24);
      const interrompueRecente = await abonner(db, 'interrompue-recente@exemple.fr', 40);
      await reserverConfirmation(db, interrompueRecente);
      await interrompre(db, interrompueRecente, 29 * 24);
      // B. Rien n'est parti : purgée 30 jours après la dernière tentative (échec, saut) ou le dépôt (aucun envoi,
      //    envoi simulé seulement). Un échec d'il y a une heure, sur un dépôt de 31 jours, est gardé.
      const echecVieux = await abonner(db, 'echec-vieux@exemple.fr', 40);
      await reserverConfirmation(db, echecVieux);
      await marquer(db, echecVieux, 'echec', 31 * 24);
      const echecRecent = await abonner(db, 'echec-recent@exemple.fr', 31);
      await reserverConfirmation(db, echecRecent);
      await marquer(db, echecRecent, 'echec', 1);
      const sauteVieille = await abonner(db, 'saute-vieille@exemple.fr', 40);
      await reserverConfirmation(db, sauteVieille);
      await marquer(db, sauteVieille, 'saute', 31 * 24);
      const sansEnvoi = await abonner(db, 'sans-envoi@exemple.fr', 31);
      const simulee = await abonner(db, 'simulee@exemple.fr', 31);
      await reserverConfirmation(db, simulee, false);
      // Gardées : demande de moins de 30 jours sans envoi ; confirmation en attente (nouvel essai) ; désinscrite
      // gardée comme liste d'opposition (mais l'abonnement part).
      const jeune = await abonner(db, 'jeune@exemple.fr', 29);
      const enCours = await abonner(db, 'en-cours@exemple.fr', 31);
      await reserverConfirmation(db, enCours);
      const opposee = await abonner(db, 'opposee@exemple.fr', 31);
      await modifier(db, `update public.destinataires_emails set desinscrit_le = now() where id = $1`, [opposee]);

      await commeService(db);
      const { rows: [{ n }] } = await db.query('select public.purger_demandes_non_confirmees(now(), 1000) as n');
      expect(n).toBe(7);
      await commeSuperutilisateur(db);
      const { rows: abonnes } = await db.query('select email from public.abonnements_actualites order by 1');
      expect(abonnes.map((r: { email: string }) => r.email)).toEqual([
        'echec-recent@exemple.fr', 'en-cours@exemple.fr', 'interrompue-recente@exemple.fr', 'jeune@exemple.fr', 'recente@exemple.fr',
      ]);
      const { rows: restants } = await db.query('select email from public.destinataires_emails order by 1');
      expect(restants.map((r: { email: string }) => r.email)).toEqual([
        'echec-recent@exemple.fr', 'en-cours@exemple.fr', 'interrompue-recente@exemple.fr', 'jeune@exemple.fr', 'opposee@exemple.fr',
        'recente@exemple.fr',
      ]);
      expect([partie, interrompueVieille, echecVieux, sauteVieille, sansEnvoi, simulee, jeune].length).toBe(7);

      // Par lots : la limite borne le nombre de retraits d'un appel.
      await abonner(db, 'lot1@exemple.fr', 31);
      await abonner(db, 'lot2@exemple.fr', 31);
      await commeService(db);
      expect((await db.query('select public.purger_demandes_non_confirmees(now(), 1) as n')).rows[0].n).toBe(1);
      expect((await db.query('select public.purger_demandes_non_confirmees(now(), 1) as n')).rows[0].n).toBe(1);
      expect((await db.query('select public.purger_demandes_non_confirmees(now(), 1) as n')).rows[0].n).toBe(0);
    }));

  it('reprise + panne SMTP au premier passage : aucun abonné repris n’est purgé la nuit suivante (Important n° 1)', () =>
    dansUneTransaction(async (db) => {
      // Abonnés repris par la migration : dépôt de 200 jours, inscrits à la même date, en attente de leur clic.
      // Premier passage en smtp avec un relais mal réglé : 4 essais en échec, un refus 5xx, un corps sans réponse.
      const issues = [
        { email: 'repris-essais@exemple.fr', raison: 'envoi_impossible', tentatives: 4 },
        { email: 'repris-refus@exemple.fr', raison: 'refus_definitif', tentatives: 1 },
        { email: 'repris-incertain@exemple.fr', raison: 'interrompu', tentatives: 1 },
      ];
      for (const { email, raison, tentatives } of issues) {
        const id = await abonner(db, email, 200);
        await modifier(db, `update public.destinataires_emails set inscrit_le = now() - interval '200 days' where id = $1`, [id]);
        await reserverConfirmation(db, id);
        await marquer(db, id, 'echec', 3);
        await modifier(db, `update public.envois_emails set raison = $2, tentatives = $3 where destinataire_id = $1`, [id, raison, tentatives]);
      }
      await commeService(db);
      const purger = async (dans: string) => (await db.query(
        `select public.purger_demandes_non_confirmees(now() + $1::interval, 1000) as n`, [dans],
      )).rows[0].n;
      // La nuit suivante (03:00) : personne n'est purgé, la liste survit au réglage corrigé dans la journée.
      expect(await purger('18 hours')).toBe(0);
      expect(await purger('29 days')).toBe(0);
      // 30 jours après la tentative, la règle ordinaire s'applique : rien n'est parti, ou l'envoi interrompu
      // n'a jamais été cliqué.
      expect(await purger('31 days')).toBe(3);
      await commeSuperutilisateur(db);
      const { rows } = await db.query(`select email from public.abonnements_actualites where email like 'repris-%'`);
      expect(rows).toEqual([]);
    }));
});

describe('séquence d’e-mails : date déplacée, bilan, idempotence', () => {
  it('une étape réservée pour une ancienne échéance est libérée (supprimée), puis la nouvelle se réserve', () =>
    dansUneTransaction(async (db) => {
      await modifier(db, 'delete from public.calendrier');
      const { rows: [{ id: date }] } = await db.query(
        `insert into public.calendrier (annee, nom, ville, date_soiree, heure, statut)
         values (2027, 'Rencontre', 'Sommières', '2027-07-30', '21:30', 'confirmee') returning id`,
      );
      const { rows: [{ id: bruno }] } = await db.query(
        `insert into public.destinataires_emails (email, confirme_le) values ('bruno@exemple.fr', '2027-06-01') returning id`,
      );
      await commeService(db);
      const reserver = `insert into public.envois_emails (destinataire_id, etape, calendrier_id, message_id, reel, statut, prevu_le)
        values ($1, 'veille', $2, null, true, 'en_attente', $3)
        on conflict (destinataire_id, etape, calendrier_id, message_id, reel) do nothing returning id`;
      expect((await db.query(reserver, [bruno, date, '2027-07-29T16:00:00Z'])).rows).toHaveLength(1);
      // La date passe au 02/08 : la nouvelle veille bute sur l'unicité tant que l'ancienne ligne existe.
      await modifier(db, `update public.calendrier set date_soiree = '2027-08-02' where id = $1`, [date]);
      await commeService(db);
      expect((await db.query(reserver, [bruno, date, '2027-08-01T16:00:00Z'])).rows).toHaveLength(0);
      // L'examen libère la ligne réclamée (en attente, raison en_cours), filtrée par identifiant et par état.
      await db.query(`update public.envois_emails set raison = 'en_cours' where destinataire_id = $1`, [bruno]);
      const { rowCount } = await db.query(
        `delete from public.envois_emails where destinataire_id = $1 and statut = 'en_attente' and raison = 'en_cours'`,
        [bruno],
      );
      expect(rowCount).toBe(1);
      expect((await db.query(reserver, [bruno, date, '2027-08-01T16:00:00Z'])).rows).toHaveLength(1);
    }));

  it('date déplacée : seuls les sauts des étapes de cette date sont effacés (mineur n° 2)', () =>
    dansUneTransaction(async (db) => {
      await modifier(db, 'delete from public.calendrier');
      const { rows: dates } = await db.query(
        `insert into public.calendrier (annee, nom, ville, date_soiree, heure, statut) values
           (2027, 'A', 'Sommières', '2027-07-30', '21:30', 'confirmee'), (2027, 'B', 'Lunel', '2027-08-06', '21:30', 'confirmee')
         returning id, nom`,
      );
      const [a, b] = ['A', 'B'].map((nom) => dates.find((d: { nom: string }) => d.nom === nom).id as string);
      const { rows: [{ id }] } = await db.query(`insert into public.destinataires_emails (email) values ('lea@exemple.fr') returning id`);
      await db.query(
        `insert into public.envois_emails (destinataire_id, etape, calendrier_id, reel, statut, raison) values
           ($1, 'j_moins_7', $2, true, 'saute', 'deja_passe_a_l_inscription'), ($1, 'veille', $2, false, 'saute', 'plafond_jour'),
           ($1, 'prochaines_dates', $2, true, 'saute', 'meme_jour_que_bienvenue'), ($1, 'jour_j', $2, true, 'envoye', null),
           ($1, 'lendemain', $2, true, 'echec', 'interrompu'), ($1, 'annonce', $2, true, 'saute', 'date_passee'),
           ($1, 'j_moins_7', $3, true, 'saute', 'deja_passe_a_l_inscription')`,
        [id, a, b],
      );
      const lignes = async () => (await db.query(
        `select c.nom || ':' || e.etape || ':' || e.statut as l from public.envois_emails e join public.calendrier c on c.id = e.calendrier_id
         order by 1`,
      )).rows.map((r: { l: string }) => r.l);
      const toutes = await lignes();
      // Une modification sans changement de date (heure, statut) ne touche à rien.
      await db.query(`update public.calendrier set heure = '22:00', date_soiree = date_soiree where id = $1`, [a]);
      expect(await lignes()).toEqual(toutes);
      await db.query(`update public.calendrier set date_soiree = '2027-08-13' where id = $1`, [a]);
      expect(await lignes()).toEqual(['A:annonce:saute', 'A:jour_j:envoye', 'A:lendemain:echec', 'B:j_moins_7:saute']);
    }));

  it('bilan_envois_emails regroupe aussi par raison', () =>
    dansUneTransaction(async (db) => {
      const id = await abonner(db, 'lea@exemple.fr');
      await commeSuperutilisateur(db);
      const { rows: [{ id: date }] } = await db.query(
        `insert into public.calendrier (annee, nom, ville, date_soiree, statut) values (2027, 'R', 'S', '2027-07-30', 'confirmee') returning id`,
      );
      await db.query(
        `insert into public.envois_emails (destinataire_id, etape, calendrier_id, reel, statut, raison) values
           ($1, 'veille', $2, true, 'saute', 'plafond_jour'), ($1, 'jour_j', $2, true, 'saute', 'plafond_jour'),
           ($1, 'lendemain', $2, true, 'saute', 'fenetre_depassee'), ($1, 'j_moins_7', $2, true, 'echec', 'interrompu')`,
        [id, date],
      );
      const { rows } = await db.query(
        `select statut, raison, sum(nombre)::int as n from public.bilan_envois_emails where calendrier_id = $1
         group by statut, raison order by 1, 2`,
        [date],
      );
      expect(rows).toEqual([
        { statut: 'echec', raison: 'interrompu', n: 1 },
        { statut: 'saute', raison: 'fenetre_depassee', n: 1 },
        { statut: 'saute', raison: 'plafond_jour', n: 2 },
      ]);
    }));

  it('messages_inscrits : une clé d’idempotence n’enregistre qu’un message', () =>
    dansUneTransaction(async (db) => {
      await commeService(db);
      const inserer = `insert into public.messages_inscrits (sujet, corps, destinataires, cle) values ('Info', 'Texte', 2, $1)
        on conflict (cle) do nothing returning id`;
      const cle = '7d1f0e8e-0c56-4b0e-9c55-2f6f0b8f2b11';
      expect((await db.query(inserer, [cle])).rows).toHaveLength(1);
      expect((await db.query(inserer, [cle])).rows).toHaveLength(0);
      // Sans clé, aucune contrainte : l'idempotence en mémoire du serveur s'applique.
      expect((await db.query(inserer, [null])).rows).toHaveLength(1);
      expect((await db.query(inserer, [null])).rows).toHaveLength(1);
    }));
});
