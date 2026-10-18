import { describe, expect, it } from 'vitest';
import { ETAPES, MODELES_DEFAUT, type DateEnrichie, type Etape } from '../../serveur/gabarits-emails.mjs';
import {
  calculerEnvois,
  dateDeBienvenue,
  echeance,
  envoisAVenir,
  lireEmailsATraiter,
  sautsPerimes,
  type Destinataire,
  type EmailsATraiter,
  type Envoi,
  type EnvoiPrevu,
  type ModeleRpc,
  type Rattachement,
} from '../../serveur/echeances-emails.mjs';

// Calendrier 2027 réel (migration 20261011090200), les trois dates de l'été passées en « confirmee ».
const MARSILLARGUES = 'cal-2027-marsillargues';
const SOMMIERES = 'cal-2027-sommieres';
const BEZOUCE = 'cal-2027-bezouce';
const BEZIERS = 'cal-2027-beziers';
const LE_CRES = 'cal-2027-le-cres';

function dateCalendrier(changes: Partial<DateEnrichie> & Pick<DateEnrichie, 'id' | 'ville' | 'date_soiree'>): DateEnrichie {
  return {
    nom: 'Olympiades camarguaises',
    arenes: null,
    heure: '21:30:00',
    statut: 'confirmee',
    lien_billetterie: null,
    infos_pratiques: null,
    soiree: null,
    manades: [],
    vainqueur: null,
    ...changes,
  };
}

const marsillargues = (changes: Partial<DateEnrichie> = {}) => dateCalendrier({
  id: MARSILLARGUES, ville: 'Marsillargues', arenes: 'Arènes Marcel Guillarmet', date_soiree: '2027-07-30', ...changes,
});
const sommieres = (changes: Partial<DateEnrichie> = {}) => dateCalendrier({
  id: SOMMIERES, nom: 'Rencontre des manades', ville: 'Sommières', arenes: 'Arènes Gilles Arnaud', date_soiree: '2027-07-31',
  soiree: { slug: 'sommieres-2027', statut: 'publiee' }, ...changes,
});
const bezouce = (changes: Partial<DateEnrichie> = {}) => dateCalendrier({
  id: BEZOUCE, ville: 'Bezouce', arenes: 'Arènes de Bezouce', date_soiree: '2027-08-05', heure: '21:00:00', ...changes,
});
const beziers = (changes: Partial<DateEnrichie> = {}) => dateCalendrier({
  id: BEZIERS, nom: 'Olympiades des gardians de la Feria', ville: 'Béziers', arenes: 'Arènes de Béziers', date_soiree: '2027-08-14',
  heure: null, ...changes,
});
const leCres = (changes: Partial<DateEnrichie> = {}) => dateCalendrier({
  id: LE_CRES, ville: 'Le Crès', arenes: 'Arènes du Crès', date_soiree: '2027-08-16', heure: '21:00:00', ...changes,
});

const VILLES: Record<string, string> = {
  [MARSILLARGUES]: 'Marsillargues', [SOMMIERES]: 'Sommières', [BEZOUCE]: 'Bezouce', [BEZIERS]: 'Béziers', [LE_CRES]: 'Le Crès',
};

/** Les 9 modèles comme la RPC les renvoie : valeurs par défaut, heures en « HH:MM:SS ». */
function modeles(changes: Partial<Record<Etape, Partial<ModeleRpc>>> = {}): ModeleRpc[] {
  return ETAPES.map((cle) => {
    const defaut = MODELES_DEFAUT[cle];
    return {
      cle,
      nom: defaut.nom,
      actif: true,
      sujet: defaut.sujet,
      preheader: defaut.preheader,
      corps: defaut.corps,
      encart: defaut.encart,
      jours_decalage: defaut.jours_decalage,
      heure_envoi: defaut.heure_envoi === null ? null : `${defaut.heure_envoi}:00`,
      ...changes[cle],
    };
  });
}

/** « 2027-07-22 12:00 », heure d'été de Paris (UTC+2), en instant. */
const ete = (moment: string) => new Date(`${moment.replace(' ', 'T')}:00+02:00`);
const iso = (moment: string) => ete(moment).toISOString();

const CAMILLE = 'dest-camille';

function destinataire(changes: Partial<Destinataire> = {}): Destinataire {
  return {
    id: CAMILLE,
    abonnement_a_confirmer: false,
    desinscrit: false,
    annonces: false,
    confirme_le: null,
    ...changes,
  };
}

function rattachement(calendrierId: string, creeLe: string, changes: Partial<Rattachement> = {}): Rattachement {
  return { destinataire_id: CAMILLE, calendrier_id: calendrierId, origine: 'inscription', cree_le: iso(creeLe), ...changes };
}

function envoi(etape: Etape, calendrierId: string | null, prevuLe: string, changes: Partial<Envoi> = {}): Envoi {
  return {
    destinataire_id: CAMILLE,
    etape,
    calendrier_id: calendrierId,
    statut: 'envoye',
    raison: null,
    prevu_le: prevuLe,
    ...changes,
  };
}

function donnees(changes: Partial<EmailsATraiter> = {}): EmailsATraiter {
  return {
    modeles: modeles(),
    dates: [marsillargues(), sommieres(), bezouce()],
    prochaines: [],
    destinataires: [],
    rattachements: [],
    envois: [],
    ...changes,
  };
}

const PARIS = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

/** « 2027-07-29 20:00 · veille Marsillargues · deja_passe_a_l_inscription » */
function decrire(maintenant: Date, prevu: EnvoiPrevu) {
  const villes = prevu.calendrierIds.map((id) => VILLES[id] ?? id).join('+');
  const etape = [prevu.etape, villes].filter(Boolean).join(' ') + (prevu.encartDateProche ? ' +encart' : '');
  return `${PARIS.format(maintenant)} · ${etape} · ${prevu.raison ?? 'part'}`;
}

/**
 * Le planificateur, passage après passage : chaque résultat est réservé dans `etat.envois` (une ligne
 * par date, `envoye` ou `saute`), comme la tâche 5 le fera en base. Renvoie le journal des décisions.
 */
function simuler(etat: EmailsATraiter, debut: string, fin: string, pasMinutes = 15) {
  const journal: string[] = [];
  for (let instant = ete(debut).getTime(); instant <= ete(fin).getTime(); instant += pasMinutes * 60_000) {
    const maintenant = new Date(instant);
    const { aEnvoyer, sautes } = calculerEnvois(etat, maintenant);
    for (const prevu of [...aEnvoyer, ...sautes]) {
      journal.push(decrire(maintenant, prevu));
      for (const calendrierId of prevu.calendrierIds.length ? prevu.calendrierIds : [null]) {
        etat.envois.push(envoi(prevu.etape, calendrierId, prevu.prevuLe, {
          destinataire_id: prevu.destinataireId,
          statut: prevu.raison ? 'saute' : 'envoye',
          raison: prevu.raison ?? null,
        }));
      }
    }
  }
  return journal;
}

/** Un spectateur confirmé à `moment`, rattaché à cet instant à `calendrierId` (origine inscription). */
function inscrit(calendrierId: string, moment: string, changes: Partial<Destinataire> = {}) {
  return donnees({
    destinataires: [destinataire({ confirme_le: iso(moment), ...changes })],
    rattachements: [rattachement(calendrierId, moment)],
  });
}

