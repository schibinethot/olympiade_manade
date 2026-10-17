// @ts-check
// Lecteur ZIP minimal (fichiers stockés ou déflatés) pour .docx et .xlsx.

import { inflateRawSync } from 'node:zlib';

/**
 * @param {Buffer} archive
 * @returns {Map<string, Buffer>}
 */
export function lireZip(archive) {
  /** @type {Map<string, Buffer>} */
  const fichiers = new Map();
  let fin = archive.length - 22;
  while (fin >= 0 && archive.readUInt32LE(fin) !== 0x06054b50) fin -= 1;
  if (fin < 0) throw new Error('Archive illisible.');
  const total = archive.readUInt16LE(fin + 10);
  let curseur = archive.readUInt32LE(fin + 16);
  for (let i = 0; i < total; i += 1) {
    if (archive.readUInt32LE(curseur) !== 0x02014b50) break;
    const methode = archive.readUInt16LE(curseur + 10);
    const compresse = archive.readUInt32LE(curseur + 20);
    const nomLongueur = archive.readUInt16LE(curseur + 28);
    const extra = archive.readUInt16LE(curseur + 30);
    const commentaire = archive.readUInt16LE(curseur + 32);
    const nom = archive.subarray(curseur + 46, curseur + 46 + nomLongueur).toString('utf8');
    const local = archive.readUInt32LE(curseur + 42);
    const nomLocal = archive.readUInt16LE(local + 26);
    const extraLocal = archive.readUInt16LE(local + 28);
    const debut = local + 30 + nomLocal + extraLocal;
    const donnees = archive.subarray(debut, debut + compresse);
    fichiers.set(nom, methode === 0 ? Buffer.from(donnees) : methode === 8 ? inflateRawSync(donnees) : Buffer.alloc(0));
    curseur += 46 + nomLongueur + extra + commentaire;
  }
  return fichiers;
}

/**
 * @param {Record<string, string | Buffer>} entrees
 */
export function ecrireZip(entrees) {
  /** @type {Buffer[]} */
  const morceaux = [];
  /** @type {{ nom: string, debut: number, taille: number }[]} */
  const catalogue = [];
  let taille = 0;
  for (const [nom, contenu] of Object.entries(entrees)) {
    const donnees = Buffer.isBuffer(contenu) ? contenu : Buffer.from(contenu);
    const nomBuf = Buffer.from(nom);
    const entete = Buffer.alloc(30);
    entete.writeUInt32LE(0x04034b50, 0);
    entete.writeUInt16LE(20, 4);
    entete.writeUInt16LE(nomBuf.length, 26);
    entete.writeUInt32LE(donnees.length, 18);
    entete.writeUInt32LE(donnees.length, 22);
    catalogue.push({ nom, debut: taille, taille: donnees.length });
    morceaux.push(entete, nomBuf, donnees);
    taille += entete.length + nomBuf.length + donnees.length;
  }
  const debutCatalogue = taille;
  for (const entree of catalogue) {
    const nomBuf = Buffer.from(entree.nom);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(nomBuf.length, 28);
    central.writeUInt32LE(entree.taille, 20);
    central.writeUInt32LE(entree.taille, 24);
    central.writeUInt32LE(entree.debut, 42);
    morceaux.push(central, nomBuf);
    taille += central.length + nomBuf.length;
  }
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(catalogue.length, 8);
  fin.writeUInt16LE(catalogue.length, 10);
  fin.writeUInt32LE(taille - debutCatalogue, 12);
  fin.writeUInt32LE(debutCatalogue, 16);
  morceaux.push(fin);
  return Buffer.concat(morceaux);
}
