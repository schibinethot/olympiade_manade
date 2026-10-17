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

function contexte(changes: Partial<ContexteEmail> = {}): ContexteEmail {
  return {
    prenom: 'Camille',
    maintenant: new Date('2027-07-24T10:00:00+02:00'),
    origine: ORIGINE,
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
  it('écrit la date, le jour, l’heure et l’année à la française', () => {
    expect(formaterDate('2027-07-31', '21:30:00')).toEqual({
      date: 'samedi 31 juillet 2027',
      date_courte: 'sam. 31/07',
      jour: 'samedi',
      heure: '21 h 30',
      annee: '2027',
    });
  });

  it('laisse l’heure nulle quand elle est inconnue', () => {
    expect(formaterDate('2027-08-14', null).heure).toBeNull();
  });

  it('écrit « 1er » et une heure ronde sans minutes', () => {
    expect(formaterDate('2027-08-01', '10:00:00')).toMatchObject({
      date: 'dimanche 1er août 2027', date_courte: 'dim. 01/08', heure: '10 h',
    });
  });
});

describe('compteARebours', () => {
  const cas: [string, string | null, number][] = [
    ['2027-07-24T10:00:00+02:00', 'dans 7 jours', 7],
    ['2027-07-30T18:00:00+02:00', 'demain', 1],
    ['2027-07-31T10:00:00+02:00', 'ce soir', 0],
    ['2027-08-01T10:00:00+02:00', 'hier', -1],
  ];
  it.each(cas)('le %s (Paris), une date le 31/07 à 21:30 donne %s', (maintenant, texte, jours) => {
    expect(compteARebours('2027-07-31', '21:30:00', new Date(maintenant))).toEqual({ texte, jours });
  });

  it('compte les jours à l’heure de Paris, pas en UTC', () => {
    // 31/07 à 00:30 à Paris, c'est encore le 30/07 en UTC.
    expect(compteARebours('2027-07-31', '21:30:00', new Date('2027-07-30T22:30:00Z'))).toEqual({ texte: 'ce soir', jours: 0 });
  });

  it('dit « aujourd’hui » pour une date de l’après-midi (Arles, 15:30)', () => {
    expect(compteARebours('2027-05-01', '15:30:00', new Date('2027-05-01T09:00:00+02:00')).texte).toBe('aujourd’hui');
  });

  it('n’a plus de texte une semaine après la date', () => {
    expect(compteARebours('2027-07-31', '21:30:00', new Date('2027-08-07T10:00:00+02:00'))).toEqual({ texte: null, jours: -7 });
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
    expect(sans.html).toContain('Heure : 21 h 30');

    const avec = rendreEmail(modele(corps), contexte({
      date: dateSommieres({ lien_billetterie: 'https://billetterie.exemple.fr/?a=1&b=2' }),
    }), { cible: 'email' });
    expect(avec.html).toContain('href="https://billetterie.exemple.fr/?a=1&amp;b=2"');
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
    expect(rendu.html).toContain('Heure : 21 h 30');
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
    expect(bon.texte).toContain(`le site${NB}: https://olympiadedesmanades.fr/dates`);
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

  it('liste les prochaines dates avec un lien « Je viens » quand il existe', () => {
    const prochaines = [
      { ...dateSommieres(), lienJeViens: `${ORIGINE}/emails/je-viens?j=x` },
      { ...dateSommieres({ id: 'b', ville: 'Béziers', arenes: 'Arènes de Béziers', date_soiree: '2027-08-14', heure: null }), lienJeViens: null },
    ];
    const rendu = rendreEmail(modele('Les dates :\n\n{{prochaines_dates}}\n\nFin.'), contexte({ prochaines }), { cible: 'email' });
    expect(rendu.html).toContain('sam. 31/07 · Sommières, Arènes Gilles Arnaud · 21 h 30');
    expect(rendu.html).toContain(`href="${ORIGINE}/emails/je-viens?j=x"`);
    expect(rendu.html.match(/Je viens/g)).toHaveLength(1);
    expect(rendu.html).toContain('sam. 14/08 · Béziers, Arènes de Béziers');
    expect(rendu.texte).toContain(`- sam. 31/07 · Sommières, Arènes Gilles Arnaud · 21 h 30 · Je viens${NB}: ${ORIGINE}/emails/je-viens?j=x`);
    expect(rendu.texte).toContain('- sam. 14/08 · Béziers, Arènes de Béziers\n');
    const vide = rendreEmail(modele('Les dates :\n\n{{dates_annoncees}}\n\nFin.'), contexte(), { cible: 'email' });
    expect(vide.texte.startsWith('Les dates :\n\nFin.')).toBe(true);
  });

  it('ne rend l’encart de la bienvenue que si la date est proche', () => {
    const bienvenue = modele('Bienvenue.', { encart: 'Encart **proche** : {{date}}' });
    const loin = rendreEmail(bienvenue, contexte({ encartDateProche: false }), { cible: 'email' });
    expect(loin.html).not.toContain('Encart');
    expect(loin.texte).not.toContain('Encart');
    const proche = rendreEmail(bienvenue, contexte({ encartDateProche: true }), { cible: 'email' });
    expect(proche.html).toContain('Encart <strong>proche</strong> : samedi 31 juillet 2027');
    expect(proche.html).toContain('#efe7d8');
    expect(proche.texte).toContain('Encart proche : samedi 31 juillet 2027');
    expect(rendreEmail(bienvenue, contexte({ encartDateProche: true }), { cible: 'apercu' }).html).toContain('class="ee-encart"');
  });

  it('pose le gabarit email : 600 px, logo hébergé, pré-en-tête masqué, pied de désinscription', () => {
    const rendu = rendreEmail(modele('Corps.', { preheader: 'Le texte d’aperçu' }), contexte(), { cible: 'email' });
    expect(rendu.html.startsWith('<!doctype html>')).toBe(true);
    expect(rendu.html).toContain('width="600"');
    expect(rendu.html).toContain(`src="${ORIGINE}/email/logo.png"`);
    expect(rendu.html).toMatch(/<div style="display:none;[^"]*">Le texte d’aperçu/);
    expect(rendu.html).toContain('Vous recevez cet email car vous êtes inscrit·e à l’Olympiade des Manades.');
    expect(rendu.html).toContain(`href="${DESINSCRIPTION}"`);
    expect(rendu.html).toContain('olympiadedesmanades.fr</a>');
    for (const couleur of ['#f7f4ed', '#fcfbf7', '#b78649', '#1c1912']) expect(rendu.html).toContain(couleur);
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
    expect(rendu.sujet).toBe('L’Olympiade à Sommières Bcc: pirate@exemple.fr, dans 7 jours');
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

  it('cite la date dans chaque modèle sauf la confirmation', () => {
    for (const cle of ETAPES) {
      if (cle === 'confirmation') continue;
      const m = MODELES_DEFAUT[cle];
      expect([m.sujet, m.preheader, m.corps].join('\n'), cle).toMatch(/\{\{(date|compte_a_rebours)\}\}/);
    }
  });

  it('contient les éléments imposés', () => {
    expect(MODELES_DEFAUT.confirmation.corps).toContain('[[Confirmer mon adresse|{{lien_confirmation}}]]');
    expect(MODELES_DEFAUT.annonce.corps).toContain('{{dates_annoncees}}');
    const encart = MODELES_DEFAUT.bienvenue.encart ?? '';
    for (const morceau of ['{{date}}', '{{heure}}', '{{arenes}}', '{{lien_billetterie}}', '{{infos_pratiques}}', '{{lien_noter}}',
      'Vous recevrez la suite au fur et à mesure.']) {
      expect(encart).toContain(morceau);
    }
    expect(encart).toMatch(/\[\[[^|\]]+\|\{\{lien_noter\}\}\]\]/);
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

  it('n’importe aucun module node:, car l’admin importe ce module', () => {
    const source = readFileSync(new URL('../../serveur/gabarits-emails.mjs', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from ['"]node:|import\(['"]node:|require\(/);
  });
});