describe('echeance', () => {
  it('place chaque étape datée à son heure de Paris, avec les valeurs par défaut', () => {
    const parCle = new Map(modeles().map((modele) => [modele.cle, modele]));
    const pour = (cle: Etape) => echeance(parCle.get(cle)!, marsillargues())?.toISOString();
    expect(pour('j_moins_7')).toBe('2027-07-23T08:00:00.000Z');
    expect(pour('veille')).toBe('2027-07-29T16:00:00.000Z');
    expect(pour('jour_j')).toBe('2027-07-30T08:00:00.000Z');
    expect(pour('lendemain')).toBe('2027-07-31T08:00:00.000Z');
    expect(pour('prochaines_dates')).toBe('2027-08-06T08:00:00.000Z');
    expect(pour('annonce')).toBe('2027-07-20T08:00:00.000Z');
  });

  it('renvoie null pour confirmation, bienvenue et message, et pour un réglage incomplet', () => {
    for (const cle of ['confirmation', 'bienvenue', 'message'] as const) {
      expect(echeance({ cle, jours_decalage: 0, heure_envoi: '10:00' }, marsillargues())).toBeNull();
    }
    expect(echeance({ cle: 'veille', jours_decalage: null, heure_envoi: '18:00' }, marsillargues())).toBeNull();
    expect(echeance({ cle: 'veille', jours_decalage: -1, heure_envoi: null }, marsillargues())).toBeNull();
  });

  it('heure d’hiver : une veille à 18:00 reste à 18:00 heure de Paris', () => {
    const veille = { cle: 'veille', jours_decalage: -1, heure_envoi: '18:00:00' };
    expect(echeance(veille, { date_soiree: '2027-10-31' })?.toISOString()).toBe('2027-10-30T16:00:00.000Z');
    expect(echeance(veille, { date_soiree: '2027-11-01' })?.toISOString()).toBe('2027-10-31T17:00:00.000Z');
    // Passage à l'heure d'été, le 28/03/2027.
    expect(echeance(veille, { date_soiree: '2027-03-28' })?.toISOString()).toBe('2027-03-27T17:00:00.000Z');
    expect(echeance({ cle: 'jour_j', jours_decalage: 0, heure_envoi: '10:00:00' }, { date_soiree: '2027-03-28' })?.toISOString())
      .toBe('2027-03-28T08:00:00.000Z');
    // Hors des bornes de l'admin, mais juste : 01:30 le 28/03 est encore en heure d'hiver (UTC+1).
    expect(echeance({ cle: 'jour_j', jours_decalage: 0, heure_envoi: '01:30' }, { date_soiree: '2027-03-28' })?.toISOString())
      .toBe('2027-03-28T00:30:00.000Z');
  });

  it('suit les réglages de l’admin, bornes comprises (-14 à 7 jours, 07:00 à 21:00)', () => {
    expect(echeance({ cle: 'j_moins_7', jours_decalage: -14, heure_envoi: '07:00' }, marsillargues())?.toISOString())
      .toBe('2027-07-16T05:00:00.000Z');
    expect(echeance({ cle: 'lendemain', jours_decalage: 7, heure_envoi: '21:00:00' }, marsillargues())?.toISOString())
      .toBe('2027-08-06T19:00:00.000Z');
  });
});

