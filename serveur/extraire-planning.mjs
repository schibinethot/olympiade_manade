// @ts-check
// Brouillon de planning (CDC §4.3). Rien n'est écrit dans les épreuves ici.

import { createHash } from 'node:crypto';
import { lireZip } from './zip.mjs';

const MAX_OCTETS = 20 * 1024 * 1024;
const EPREUVES = [
  ['Ferrade en piste', 'Le cavalier renverse un anouble avec le fer, met pied à terre et couche la bête pour simuler le marquage.'],
  ['Saut de cheval à cheval', 'Deux cavaliers encadrent un cheval libre. L’un le guide, l’autre saute dessus en plein galop.'],
  ['Saut de cheval à taureau', 'Le cavalier saute de son cheval sur un taureau lancé et le tient jusqu’à le mettre au sol.'],
  ['Attente au fer', 'Les manadiers dirigent un taureau vers deux gardians armés de tridents, qui doivent piquer en même temps.'],
];

/** @param {string} valeur */
export function normaliser(valeur) {
  return valeur.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * @param {string[]} manades
 * @param {{ nom: string, heureDebut?: string, heureFin?: string, description?: string }[]} epreuves
 * @param {string[]} avertissements
 */
export function brouillon(manades, epreuves, avertissements, proposerModele = true) {
  const noms = [...new Set(manades.map((nom) => nom.trim()).filter(Boolean))];
  const liste = epreuves.length
    ? epreuves
    : proposerModele
      ? EPREUVES.map(([nom, description]) => ({ nom, description, heureDebut: '', heureFin: '', descriptionIa: false }))
      : [];
  if (!epreuves.length && proposerModele && noms.length) avertissements.push('Aucune épreuve lisible : le modèle des 4 épreuves est proposé, sans texte généré par l’IA.');
  return {
    manades: noms.map((nom) => ({ nom, connue: false })),
    epreuves: liste.map((epreuve, index) => ({
      ordre: index + 1,
      nom: epreuve.nom,
      heureDebut: epreuve.heureDebut ?? '',
      heureFin: epreuve.heureFin ?? '',
      description: epreuve.description || EPREUVES.find(([nom]) => normaliser(nom) === normaliser(epreuve.nom))?.[1] || '',
      descriptionIa: Boolean(epreuve.description && !EPREUVES.some(([nom]) => normaliser(nom) === normaliser(epreuve.nom))),
    })),
    avertissements,
  };
}

/** @param {string} texte */
export function brouillonDepuisTexte(texte) {
  const lignes = texte.split(/\r?\n/).map((ligne) => ligne.trim()).filter(Boolean);
  /** @type {{ nom: string, heureDebut?: string, heureFin?: string, description?: string }[]} */
  const epreuves = [];
  /** @type {string[]} */
  const manades = [];
  for (const ligne of lignes) {
    const connue = EPREUVES.find(([nom]) => normaliser(ligne).includes(normaliser(nom)));
    const heures = [...ligne.matchAll(/(\d{1,2})[:h](\d{2})/g)].map((trouve) => `${trouve[1].padStart(2, '0')}:${trouve[2]}`);
    if (connue) {
      epreuves.push({ nom: connue[0], description: connue[1], heureDebut: heures[0], heureFin: heures[1] });
      continue;
    }
    if (ligne.length <= 40 && !/^\d/.test(ligne)) manades.push(ligne.replace(/[,;|].*$/, '').trim());
  }
  return brouillon(manades, epreuves, []);
}

/** @param {string} csv */
export function brouillonDepuisCsv(csv) {
  const lignes = csv.split(/\r?\n/).map((ligne) => ligne.trim()).filter(Boolean);
  if (!lignes.length) return brouillon([], [], ['Fichier vide.']);
  const separateurs = [',', ';', '\t'];
  const separateur = separateurs.reduce((meilleur, candidat) => (
    lignes[0].split(candidat).length > lignes[0].split(meilleur).length ? candidat : meilleur
  ));
  const cellules = lignes.map((ligne) => ligne.split(separateur).map((cellule) => cellule.trim().replace(/^"|"$/g, '')));
  const entete = cellules[0].map(normaliser);
  /** @param {string[]} noms */
  const index = (noms) => entete.findIndex((colonne) => noms.some((nom) => colonne.includes(nom)));
  const iEpreuve = index(['epreuve', 'épreuve']);
  const iManade = index(['manade']);
  const iDebut = index(['debut', 'début', 'heure']);
  const iFin = index(['fin']);
  /** @type {Map<string, { nom: string, heureDebut?: string, heureFin?: string }>} */
  const epreuves = new Map();
  /** @type {string[]} */
  const manades = [];
  const corps = iManade >= 0 || iEpreuve >= 0 ? cellules.slice(1) : cellules;
  for (const ligne of corps) {
    const manade = iManade >= 0 ? ligne[iManade] : ligne[0];
    if (manade) manades.push(manade);
    const nomEpreuve = iEpreuve >= 0 ? ligne[iEpreuve] : '';
    if (nomEpreuve && !epreuves.has(normaliser(nomEpreuve))) {
      epreuves.set(normaliser(nomEpreuve), { nom: nomEpreuve, heureDebut: iDebut >= 0 ? ligne[iDebut] : '', heureFin: iFin >= 0 ? ligne[iFin] : '' });
    }
  }
  return brouillon([...new Set(manades)], [...epreuves.values()], []);
}

/** @param {string} xml */
function textesWord(xml) {
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((trouve) => trouve[1]).join('\n');
}

/** @param {Map<string, Buffer>} fichiers */
function texteClasseur(fichiers) {
  const partage = fichiers.get('xl/sharedStrings.xml')?.toString('utf8') ?? '';
  const chaines = [...partage.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((trouve) => trouve[1]);
  const feuille = [...fichiers.keys()].find((nom) => nom.startsWith('xl/worksheets/sheet')) ?? '';
  const xml = fichiers.get(feuille)?.toString('utf8') ?? '';
  const lignes = [...xml.matchAll(/<row[\s\S]*?<\/row>/g)].map((ligne) => {
    const cellules = [...ligne[0].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)].map((cellule) => {
      const type = /t="s"/.test(cellule[1]) ? 's' : 'n';
      const valeur = cellule[2].match(/<v>([^<]*)<\/v>/)?.[1] ?? '';
      return type === 's' ? chaines[Number(valeur)] ?? '' : valeur;
    });
    return cellules.join(',');
  });
  return lignes.join('\n');
}

/**
 * @param {{ nom: string, type: string, octets: Buffer, cleAnthropic?: string, modele?: string, demander?: typeof fetch }} entree
 */
export async function extrairePlanning(entree) {
  if (entree.octets.length > MAX_OCTETS) {
    return { brouillon: brouillon([], [], ['Fichier trop lourd (20 Mo maximum).'], false), empreinte: '', erreur: 'trop_gros' };
  }
  const empreinte = createHash('sha256').update(entree.octets).digest('hex');
  const nom = entree.nom.toLowerCase();
  const type = entree.type.toLowerCase();
  try {
    if (type.includes('csv') || nom.endsWith('.csv')) {
      return { brouillon: brouillonDepuisCsv(entree.octets.toString('utf8')), empreinte, erreur: null };
    }
    if (nom.endsWith('.xlsx') || nom.endsWith('.xls') || type.includes('spreadsheet') || type.includes('excel')) {
      const fichiers = lireZip(entree.octets);
      return { brouillon: brouillonDepuisCsv(texteClasseur(fichiers)), empreinte, erreur: null };
    }
    if (nom.endsWith('.docx') || type.includes('wordprocessingml')) {
      const xml = lireZip(entree.octets).get('word/document.xml')?.toString('utf8') ?? '';
      return { brouillon: brouillonDepuisTexte(textesWord(xml)), empreinte, erreur: null };
    }
    if (type.includes('pdf') || nom.endsWith('.pdf') || type.startsWith('image/') || /\.(png|jpe?g|webp|heic)$/.test(nom)) {
      if (!entree.cleAnthropic) {
        return {
          brouillon: brouillon([], [], ['La lecture automatique des PDF et des photos demande une clé Anthropic, absente de cet environnement. Saisissez le planning dans le tableau : rien n’est écrit tant que vous n’appliquez pas.'], false),
          empreinte,
          erreur: null,
        };
      }
      const lu = await lireAvecModele(entree);
      return { brouillon: lu, empreinte, erreur: null };
    }
    return { brouillon: brouillon([], [], ['Format non reconnu. Déposez un PDF, une photo, un Word, un Excel ou un CSV.'], false), empreinte, erreur: 'format' };
  } catch {
    return { brouillon: brouillon([], [], ['Le fichier n’a pas pu être lu. Vous pouvez saisir le planning à la main.'], false), empreinte, erreur: 'lecture' };
  }
}

/**
 * @param {{ nom: string, type: string, octets: Buffer, cleAnthropic?: string, modele?: string, demander?: typeof fetch }} entree
 */
async function lireAvecModele(entree) {
  const demander = entree.demander ?? fetch;
  const media = entree.type || (entree.nom.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  const contenu = media === 'application/pdf'
    ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: entree.octets.toString('base64') } }]
    : [{ type: 'image', source: { type: 'base64', media_type: media, data: entree.octets.toString('base64') } }];
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      manades: { type: 'array', items: { type: 'string' } },
      epreuves: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            nom: { type: 'string' },
            heureDebut: { type: 'string' },
            heureFin: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['nom', 'heureDebut', 'heureFin', 'description'],
        },
      },
      avertissements: { type: 'array', items: { type: 'string' } },
    },
    required: ['manades', 'epreuves', 'avertissements'],
  };
  const reponse = await demander('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': entree.cleAnthropic ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: entree.modele || 'claude-opus-5-5',
      max_tokens: 2000,
      output_config: { format: { type: 'json_schema', schema } },
      messages: [{
        role: 'user',
        content: [
          ...contenu,
          { type: 'text', text: 'Extrais le planning d’une olympiade de manades. Réponds uniquement selon le schéma. Si une épreuve n’est pas décrite, rédige une phrase et marque-le dans la description.' },
        ],
      }],
    }),
  });
  if (!reponse.ok) {
    return brouillon([], [], ['La lecture automatique a échoué. Le tableau reste modifiable, rien n’est écrit.']);
  }
  const corps = await reponse.json();
  const texte = Array.isArray(corps.content) ? corps.content.map((/** @type {{ text?: string }} */ bloc) => bloc.text ?? '').join('') : '';
  const json = JSON.parse(texte);
  const resultat = brouillon(json.manades ?? [], json.epreuves ?? [], json.avertissements ?? []);
  for (const epreuve of resultat.epreuves) {
    if (epreuve.description && !EPREUVES.some(([nom]) => normaliser(nom) === normaliser(epreuve.nom))) epreuve.descriptionIa = true;
  }
  return resultat;
}

/** Confirme que l’application est un acte séparé de l’extraction. @param {unknown} confirme */
export function pretAEcrire(confirme) {
  return confirme === true;
}
