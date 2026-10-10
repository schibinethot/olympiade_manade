// Calcul du rapport de contraste WCAG 2 (luminance relative sRGB), partagé par les tests
// unitaires et e2e.

export type Rvb = readonly [number, number, number];

export const BLANC: Rvb = [255, 255, 255];

export function rvbDepuisHex(hex: string): Rvb {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) throw new Error(`Couleur hexadécimale invalide : ${hex}`);
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/** Lit une couleur calculée par le navigateur, de la forme « rgb(28, 25, 18) ». */
export function rvbDepuisCss(valeur: string): Rvb {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(valeur);
  if (!m) throw new Error(`Couleur CSS illisible : ${valeur}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function canalLineaire(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance([r, v, b]: Rvb): number {
  return 0.2126 * canalLineaire(r) + 0.7152 * canalLineaire(v) + 0.0722 * canalLineaire(b);
}

export function contraste(a: Rvb, b: Rvb): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
}