describe('calculerEnvois : parcours sur le calendrier 2027', () => {
  it('inscription à J-8 de Marsillargues (22/07) : J-7 le 23/07, veille le 29/07, jour J le 30/07, lendemain le 31/07', () => {
    const etat = inscrit(MARSILLARGUES, '2027-07-22 12:00');
    expect(simuler(etat, '2027-07-22 12:00', '2027-08-08 12:00')).toEqual([
      '2027-07-22 12:00 · bienvenue · part',
      '2027-07-23 10:00 · j_moins_7 Marsillargues · part',
      '2027-07-29 18:00 · veille Marsillargues · part',
      '2027-07-30 10:00 · jour_j Marsillargues · part',
      '2027-07-31 10:00 · lendemain Marsillargues · part',
    ]);
  });

  it('même rythme pour Sommières, rejointe par « Je viens » à J-8 (23/07) : veille le 30/07 à 18:00, jour J le 31/07, lendemain le 01/08', () => {
    const etat = donnees({
      destinataires: [destinataire({ confirme_le: iso('2027-07-01 09:00') })],
      rattachements: [rattachement(SOMMIERES, '2027-07-23 12:00', { origine: 'je_viens' })],
      envois: [envoi('bienvenue', null, iso('2027-07-01 09:00'))],
    });
    expect(simuler(etat, '2027-07-23 12:00', '2027-08-02 12:00')).toEqual([
      '2027-07-24 10:00 · j_moins_7 Sommières · part',
      '2027-07-30 18:00 · veille Sommières · part',
      '2027-07-31 10:00 · jour_j Sommières · part',
      '2027-08-01 10:00 · lendemain Sommières · part',
    ]);
  });

  it('inscription la veille à 20:00 : bienvenue avec encart, la veille est déjà passée, le jour J part', () => {
    const etat = inscrit(MARSILLARGUES, '2027-07-29 20:00');
    expect(simuler(etat, '2027-07-29 20:00', '2027-08-01 12:00')).toEqual([
      '2027-07-29 20:00 · bienvenue +encart · part',
      '2027-07-29 20:00 · j_moins_7 Marsillargues · deja_passe_a_l_inscription',
      '2027-07-29 20:00 · veille Marsillargues · deja_passe_a_l_inscription',
      '2027-07-30 10:00 · jour_j Marsillargues · part',
      '2027-07-31 10:00 · lendemain Marsillargues · part',
    ]);
  });

  it('inscription le jour J à 09:00 (31/07) : bienvenue avec encart, le jour J est sauté, le lendemain part', () => {
    const etat = inscrit(SOMMIERES, '2027-07-31 09:00');
    expect(simuler(etat, '2027-07-31 09:00', '2027-08-02 12:00')).toEqual([
      '2027-07-31 09:00 · bienvenue +encart · part',
      '2027-07-31 09:00 · j_moins_7 Sommières · deja_passe_a_l_inscription',
      '2027-07-31 09:00 · veille Sommières · deja_passe_a_l_inscription',
      '2027-07-31 10:00 · jour_j Sommières · meme_jour_que_bienvenue',
      '2027-08-01 10:00 · lendemain Sommières · part',
    ]);
  });

  it('inscription à J-3 à 20:00 (27/07) : bienvenue avec encart, le J-7 est déjà passé, la veille part', () => {
    const etat = inscrit(MARSILLARGUES, '2027-07-27 20:00');
    expect(simuler(etat, '2027-07-27 20:00', '2027-07-31 12:00')).toEqual([
      '2027-07-27 20:00 · bienvenue +encart · part',
      '2027-07-27 20:00 · j_moins_7 Marsillargues · deja_passe_a_l_inscription',
      '2027-07-29 18:00 · veille Marsillargues · part',
      '2027-07-30 10:00 · jour_j Marsillargues · part',
      '2027-07-31 10:00 · lendemain Marsillargues · part',
    ]);
  });

  it('inscription pendant la soirée, le 01/08 à 00:30 : la date du 31/07 compte encore, encart puis lendemain', () => {
    const etat = inscrit(SOMMIERES, '2027-08-01 00:30');
    expect(simuler(etat, '2027-08-01 00:30', '2027-08-02 12:00')).toEqual([
      '2027-08-01 00:30 · bienvenue +encart · part',
      '2027-08-01 00:30 · j_moins_7 Sommières · deja_passe_a_l_inscription',
      '2027-08-01 00:30 · veille Sommières · deja_passe_a_l_inscription',
      '2027-08-01 00:30 · jour_j Sommières · deja_passe_a_l_inscription',
      '2027-08-01 10:00 · lendemain Sommières · part',
    ]);
  });

  it('point de revue 4 : Bezouce déplacée au 07/08 après l’envoi du J-7, pas de nouveau J-7, la veille le 06/08 à 18:00', () => {
    const etat = inscrit(BEZOUCE, '2027-07-27 12:00');
    etat.envois.push(
      envoi('bienvenue', null, iso('2027-07-27 12:00')),
      envoi('j_moins_7', BEZOUCE, iso('2027-07-29 10:00')),
    );
    etat.dates = [marsillargues(), sommieres(), bezouce({ date_soiree: '2027-08-07' })];
    // Le nouveau J-7 tomberait le 31/07 à 10:00 : la ligne déjà envoyée suffit à l'arrêter.
    expect(calculerEnvois(etat, ete('2027-07-31 10:00'))).toEqual({ aEnvoyer: [], sautes: [] });
    expect(simuler(etat, '2027-07-29 10:15', '2027-08-09 12:00')).toEqual([
      '2027-08-06 18:00 · veille Bezouce · part',
      '2027-08-07 10:00 · jour_j Bezouce · part',
      '2027-08-08 10:00 · lendemain Bezouce · part',
    ]);
    expect(etat.envois.find((ligne) => ligne.etape === 'veille')?.prevu_le).toBe('2027-08-06T16:00:00.000Z');
  });

  it('date annulée : J-7, veille, jour J et lendemain sautés (date_annulee), les prochaines dates partent', () => {
    const etat = inscrit(SOMMIERES, '2027-07-22 12:00', { annonces: true });
    etat.dates = [marsillargues(), sommieres({ statut: 'annulee' }), bezouce()];
    etat.prochaines = [beziers({ statut: 'confirmee' })];
    expect(simuler(etat, '2027-07-22 12:00', '2027-08-08 12:00')).toEqual([
      '2027-07-22 12:00 · bienvenue · part',
      // L'annonce de Marsillargues, bloquée le 22/07 par la bienvenue, est reportée au lendemain 10:00.
      '2027-07-23 10:00 · annonce Marsillargues · part',
      '2027-07-24 10:00 · j_moins_7 Sommières · date_annulee',
      '2027-07-30 10:00 · annonce Bezouce · part',
      '2027-07-30 18:00 · veille Sommières · date_annulee',
      '2027-07-31 10:00 · jour_j Sommières · date_annulee',
      '2027-08-01 10:00 · lendemain Sommières · date_annulee',
      '2027-08-07 10:00 · prochaines_dates Sommières · part',
    ]);
  });

  it('soirée liée reportée ou annulée alors que la date est confirmée : ni J-7, ni veille, ni jour J, ni lendemain', () => {
    for (const statut of ['reportee', 'annulee'] as const) {
      const etat = inscrit(SOMMIERES, '2027-07-22 12:00');
      etat.dates = [marsillargues(), sommieres({ soiree: { slug: 'sommieres-2027', statut } }), bezouce()];
      // Étapes 2 à 5 suspendues : rien n'est envoyé ni enregistré, pas de « merci » pour une soirée qui n'a pas eu lieu.
      expect(simuler(etat, '2027-07-22 12:00', '2027-08-02 12:00')).toEqual(['2027-07-22 12:00 · bienvenue · part']);
    }
  });

  it('soirée de nouveau publiée dans la fenêtre du lendemain : le lendemain repart', () => {
    const etat = inscrit(SOMMIERES, '2027-07-22 12:00');
    etat.envois.push(envoi('bienvenue', null, iso('2027-07-22 12:00')));
    etat.dates = [marsillargues(), sommieres({ soiree: { slug: 'sommieres-2027', statut: 'reportee' } }), bezouce()];
    expect(calculerEnvois(etat, ete('2027-08-01 10:00'))).toEqual({ aEnvoyer: [], sautes: [] });
    etat.dates = [marsillargues(), sommieres(), bezouce()];
    expect(calculerEnvois(etat, ete('2027-08-01 10:00')).aEnvoyer.map(decrireCourt)).toEqual(['lendemain Sommières']);
  });

  it('date prévisionnelle : rappels suspendus sans rien enregistrer, repris si elle redevient confirmée', () => {
    const etat = inscrit(MARSILLARGUES, '2027-07-22 12:00');
    etat.envois.push(envoi('bienvenue', null, iso('2027-07-22 12:00')), envoi('j_moins_7', MARSILLARGUES, iso('2027-07-23 10:00')));
    etat.dates = [marsillargues({ statut: 'previsionnelle' }), sommieres(), bezouce()];
    expect(calculerEnvois(etat, ete('2027-07-29 18:00'))).toEqual({ aEnvoyer: [], sautes: [] });
    expect(calculerEnvois(etat, ete('2027-07-30 10:00'))).toEqual({ aEnvoyer: [], sautes: [] });
    etat.dates = [marsillargues(), sommieres(), bezouce()];
    expect(calculerEnvois(etat, ete('2027-07-30 10:00')).aEnvoyer.map((prevu) => prevu.etape)).toEqual(['jour_j']);
  });
});

