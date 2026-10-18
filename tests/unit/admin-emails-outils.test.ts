import { describe, expect, it } from 'vitest';
import { MODELES_DEFAUT, rendreEmail } from '../../serveur/gabarits-emails.mjs';
import { lireEtatEmails, type DateCalendrier, type EtatEmails, type LigneBilan } from '../../app/composants/admin/emails/donnees';
import { OUTILS } from '../../app/composants/admin/emails/Insertion';
import { nouvelleCle } from '../../app/composants/admin/emails/MessageInscrits';
import {
  bandeauxEnvoi,
  decalerJour,
  heureSaisie,
  jourParisDe,
  heureValide,
  insererBouton,
  insererGras,
  insererLien,
  insererListe,
  insererTitre,
  insererVariable,
  raisonsDuBilan,
  instantEnClair,
  joursValides,
  libelleChoixJours,
  libelleOptionDate,
  messageAEcrire,
  preparerApercu,
  prochainEnvoiEnClair,
  quandEnClair,
  regrouperBilan,
  soireesSuspendues,
  variableDisponible,
  modelesUtilisant,
  datesPourEstimation,
} from '../../app/composants/admin/emails/outils';

const NB = '\u00a0';

const SOMMIERES: DateCalendrier = {
  id: 'sommieres', nom: 'Olympiade des Manades', ville: 'Sommières', arenes: 'Arènes Gilles Arnaud',
  date_soiree: '2027-07-31', heure: '21:30:00', statut: 'confirmee', lien_billetterie: null,
  infos_pratiques: null, soiree_id: null, soiree: null,
};
const BEZOUCE: DateCalendrier = {
  ...SOMMIERES, id: 'bezouce', ville: 'Bezouce', arenes: null, date_soiree: '2027-08-05', heure: null,
};
const LE_CRES: DateCalendrier = {
  ...SOMMIERES, id: 'le-cres', ville: 'Le Crès', arenes: null, date_soiree: '2027-08-16', heure: null,
};
const MAINTENANT = new Date('2026-10-17T08:00:00Z');
const ORIGINE = 'https://olympiadedesmanades.fr';

describe('quand en clair', () => {
  it('dit les échéances par défaut comme l’organisateur les dirait', () => {
    const quand = (cle: keyof typeof MODELES_DEFAUT) => quandEnClair(cle, MODELES_DEFAUT[cle].jours_decalage, MODELES_DEFAUT[cle].heure_envoi);
    expect(quand('j_moins_7')).toBe('7 jours avant, à 10 h');
    expect(quand('veille')).toBe('La veille, à 18 h');
    expect(quand('jour_j')).toBe('Le jour même, à 10 h');
    expect(quand('lendemain')).toBe('Le lendemain, à 10 h');
    expect(quand('prochaines_dates')).toBe('7 jours après, à 10 h');
    expect(quand('annonce')).toBe('10 jours avant chaque autre date, à 10 h');
    expect(quand('confirmation')).toMatch(/^Dès le dépôt/);
    expect(quand('message')).toMatch(/onglet Dates/);
  });

  it('libelle les choix du jour d’envoi sans tournure bancale', () => {
    expect(libelleChoixJours(-7, false)).toBe('7 jours avant la date');
    expect(libelleChoixJours(-1, false)).toBe('La veille de la date');
    expect(libelleChoixJours(0, false)).toBe('Le jour même');
    expect(libelleChoixJours(1, false)).toBe('Le lendemain de la date');
    expect(libelleChoixJours(7, false)).toBe('7 jours après la date');
    expect(libelleChoixJours(-10, true)).toBe('10 jours avant chaque autre date');
    expect(libelleChoixJours(0, true)).toBe('Le jour même de chaque autre date');
    expect(quandEnClair('annonce', -1, '09:00')).toBe('La veille de chaque autre date, à 9 h');
  });

  it('lit les heures de la base, avec ou sans secondes', () => {
    expect(quandEnClair('veille', -1, '18:30:00')).toBe('La veille, à 18 h 30');
    expect(quandEnClair('j_moins_7', -2, '07:05')).toBe('2 jours avant, à 7 h 05');
    expect(heureSaisie('18:30:00')).toBe('18:30');
    expect(heureSaisie(null)).toBe('');
  });

  it('borne les réglages comme la base', () => {
    expect(joursValides(-14)).toBe(true);
    expect(joursValides(7)).toBe(true);
    expect(joursValides(-15)).toBe(false);
    expect(joursValides(8)).toBe(false);
    expect(joursValides(1.5)).toBe(false);
    expect(heureValide('07:00')).toBe(true);
    expect(heureValide('21:00')).toBe(true);
    expect(heureValide('06:59')).toBe(false);
    expect(heureValide('21:01')).toBe(false);
    expect(heureValide('')).toBe(false);
  });
});

