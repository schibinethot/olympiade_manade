import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CONSENTEMENT_ANNONCES_TEXTE,
  CONSENTEMENT_ANNONCES_VERSION,
  ETAPES,
  MODELES_DEFAUT,
  VARIABLES,
  compteARebours,
  cssApercu,
  formaterDate,
  rendreEmail,
  variablesInconnues,
  type ContexteEmail,
  type DateEnrichie,
} from '../../serveur/gabarits-emails.mjs';

const ORIGINE = 'https://olympiadedesmanades.fr';
const DESINSCRIPTION = `${ORIGINE}/emails/desinscription?j=jeton-desinscription`;
const NB = '\u00a0';

function dateSommieres(changes: Partial<DateEnrichie> = {}): DateEnrichie {
  return {
    id: 'cal-sommieres',
    nom: 'Rencontre des manades',
    ville: 'Sommières',
    arenes: 'Arènes Gilles Arnaud',
    date_soiree: '2027-07-31',
    heure: '21:30:00',
    statut: 'confirmee',
    lien_billetterie: null,
    infos_pratiques: null,
    soiree: { slug: 'sommieres-2027', statut: 'publiee' },
    manades: ['Arlatenco', 'Vinuesa'],
    vainqueur: null,
    ...changes,
  };
}

/** Par défaut, une personne qui a consenti aux annonces ({{lien_dates}} fourni, revue juridique B3). */
function contexte(changes: Partial<ContexteEmail> = {}): ContexteEmail {
  return {
    prenom: 'Camille',
    maintenant: new Date('2027-07-24T10:00:00+02:00'),
    origine: ORIGINE,
    annonces: true,
    date: dateSommieres(),
    prochaines: [],
    annoncees: [],
    encartDateProche: false,
    liens: { desinscription: DESINSCRIPTION, confirmation: null, jeViens: null },
    ...changes,
  };
}

function modele(corps: string, autres: { sujet?: string; preheader?: string; encart?: string | null } = {}) {
  return { sujet: 'Sujet', preheader: '', corps, encart: null, ...autres };
}

/** Contexte où chaque variable a une valeur : sert à rendre tous les modèles par défaut. */
function contexteComplet(): ContexteEmail {
  const marsillargues = dateSommieres({
    id: 'cal-marsillargues', nom: 'Olympiades camarguaises', ville: 'Marsillargues',
    arenes: 'Arènes Marcel Guillarmet', date_soiree: '2027-07-30',
  });
  return contexte({
    date: dateSommieres({
      lien_billetterie: 'https://billetterie.exemple.fr/sommieres',
      infos_pratiques: 'Parking gratuit derrière les arènes.\nOuverture des portes à 20 h 30.',
      vainqueur: 'Manade Vinuesa',
    }),
    prochaines: [{ ...marsillargues, lienJeViens: `${ORIGINE}/emails/je-viens?j=a` }],
    annoncees: [{ ...dateSommieres(), lienJeViens: `${ORIGINE}/emails/je-viens?j=b` }],
    encartDateProche: true,
    liens: {
      desinscription: DESINSCRIPTION,
      confirmation: `${ORIGINE}/emails/confirmation?j=c`,
      jeViens: `${ORIGINE}/emails/je-viens?j=d`,
    },
  });
}

const BALISE = /<\/?[a-z!][^>]*>/i;

describe('formaterDate', () => {
  it('écrit la date, le jour, l’heure et l’année à la française, sans coupure possible', () => {
    expect(formaterDate('2027-07-31', '21:30:00')).toEqual({
      date: `samedi 31${NB}juillet 2027`,
      date_courte: `sam.${NB}31/07`,
      jour: 'samedi',
      heure: `21${NB}h${NB}30`,
      annee: '2027',
    });
  });

  it('laisse l’heure nulle quand elle est inconnue', () => {
    expect(formaterDate('2027-08-14', null).heure).toBeNull();
  });

  it('écrit « 1er » et une heure ronde sans minutes', () => {
    expect(formaterDate('2027-08-01', '10:00:00')).toMatchObject({
      date: `dimanche 1er${NB}août 2027`, date_courte: `dim.${NB}01/08`, heure: `10${NB}h`,
    });
  });
});

