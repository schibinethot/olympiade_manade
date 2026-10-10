import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLANC, contraste, rvbDepuisHex, type Rvb } from '../outils/contraste';

const css = readFileSync(new URL('../../app/app.css', import.meta.url), 'utf8');

function variable(nom: string): string {
  const m = new RegExp(`--${nom}:\\s*([^;]+);`).exec(css);
  if (!m) throw new Error(`Variable --${nom} absente de app/app.css`);
  return m[1];
}

/** Arrêts « #rrggbb N% » d'un linear-gradient, dans l'ordre. */
function arrets(degrade: string): { couleur: Rvb; position: number }[] {
  return [...degrade.matchAll(/#([0-9a-f]{6})\s+(\d+(?:\.\d+)?)%/gi)].map((m) => ({
    couleur: rvbDepuisHex(m[1]),
    position: Number(m[2]),
  }));
}

/** Couleurs du dégradé tous les 1 % entre deux arrêts (interpolation sRGB, comme le navigateur). */
function echantillons(liste: { couleur: Rvb }[]): Rvb[] {
  const points: Rvb[] = [];
  for (let i = 0; i < liste.length - 1; i++) {
    const [a, b] = [liste[i].couleur, liste[i + 1].couleur];
    for (let pas = 0; pas <= 100; pas++) {
      const t = pas / 100;
      const melange = (c: 0 | 1 | 2) => Math.round(a[c] + (b[c] - a[c]) * t);
      points.push([melange(0), melange(1), melange(2)]);
    }
  }
  return points;
}

describe('dégradé couchant sous texte blanc (--couchant-bouton)', () => {
  it('a au moins trois arrêts lisibles', () => {
    expect(arrets(variable('couchant-bouton')).length).toBeGreaterThanOrEqual(3);
  });

  it('garde au moins 4,5:1 avec le blanc en tout point (AA, texte courant)', () => {
    const points = echantillons(arrets(variable('couchant-bouton')));
    const minimum = Math.min(...points.map((p) => contraste(BLANC, p)));
    expect(minimum).toBeGreaterThanOrEqual(4.5);
  });
});

describe('carte « Notez les Olympiades » sous texte blanc (--couchant-carte et sa lueur)', () => {
  it('a au moins trois arrêts lisibles', () => {
    expect(arrets(variable('couchant-carte')).length).toBeGreaterThanOrEqual(3);
  });

  it('garde au moins 4,5:1 avec le blanc en tout point, lueur posée par-dessus à toute opacité', () => {
    const fond = echantillons(arrets(variable('couchant-carte')));
    const lueur = rvbDepuisHex(variable('couchant-carte-lueur'));
    // La lueur radiale passe de l'opaque au transparent : composition alpha dans l'espace sRGB.
    const points = fond.flatMap((p) =>
      Array.from({ length: 11 }, (_, i) => {
        const a = i / 10;
        const melange = (c: 0 | 1 | 2) => Math.round(lueur[c] * a + p[c] * (1 - a));
        return [melange(0), melange(1), melange(2)] as const;
      }),
    );
    const minimum = Math.min(...points.map((p) => contraste(BLANC, p)));
    expect(minimum).toBeGreaterThanOrEqual(4.5);
  });
});

