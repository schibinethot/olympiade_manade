import { describe, expect, it } from 'vitest';
import { COLONNES_IDENTITE, ligneOrganisateur, nomOrganisateur, type IdentiteLegale } from '../../app/lib/identite';

const VIDE: IdentiteLegale = {
  raison_sociale: null, forme_juridique: null, adresse: null, telephone: null, email: null,
  immatriculation: null, capital: null, tva: null, directeur_publication: null,
};

describe('identité de l’organisateur', () => {
  it('lit les mêmes colonnes que les mentions légales', () => {
    expect(COLONNES_IDENTITE).toBe('raison_sociale, forme_juridique, adresse, telephone, email, immatriculation, capital, tva, directeur_publication');
  });

  it('construit la ligne du pied des emails avec les seuls champs renseignés', () => {
    expect(ligneOrganisateur({ ...VIDE, raison_sociale: 'Association des Manades', forme_juridique: 'association loi 1901', adresse: '1 place des Arènes,\n30250 Sommières' }))
      .toBe('L’Olympiade des Manades est organisée par Association des Manades, association loi 1901, 1 place des Arènes, 30250 Sommières.');
    expect(ligneOrganisateur({ ...VIDE, raison_sociale: '  Comité des fêtes  ', email: 'contact@exemple.fr' }))
      .toBe('L’Olympiade des Manades est organisée par Comité des fêtes.');
  });

  it('ne fabrique aucune ligne sans nom : l’identité est alors manquante', () => {
    expect(ligneOrganisateur(null)).toBeNull();
    expect(ligneOrganisateur(VIDE)).toBeNull();
    expect(ligneOrganisateur({ ...VIDE, raison_sociale: '   ', forme_juridique: 'SAS', adresse: 'Nîmes' })).toBeNull();
    expect(nomOrganisateur({ ...VIDE, email: 'contact@exemple.fr' })).toBeNull();
    expect(nomOrganisateur({ ...VIDE, raison_sociale: ' Manade\tVinuesa ' })).toBe('Manade Vinuesa');
  });
});