describe('estimations et dates', () => {
  it('lit le jour de Paris et décale les jours avec le module partagé du serveur (fuseau-paris.mjs)', () => {
    // 22 h 30 UTC le 31/07 : déjà le 01/08 à Paris (été, UTC+2) ; 23 h 30 UTC le 31/12 : 01/01 (hiver, UTC+1).
    expect(jourParisDe(new Date('2027-07-31T22:30:00Z'))).toBe('2027-08-01');
    expect(jourParisDe(new Date('2027-12-31T23:30:00Z'))).toBe('2028-01-01');
    expect(jourParisDe(new Date('2027-12-31T22:30:00Z'))).toBe('2027-12-31');
    expect(decalerJour('2027-03-31', -8)).toBe('2027-03-23');
    expect(decalerJour('2027-12-28', 7)).toBe('2028-01-04');
    expect(() => decalerJour('2027-02-31', 1)).toThrow(RangeError);
  });

  it('écrit un instant à l’heure de Paris, été comme hiver', () => {
    expect(instantEnClair('2027-07-24T08:00:00Z')).toBe('sam. 24/07 à 10 h');
    expect(instantEnClair('2027-11-06T16:30:00Z')).toBe('sam. 06/11 à 17 h 30');
  });

  it('dit le prochain envoi comme une estimation, en nommant la date', () => {
    expect(prochainEnvoiEnClair({ etape: 'j_moins_7', calendrierId: 'sommieres', prevuLe: '2027-07-24T08:00:00Z', destinataires: 132 }, SOMMIERES))
      .toBe(`environ 132 inscrits de Sommières (sam.${NB}31/07), sam. 24/07 à 10 h`);
    expect(prochainEnvoiEnClair({ etape: 'veille', calendrierId: 'sommieres', prevuLe: '2027-07-30T16:00:00Z', destinataires: 1 }, SOMMIERES))
      .toBe(`environ 1 inscrit de Sommières (sam.${NB}31/07), ven. 30/07 à 18 h`);
    expect(prochainEnvoiEnClair({ etape: 'veille', calendrierId: 'sommieres', prevuLe: '2027-07-30T16:00:00Z', destinataires: 0 }, SOMMIERES))
      .toBe(`ven. 30/07 à 18 h, Sommières (sam.${NB}31/07)${NB}: aucun inscrit pour l’instant`);
    expect(prochainEnvoiEnClair({ etape: 'veille', calendrierId: 'x', prevuLe: '2027-07-30T16:00:00Z', destinataires: 2 }))
      .toBe('environ 2 inscrits de la date, ven. 30/07 à 18 h');
    expect(prochainEnvoiEnClair(undefined)).toBeNull();
  });

  it('suspend les étapes d’une date dont la soirée liée est annulée ou reportée', () => {
    const reportee = { ...SOMMIERES, soiree: { slug: 's', statut: 'reportee' as const } };
    expect(datesPourEstimation([reportee, BEZOUCE]).map((date) => date.statut)).toEqual(['annulee', 'confirmee']);
  });

  it('libelle une date du calendrier avec son statut, même illisible', () => {
    expect(libelleOptionDate(SOMMIERES)).toBe(`sam.${NB}31/07/2027 · Sommières`);
    expect(libelleOptionDate({ ...BEZOUCE, statut: 'previsionnelle' })).toBe(`jeu.${NB}05/08/2027 · Bezouce (prévisionnelle)`);
    expect(libelleOptionDate({ ...BEZOUCE, date_soiree: '2027-02-31' })).toBe('2027-02-31 · Bezouce');
  });

  it('repère une soirée liée annulée ou reportée sous une date confirmée', () => {
    const reportee = { ...SOMMIERES, soiree: { slug: 's', statut: 'reportee' as const } };
    const annulee = { ...BEZOUCE, statut: 'annulee' as const, soiree: { slug: 'b', statut: 'annulee' as const } };
    expect(soireesSuspendues([reportee, annulee, BEZOUCE], '2027-07-01').map((date) => date.id)).toEqual(['sommieres']);
    expect(soireesSuspendues([reportee], '2027-08-01')).toEqual([]);
  });

  it('regroupe le bilan par étape et par date', () => {
    const bilan: LigneBilan[] = [
      { etape: 'veille', calendrier_id: 'a', reel: true, statut: 'envoye', nombre: 10, dernier_envoi: '2027-07-30T16:00:00Z' },
      { etape: 'veille', calendrier_id: 'a', reel: false, statut: 'simule', nombre: 3, dernier_envoi: '2027-07-29T16:00:00Z' },
      { etape: 'veille', calendrier_id: 'a', reel: true, statut: 'saute', nombre: 2, dernier_envoi: null },
      { etape: 'confirmation', calendrier_id: null, reel: true, statut: 'echec', nombre: 1, dernier_envoi: '2027-07-01T08:00:00Z' },
      { etape: 'confirmation', calendrier_id: null, reel: true, statut: 'en_attente', nombre: 2, dernier_envoi: '2027-07-02T08:00:00Z' },
    ];
    expect(regrouperBilan(bilan)).toEqual([
      {
        etape: 'confirmation', calendrierId: null, envoye: 0, simule: 0, echec: 1, saute: 0, en_attente: 2,
        dernierEnvoi: null, derniereTentative: '2027-07-02T08:00:00Z',
      },
      {
        etape: 'veille', calendrierId: 'a', envoye: 10, simule: 3, echec: 0, saute: 2, en_attente: 0,
        dernierEnvoi: '2027-07-30T16:00:00Z', derniereTentative: null,
      },
    ]);
  });
});