describe('page Dates : textes sur les fonds ajoutés', () => {
  const couleur = (nom: string) => rvbDepuisHex(variable(`color-${nom}`));
  const sur = (fond: Rvb, couche: Rvb, alpha: number): Rvb =>
    [0, 1, 2].map((c) => Math.round(couche[c] * alpha + fond[c] * (1 - alpha))) as unknown as Rvb;

  it('lien rouge sur la carte des archives (lin à 50 % sur sable) : 4,5:1 au moins', () => {
    const fond = sur(couleur('sable'), couleur('lin'), 0.5);
    expect(contraste(couleur('rouge'), fond)).toBeGreaterThanOrEqual(4.5);
  });

  it('« Prochaine soirée » en rouge sur la teinte couchant de la carte : 4,5:1 au moins', () => {
    const fond = sur(couleur('creme'), rvbDepuisHex('#ec7433'), 0.12);
    expect(contraste(couleur('rouge'), fond)).toBeGreaterThanOrEqual(4.5);
  });

  it('bouton « Billetterie » de la soirée du jour : 4,5:1 au moins', () => {
    expect(contraste(rvbDepuisHex('#9a2c12'), rvbDepuisHex('#fffaf2'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('textes rouges sur fond teinté de rouge (alertes, badge « Annulée », pastille « Ce soir »)', () => {
  const couleur = (nom: string) => rvbDepuisHex(variable(`color-${nom}`));
  const sur = (fond: Rvb, couche: Rvb, alpha: number): Rvb =>
    [0, 1, 2].map((c) => Math.round(couche[c] * alpha + fond[c] * (1 - alpha))) as unknown as Rvb;
  // Le rouge de la charte n'y tient que 4,23 à 4,60:1 : ces textes prennent un rouge plus sombre.
  const texte = () => couleur('rouge-alerte');

  it('alerte (rouge à 8 %) sur la carte sable et sur crème : 4,5:1 au moins', () => {
    for (const fond of ['sable', 'creme']) {
      expect(contraste(texte(), sur(couleur(fond), couleur('rouge'), 0.08)), fond).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('badge « Annulée » et pastille « Ce soir » (rouge à 10 %) sur crème et sur sable : 4,5:1 au moins', () => {
    for (const fond of ['creme', 'sable']) {
      expect(contraste(texte(), sur(couleur(fond), couleur('rouge'), 0.1)), fond).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('chaque texte posé sur un fond teinté de rouge utilise ce rouge sombre', () => {
    const fichiers = [
      'app/composants/FormulaireCode.tsx',
      'app/composants/FormulaireInscription.tsx',
      'app/routes/inscription-code.tsx',
      'app/composants/FormulaireContact.tsx',
      'app/composants/BadgeSoiree.tsx',
      'app/composants/Entete.tsx',
    ];
    for (const fichier of fichiers) {
      const source = readFileSync(new URL(`../../${fichier}`, import.meta.url), 'utf8');
      // Classe complète (jusqu'au guillemet ou à l'accent grave) de chaque fond rouge à 8 ou 10 %.
      const classes = [...source.matchAll(/bg-\[rgba\(194,59,29,\.(?:08|1)\)\][^"`]*/g)].map((m) => m[0]);
      expect(classes.length, fichier).toBeGreaterThan(0);
      for (const classe of classes) expect(classe, fichier).toMatch(/\btext-rouge-alerte\b/);
    }
  });
});

describe('pages d’inscription : texte blanc sur la photo des arènes (Task 6)', () => {
  // Pixel le plus clair possible du duotone (.duo) : photo blanche, multipliée par l'arrêt le plus
  // clair du dégradé (#ffe2bd), puis éclaircie par l'aplat #4a170a (mode « screen »).
  const ecran = (a: number, b: number) => Math.round(255 - ((255 - a) * (255 - b)) / 255);
  const plusClair: Rvb = [ecran(0xff, 0x4a), ecran(0xe2, 0x17), ecran(0xbd, 0x0a)];

  function rgba(nom: string): { couleur: Rvb; alpha: number } {
    const m = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(variable(nom));
    if (!m) throw new Error(`--${nom} n'est pas une couleur rgba()`);
    return { couleur: [Number(m[1]), Number(m[2]), Number(m[3])], alpha: Number(m[4]) };
  }

  it('garde au moins 4,5:1 sous le voile, du haut (le plus clair) au bas', () => {
    for (const nom of ['voile-inscription-haut', 'voile-inscription-bas']) {
      const { couleur, alpha } = rgba(nom);
      const fond = [0, 1, 2].map((c) => Math.round(couleur[c] * alpha + plusClair[c] * (1 - alpha))) as unknown as Rvb;
      expect(contraste(BLANC, fond), nom).toBeGreaterThanOrEqual(4.5);
    }
  });
});