describe('calculerEnvois : annonces', () => {
  /** Une consentante confirmée de longue date, rattachée à aucune date de l'été. */
  function consentante(changes: Partial<EmailsATraiter> = {}) {
    return donnees({
      destinataires: [destinataire({ confirme_le: iso('2027-07-01 09:00'), annonces: true })],
      envois: [envoi('bienvenue', null, iso('2027-07-01 09:00'))],
      ...changes,
    });
  }

  it('le 20/07 à 10:00, une seule annonce regroupe Marsillargues et Sommières (même semaine), triées par date', () => {
    const { aEnvoyer, sautes } = calculerEnvois(consentante(), ete('2027-07-20 10:00'));
    expect(sautes).toEqual([]);
    expect(aEnvoyer).toEqual([
      { destinataireId: CAMILLE, etape: 'annonce', calendrierIds: [MARSILLARGUES, SOMMIERES], prevuLe: iso('2027-07-20 10:00') },
    ]);
  });

  it('le 26/07 (J-10 de Bezouce), rien, car moins de 7 jours ; le 27/07, une annonce de Bezouce seule', () => {
    const etat = consentante();
    expect(simuler(etat, '2027-07-20 09:00', '2027-08-04 12:00')).toEqual([
      '2027-07-20 10:00 · annonce Marsillargues+Sommières · part',
      '2027-07-27 10:00 · annonce Bezouce · part',
    ]);
    const avantLe27 = consentante({
      envois: [
        envoi('bienvenue', null, iso('2027-07-01 09:00')),
        envoi('annonce', MARSILLARGUES, iso('2027-07-20 10:00')),
        envoi('annonce', SOMMIERES, iso('2027-07-20 10:00')),
      ],
    });
    expect(calculerEnvois(avantLe27, ete('2027-07-26 10:00'))).toEqual({ aEnvoyer: [], sautes: [] });
    expect(calculerEnvois(avantLe27, ete('2027-07-27 09:59')).aEnvoyer).toEqual([]);
    expect(calculerEnvois(avantLe27, ete('2027-07-27 10:00')).aEnvoyer.map((prevu) => prevu.calendrierIds)).toEqual([[BEZOUCE]]);
  });

  it('n’annonce ni une date rattachée, ni une prévisionnelle, ni une soirée suspendue, ni une date commencée', () => {
    const etat = consentante({
      dates: [bezouce({ date_soiree: '2027-08-06' }), beziers({ statut: 'previsionnelle' }), leCres({ soiree: { slug: 'le-cres-2027', statut: 'reportee' } })],
    });
    // Le 06/08 : Bezouce (déplacée) a commencé à 00:00, Béziers est prévisionnelle, la soirée du Crès est reportée.
    expect(calculerEnvois(etat, ete('2027-08-06 10:00'))).toEqual({ aEnvoyer: [], sautes: [] });
    etat.dates = [beziers({ statut: 'previsionnelle' }), leCres({ soiree: { slug: 'le-cres-2027', statut: 'publiee' } })];
    expect(calculerEnvois(etat, ete('2027-08-06 10:00')).aEnvoyer.map((prevu) => prevu.calendrierIds)).toEqual([[LE_CRES]]);
    etat.rattachements = [rattachement(LE_CRES, '2027-08-01 12:00', { origine: 'je_viens' })];
    expect(calculerEnvois(etat, ete('2027-08-06 10:00')).aEnvoyer.filter((prevu) => prevu.etape === 'annonce')).toEqual([]);
  });

  it('sans consentement aux annonces, ou désinscrite, rien n’est annoncé', () => {
    const sansConsentement = consentante({ destinataires: [destinataire({ confirme_le: iso('2027-07-01 09:00') })] });
    expect(calculerEnvois(sansConsentement, ete('2027-07-20 10:00')).aEnvoyer).toEqual([]);
    const desinscrite = consentante({ destinataires: [destinataire({ confirme_le: iso('2027-07-01 09:00'), annonces: true, desinscrit: true })] });
    expect(calculerEnvois(desinscrite, ete('2027-07-20 10:00')).aEnvoyer).toEqual([]);
  });

  it('un modèle annonce inactif ou absent n’annonce rien', () => {
    const inactif = consentante({ modeles: modeles({ annonce: { actif: false } }) });
    expect(simuler(inactif, '2027-07-20 09:00', '2027-08-04 12:00')).toEqual([]);
    const absent = consentante({ modeles: modeles().filter((modele) => modele.cle !== 'annonce') });
    expect(simuler(absent, '2027-07-20 09:00', '2027-08-04 12:00')).toEqual([]);
  });
});

