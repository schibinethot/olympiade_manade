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

/** Colonnes lues par les pages publiques et l'admin (table identite_legale, lisible par tous). */
export const COLONNES_IDENTITE = CHAMPS_IDENTITE.map(({ cle }) => cle).join(', ');

export function identiteRemplie(identite: IdentiteLegale | null): boolean {
  if (!identite) return false;
  return Boolean(identite.raison_sociale?.trim() || identite.email?.trim() || identite.directeur_publication?.trim());
}

/** Valeur d'un champ sur une ligne : espaces et retours à la ligne réduits à une espace, null si vide. */
const propre = (valeur: string | null | undefined) => valeur?.replace(/\s+/g, ' ').trim() || null;

/** Nom ou raison sociale de l'organisateur, null s'il n'est pas renseigné. */
export function nomOrganisateur(identite: IdentiteLegale | null): string | null {
  return propre(identite?.raison_sociale);
}

/**
 * Ligne d'identité du pied des emails (revue juridique B4, contrat C-0.5 `organisateur`) :
 * « L’Olympiade des Manades est organisée par [nom], [forme juridique], [adresse]. », avec les seuls
 * champs renseignés. Null sans nom : aucune valeur n'est inventée.
 */
export function ligneOrganisateur(identite: IdentiteLegale | null): string | null {
  const nom = nomOrganisateur(identite);
  if (!nom) return null;
  const parties = [nom, propre(identite?.forme_juridique), propre(identite?.adresse)].filter(Boolean);
  return `L’Olympiade des Manades est organisée par ${parties.join(', ')}.`;
}