describe('insertion de la syntaxe', () => {
  it('insère une variable au curseur, ou à la place de la sélection', () => {
    expect(insererVariable('Bonjour ,', 8, 8, 'prenom')).toEqual({ valeur: 'Bonjour {{prenom}},', debut: 18, fin: 18 });
    expect(insererVariable('Le X', 3, 4, 'date')).toEqual({ valeur: 'Le {{date}}', debut: 11, fin: 11 });
  });

  it('met en gras la sélection, ou un texte à remplacer', () => {
    expect(insererGras('un mot ici', 3, 6)).toEqual({ valeur: 'un **mot** ici', debut: 5, fin: 8 });
    const vide = insererGras('', 0, 0);
    expect(vide.valeur).toBe('**texte en gras**');
    expect(vide.valeur.slice(vide.debut, vide.fin)).toBe('texte en gras');
  });

  it('fait un lien de la sélection et sélectionne l’adresse à compléter', () => {
    const lien = insererLien('Voir le site', 5, 12);
    expect(lien.valeur).toBe('Voir [le site](https://)');
    expect(lien.valeur.slice(lien.debut, lien.fin)).toBe('https://');
    const vide = insererLien('', 0, 0);
    expect(vide.valeur).toBe('[texte du lien](https://)');
    expect(vide.valeur.slice(vide.debut, vide.fin)).toBe('texte du lien');
  });

  it('met en liste la ligne courante ou les lignes sélectionnées', () => {
    expect(insererListe('Intro\nHeure', 8, 8).valeur).toBe('Intro\n- Heure');
    expect(insererListe('A\nB\n- C', 0, 7).valeur).toBe('- A\n- B\n- C');
    expect(insererListe('', 0, 0)).toEqual({ valeur: '- ', debut: 2, fin: 2 });
  });

  it('pose un bouton seul sur sa ligne', () => {
    const bouton = insererBouton('Avant après', 5, 5);
    expect(bouton.valeur).toBe('Avant\n[[Texte du bouton|https://]]\n après');
    expect(bouton.valeur.slice(bouton.debut, bouton.fin)).toBe('Texte du bouton');
    const avecTexte = insererBouton('Je note', 0, 7);
    expect(avecTexte.valeur).toBe('[[Je note|https://]]');
    expect(avecTexte.valeur.slice(avecTexte.debut, avecTexte.fin)).toBe('https://');
  });

  it('nettoie les crochets qui casseraient la syntaxe', () => {
    expect(insererBouton('a [b|c]', 0, 7).valeur).toBe('[[a bc|https://]]');
    expect(insererLien('[x]', 0, 3).valeur).toBe('[x](https://)');
  });

  it('fait de la ligne courante le titre « # », sans doubler la marque (C-0.6)', () => {
    expect(insererTitre('Bonjour\nRendez-vous à Lunel\nSuite', 12)).toEqual({ valeur: 'Bonjour\n# Rendez-vous à Lunel\nSuite', debut: 29, fin: 29 });
    expect(insererTitre('# Déjà un titre', 3).valeur).toBe('# Déjà un titre');
    expect(insererTitre('- Une puce', 0).valeur).toBe('# Une puce');
    const vide = insererTitre('Intro\n\nFin', 6);
    expect(vide.valeur).toBe('Intro\n# Titre de l’email\nFin');
    expect(vide.valeur.slice(vide.debut, vide.fin)).toBe('Titre de l’email');
  });

  it('la barre propose le bouton Titre en premier', () => {
    expect(OUTILS.map((outil) => outil.libelle)).toEqual(['Titre', 'Gras', 'Lien', 'Liste', 'Bouton']);
  });
});