describe('calculerEnvois : plafond journalier', () => {
  /** Rattachée à Marsillargues depuis le 22/07 : bienvenue, J-7 et veille déjà partis. */
  function rattacheeMarsillargues(changes: Partial<Destinataire> = {}) {
    const etat = inscrit(MARSILLARGUES, '2027-07-22 12:00', changes);
    etat.envois.push(
      envoi('bienvenue', null, iso('2027-07-22 12:00')),
      envoi('j_moins_7', MARSILLARGUES, iso('2027-07-23 10:00')),
      envoi('veille', MARSILLARGUES, iso('2027-07-29 18:00')),
    );
    return etat;
  }

  it('le jour J du 30/07 et une annonce le même jour : le jour J part, l’annonce n’est ni envoyée ni sautée', () => {
    // Elle a cliqué sur la confirmation de son abonnement le 29/07 à 20:00 : les annonces sont dues.
    const etat = rattacheeMarsillargues({ annonces: true });
    const { aEnvoyer, sautes } = calculerEnvois(etat, ete('2027-07-30 10:00'));
    expect(aEnvoyer).toEqual([
      { destinataireId: CAMILLE, etape: 'jour_j', calendrierIds: [MARSILLARGUES], prevuLe: iso('2027-07-30 10:00') },
    ]);
    expect(sautes).toEqual([]);
  });

  it('l’annonce reportée part le premier jour libre, à son heure (10:00), jamais à l’aube', () => {
    const etat = rattacheeMarsillargues({ annonces: true });
    expect(simuler(etat, '2027-07-29 20:00', '2027-08-02 12:00')).toEqual([
      '2027-07-30 10:00 · jour_j Marsillargues · part',
      '2027-07-31 10:00 · lendemain Marsillargues · part',
      // Sommières a commencé le 31/07 à 00:00 : elle n'est plus annoncée.
      '2027-08-01 10:00 · annonce Bezouce · part',
    ]);
  });

  it('calendrier dense (30/07 et 31/07) : la date la plus proche passe avant, puis le lendemain', () => {
    const etat = inscrit(MARSILLARGUES, '2027-07-22 12:00');
    etat.rattachements.push(rattachement(SOMMIERES, '2027-07-22 12:30', { origine: 'je_viens' }));
    expect(simuler(etat, '2027-07-22 12:00', '2027-08-02 12:00')).toEqual([
      '2027-07-22 12:00 · bienvenue · part',
      '2027-07-23 10:00 · j_moins_7 Marsillargues · part',
      '2027-07-24 10:00 · j_moins_7 Sommières · part',
      '2027-07-29 18:00 · veille Marsillargues · part',
      '2027-07-30 10:00 · jour_j Marsillargues · part',
      '2027-07-30 18:00 · veille Sommières · plafond_jour',
      '2027-07-31 10:00 · jour_j Sommières · part',
      '2027-07-31 10:00 · lendemain Marsillargues · plafond_jour',
      '2027-08-01 10:00 · lendemain Sommières · part',
    ]);
  });

  it('prochaines dates : un seul e-mail pour deux dates rattachées, le second est sauté (prochaines_dates_recent)', () => {
    const etat = inscrit(MARSILLARGUES, '2027-07-22 12:00', { annonces: true });
    etat.rattachements.push(rattachement(SOMMIERES, '2027-07-22 12:30', { origine: 'je_viens' }));
    etat.prochaines = [beziers({ statut: 'confirmee' })];
    const journal = simuler(etat, '2027-07-22 12:00', '2027-08-08 12:00');
    expect(journal.filter((ligne) => ligne.includes('prochaines_dates'))).toEqual([
      '2027-08-06 10:00 · prochaines_dates Marsillargues · part',
      '2027-08-07 10:00 · prochaines_dates Sommières · prochaines_dates_recent',
    ]);
  });

  it('prochaines dates : 7 jours glissants, comptés sur les envois envoye, simule et en_attente', () => {
    // Rattachée à Sommières seule : ses prochaines dates sont dues le 07/08 à 10:00.
    const etat = inscrit(SOMMIERES, '2027-07-22 12:00', { annonces: true });
    etat.prochaines = [beziers({ statut: 'confirmee' })];
    const historique = (['bienvenue', 'j_moins_7', 'veille', 'jour_j', 'lendemain'] as const).map((etape) => (
      envoi(etape, etape === 'bienvenue' ? null : SOMMIERES, iso('2027-07-22 12:00'))
    ));
    const avec = (ligne: Envoi) => ({ ...etat, envois: [...historique, ligne] });
    const precedent = (prevuLe: string, changes: Partial<Envoi> = {}) => envoi('prochaines_dates', MARSILLARGUES, iso(prevuLe), changes);
    const issue = (ligne: Envoi) => {
      const { aEnvoyer, sautes } = calculerEnvois(avec(ligne), ete('2027-08-07 10:00'));
      return [...aEnvoyer, ...sautes].map(decrireCourt);
    };
    expect(issue(precedent('2027-07-31 10:15'))).toEqual(['prochaines_dates Sommières prochaines_dates_recent']);
    expect(issue(precedent('2027-07-31 10:00'))).toEqual(['prochaines_dates Sommières']);
    for (const statut of ['simule', 'en_attente'] as const) {
      expect(issue(precedent('2027-08-06 10:00', { statut }))).toEqual(['prochaines_dates Sommières prochaines_dates_recent']);
    }
    for (const statut of ['echec', 'saute'] as const) {
      expect(issue(precedent('2027-08-06 10:00', { statut }))).toEqual(['prochaines_dates Sommières']);
    }
  });

  it('une étape due attend une étape plus prioritaire prévue plus tard le même jour', () => {
    const etat = rattacheeMarsillargues();
    etat.envois = etat.envois.filter((ligne) => ligne.etape !== 'veille');
    etat.rattachements.push(rattachement(BEZOUCE, '2027-07-22 12:30', { origine: 'je_viens' }));
    // Le 29/07 à 10:00, le J-7 de Bezouce est dû, mais la veille de Marsillargues (date plus proche) tombe à 18:00.
    expect(calculerEnvois(etat, ete('2027-07-29 10:00'))).toEqual({ aEnvoyer: [], sautes: [] });
    expect(simuler(etat, '2027-07-29 09:00', '2027-07-29 23:45')).toEqual([
      '2027-07-29 18:00 · veille Marsillargues · part',
      '2027-07-29 18:00 · j_moins_7 Bezouce · plafond_jour',
    ]);
    // Sans veille active, rien n'est attendu : le J-7 de Bezouce part à son heure.
    const sansVeille = rattacheeMarsillargues();
    sansVeille.envois = sansVeille.envois.filter((ligne) => ligne.etape !== 'veille');
    sansVeille.rattachements.push(rattachement(BEZOUCE, '2027-07-22 12:30', { origine: 'je_viens' }));
    sansVeille.modeles = modeles({ veille: { actif: false } });
    expect(calculerEnvois(sansVeille, ete('2027-07-29 10:00')).aEnvoyer.map(decrireCourt)).toEqual(['j_moins_7 Bezouce']);
  });

  it('l’annonce passe avant les prochaines dates, sautées (plafond_jour)', () => {
    // Le 06/08 à 10:00 : J+7 de Marsillargues et J-10 du Crès.
    const etat = rattacheeMarsillargues({ annonces: true });
    etat.envois.push(envoi('jour_j', MARSILLARGUES, iso('2027-07-30 10:00')), envoi('lendemain', MARSILLARGUES, iso('2027-07-31 10:00')));
    etat.dates = [marsillargues(), leCres()];
    etat.prochaines = [leCres()];
    const { aEnvoyer, sautes } = calculerEnvois(etat, ete('2027-08-06 10:00'));
    expect(aEnvoyer.map(decrireCourt)).toEqual(['annonce Le Crès']);
    expect(sautes.map(decrireCourt)).toEqual(['prochaines_dates Marsillargues plafond_jour']);
  });

  it('comptent les envois envoye, simule et en_attente du jour, hors confirmation et message', () => {
    const etat = rattacheeMarsillargues();
    const avec = (ligne: Envoi) => ({ ...etat, envois: [...etat.envois, ligne] });
    const autre = (changes: Partial<Envoi>) => envoi('lendemain', BEZOUCE, iso('2027-07-30 08:00'), changes);
    for (const statut of ['envoye', 'simule', 'en_attente'] as const) {
      expect(calculerEnvois(avec(autre({ statut })), ete('2027-07-30 10:00')).sautes.map(decrireCourt))
        .toEqual(['jour_j Marsillargues plafond_jour']);
    }
    for (const ligne of [autre({ statut: 'echec' }), autre({ statut: 'saute' }), envoi('confirmation', null, iso('2027-07-30 08:00')),
      envoi('message', null, iso('2027-07-30 08:00'))]) {
      expect(calculerEnvois(avec(ligne), ete('2027-07-30 10:00')).aEnvoyer.map(decrireCourt)).toEqual(['jour_j Marsillargues']);
    }
  });
});

function decrireCourt(prevu: EnvoiPrevu) {
  return [prevu.etape, prevu.calendrierIds.map((id) => VILLES[id] ?? id).join('+'), prevu.raison].filter(Boolean).join(' ');
}

