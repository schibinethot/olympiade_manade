export type IdentiteLegale = {
  raison_sociale: string | null;
  forme_juridique: string | null;
  adresse: string | null;
  telephone: string | null;
  email: string | null;
  immatriculation: string | null;
  capital: string | null;
  tva: string | null;
  directeur_publication: string | null;
};

export const CHAMPS_IDENTITE: { cle: keyof IdentiteLegale; libelle: string }[] = [
  { cle: 'raison_sociale', libelle: 'Nom ou raison sociale' },
  { cle: 'forme_juridique', libelle: 'Forme juridique' },
  { cle: 'adresse', libelle: 'Adresse' },
  { cle: 'telephone', libelle: 'Téléphone' },
  { cle: 'email', libelle: 'Email' },
  { cle: 'immatriculation', libelle: 'Immatriculation' },
  { cle: 'capital', libelle: 'Capital' },
  { cle: 'tva', libelle: 'TVA' },
  { cle: 'directeur_publication', libelle: 'Directeur de la publication' },
];

export function identiteRemplie(identite: IdentiteLegale | null): boolean {
  if (!identite) return false;
  return Boolean(identite.raison_sociale?.trim() || identite.email?.trim() || identite.directeur_publication?.trim());
}