describe('bilan et état du serveur', () => {
  it('compte les raisons des envois sautés ou en échec à partir de la vue, sans les en attente', () => {
    const bilan: LigneBilan[] = [
      { etape: 'veille', calendrier_id: 'a', reel: true, statut: 'saute', raison: 'plafond_jour', nombre: 2, dernier_envoi: null },
      { etape: 'jour_j', calendrier_id: 'a', reel: true, statut: 'saute', raison: 'plafond_jour', nombre: 1, dernier_envoi: null },
      { etape: 'veille', calendrier_id: 'a', reel: true, statut: 'echec', raison: null, nombre: 1, dernier_envoi: '2027-07-01T08:00:00Z' },
      { etape: 'veille', calendrier_id: 'a', reel: true, statut: 'en_attente', raison: 'envoi_impossible', nombre: 4, dernier_envoi: null },
      { etape: 'annonce', calendrier_id: 'b', reel: true, statut: 'saute', raison: 'code_futur', nombre: 3, dernier_envoi: null },
      { etape: 'veille', calendrier_id: 'a', reel: true, statut: 'saute', raison: 'date_annulee', nombre: 5, dernier_envoi: null },
    ];
    expect(raisonsDuBilan(bilan)).toEqual([
      { raison: 'date_annulee', libelle: 'Date annulée', nombre: 5 },
      { raison: 'plafond_jour', libelle: 'Plafond d’un email automatique par jour atteint', nombre: 3 },
      { raison: 'code_futur', libelle: 'Raison non libellée (code_futur)', nombre: 3 },
      { raison: null, libelle: 'Autre raison (échec du serveur d’envoi après 3 essais…)', nombre: 1 },
    ]);
    expect(raisonsDuBilan([])).toEqual([]);
  });

  it('regroupe le bilan par étape et par date quelle que soit la raison', () => {
    const bilan: LigneBilan[] = [
      { etape: 'veille', calendrier_id: 'a', reel: true, statut: 'saute', raison: 'plafond_jour', nombre: 2, dernier_envoi: null },
      { etape: 'veille', calendrier_id: 'a', reel: true, statut: 'saute', raison: 'date_annulee', nombre: 3, dernier_envoi: null },
    ];
    expect(regrouperBilan(bilan)).toMatchObject([{ etape: 'veille', calendrierId: 'a', saute: 5 }]);
  });

  it('lit la réponse de l’état avec des valeurs prudentes pour un champ absent ou faux', () => {
    expect(lireEtatEmails(null)).toBeNull();
    expect(lireEtatEmails({ mode: 'log', pret: true, cleLiens: true, dernierPassage: null })).toEqual({
      mode: 'log', pret: true, raisonsInactif: [], cleLiens: true, barriereActive: false,
      dernierPassage: null, dernierBilan: null, derniereErreur: null,
    });
    expect(lireEtatEmails({
      mode: 'autre', pret: 'oui', raisonsInactif: ['barriere', 3], barriereActive: true, dernierPassage: 'pas une date',
      dernierBilan: { envoyes: 2, sautes: 'x' }, derniereErreur: { instant: '2027-07-01T08:00:00Z', message: 'Supabase injoignable' },
    })).toEqual({
      mode: 'off', pret: false, raisonsInactif: ['barriere'], cleLiens: false, barriereActive: true, dernierPassage: null,
      dernierBilan: { envoyes: 2 }, derniereErreur: { instant: '2027-07-01T08:00:00Z', message: 'Supabase injoignable' },
    });
  });

  const ETAT: EtatEmails = {
    mode: 'smtp', pret: true, raisonsInactif: [], cleLiens: true, barriereActive: false,
    dernierPassage: '2027-07-01T07:58:00Z', dernierBilan: null, derniereErreur: null,
  };
  const A_8H = new Date('2027-07-01T08:00:00Z');

  it('ne dit « les emails partent pour de vrai » que si le serveur est prêt en smtp', () => {
    expect(bandeauxEnvoi(ETAT, A_8H)).toEqual([]);
    const barriere = bandeauxEnvoi({ ...ETAT, pret: false, raisonsInactif: ['barriere', 'identite'], barriereActive: true }, A_8H);
    expect(barriere).toEqual([{
      titre: 'L’envoi réel est demandé, mais aucun email ne part.',
      lignes: [
        `Le site est encore privé (barrière d’accès)${NB}: aucun email réel ne part.`,
        `Identité de l’organisateur manquante${NB}: aucun email réel ne partira tant qu’elle n’est pas renseignée (Administration, Vitrine).`,
      ],
    }]);
    expect(bandeauxEnvoi({ ...ETAT, pret: false, raisonsInactif: [] }, A_8H)[0].lignes).toEqual([`Le serveur ne précise pas la raison${NB}: vérifiez sa configuration.`]);
    expect(bandeauxEnvoi({ ...ETAT, pret: false, raisonsInactif: ['nouveau_code'] }, A_8H)[0].lignes[0]).toContain('nouveau_code');
  });

  it('dit la simulation et signale une barrière active même en mode log', () => {
    const [bandeau] = bandeauxEnvoi({ ...ETAT, mode: 'log', barriereActive: true }, A_8H);
    expect(bandeau.titre).toBe('Aucun email ne part réellement.');
    expect(bandeau.lignes[0]).toContain('EMAILS_MODE=log');
    expect(bandeau.lignes[1]).toContain('barrière d’accès');
    expect(bandeauxEnvoi({ ...ETAT, mode: 'off', pret: false, raisonsInactif: ['mode_off'] }, A_8H)[0].lignes)
      .toEqual([`Envoi coupé (EMAILS_MODE=off)${NB}: rien n’est calculé ni envoyé.`]);
  });

  it('alerte sans passage réussi depuis plus de 10 minutes, avec la dernière erreur', () => {
    expect(bandeauxEnvoi({ ...ETAT, dernierPassage: '2027-07-01T07:50:00Z' }, A_8H)).toEqual([]);
    const [panne] = bandeauxEnvoi({
      ...ETAT, dernierPassage: '2027-07-01T07:49:00Z', derniereErreur: { instant: '2027-07-01T07:59:00Z', message: 'Supabase injoignable' },
    }, A_8H);
    expect(panne.titre).toBe('Le planificateur ne passe plus.');
    expect(panne.lignes[0]).toContain('il y a plus de 10 minutes');
    expect(panne.lignes[1]).toBe(`Dernière erreur, jeu. 01/07 à 9 h 59${NB}: Supabase injoignable`);
    // Juste après le démarrage, sans erreur : pas d'alerte ; avec une erreur : alerte.
    expect(bandeauxEnvoi({ ...ETAT, dernierPassage: null }, A_8H)).toEqual([]);
    expect(bandeauxEnvoi({ ...ETAT, dernierPassage: null, derniereErreur: { instant: '2027-07-01T07:59:00Z', message: 'x' } }, A_8H)[0].lignes[0])
      .toContain('depuis le démarrage du serveur');
    // Mode off ou planificateur arrêté : l'alerte de panne n'ajoute rien aux raisons déjà dites.
    expect(bandeauxEnvoi({ ...ETAT, mode: 'off', pret: false, raisonsInactif: ['mode_off'], dernierPassage: null }, A_8H)).toHaveLength(1);
  });
});