describe('calculerEnvois : confirmation, bienvenue et cas limites', () => {
  it('confirmation puis bienvenue : la bienvenue n’existe pas tant que confirme_le est nul', () => {
    const abonne = destinataire({ abonnement_a_confirmer: true });
    const avant = donnees({ destinataires: [abonne] });
    expect(calculerEnvois(avant, ete('2027-07-20 15:00'))).toEqual({
      aEnvoyer: [{ destinataireId: CAMILLE, etape: 'confirmation', calendrierIds: [], prevuLe: iso('2027-07-20 15:00') }],
      sautes: [],
    });
    avant.envois.push(envoi('confirmation', null, iso('2027-07-20 15:00')));
    expect(calculerEnvois(avant, ete('2027-07-20 15:15'))).toEqual({ aEnvoyer: [], sautes: [] });

    // Le clic : confirmée, consentante, rattachée à la prochaine date confirmée.
    const apres = donnees({
      destinataires: [{ ...abonne, abonnement_a_confirmer: false, annonces: true, confirme_le: iso('2027-07-20 15:30') }],
      rattachements: [rattachement(MARSILLARGUES, '2027-07-20 15:30')],
      envois: avant.envois,
    });
    expect(calculerEnvois(apres, ete('2027-07-20 15:31'))).toEqual({
      aEnvoyer: [{
        destinataireId: CAMILLE, etape: 'bienvenue', calendrierIds: [], prevuLe: ete('2027-07-20 15:31').toISOString(), encartDateProche: false,
      }],
      sautes: [],
    });
  });

  it('une adresse désinscrite qui se réabonne reçoit sa confirmation, et rien d’autre', () => {
    const etat = donnees({
      destinataires: [destinataire({
        abonnement_a_confirmer: true, desinscrit: true, annonces: true, confirme_le: iso('2027-07-01 09:00'),
      })],
      rattachements: [rattachement(MARSILLARGUES, '2027-07-01 09:00')],
    });
    expect(calculerEnvois(etat, ete('2027-07-30 10:00')).aEnvoyer.map(decrireCourt)).toEqual(['confirmation']);
    expect(calculerEnvois(etat, ete('2027-07-30 10:00')).sautes).toEqual([]);
  });

  it('un modèle inactif ou absent ne produit rien', () => {
    const etat = inscrit(MARSILLARGUES, '2027-07-22 12:00');
    etat.envois.push(envoi('bienvenue', null, iso('2027-07-22 12:00')));
    expect(calculerEnvois(etat, ete('2027-07-30 10:00')).aEnvoyer.map(decrireCourt)).toEqual(['jour_j Marsillargues']);
    // La veille, jamais réservée, est hors fenêtre au 30/07 ; le J-7 (23/07), au-delà de l'horizon de 48 h
    // d'un rattachement ancien, n'est plus examiné du tout.
    expect(calculerEnvois(etat, ete('2027-07-30 10:00')).sautes.map(decrireCourt))
      .toEqual(['veille Marsillargues fenetre_depassee']);
    const inactifs = { ...etat, modeles: modeles({ j_moins_7: { actif: false }, veille: { actif: false }, jour_j: { actif: false } }) };
    expect(calculerEnvois(inactifs, ete('2027-07-30 10:00'))).toEqual({ aEnvoyer: [], sautes: [] });
    const absents = { ...etat, modeles: modeles().filter((modele) => !['j_moins_7', 'veille', 'jour_j'].includes(modele.cle)) };
    expect(calculerEnvois(absents, ete('2027-07-30 10:00'))).toEqual({ aEnvoyer: [], sautes: [] });

    const abonne = donnees({ destinataires: [destinataire({ abonnement_a_confirmer: true })] });
    expect(calculerEnvois({ ...abonne, modeles: modeles().filter((modele) => modele.cle !== 'confirmation') }, ete('2027-07-20 15:00')))
      .toEqual({ aEnvoyer: [], sautes: [] });
    const bienvenue = inscrit(MARSILLARGUES, '2027-07-22 12:00');
    expect(calculerEnvois({ ...bienvenue, modeles: modeles({ bienvenue: { actif: false } }) }, ete('2027-07-22 12:00')))
      .toEqual({ aEnvoyer: [], sautes: [] });
  });

  it('fenêtre de 12 h : à échéance + 12 h l’étape part encore, à + 13 h elle est sautée (fenetre_depassee)', () => {
    const etat = inscrit(MARSILLARGUES, '2027-07-22 12:00');
    etat.envois.push(
      envoi('bienvenue', null, iso('2027-07-22 12:00')),
      envoi('j_moins_7', MARSILLARGUES, iso('2027-07-23 10:00')),
      envoi('veille', MARSILLARGUES, iso('2027-07-29 18:00')),
    );
    expect(calculerEnvois(etat, ete('2027-07-30 22:00')).aEnvoyer.map(decrireCourt)).toEqual(['jour_j Marsillargues']);
    expect(calculerEnvois(etat, ete('2027-07-30 23:00'))).toEqual({
      aEnvoyer: [],
      sautes: [{
        destinataireId: CAMILLE, etape: 'jour_j', calendrierIds: [MARSILLARGUES], prevuLe: iso('2027-07-30 10:00'), raison: 'fenetre_depassee',
      }],
    });
    // La bienvenue suit la même fenêtre, comptée depuis confirme_le.
    expect(calculerEnvois(inscrit(MARSILLARGUES, '2027-07-22 12:00'), ete('2027-07-23 01:00')).sautes.map(decrireCourt))
      .toEqual(['bienvenue fenetre_depassee']);
  });

  it('prochaines dates : rien sans consentement, « aucune_date » sans date à venir', () => {
    const etat = inscrit(MARSILLARGUES, '2027-07-22 12:00');
    etat.envois.push(...(['bienvenue', 'j_moins_7', 'veille', 'jour_j', 'lendemain'] as const).map((etape) => (
      envoi(etape, etape === 'bienvenue' ? null : MARSILLARGUES, iso('2027-07-22 12:00'))
    )));
    expect(calculerEnvois(etat, ete('2027-08-06 10:00'))).toEqual({ aEnvoyer: [], sautes: [] });
    etat.destinataires = [{ ...etat.destinataires[0], annonces: true }];
    expect(calculerEnvois(etat, ete('2027-08-06 10:00')).sautes.map(decrireCourt)).toEqual(['prochaines_dates Marsillargues aucune_date']);
    etat.prochaines = [beziers({ statut: 'confirmee' })];
    expect(calculerEnvois(etat, ete('2027-08-06 10:00')).aEnvoyer.map(decrireCourt)).toEqual(['prochaines_dates Marsillargues']);
  });

  it('un envoi existant bloque l’étape, quel que soit son statut', () => {
    for (const statut of ['en_attente', 'envoye', 'simule', 'echec', 'saute'] as const) {
      const etat = inscrit(MARSILLARGUES, '2027-07-22 12:00');
      etat.envois.push(envoi('bienvenue', null, iso('2027-07-22 12:00')), envoi('j_moins_7', MARSILLARGUES, iso('2027-07-23 10:00'), { statut }));
      expect(calculerEnvois(etat, ete('2027-07-23 10:00'))).toEqual({ aEnvoyer: [], sautes: [] });
    }
  });

  it('heure d’hiver : la veille d’une date du 31/10 part le 30/10 à 18:00 de Paris (16:00 UTC)', () => {
    const toussaint = dateCalendrier({ id: 'cal-toussaint', ville: 'Arles', date_soiree: '2027-10-31' });
    const etat = donnees({
      dates: [toussaint],
      destinataires: [destinataire({ confirme_le: '2027-10-01T08:00:00.000Z' })],
      rattachements: [rattachement('cal-toussaint', '2027-10-01 10:00')],
      envois: [envoi('bienvenue', null, '2027-10-01T08:00:00.000Z'), envoi('j_moins_7', 'cal-toussaint', '2027-10-24T08:00:00.000Z')],
    });
    expect(calculerEnvois(etat, new Date('2027-10-30T15:59:00Z')).aEnvoyer).toEqual([]);
    expect(calculerEnvois(etat, new Date('2027-10-30T16:00:00Z')).aEnvoyer.map((prevu) => prevu.prevuLe)).toEqual(['2027-10-30T16:00:00.000Z']);
  });
});