describe('compteARebours', () => {
  const cas: [string, string | null, number][] = [
    ['2027-07-24T10:00:00+02:00', `dans 7${NB}jours`, 7],
    ['2027-07-30T18:00:00+02:00', 'demain', 1],
    ['2027-07-31T10:00:00+02:00', 'ce soir', 0],
    ['2027-08-01T10:00:00+02:00', 'hier', -1],
  ];
  it.each(cas)('le %s (Paris), une date le 31/07 à 21:30 donne %s', (maintenant, texte, jours) => {
    expect(compteARebours('2027-07-31', '21:30:00', new Date(maintenant))).toEqual({ texte, jours });
  });

  it('compte en « jour des soirées » de Paris (bascule à 06:00), pas en UTC', () => {
    // 31/07 à 03:00 à Paris (01:00 UTC, déjà le 31 en UTC) : la nuit compte encore pour le 30/07.
    expect(compteARebours('2027-07-31', '21:30:00', new Date('2027-07-31T01:00:00Z'))).toEqual({ texte: 'demain', jours: 1 });
    expect(compteARebours('2027-07-31', '21:30:00', new Date('2027-07-31T04:00:00Z'))).toEqual({ texte: 'ce soir', jours: 0 });
  });

  it('une inscription à 00 h 30, pendant la soirée, ne lit pas « c’est hier »', () => {
    expect(compteARebours('2027-07-31', '21:30:00', new Date('2027-08-01T00:30:00+02:00'))).toEqual({ texte: 'ce soir', jours: 0 });
    expect(compteARebours('2027-07-31', '21:30:00', new Date('2027-08-01T06:00:00+02:00'))).toEqual({ texte: 'hier', jours: -1 });
  });

  it('lève une erreur sur un instant invalide (mineur T2), au lieu de compter NaN jours', () => {
    expect(() => compteARebours('2027-07-31', '21:30:00', new Date('pas une date'))).toThrow(RangeError);
  });

  it('dit « aujourd’hui » pour une date de l’après-midi (Arles, 15:30)', () => {
    expect(compteARebours('2027-05-01', '15:30:00', new Date('2027-05-01T09:00:00+02:00')).texte).toBe('aujourd’hui');
  });

  it('n’a plus de texte une semaine après la date', () => {
    expect(compteARebours('2027-07-31', '21:30:00', new Date('2027-08-07T10:00:00+02:00'))).toEqual({ texte: null, jours: -7 });
  });
  it.each([
    ['passage à l’heure d’été, veille à 23 h 30', '2027-03-28', '2027-03-27T23:30:00+01:00', 'demain', 1],
    ['passage à l’heure d’été, jour même à 00 h 30 (nuit de la veille)', '2027-03-28', '2027-03-28T00:30:00+01:00', 'demain', 1],
    ['passage à l’heure d’été, jour même à 07 h', '2027-03-28', '2027-03-28T07:00:00+02:00', 'ce soir', 0],
    ['passage à l’heure d’hiver, veille à 23 h 30', '2027-10-31', '2027-10-30T23:30:00+02:00', 'demain', 1],
    ['passage à l’heure d’hiver, jour même à 00 h 30 (nuit de la veille)', '2027-10-31', '2027-10-31T00:30:00+02:00', 'demain', 1],
    ['passage à l’heure d’hiver, jour même à 06 h', '2027-10-31', '2027-10-31T06:00:00+01:00', 'ce soir', 0],
  ])('%s', (_cas, date, maintenant, texte, jours) => {
    expect(compteARebours(date, '21:30:00', new Date(maintenant))).toEqual({ texte, jours });
  });

  it('accepte une heure sur un chiffre', () => {
    expect(formaterDate('2027-05-01', '9:30').heure).toBe(`9${NB}h${NB}30`);
    expect(compteARebours('2027-05-01', '9:30', new Date('2027-05-01T08:00:00+02:00')).texte).toBe('aujourd’hui');
  });
});

describe('variables', () => {
  it('repère les variables inconnues', () => {
    expect(variablesInconnues('a {{truc}} {{date}}')).toEqual(['truc']);
    expect(variablesInconnues('{{ date }} {{truc}} {{truc}} {{machin}}')).toEqual(['truc', 'machin']);
  });

  it('liste les variables de la spec, plus le lien de confirmation et les dates annoncées', () => {
    const cles = VARIABLES.map((variable) => variable.cle);
    expect(cles).toEqual(expect.arrayContaining([
      'prenom', 'date', 'date_courte', 'jour', 'heure', 'compte_a_rebours', 'jours_restants', 'annee',
      'nom_evenement', 'ville', 'arenes', 'infos_pratiques', 'manades', 'vainqueur', 'prochaines_dates',
      'dates_annoncees', 'lien_billetterie', 'lien_noter', 'lien_classement', 'lien_dates', 'lien_je_viens',
      'lien_confirmation',
    ]));
    expect(new Set(cles).size).toBe(cles.length);
    for (const variable of VARIABLES) {
      expect(['Personne', 'Date', 'Lieu', 'Infos', 'Liens']).toContain(variable.groupe);
      expect(variable.libelle.length).toBeGreaterThan(0);
      expect(variable.exemple.length).toBeGreaterThan(0);
    }
  });
});