describe('message aux inscrits : clé d’idempotence', () => {
  it('tire un uuid v4 différent à chaque formulaire, même sans crypto.randomUUID', () => {
    const forme = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(nouvelleCle()).toMatch(forme);
    expect(nouvelleCle()).not.toBe(nouvelleCle());
    const original = crypto.randomUUID;
    try {
      // @ts-expect-error simulation d'un contexte non sécurisé
      crypto.randomUUID = undefined;
      expect(nouvelleCle()).toMatch(forme);
    } finally {
      crypto.randomUUID = original;
    }
  });
});

describe('variables disponibles selon l’email', () => {
  it('suit le contexte posé à l’envoi par le serveur', () => {
    expect(variableDisponible('confirmation', 'lien_confirmation')).toBe(true);
    expect(variableDisponible('bienvenue', 'lien_confirmation')).toBe(false);
    expect(variableDisponible('annonce', 'lien_je_viens')).toBe(true);
    expect(variableDisponible('annonce', 'dates_annoncees')).toBe(true);
    expect(variableDisponible('message', 'lien_je_viens')).toBe(false);
    expect(variableDisponible('prochaines_dates', 'dates_annoncees')).toBe(false);
  });

  it('ne donne le vainqueur qu’à un email parti après la soirée, selon son réglage', () => {
    expect(variableDisponible('lendemain', 'vainqueur', 1)).toBe(true);
    expect(variableDisponible('prochaines_dates', 'vainqueur', 7)).toBe(true);
    expect(variableDisponible('message', 'vainqueur')).toBe(true);
    // Réglé à J+1, la veille part après la soirée ; le lendemain avancé au jour même, avant.
    expect(variableDisponible('veille', 'vainqueur', 1)).toBe(true);
    expect(variableDisponible('lendemain', 'vainqueur', 0)).toBe(false);
    for (const cle of ['j_moins_7', 'veille', 'jour_j'] as const) expect(variableDisponible(cle, 'vainqueur', MODELES_DEFAUT[cle].jours_decalage)).toBe(false);
    // L'annonce porte sur une date à venir, la bienvenue et la confirmation sur aucune soirée passée.
    expect(variableDisponible('annonce', 'vainqueur', 3)).toBe(false);
    expect(variableDisponible('bienvenue', 'vainqueur')).toBe(false);
    expect(variableDisponible('lendemain', 'vainqueur')).toBe(false);
  });

  it('ne laisse à la confirmation que le prénom et les liens sans date', () => {
    expect(['prenom', 'lien_dates', 'lien_confirmation'].every((variable) => variableDisponible('confirmation', variable))).toBe(true);
    expect(['date', 'ville', 'infos_pratiques', 'lien_noter', 'prochaines_dates'].some((variable) => variableDisponible('confirmation', variable))).toBe(false);
    expect(variableDisponible('veille', 'infos_pratiques')).toBe(true);
  });

  it('nomme les modèles qui utilisent une variable', () => {
    const modeles = (['bienvenue', 'veille', 'jour_j', 'lendemain'] as const).map((cle) => ({ cle, ...MODELES_DEFAUT[cle] }));
    expect(modelesUtilisant(modeles, 'infos_pratiques')).toEqual(['Bienvenue', 'La veille', 'Le jour J']);
    expect(modelesUtilisant(modeles, 'truc')).toEqual([]);
  });
});