describe('dateDeBienvenue', () => {
  it('donne la date rattachée à l’inscription ; encart de 0 à 7 jours (Paris) après confirme_le, date confirmée', () => {
    const pour = (confirmeLe: string, changes: Partial<DateEnrichie> = {}) => dateDeBienvenue(
      { dates: [marsillargues(changes)], rattachements: [rattachement(MARSILLARGUES, confirmeLe)] },
      { id: CAMILLE, confirme_le: iso(confirmeLe) },
    );
    expect(pour('2027-07-22 23:59')).toEqual({ date: marsillargues(), encartDateProche: false });
    // Avant 06:00, l'instant compte encore pour la veille : le 23/07 à 05:59 est à 8 jours.
    expect(pour('2027-07-23 05:59').encartDateProche).toBe(false);
    expect(pour('2027-07-23 06:00').encartDateProche).toBe(true);
    expect(pour('2027-07-30 21:00').encartDateProche).toBe(true);
    expect(pour('2027-07-31 05:59').encartDateProche).toBe(true);
    expect(pour('2027-07-31 06:00').encartDateProche).toBe(false);
    // Une date annulée ou repassée en prévisionnelle n'est jamais citée.
    expect(pour('2027-07-27 20:00', { statut: 'annulee' })).toEqual({ date: null, encartDateProche: false });
    expect(pour('2027-07-27 20:00', { statut: 'previsionnelle' })).toEqual({ date: null, encartDateProche: false });
    // Soirée liée annulée ou reportée : la date n'est plus citée (mineur différé T3), même confirmée.
    for (const statut of ['annulee', 'reportee'] as const) {
      expect(pour('2027-07-27 20:00', { soiree: { slug: 'm', statut } })).toEqual({ date: null, encartDateProche: false });
    }
    expect(pour('2027-07-27 20:00', { soiree: { slug: 'm', statut: 'publiee' } }).date).not.toBeNull();
  });

  it('date lointaine renvoyée par la RPC pour la bienvenue (au-delà de J+17) : citée si confirmée, rien d’autre ne part', () => {
    // Confirmée le 01/07, rattachée à Marsillargues (30/07, J+29).
    const etat = inscrit(MARSILLARGUES, '2027-07-01 10:00');
    etat.dates = [marsillargues()];
    expect(calculerEnvois(etat, ete('2027-07-01 10:00'))).toEqual({
      aEnvoyer: [{ destinataireId: CAMILLE, etape: 'bienvenue', calendrierIds: [], prevuLe: iso('2027-07-01 10:00'), encartDateProche: false }],
      sautes: [],
    });
    expect(dateDeBienvenue(etat, etat.destinataires[0])).toEqual({ date: marsillargues(), encartDateProche: false });
    for (const statut of ['annulee', 'previsionnelle'] as const) {
      etat.dates = [marsillargues({ statut })];
      expect(dateDeBienvenue(etat, etat.destinataires[0])).toEqual({ date: null, encartDateProche: false });
      expect(calculerEnvois(etat, ete('2027-07-01 10:00')).aEnvoyer.map(decrireCourt)).toEqual(['bienvenue']);
    }
  });

  it('sans rattachement d’inscription (« Je viens », première confirmation) : pas de date, pas d’encart', () => {
    expect(dateDeBienvenue(
      { dates: [marsillargues()], rattachements: [rattachement(MARSILLARGUES, '2027-07-27 20:00', { origine: 'premiere_confirmation' })] },
      { id: CAMILLE, confirme_le: iso('2027-07-27 20:00') },
    )).toEqual({ date: null, encartDateProche: false });
  });
});

describe('envoisAVenir', () => {
  const lignesCalendrier = () => [marsillargues(), sommieres(), bezouce()].map(({ id, date_soiree, statut }) => ({ id, date_soiree, statut }));

  it('liste les envois datés des 7 prochains jours avec le nombre de rattachés, sans plafonds', () => {
    expect(envoisAVenir(modeles(), lignesCalendrier(), { [MARSILLARGUES]: 132, [SOMMIERES]: 40 }, ete('2027-07-22 12:00'))).toEqual([
      { etape: 'j_moins_7', calendrierId: MARSILLARGUES, prevuLe: iso('2027-07-23 10:00'), destinataires: 132 },
      { etape: 'j_moins_7', calendrierId: SOMMIERES, prevuLe: iso('2027-07-24 10:00'), destinataires: 40 },
      { etape: 'j_moins_7', calendrierId: BEZOUCE, prevuLe: iso('2027-07-29 10:00'), destinataires: 0 },
    ]);
    expect(envoisAVenir(modeles(), lignesCalendrier(), {}, ete('2027-07-29 12:00'), 2).map((prevu) => `${prevu.etape} ${VILLES[prevu.calendrierId]}`))
      .toEqual(['veille Marsillargues', 'jour_j Marsillargues', 'veille Sommières', 'jour_j Sommières', 'lendemain Marsillargues']);
  });

  it('ignore les modèles inactifs, et les étapes 2 à 5 d’une date annulée ou prévisionnelle', () => {
    const dates = [
      { id: MARSILLARGUES, date_soiree: '2027-07-30', statut: 'annulee' as const },
      { id: SOMMIERES, date_soiree: '2027-07-31', statut: 'previsionnelle' as const },
    ];
    expect(envoisAVenir(modeles(), dates, { [MARSILLARGUES]: 10, [SOMMIERES]: 5 }, ete('2027-07-29 12:00'), 10)).toEqual([
      { etape: 'prochaines_dates', calendrierId: MARSILLARGUES, prevuLe: iso('2027-08-06 10:00'), destinataires: 10 },
      { etape: 'prochaines_dates', calendrierId: SOMMIERES, prevuLe: iso('2027-08-07 10:00'), destinataires: 5 },
    ]);
    expect(envoisAVenir(modeles({ prochaines_dates: { actif: false } }), dates, {}, ete('2027-07-29 12:00'), 10)).toEqual([]);
  });
});