describe('rendreEmail : règle « au fur et à mesure »', () => {
  it('retire une ligne dont la variable n’a pas de valeur', () => {
    const corps = 'Billetterie : {{lien_billetterie}}\nHeure : {{heure}}';
    const sans = rendreEmail(modele(corps), contexte(), { cible: 'email' });
    expect(sans.html).not.toContain('Billetterie');
    expect(sans.texte).not.toContain('Billetterie');
    expect(sans.html).toContain(`Heure : 21${NB}h${NB}30`);

    const avec = rendreEmail(modele(corps), contexte({
      date: dateSommieres({ lien_billetterie: 'https://billetterie.exemple.fr/?a=1&b=2' }),
    }), { cible: 'email' });
    expect(avec.html).toContain('href="https://billetterie.exemple.fr/?a=1&amp;b=2"');
    // Un {{lien_*}} laissé seul affiche son domaine (design, mineur 6) ; la version texte garde l'URL.
    expect(avec.html).toMatch(/<a href="https:\/\/billetterie\.exemple\.fr\/\?a=1&amp;b=2"[^>]*>billetterie\.exemple\.fr<\/a>/);
    expect(avec.texte).toContain('Billetterie : https://billetterie.exemple.fr/?a=1&b=2');
  });

  it('retire seulement « {{prenom}} » et l’espace qui le précède', () => {
    const rendu = rendreEmail(modele('Bonjour {{prenom}},\n\nSuite.', { sujet: 'Merci {{prenom}} !' }), contexte({ prenom: null }), { cible: 'email' });
    expect(rendu.html).toContain('Bonjour,');
    expect(rendu.texte.startsWith('Bonjour,\n\nSuite.')).toBe(true);
    expect(rendu.sujet).toBe('Merci !');
    expect(rendreEmail(modele('Bonjour {{prenom}},'), contexte(), { cible: 'email' }).texte).toContain('Bonjour Camille,');
  });

  it('retire un élément de liste ou un bouton sans valeur, et garde le reste', () => {
    const corps = '- Heure : {{heure}}\n- Arènes : {{arenes}}\n\n[[Je note les manades|{{lien_noter}}]]';
    const rendu = rendreEmail(modele(corps), contexte({ date: dateSommieres({ arenes: null, soiree: null }) }), { cible: 'email' });
    expect(rendu.html).toContain(`Heure : 21${NB}h${NB}30`);
    expect(rendu.html).not.toContain('Arènes');
    expect(rendu.html).not.toContain('Je note');
  });

  it('ne donne /noter que pour une soirée publiée ou en cours, et /classements qu’avec une soirée', () => {
    const corps = '[[Noter|{{lien_noter}}]]\n\n[Classement]({{lien_classement}})\n\n[Dates]({{lien_dates}})';
    const terminee = rendreEmail(modele(corps), contexte({
      date: dateSommieres({ soiree: { slug: 's', statut: 'terminee' } }),
    }), { cible: 'email' });
    expect(terminee.html).not.toContain('/noter');
    expect(terminee.html).toContain(`href="${ORIGINE}/classements"`);
    expect(terminee.html).toContain(`href="${ORIGINE}/dates"`);
    const enCours = rendreEmail(modele(corps), contexte({
      date: dateSommieres({ soiree: { slug: 's', statut: 'en_cours' } }),
    }), { cible: 'email' });
    expect(enCours.html).toContain(`href="${ORIGINE}/noter"`);
    const sansSoiree = rendreEmail(modele(corps), contexte({ date: dateSommieres({ soiree: null }) }), { cible: 'email' });
    expect(sansSoiree.html).not.toContain('/classements');
  });

  it('ne fournit {{lien_dates}} qu’à une personne qui a consenti aux annonces, ou dans l’annonce (revue juridique B3)', () => {
    const lendemain = MODELES_DEFAUT.lendemain;
    const avec = rendreEmail(lendemain, contexte({ etape: 'lendemain', annonces: true }), { cible: 'email' });
    expect(avec.html).toContain(`href="${ORIGINE}/dates"`);
    expect(avec.texte).toContain('La saison continue');
    for (const annonces of [false, undefined]) {
      const sans = rendreEmail(lendemain, contexte({ etape: 'lendemain', annonces }), { cible: 'email' });
      expect(sans.html, String(annonces)).not.toContain('/dates');
      expect(sans.texte, String(annonces)).not.toContain('La saison continue');
      expect(sans.texte, String(annonces)).toContain('À bientôt dans les arènes');
    }
    for (const etape of ['annonce', 'prochaines_dates'] as const) {
      const rendu = rendreEmail(modele('[Voir tout le calendrier]({{lien_dates}})'), contexte({ etape, annonces: false }), { cible: 'email' });
      expect(rendu.html, etape).toContain(`href="${ORIGINE}/dates"`);
    }
  });

  it('garde les heures des infos pratiques d’un seul tenant', () => {
    const rendu = rendreEmail(modele('{{infos_pratiques}}'), contexte({
      date: dateSommieres({ infos_pratiques: 'Portes à 20 h 30, parking dès 19 h.' }),
    }), { cible: 'email' });
    expect(rendu.texte).toContain(`Portes à 20${NB}h${NB}30, parking dès 19${NB}h.`);
  });
});

