import { encode } from 'uqr';

const WIN_ANSI: Record<string, number> = {
  '€': 0x80, 'Œ': 0x8c, 'œ': 0x9c, 'Ÿ': 0x9f,
  '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '–': 0x96, '—': 0x97,
  ' ': 0xa0, '«': 0xab, '»': 0xbb,
  'À': 0xc0, 'Â': 0xc2, 'Ä': 0xc4, 'Ç': 0xc7, 'È': 0xc8, 'É': 0xc9, 'Ê': 0xca, 'Ë': 0xcb,
  'Î': 0xce, 'Ï': 0xcf, 'Ô': 0xd4, 'Ö': 0xd6, 'Ù': 0xd9, 'Û': 0xdb, 'Ü': 0xdc,
  'à': 0xe0, 'â': 0xe2, 'ä': 0xe4, 'ç': 0xe7, 'è': 0xe8, 'é': 0xe9, 'ê': 0xea, 'ë': 0xeb,
  'î': 0xee, 'ï': 0xef, 'ô': 0xf4, 'ö': 0xf6, 'ù': 0xf9, 'û': 0xfb, 'ü': 0xfc,
};

export function matriceQr(texte: string): boolean[][] {
  return encode(texte, { ecc: 'M', border: 2 }).data;
}

function echapper(valeur: string): string {
  let sortie = '';
  for (const caractere of valeur) {
    if (caractere === '\\' || caractere === '(' || caractere === ')') {
      sortie += `\\${caractere}`;
      continue;
    }
    const code = caractere.codePointAt(0) ?? 63;
    if (code >= 32 && code <= 126) {
      sortie += caractere;
      continue;
    }
    const ansi = WIN_ANSI[caractere];
    sortie += ansi == null ? '?' : `\\${ansi.toString(8).padStart(3, '0')}`;
  }
  return sortie;
}

export type DocumentPdf = {
  titre: string;
  lignes: string[];
  qr?: boolean[][];
  legendeQr?: string;
};

/** PDF d’une page, police standard, sans dépendance. */
export function documentPdf({ titre, lignes, qr, legendeQr }: DocumentPdf): Uint8Array {
  const operations: string[] = [];
  operations.push('BT');
  operations.push('/F1 22 Tf');
  operations.push('48 780 Td');
  operations.push(`(${echapper(titre)}) Tj`);
  operations.push('/F1 12 Tf');
  let y = 748;
  for (const ligne of lignes.slice(0, 28)) {
    y -= 18;
    operations.push(`1 0 0 1 48 ${y} Tm`);
    operations.push(`(${echapper(ligne)}) Tj`);
  }
  operations.push('ET');
  if (qr && qr.length) {
    const module = Math.max(3, Math.min(8, Math.floor(220 / qr.length)));
    const taille = module * qr.length;
    const origineX = 48;
    const origineY = Math.max(48, y - taille - 36);
    operations.push('0 0 0 rg');
    for (let ligne = 0; ligne < qr.length; ligne += 1) {
      const rangee = qr[ligne] ?? [];
      for (let colonne = 0; colonne < rangee.length; colonne += 1) {
        if (!rangee[colonne]) continue;
        const x = origineX + colonne * module;
        const bas = origineY + (qr.length - 1 - ligne) * module;
        operations.push(`${x} ${bas} ${module} ${module} re`);
      }
    }
    operations.push('f');
    if (legendeQr) {
      operations.push('BT');
      operations.push('/F1 11 Tf');
      operations.push(`1 0 0 1 48 ${Math.max(36, origineY - 16)} Tm`);
      operations.push(`(${echapper(legendeQr)}) Tj`);
      operations.push('ET');
    }
  }
  const flux = operations.join('\n');
  const octetsFlux = new TextEncoder().encode(flux).length;
  const objets = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${octetsFlux} >>\nstream\n${flux}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let corps = '%PDF-1.4\n';
  const encoder = new TextEncoder();
  const offsets = [0];
  objets.forEach((objet, index) => {
    offsets.push(encoder.encode(corps).length);
    corps += `${index + 1} 0 obj\n${objet}\nendobj\n`;
  });
  const xref = encoder.encode(corps).length;
  corps += `xref\n0 ${objets.length + 1}\n`;
  corps += '0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) corps += `${String(offset).padStart(10, '0')} 00000 n \n`;
  corps += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return encoder.encode(corps);
}

export function telechargerFichier(nom: string, octets: Uint8Array, type: string) {
  const url = URL.createObjectURL(new Blob([octets as BlobPart], { type }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