describe('vague finale : horizons, interrompus et forme compacte de la RPC', () => {
  it('une étape passée depuis plus de 48 h n’est plus examinée, sauf pour un rattachement de moins de 48 h', () => {
    // Rattachée le 22/07 : au 30/07, le J-7 (23/07) est oublié ; la veille (29/07 18:00, il y a 16 h) est sautée.
    const ancienne = inscrit(MARSILLARGUES, '2027-07-22 12:00');
    ancienne.envois.push(envoi('bienvenue', null, iso('2027-07-22 12:00')));
    expect(calculerEnvois(ancienne, ete('2027-07-30 10:00')).sautes.map(decrireCourt)).toEqual(['veille Marsillargues fenetre_depassee']);
    // « Je viens » le 30/07 à 09:00 : toutes les étapes déjà passées sont enregistrées, une fois.
    const recente = inscrit(MARSILLARGUES, '2027-07-22 12:00');
    recente.envois.push(envoi('bienvenue', null, iso('2027-07-22 12:00')));
    recente.rattachements = [rattachement(MARSILLARGUES, '2027-07-30 09:00', { origine: 'je_viens' })];
    expect(calculerEnvois(recente, ete('2027-07-30 10:00')).sautes.map(decrireCourt))
      .toEqual(['j_moins_7 Marsillargues deja_passe_a_l_inscription', 'veille Marsillargues deja_passe_a_l_inscription']);
  });

  it('la bienvenue n’est examinée que dans les 24 h qui suivent la confirmation', () => {
    const etat = inscrit(MARSILLARGUES, '2027-07-22 12:00');
    expect(calculerEnvois(etat, ete('2027-07-23 11:59')).sautes.map(decrireCourt)).toContain('bienvenue fenetre_depassee');
    expect(calculerEnvois(etat, ete('2027-07-23 12:01')).sautes.map(decrireCourt)).not.toContain('bienvenue fenetre_depassee');
  });

  it('un envoi interrompu (peut-être parti) occupe le plafond du jour (mineur T5)', () => {
    const etat = inscrit(MARSILLARGUES, '2027-07-22 12:00');
    etat.envois.push(
      envoi('bienvenue', null, iso('2027-07-22 12:00')),
      envoi('j_moins_7', MARSILLARGUES, iso('2027-07-23 10:00')),
      envoi('veille', MARSILLARGUES, iso('2027-07-29 18:00')),
      envoi('lendemain', BEZOUCE, iso('2027-07-30 08:00'), { statut: 'echec', raison: 'interrompu' }),
    );
    expect(calculerEnvois(etat, ete('2027-07-30 10:00')).sautes.map(decrireCourt)).toEqual(['jour_j Marsillargues plafond_jour']);
    etat.envois[3] = { ...etat.envois[3], raison: 'envoi_impossible' };
    expect(calculerEnvois(etat, ete('2027-07-30 10:00')).aEnvoyer.map(decrireCourt)).toEqual(['jour_j Marsillargues']);
  });

  it('lireEmailsATraiter : une ligne par personne, dates citées par leur position, horodatages en millisecondes', () => {
    const dates = [marsillargues(), sommieres()];
    const brut = {
      modeles: modeles(), dates, prochaines: [],
      destinataires: [
        [CAMILLE, true, false, true, Date.parse('2027-07-01T08:00:00Z'),
          [[0, 'inscription', Date.parse('2027-07-01T08:00:00Z')], [1, 'je_viens', Date.parse('2027-07-02T08:00:00Z')]],
          [['veille', 0, 'envoye', null, Date.parse('2027-07-29T16:00:00Z')], ['annonce', 'cal-hors-dates', 'saute', 'plafond_jour', 0],
            ['bienvenue', null, 'simule', null, Date.parse('2027-07-01T08:05:00Z')]]],
        ['dest-sans-date', false, true, false, null, [], []],
      ],
    };
    expect(lireEmailsATraiter(brut)).toEqual({
      modeles: brut.modeles, dates, prochaines: [],
      destinataires: [
        { id: CAMILLE, abonnement_a_confirmer: true, desinscrit: false, annonces: true, confirme_le: '2027-07-01T08:00:00.000Z' },
        { id: 'dest-sans-date', abonnement_a_confirmer: false, desinscrit: true, annonces: false, confirme_le: null },
      ],
      rattachements: [
        { destinataire_id: CAMILLE, calendrier_id: MARSILLARGUES, origine: 'inscription', cree_le: '2027-07-01T08:00:00.000Z' },
        { destinataire_id: CAMILLE, calendrier_id: SOMMIERES, origine: 'je_viens', cree_le: '2027-07-02T08:00:00.000Z' },
      ],
      envois: [
        { destinataire_id: CAMILLE, etape: 'veille', calendrier_id: MARSILLARGUES, statut: 'envoye', raison: null, prevu_le: '2027-07-29T16:00:00.000Z' },
        { destinataire_id: CAMILLE, etape: 'annonce', calendrier_id: 'cal-hors-dates', statut: 'saute', raison: 'plafond_jour', prevu_le: '1970-01-01T00:00:00.000Z' },
        { destinataire_id: CAMILLE, etape: 'bienvenue', calendrier_id: null, statut: 'simule', raison: null, prevu_le: '2027-07-01T08:05:00.000Z' },
      ],
    });
    for (const invalide of [
      null, [], { ...brut, destinataires: undefined }, { ...brut, destinataires: [[CAMILLE, true]] },
      { ...brut, destinataires: [[CAMILLE, true, false, true, null, [[5, 'inscription', 0]], []]] },
      { ...brut, destinataires: [[CAMILLE, true, false, true, 'hier', [], []]] },
    ]) {
      expect(() => lireEmailsATraiter(invalide)).toThrow('réponse RPC invalide');
    }
  });
});

describe('fix 2 : sauts pour une ancienne échéance (mineur n° 6)', () => {
  const camille = destinataire({ confirme_le: iso('2027-06-01 10:00') });
  const suit = [rattachement(MARSILLARGUES, '2027-06-01 10:00')];

  it('un saut enregistré pour une autre échéance est tenu pour absent ; sautsPerimes dit lequel supprimer', () => {
    // La veille passe de 18:00 à 19:00 après un saut « plafond_jour » enregistré à 18:00.
    const etat = donnees({
      modeles: modeles({ veille: { heure_envoi: '19:00:00' } }),
      destinataires: [camille],
      rattachements: suit,
      envois: [envoi('veille', MARSILLARGUES, iso('2027-07-29 18:00'), { statut: 'saute', raison: 'plafond_jour' })],
    });
    const calcul = calculerEnvois(etat, ete('2027-07-29 19:05'));
    expect(calcul.aEnvoyer.map((e) => decrire(ete('2027-07-29 19:05'), e))).toEqual(['2027-07-29 19:05 · veille Marsillargues · part']);
    expect(calcul.aEnvoyer[0].prevuLe).toBe(iso('2027-07-29 19:00'));
    expect(sautsPerimes(etat, [...calcul.aEnvoyer, ...calcul.sautes])).toEqual([
      { etape: 'veille', calendrierId: MARSILLARGUES, prevuLe: iso('2027-07-29 19:00'), destinataireIds: [CAMILLE] },
    ]);
  });

  it('date reportée pendant un calcul : le J-7 sauté pour l’ancienne date ne bloque pas le nouveau', () => {
    // Marsillargues passe du 30/07 au 13/08 ; un saut du J-7 du 23/07 a été écrit après le passage du déclencheur.
    const etat = donnees({
      dates: [marsillargues({ date_soiree: '2027-08-13' })],
      destinataires: [camille],
      rattachements: suit,
      envois: [envoi('j_moins_7', MARSILLARGUES, iso('2027-07-23 10:00'), { statut: 'saute', raison: 'deja_passe_a_l_inscription' })],
    });
    const calcul = calculerEnvois(etat, ete('2027-08-06 10:05'));
    expect(calcul.aEnvoyer.map((e) => decrire(ete('2027-08-06 10:05'), e))).toEqual(['2027-08-06 10:05 · j_moins_7 Marsillargues · part']);
    expect(sautsPerimes(etat, calcul.aEnvoyer)).toHaveLength(1);
  });

  it('un saut à la bonne échéance, ou un envoi parti pour l’ancienne, compte toujours', () => {
    const aJour = donnees({
      destinataires: [camille],
      rattachements: suit,
      envois: [envoi('veille', MARSILLARGUES, iso('2027-07-29 18:00'), { statut: 'saute', raison: 'plafond_jour' })],
    });
    expect(calculerEnvois(aJour, ete('2027-07-29 18:05'))).toEqual({ aEnvoyer: [], sautes: [] });
    // Parti à 18:00, réglage passé à 19:00 ensuite : pas de second envoi.
    const parti = donnees({
      modeles: modeles({ veille: { heure_envoi: '19:00:00' } }),
      destinataires: [camille],
      rattachements: suit,
      envois: [envoi('veille', MARSILLARGUES, iso('2027-07-29 18:00'))],
    });
    const calcul = calculerEnvois(parti, ete('2027-07-29 19:05'));
    expect(calcul).toEqual({ aEnvoyer: [], sautes: [] });
    expect(sautsPerimes(parti, calcul.aEnvoyer)).toEqual([]);
  });
});