describe('message aux inscrits', () => {
  it('refuse le texte de départ tel quel, ou avec sa phrase à remplacer', () => {
    expect(messageAEcrire(MODELES_DEFAUT.message.corps)).toBe(true);
    expect(messageAEcrire(`${MODELES_DEFAUT.message.corps}\n\nPS : merci.`)).toBe(true);
    expect(messageAEcrire('Bonjour {{prenom}},\n\nLe parking change de place.')).toBe(false);
  });
});

describe('contexte de l’aperçu', () => {
  const base = {
    reglage: { jours_decalage: -7, heure_envoi: '10:00:00' },
    date: SOMMIERES, dates: [SOMMIERES, BEZOUCE], prenom: 'Camille', origine: ORIGINE,
    maintenant: MAINTENANT, exemples: false, encart: true,
  };

  it('se place à l’échéance de l’étape pour la date choisie', () => {
    const { contexte, instant } = preparerApercu({ ...base, cle: 'j_moins_7' });
    expect(instant.toISOString()).toBe('2027-07-24T08:00:00.000Z');
    const rendu = rendreEmail(MODELES_DEFAUT.j_moins_7, contexte, { cible: 'apercu' });
    expect(rendu.html).toContain(`samedi 31${NB}juillet 2027`);
    expect(rendu.sujet).toBe(`L’Olympiade à Sommières, c’est dans 7${NB}jours`);
    expect(rendu.html).toContain('Bonjour Camille,');
    // Pas de soirée liée : la ligne des manades et le lien pour noter disparaissent.
    expect(rendu.html).not.toContain('Manades engagées');
  });

  it('complète les infos manquantes avec des exemples sur demande', () => {
    const { contexte } = preparerApercu({ ...base, cle: 'j_moins_7', exemples: true });
    const rendu = rendreEmail(MODELES_DEFAUT.j_moins_7, contexte, { cible: 'apercu' });
    expect(rendu.html).toContain('Manades engagées');
    expect(rendu.html).toContain(`${ORIGINE}/noter`);
  });

  it('montre l’encart de bienvenue quelques jours avant la date', () => {
    const avec = preparerApercu({ ...base, cle: 'bienvenue', reglage: { jours_decalage: null, heure_envoi: null } });
    expect(avec.contexte.encartDateProche).toBe(true);
    expect(rendreEmail(MODELES_DEFAUT.bienvenue, avec.contexte, { cible: 'apercu' }).html).toContain(`c’est dans 3${NB}jours`);
    const sans = preparerApercu({ ...base, cle: 'bienvenue', reglage: { jours_decalage: null, heure_envoi: null }, encart: false });
    expect(sans.contexte.encartDateProche).toBe(false);
    expect(sans.instant).toBe(MAINTENANT);
  });

  it('liste les prochaines dates confirmées comme l’envoi, avec leur lien « Je viens »', () => {
    const { contexte } = preparerApercu({ ...base, cle: 'prochaines_dates', reglage: { jours_decalage: 7, heure_envoi: '10:00' }, dates: [SOMMIERES, BEZOUCE, LE_CRES] });
    // Le 07/08 à 10 h : Bezouce (05/08) est passée, seul Le Crès est à venir.
    expect(contexte.prochaines.map((date) => date.id)).toEqual(['le-cres']);
    expect(contexte.prochaines[0].lienJeViens).toBe(`${ORIGINE}/emails/je-viens`);
    const rendu = rendreEmail(MODELES_DEFAUT.prochaines_dates, contexte, { cible: 'apercu' });
    expect(rendu.html).toContain(`lun.${NB}16/08${NB}· Le Crès`);
  });

  it('exclut la date de l’email et garde 3 prochaines dates au plus', () => {
    const autres = [1, 2, 3, 4].map((n) => ({ ...LE_CRES, id: `autre-${n}`, date_soiree: `2027-09-0${n}` }));
    const { contexte } = preparerApercu({ ...base, cle: 'message', reglage: { jours_decalage: null, heure_envoi: null }, dates: [SOMMIERES, ...autres], annonces: true });
    expect(contexte.prochaines.map((date) => date.id)).toEqual(['autre-1', 'autre-2', 'autre-3']);
  });

  it('ne liste les autres dates qu’à une personne qui a accepté les annonces, comme l’envoi (B3)', () => {
    const reglageVide = { jours_decalage: null, heure_envoi: null };
    const dates = [SOMMIERES, LE_CRES];
    // Par défaut : vrai pour l'annonce et les prochaines dates, faux ailleurs.
    expect(preparerApercu({ ...base, cle: 'message', reglage: reglageVide, dates }).contexte).toMatchObject({ annonces: false, prochaines: [] });
    expect(preparerApercu({ ...base, cle: 'bienvenue', reglage: reglageVide, dates }).contexte.prochaines).toEqual([]);
    expect(preparerApercu({ ...base, cle: 'prochaines_dates', reglage: { jours_decalage: 7, heure_envoi: '10:00' }, dates }).contexte.annonces).toBe(true);
    expect(preparerApercu({ ...base, cle: 'annonce', reglage: { jours_decalage: -10, heure_envoi: '10:00' }, dates }).contexte.annonces).toBe(true);
    // Sans consentement, même les exemples ne fabriquent pas de liste.
    expect(preparerApercu({ ...base, cle: 'veille', dates: [], date: null, exemples: true, annonces: false }).contexte.prochaines).toEqual([]);
    expect(preparerApercu({ ...base, cle: 'veille', dates: [], date: null, exemples: true, annonces: true }).contexte.prochaines).toHaveLength(1);
  });

  it('ne propose pas une date dont la soirée liée est annulée ou reportée, comme la RPC (M8)', () => {
    const reportee = { ...LE_CRES, id: 'reportee', date_soiree: '2027-08-20', soiree: { slug: 'x', statut: 'reportee' as const } };
    const annulee = { ...LE_CRES, id: 'annulee', date_soiree: '2027-08-21', soiree: { slug: 'y', statut: 'annulee' as const } };
    const { contexte } = preparerApercu({ ...base, cle: 'message', reglage: { jours_decalage: null, heure_envoi: null }, dates: [SOMMIERES, reportee, annulee, LE_CRES], annonces: true });
    expect(contexte.prochaines.map((date) => date.id)).toEqual(['le-cres']);
  });

  it('passe l’étape et l’organisateur au rendu (contrat C-0.5)', () => {
    const avec = preparerApercu({ ...base, cle: 'veille', organisateur: 'L’Olympiade des Manades est organisée par Association des Manades.' });
    expect(avec.contexte).toMatchObject({ etape: 'veille', organisateur: 'L’Olympiade des Manades est organisée par Association des Manades.' });
    expect(preparerApercu({ ...base, cle: 'confirmation', reglage: { jours_decalage: null, heure_envoi: null } }).contexte)
      .toMatchObject({ etape: 'confirmation', organisateur: null, annonces: false });
  });

  it('ne met le lien de confirmation que dans la confirmation, et « Je viens » que dans l’annonce', () => {
    const reglageVide = { jours_decalage: null, heure_envoi: null };
    expect(preparerApercu({ ...base, cle: 'confirmation', reglage: reglageVide }).contexte.liens)
      .toEqual({ desinscription: `${ORIGINE}/emails/desinscription`, confirmation: `${ORIGINE}/emails/confirmation`, jeViens: null });
    expect(preparerApercu({ ...base, cle: 'confirmation', reglage: reglageVide }).contexte.prochaines).toEqual([]);
    expect(preparerApercu({ ...base, cle: 'veille' }).contexte.liens).toMatchObject({ confirmation: null, jeViens: null });
    const annonce = preparerApercu({ ...base, cle: 'annonce', reglage: { jours_decalage: -10, heure_envoi: '10:00' } });
    expect(annonce.contexte.liens.jeViens).toBe(`${ORIGINE}/emails/je-viens`);
    expect(annonce.contexte.annoncees.map((date) => date.id)).toEqual(['sommieres']);
  });

  it('rend la confirmation sans date, et le vainqueur seulement après la soirée', () => {
    const reglageVide = { jours_decalage: null, heure_envoi: null };
    expect(preparerApercu({ ...base, cle: 'confirmation', reglage: reglageVide, exemples: true }).contexte.date).toBeNull();
    expect(preparerApercu({ ...base, cle: 'veille', exemples: true }).contexte.date?.vainqueur).toBeNull();
    expect(preparerApercu({ ...base, cle: 'lendemain', reglage: { jours_decalage: 1, heure_envoi: '10:00' }, exemples: true }).contexte.date?.vainqueur)
      .toBe('Manade Vinuesa');
  });

  it('retombe sur maintenant si le réglage en cours de saisie est invalide', () => {
    const { instant } = preparerApercu({ ...base, cle: 'veille', reglage: { jours_decalage: -1, heure_envoi: '25:00' } });
    expect(instant).toBe(MAINTENANT);
  });

  it('sans date au calendrier, rend sans date, ou avec une date d’exemple', () => {
    const sans = preparerApercu({ ...base, cle: 'veille', date: null, dates: [] });
    expect(sans.contexte.date).toBeNull();
    const exemple = preparerApercu({ ...base, cle: 'veille', date: null, dates: [], exemples: true });
    expect(exemple.contexte.date?.ville).toBe('Sommières');
  });

  it('écrit le prénom vide comme une absence de prénom', () => {
    const { contexte } = preparerApercu({ ...base, cle: 'veille', prenom: '  ' });
    expect(contexte.prenom).toBeNull();
    expect(rendreEmail(MODELES_DEFAUT.veille, contexte, { cible: 'apercu' }).html).toContain('Bonjour,');
  });
});