describe('rendreEmail : texte d’admin piégé (point de revue 5)', () => {
  it('échappe un prénom piégé et le HTML du corps', () => {
    const rendu = rendreEmail(
      modele('Bonjour {{prenom}},\n\n<script>alert(1)</script>', { sujet: 'Salut {{prenom}}' }),
      contexte({ prenom: '<img src=x onerror=alert(1)>' }),
      { cible: 'email' },
    );
    expect(rendu.html).not.toContain('<img src=x');
    expect(rendu.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(rendu.html).not.toContain('<script>');
    expect(rendu.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('rend un lien javascript: ou http: en texte simple', () => {
    for (const cible of ['email', 'apercu'] as const) {
      const rendu = rendreEmail(modele('Voir [x](javascript:alert(1)) ou [y](http://exemple.fr).\n\n[[Clic|javascript:alert(1)]]'), contexte(), { cible });
      expect(rendu.html).not.toMatch(/href="(javascript|http:)/);
      expect(rendu.html).toContain('[x](javascript:alert(1))');
      expect(rendu.html).toContain('[[Clic|javascript:alert(1)]]');
    }
    const bon = rendreEmail(modele('Voir [le site](https://olympiadedesmanades.fr/dates).'), contexte(), { cible: 'email' });
    expect(bon.html).toMatch(/<a href="https:\/\/olympiadedesmanades\.fr\/dates"[^>]*>le site<\/a>/);
    // Version texte : un lien dans une phrase s'écrit « texte (url) » (design, mineur 13).
    expect(bon.texte).toContain('Voir le site (https://olympiadedesmanades.fr/dates).');
  });

  it('rend une variable inconnue vide sans retirer la ligne', () => {
    const rendu = rendreEmail(modele('Avant{{truc}}Après'), contexte(), { cible: 'email' });
    expect(rendu.html).toContain('AvantAprès');
    expect(rendu.html).not.toContain('truc');
    expect(rendu.texte).toContain('AvantAprès');
  });

  it('n’interprète pas la syntaxe contenue dans une valeur', () => {
    const rendu = rendreEmail(modele('Bonjour {{prenom}}'), contexte({ prenom: '**{{lien_dates}}** [a](https://x.fr)' }), { cible: 'email' });
    expect(rendu.html).toContain('Bonjour **{{lien_dates}}** [a](https://x.fr)');
    expect(rendu.html).not.toContain('<strong>');
  });
});

describe('rendreEmail : mise en forme', () => {
  it('rend gras, paragraphes et listes', () => {
    const rendu = rendreEmail(modele('Un **grand** merci.\nDeuxième ligne.\n\n- un\n- deux\n\nUn ** seul.'), contexte(), { cible: 'apercu' });
    expect(rendu.html).toContain('<strong>grand</strong>');
    expect(rendu.html).toContain('Un <strong>grand</strong> merci.<br>Deuxième ligne.');
    expect(rendu.html.match(/<li /g)).toHaveLength(2);
    expect(rendu.html).toContain('Un ** seul.');
    expect(rendu.texte).toContain('Un grand merci.\nDeuxième ligne.\n\n- un\n- deux\n\nUn ** seul.');
  });

  it('rend un bouton aux styles en ligne pour l’email, à classes sans style pour l’aperçu', () => {
    const corps = '[[Je note les manades|{{lien_noter}}]]';
    const email = rendreEmail(modele(corps), contexte(), { cible: 'email' });
    expect(email.html).toMatch(/<a href="https:\/\/olympiadedesmanades\.fr\/noter"[^>]* style="[^"]+"[^>]*>Je note les manades<\/a>/);
    expect(email.texte).toContain(`Je note les manades${NB}: ${ORIGINE}/noter`);
    const apercu = rendreEmail(modele(corps), contexte(), { cible: 'apercu' });
    expect(apercu.html).toContain('class="ee-bouton"');
    expect(apercu.html).not.toContain('style=');
  });

  it('liste les prochaines dates en tableau, avec une pastille « Je viens » quand le lien existe', () => {
    const prochaines = [
      { ...dateSommieres(), lienJeViens: `${ORIGINE}/emails/je-viens#j=x` },
      { ...dateSommieres({ id: 'b', ville: 'Béziers', arenes: 'Arènes de Béziers', date_soiree: '2027-08-14', heure: null }), lienJeViens: null },
      { ...dateSommieres({ id: 'c', ville: 'Nîmes', arenes: null, date_soiree: '2027-09-04', heure: null, statut: 'previsionnelle' }), lienJeViens: null },
    ];
    for (const cible of ['email', 'apercu'] as const) {
      const rendu = rendreEmail(modele('Les dates :\n\n{{prochaines_dates}}\n\nFin.'), contexte({ prochaines }), { cible });
      expect(rendu.html, cible).toContain(`sam.${NB}31/07${NB}· Sommières</strong>`);
      expect(rendu.html, cible).toContain(`Arènes Gilles Arnaud${NB}· 21${NB}h${NB}30</span>`);
      expect(rendu.html, cible).toContain(`href="${ORIGINE}/emails/je-viens#j=x"`);
      expect(rendu.html.match(/Je viens/g), cible).toHaveLength(1);
      expect(rendu.html, cible).toContain(`sam.${NB}14/08${NB}· Béziers</strong>`);
      // Date prévisionnelle : dite « à confirmer » (design, mineur 2).
      expect(rendu.html, cible).toContain('date à confirmer</span>');
      expect(rendu.html, cible).toMatch(cible === 'email' ? /<table role="presentation"[^>]*style="[^"]*border-top/ : /<table class="ee-dates">/);
      expect(rendu.texte, cible).toContain(`- sam.${NB}31/07${NB}· Sommières, Arènes Gilles Arnaud${NB}· 21${NB}h${NB}30\n  Je viens${NB}: ${ORIGINE}/emails/je-viens#j=x`);
      expect(rendu.texte, cible).toContain(`- sam.${NB}14/08${NB}· Béziers, Arènes de Béziers\n`);
      expect(rendu.texte, cible).toContain(`- sam.${NB}04/09${NB}· Nîmes${NB}· date à confirmer\n`);
    }
    // Pastille à toute épreuve dans l'email : le contour est sur sa cellule (Outlook).
    const email = rendreEmail(modele('{{prochaines_dates}}'), contexte({ prochaines }), { cible: 'email' }).html;
    expect(email).toMatch(/<td style="border:1px solid #1c1912;border-radius:999px;mso-padding-alt:9px 16px"><a [^>]*>Je viens<\/a>/);
    const vide = rendreEmail(modele('Les dates :\n\n{{dates_annoncees}}\n\nFin.'), contexte(), { cible: 'email' });
    expect(vide.texte.startsWith('Les dates :\n\nFin.')).toBe(true);
  });

  it('rend une ligne « # Titre » en titre (Playfair, repli Georgia), un seul élément par ligne', () => {
    const email = rendreEmail(modele('# Plus que **7** jours\nBonjour.'), contexte(), { cible: 'email' });
    expect(email.html).toMatch(/<h1 style="margin:0 0 16px;font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;line-height:32px;[^"]*">Plus que <strong>7<\/strong> jours<\/h1>\n<p /);
    expect(email.texte.startsWith('Plus que 7 jours\nBonjour.')).toBe(true);
    const apercu = rendreEmail(modele('# Titre'), contexte(), { cible: 'apercu' });
    expect(apercu.html).toContain('<h1 class="ee-titre">Titre</h1>');
    // « #Titre » sans espace reste un paragraphe.
    expect(rendreEmail(modele('#Titre'), contexte(), { cible: 'apercu' }).html).toContain('<p class="ee-p">#Titre</p>');
  });

  it('ne rend l’encart de la bienvenue que si la date est proche, liens à l’encre (contraste AA)', () => {
    const bienvenue = modele('Bienvenue.', { encart: 'Encart **proche** : {{date}}\n\n[Billetterie](https://billetterie.exemple.fr)' });
    const loin = rendreEmail(bienvenue, contexte({ encartDateProche: false }), { cible: 'email' });
    expect(loin.html).not.toContain('Encart');
    expect(loin.texte).not.toContain('Encart');
    const proche = rendreEmail(bienvenue, contexte({ encartDateProche: true }), { cible: 'email' });
    expect(proche.html).toContain(`Encart <strong>proche</strong> : samedi 31${NB}juillet 2027`);
    expect(proche.html).toContain('#efe7d8');
    expect(proche.html).toMatch(/<a href="https:\/\/billetterie\.exemple\.fr" [^>]*style="color:#1c1912;text-decoration:underline/);
    // L'encart redéclare la police (Outlook ne l'hérite pas d'une cellule parente).
    expect(proche.html).toMatch(/<td bgcolor="#efe7d8" style="[^"]*font-family:Inter[^"]*line-height:26px;mso-line-height-rule:exactly/);
    expect(proche.texte).toContain(`Encart proche : samedi 31${NB}juillet 2027`);
    expect(rendreEmail(bienvenue, contexte({ encartDateProche: true }), { cible: 'apercu' }).html).toContain('class="ee-encart"');
  });

  it('pose le gabarit email : 600 px, logo cliquable, pré-en-tête masqué, Outlook et Apple, pied de désinscription', () => {
    const rendu = rendreEmail(modele('Corps.', { preheader: 'Le texte d’aperçu' }), contexte(), { cible: 'email' });
    expect(rendu.html.startsWith('<!doctype html>')).toBe(true);
    expect(rendu.html).toContain('<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">');
    expect(rendu.html).toContain('<meta name="x-apple-disable-message-reformatting">');
    expect(rendu.html).toContain('<o:PixelsPerInch>96</o:PixelsPerInch>');
    expect(rendu.html).toContain('-webkit-text-size-adjust:100%');
    expect(rendu.html).toContain('width="600"');
    expect(rendu.html).toMatch(new RegExp(`<a href="${ORIGINE}" [^>]*><img src="${ORIGINE}/email/logo\\.png" [^>]*alt="Olympiade des Manades" style="[^"]*font-family:'Playfair Display'`));
    expect(rendu.html).toMatch(/<div style="display:none;[^"]*">Le texte d’aperçu/);
    expect(rendu.html).toContain(`href="${DESINSCRIPTION}"`);
    expect(rendu.html).toContain('olympiadedesmanades.fr</a>');
    // Police sans Roboto (texte « tout en gras »), graisse régulière, interlignes en px pour Outlook.
    expect(rendu.html).toContain('font-family:Inter,-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;line-height:26px;mso-line-height-rule:exactly');
    expect(rendu.html).not.toContain('Roboto');
    expect(rendu.html).toContain('height:4px;line-height:4px;font-size:4px;mso-line-height-rule:exactly;background-color:#b78649;border-radius:16px 16px 0 0');
    for (const couleur of ['#f7f4ed', '#fcfbf7', '#b78649', '#1c1912']) expect(rendu.html).toContain(couleur);
    // Listes : marge à gauche plutôt qu'un retrait (Outlook).
    expect(rendreEmail(modele('- un'), contexte(), { cible: 'email' }).html).toContain('<ul style="margin:0 0 16px 22px;padding:0;list-style:disc">');
  });

  it('pied : la raison de l’envoi selon le type d’e-mail (revue juridique C1), puis l’identité de l’organisateur (B4)', () => {
    const raisons = {
      confirmation: 'Vous recevez cet email car votre adresse a été saisie dans le formulaire d’actualités de olympiadedesmanades.fr. Sans clic de votre part, elle sera supprimée dans 30 jours.',
      rappel: 'Vous recevez cet email car vous êtes inscrit·e au vote du public ou aux actualités de l’Olympiade des Manades.',
      annonce: 'Vous recevez cet email car vous avez accepté de recevoir l’annonce des prochaines dates de l’Olympiade des Manades.',
    };
    const attendues: [ContexteEmail['etape'], string][] = [
      ['confirmation', raisons.confirmation],
      ['bienvenue', raisons.rappel], ['j_moins_7', raisons.rappel], ['veille', raisons.rappel], ['jour_j', raisons.rappel],
      ['lendemain', raisons.rappel], ['message', raisons.rappel],
      ['annonce', raisons.annonce], ['prochaines_dates', raisons.annonce],
      [undefined, raisons.rappel],
    ];
    const identite = 'L’Olympiade des Manades est organisée par Association des Manades, association loi 1901, 1 place des Arènes, 30250 Sommières.';
    for (const [etape, raison] of attendues) {
      for (const cible of ['email', 'apercu'] as const) {
        const rendu = rendreEmail(modele('Corps.'), contexte({ etape, organisateur: identite }), { cible });
        expect(rendu.html, `${etape} ${cible}`).toContain(raison);
        expect(rendu.html, `${etape} ${cible}`).toContain(identite);
        expect(rendu.texte, `${etape} ${cible}`).toContain(`${raison}\n${identite}\nSe désinscrire${NB}: ${DESINSCRIPTION}`);
      }
    }
    // Identité absente : la ligne disparaît (l'aperçu de l'admin avertit, le planificateur ne part pas en smtp).
    for (const organisateur of [null, undefined, '  ']) {
      const rendu = rendreEmail(modele('Corps.'), contexte({ etape: 'veille', organisateur }), { cible: 'email' });
      expect(rendu.html).not.toContain('organisée par');
      expect(rendu.texte).toContain(`${raisons.rappel}\nSe désinscrire${NB}: ${DESINSCRIPTION}`);
    }
    // Échappée comme toute valeur.
    expect(rendreEmail(modele('Corps.'), contexte({ organisateur: 'A <b>B</b>' }), { cible: 'email' }).html).toContain('A &lt;b&gt;B&lt;/b&gt;');
  });

  it('met toujours le lien de désinscription dans le pied, pour les deux cibles et le texte', () => {
    for (const cible of ['email', 'apercu'] as const) {
      const rendu = rendreEmail(modele('Corps.'), contexte({ date: null, prenom: null }), { cible });
      expect(rendu.html).toContain(`href="${DESINSCRIPTION}"`);
      expect(rendu.texte).toContain(`Se désinscrire${NB}: ${DESINSCRIPTION}`);
    }
  });

  it('remplit le sujet sans retour à la ligne', () => {
    const rendu = rendreEmail(modele('Corps.', { sujet: 'L’Olympiade à {{ville}}, {{compte_a_rebours}}' }), contexte({
      date: dateSommieres({ ville: 'Sommières\r\nBcc: pirate@exemple.fr' }),
    }), { cible: 'email' });
    expect(rendu.sujet).toBe(`L’Olympiade à Sommières Bcc: pirate@exemple.fr, dans 7${NB}jours`);
  });

  it('remplace tout caractère de contrôle du sujet par une espace (prénom ou texte d’admin)', () => {
    const rendu = rendreEmail(
      modele('Corps.', { sujet: 'Salut {{prenom}}\u0007!\nSuite\u2028fin' }),
      contexte({ prenom: 'Ca\u0000mi\r\nlle\t\u007f\u0085X' }),
      { cible: 'email' },
    );
    expect(rendu.sujet).toBe('Salut Ca mi lle X ! Suite fin');
    expect(rendu.sujet).not.toMatch(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/);
  });

  it('ne produit aucune balise dans la version texte', () => {
    for (const cle of ETAPES) {
      const rendu = rendreEmail(MODELES_DEFAUT[cle], contexteComplet(), { cible: 'email' });
      expect(rendu.texte, cle).not.toMatch(BALISE);
    }
  });
});

describe('rendreEmail : robustesse (revue, tour 1)', () => {
  it('refuse une origine qui n’est pas une URL http(s) absolue, pour les deux cibles', () => {
    for (const cible of ['email', 'apercu'] as const) {
      for (const origine of ['', '/', 'olympiadedesmanades.fr', 'javascript:alert(1)']) {
        expect(() => rendreEmail(modele('Corps.'), contexte({ origine }), { cible }), `${cible} ${origine}`).toThrow(/origine/i);
      }
    }
  });

  it('refuse un email sans lien de désinscription valable ; l’aperçu retombe sur la page de désinscription', () => {
    for (const desinscription of ['', 'javascript:alert(1)', '/emails/desinscription?j=x']) {
      const liens = { desinscription, confirmation: null, jeViens: null };
      expect(() => rendreEmail(modele('Corps.'), contexte({ liens }), { cible: 'email' }), desinscription).toThrow(/désinscription/i);
      const apercu = rendreEmail(modele('Corps.'), contexte({ liens }), { cible: 'apercu' });
      expect(apercu.html).toContain(`href="${ORIGINE}/emails/desinscription"`);
    }
  });

  it('ne fait jamais un lien d’une valeur qui n’est pas en http(s)', () => {
    const rendu = rendreEmail(
      modele('Billetterie : {{lien_billetterie}}\n\nAvant [billets]({{lien_billetterie}}) après\n\n{{prochaines_dates}}'),
      contexte({
        date: dateSommieres({ lien_billetterie: 'javascript:alert(1)' }),
        prochaines: [{ ...dateSommieres(), lienJeViens: 'javascript:alert(2)' }],
      }),
      { cible: 'email' },
    );
    expect(rendu.html).not.toContain('javascript');
    expect(rendu.html).not.toContain('Billetterie');
    expect(rendu.html).not.toContain(`Je${NB}viens`);
    expect(rendu.html).toContain(`sam.${NB}31/07${NB}· Sommières`);
    expect(rendu.texte).not.toContain('javascript');
  });

  it('n’imbrique jamais de lien : une variable de lien dans un texte de lien reste du texte', () => {
    const rendu = rendreEmail(
      modele('[Voir {{lien_dates}}](https://olympiadedesmanades.fr/dates)\n\n[[Aller sur {{lien_dates}}|{{lien_dates}}]]'),
      contexte(),
      { cible: 'apercu' },
    );
    expect(rendu.html).not.toMatch(/<a [^>]*>(?:(?!<\/a>)[\s\S])*<a /);
    expect(rendu.html).toContain(`>Voir ${ORIGINE}/dates</a>`);
    expect(rendu.html).toContain(`>Aller sur ${ORIGINE}/dates</a>`);
    expect(rendu.texte).toContain(`Voir ${ORIGINE}/dates (https://olympiadedesmanades.fr/dates)`);
  });

  it('tolère une date sans liste de manades', () => {
    const rendu = rendreEmail(
      modele('Liste des manades : {{manades}}\n\nFin.'),
      contexte({ date: dateSommieres({ manades: undefined as unknown as string[] }) }),
      { cible: 'email' },
    );
    expect(rendu.html).not.toContain('Liste des manades');
    expect(rendu.html).toContain('Fin.');
  });

  it('met la marge de l’encart sur son tableau, pas sur la cellule', () => {
    const html = rendreEmail(modele('Corps.', { encart: 'Encart.' }), contexte({ encartDateProche: true }), { cible: 'email' }).html;
    const encart = /<table [^>]*style="([^"]*)"><tr><td bgcolor="#efe7d8" style="([^"]*)">/.exec(html);
    expect(encart).not.toBeNull();
    expect(encart?.[1]).toContain('margin:8px 0 20px');
    expect(encart?.[2]).not.toContain('margin');
    expect(encart?.[2]).toContain('border:1px solid #b78649');
  });

  it('cale la carte et le pied à 600 px dans Outlook par un tableau fantôme', () => {
    const html = rendreEmail(modele('Corps.'), contexte(), { cible: 'email' }).html;
    expect(html).toContain('<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->');
    expect(html).toContain('<!--[if mso]></td></tr></table><![endif]-->');
    expect(html.indexOf('<!--[if mso]><table')).toBeLessThan(html.indexOf('bgcolor="#fcfbf7"'));
    expect(html.indexOf('<!--[if mso]></td>')).toBeGreaterThan(html.indexOf('Se désinscrire'));
  });
});

describe('modèles par défaut', () => {
  it('suit l’ordre de la frise et couvre chaque étape', () => {
    expect(ETAPES).toEqual([
      'confirmation', 'bienvenue', 'j_moins_7', 'veille', 'jour_j', 'lendemain', 'prochaines_dates', 'annonce', 'message',
    ]);
    expect(Object.keys(MODELES_DEFAUT).sort()).toEqual([...ETAPES].sort());
  });

  it('respecte les contraintes de la table modeles_emails', () => {
    const echeances: Record<string, [number, string]> = {
      j_moins_7: [-7, '10:00'], veille: [-1, '18:00'], jour_j: [0, '10:00'],
      lendemain: [1, '10:00'], prochaines_dates: [7, '10:00'], annonce: [-10, '10:00'],
    };
    for (const cle of ETAPES) {
      const m = MODELES_DEFAUT[cle];
      expect(m.nom.trim().length, cle).toBeGreaterThan(0);
      expect(m.nom.length, cle).toBeLessThanOrEqual(80);
      expect(m.sujet.trim().length, cle).toBeGreaterThan(0);
      expect(m.sujet.length, cle).toBeLessThanOrEqual(200);
      expect(m.preheader.length, cle).toBeLessThanOrEqual(200);
      expect(m.corps.trim().length, cle).toBeGreaterThan(0);
      expect(m.corps.length, cle).toBeLessThanOrEqual(8000);
      if (cle === 'bienvenue') {
        expect(typeof m.encart).toBe('string');
        expect((m.encart ?? '').length).toBeLessThanOrEqual(4000);
      } else {
        expect(m.encart, cle).toBeNull();
      }
      const attendu = echeances[cle];
      if (attendu) {
        expect([m.jours_decalage, m.heure_envoi], cle).toEqual(attendu);
      } else {
        expect([m.jours_decalage, m.heure_envoi], cle).toEqual([null, null]);
      }
    }
  });

  it('n’emploie aucune variable inconnue', () => {
    for (const cle of ETAPES) {
      const m = MODELES_DEFAUT[cle];
      expect(variablesInconnues([m.sujet, m.preheader, m.corps, m.encart ?? ''].join('\n')), cle).toEqual([]);
    }
  });

  it('cite la date ou sa ville dans chaque modèle sauf la confirmation', () => {
    for (const cle of ETAPES) {
      if (cle === 'confirmation') continue;
      const m = MODELES_DEFAUT[cle];
      expect([m.sujet, m.preheader, m.corps].join('\n'), cle).toMatch(/\{\{(date|compte_a_rebours|ville)\}\}/);
    }
  });

  it('porte un titre par e-mail, sauf le message libre', () => {
    for (const cle of ETAPES) {
      const titres = MODELES_DEFAUT[cle].corps.split('\n').filter((ligne) => ligne.startsWith('# '));
      expect(titres.length, cle).toBe(cle === 'message' ? 0 : 1);
      if (cle !== 'message') expect(MODELES_DEFAUT[cle].corps.startsWith('# '), cle).toBe(true);
    }
  });

  it('contient les éléments imposés', () => {
    expect(MODELES_DEFAUT.confirmation.corps).toContain('[[Confirmer mon adresse|{{lien_confirmation}}]]');
    expect(MODELES_DEFAUT.annonce.corps).toContain('{{dates_annoncees}}');
    const encart = MODELES_DEFAUT.bienvenue.encart ?? '';
    for (const morceau of ['{{compte_a_rebours}}', '{{heure}}', '{{arenes}}', '[réserver mes places]({{lien_billetterie}})', '{{infos_pratiques}}', '{{lien_noter}}']) {
      expect(encart).toContain(morceau);
    }
    expect(encart).toMatch(/\[\[[^|\]]+\|\{\{lien_noter\}\}\]\]/);
    // Billetterie : un lien libellé, ou un bouton dans le J-7 ; jamais une URL brute (design n° 3).
    expect(MODELES_DEFAUT.j_moins_7.corps).toContain('[[Réserver mes places|{{lien_billetterie}}]]');
    expect(MODELES_DEFAUT.veille.corps).toContain('[réserver mes places]({{lien_billetterie}})');
    for (const cle of ETAPES) expect(MODELES_DEFAUT[cle].corps, cle).not.toMatch(/: \{\{lien_billetterie\}\}/);
  });

  it('suit la revue juridique : opposition dans la bienvenue (B1), lendemain sans autre promotion (B3, S3)', () => {
    expect(MODELES_DEFAUT.bienvenue.corps).toContain(
      'Vous ne souhaitez pas recevoir ces rappels ? Le lien de désinscription, en bas de chaque email, les arrête à tout moment, sans connexion.'
        .replace(' ?', `${NB}?`),
    );
    expect(MODELES_DEFAUT.lendemain.sujet).toBe('Les résultats de la soirée à {{ville}}');
    // Le lendemain ne parle d'autres dates que par {{lien_dates}} (fourni aux seuls consentants) ; un seul merci.
    const lendemain = MODELES_DEFAUT.lendemain.corps;
    expect(lendemain.split('\n').filter((ligne) => /prochaines dates|saison/i.test(ligne)).every((ligne) => ligne.includes('{{lien_dates}}'))).toBe(true);
    expect([MODELES_DEFAUT.lendemain.preheader, lendemain].join('\n').match(/merci/gi)).toHaveLength(1);
    // Étapes 2 à 5 : aucune liste d'autres dates.
    for (const cle of ['j_moins_7', 'veille', 'jour_j', 'lendemain'] as const) {
      expect(MODELES_DEFAUT[cle].corps, cle).not.toMatch(/\{\{(prochaines_dates|dates_annoncees)\}\}/);
    }
  });

  it('suit la typographie du site', () => {
    for (const cle of ETAPES) {
      const m = MODELES_DEFAUT[cle];
      const texte = [m.nom, m.sujet, m.preheader, m.corps, m.encart ?? ''].join('\n');
      expect(texte, cle).not.toContain('\'');
      expect(texte, cle).not.toMatch(/ [:;!?»]/);
      expect(texte, cle).not.toMatch(/« /);
    }
  });

  it('se rend sans trou ni variable brute, pour les deux cibles', () => {
    for (const cle of ETAPES) {
      for (const cible of ['email', 'apercu'] as const) {
        const rendu = rendreEmail(MODELES_DEFAUT[cle], contexteComplet(), { cible });
        for (const sortie of [rendu.sujet, rendu.html, rendu.texte]) {
          expect(sortie, `${cle} ${cible}`).not.toMatch(/\{\{|\}\}|\bundefined\b|\bnull\b|\[\[/);
        }
        expect(rendu.sujet.length, cle).toBeGreaterThan(0);
        if (cible === 'apercu') expect(rendu.html, cle).not.toMatch(/style=|<script|<style/);
      }
    }
  });

  it('n’invite plus à l’avis le lendemain, et renvoie vers les prochaines dates', () => {
    const { corps, preheader } = MODELES_DEFAUT.lendemain;
    expect(corps).not.toContain('{{lien_noter}}');
    expect(corps).not.toMatch(/avis/i);
    expect(corps).toContain('{{lien_dates}}');
    expect(corps).toContain('{{vainqueur}}');
    expect(corps).toContain('{{lien_classement}}');
    expect(preheader).not.toMatch(/dès qu|publiés|prochain email|recevrez/i);
  });

  it('ne parle de « Je viens » que s’il y a un lien « Je viens »', () => {
    const sansLien = (date: DateEnrichie) => ({ ...date, lienJeViens: null });
    for (const cle of ['prochaines_dates', 'annonce'] as const) {
      const rendu = rendreEmail(MODELES_DEFAUT[cle], contexte({
        prochaines: [sansLien(dateSommieres())],
        annoncees: [sansLien(dateSommieres())],
      }), { cible: 'email' });
      expect(rendu.html, cle).not.toContain('Je viens');
      expect(rendu.texte, cle).not.toContain('Je viens');
    }
  });

  it('ne promet pas de noter « sans attendre le réseau » la veille', () => {
    expect(MODELES_DEFAUT.veille.corps).not.toContain('sans attendre le réseau');
  });

  it('fige le texte du consentement aux annonces', () => {
    expect(CONSENTEMENT_ANNONCES_TEXTE).toBe('J’accepte de recevoir par email l’annonce des prochaines dates de l’Olympiade des Manades.');
    expect(CONSENTEMENT_ANNONCES_VERSION).toBe('2026-10-17');
  });
});

describe('aperçu, logo et isomorphisme', () => {
  it('fournit une feuille d’aperçu identique au fichier, chaque règle préfixée par .apercu-email', () => {
    const fichier = readFileSync(new URL('../../app/composants/admin/emails/apercu-email.css', import.meta.url), 'utf8');
    const feuille = cssApercu();
    expect(fichier).toBe(feuille);
    const regles = feuille.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((regle) => regle.trim()).filter(Boolean);
    expect(regles.length).toBeGreaterThan(5);
    for (const regle of regles) {
      const selecteurs = regle.slice(0, regle.indexOf('{')).split(',').map((s) => s.trim());
      for (const selecteur of selecteurs) expect(selecteur.startsWith('.apercu-email')).toBe(true);
    }
  });

  it('sert un logo PNG 2× de 240 px de large au plus, affiché à la moitié', () => {
    const png = readFileSync(new URL('../../public/email/logo.png', import.meta.url));
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    const largeur = png.readUInt32BE(16);
    const hauteur = png.readUInt32BE(20);
    expect(largeur).toBeLessThanOrEqual(240);
    expect(largeur % 2).toBe(0);
    expect(hauteur % 2).toBe(0);
    const html = rendreEmail(modele('Corps.'), contexte(), { cible: 'email' }).html;
    expect(html).toContain(`width="${largeur / 2}" height="${hauteur / 2}"`);
  });

  it('n’importe aucun module node:, car l’admin importe ce module (ni ses dépendances)', () => {
    for (const module of ['gabarits-emails.mjs', 'consentements.mjs', 'fuseau-paris.mjs']) {
      const source = readFileSync(new URL(`../../serveur/${module}`, import.meta.url), 'utf8');
      expect(source, module).not.toMatch(/\bfrom\s+['"](node:)?(fs|path|crypto|os|url|buffer|stream)['"]|import\s*\(?\s*['"]node:|\brequire\(|\bprocess\.|\bBuffer\b/);
    }
  });
});

describe('QA : pré-en-tête piégé', () => {
  it('should escape the preheader when admin text or prenom contains HTML', () => {
    const rendu = rendreEmail(
      modele('Corps.', { preheader: 'Salut {{prenom}} <script>x</script>' }),
      contexte({ prenom: '<img src=x onerror=alert(1)>' }),
      { cible: 'email' },
    );
    expect(rendu.html).not.toContain('<script>x');
    expect(rendu.html).not.toContain('<img src=x');
    expect(rendu.html).toContain('&lt;script&gt;x&lt;/script&gt;');
  });
});

describe('textes de consentement : source unique (C-0.1)', () => {
  it('serveur/consentements.mjs fournit les textes réexportés par le rendu et par les actualités', async () => {
    const consentements = await import('../../serveur/consentements.mjs');
    const actualites = await import('../../serveur/actualites.mjs');
    expect(CONSENTEMENT_ANNONCES_TEXTE).toBe(consentements.CONSENTEMENT_ANNONCES_TEXTE);
    expect(CONSENTEMENT_ANNONCES_VERSION).toBe(consentements.CONSENTEMENT_ANNONCES_VERSION);
    expect(actualites.CONSENTEMENT_ACTUALITES_TEXTE).toBe(consentements.CONSENTEMENT_ACTUALITES_TEXTE);
    expect(actualites.CONSENTEMENT_ACTUALITES_VERSION).toBe(consentements.CONSENTEMENT_ACTUALITES_VERSION);
    // Texte exact de la revue juridique (R3) : les abonnés reçoivent aussi l'annonce des dates.
    expect(consentements.CONSENTEMENT_ACTUALITES_TEXTE).toBe(
      'J’accepte de recevoir par email les actualités, les dates, les informations pratiques, les résultats et les notations de l’Olympiade des Manades.',
    );
    expect(consentements.CONSENTEMENT_ACTUALITES_VERSION).toBe('2026-10-18');
    // La migration copie le texte des annonces à l'identique (déclencheur des spectateurs).
    const migration = readFileSync(new URL('../../supabase/migrations/20261017160000_sequence_emails.sql', import.meta.url), 'utf8');
    expect(migration).toContain(`'${consentements.CONSENTEMENT_ANNONCES_TEXTE}'`);
    expect(migration).toContain(`'${consentements.CONSENTEMENT_ANNONCES_VERSION}'`);
  });
});
