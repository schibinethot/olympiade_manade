import type { ReactNode } from 'react';
import { identiteRemplie, type IdentiteLegale } from '../lib/identite';
import { useIdentiteLegale } from '../lib/useIdentiteLegale';
import { EncadreOrganisateur } from './TexteLegal';

const NB = '\u00a0';

/** Lignes de l'éditeur du site (mentions légales). */
function lignesEditeur(identite: IdentiteLegale): (string | null)[] {
  return [
    identite.raison_sociale,
    identite.forme_juridique,
    identite.adresse,
    identite.telephone,
    identite.email,
    identite.immatriculation,
    identite.capital,
    identite.tva,
    identite.directeur_publication ? `Directeur de la publication${NB}: ${identite.directeur_publication}` : null,
  ];
}

/** Identité et coordonnées du responsable du traitement (page Confidentialité, art. 13(1)(a) RGPD). */
function lignesResponsable(identite: IdentiteLegale): (string | null)[] {
  return [
    identite.raison_sociale,
    identite.forme_juridique,
    identite.adresse,
    identite.telephone ? `Téléphone${NB}: ${identite.telephone}` : null,
    identite.email ? `Email${NB}: ${identite.email}` : null,
    identite.immatriculation,
  ];
}

/**
 * Identité de l'organisateur lue dans identite_legale. Tant qu'elle n'est pas connue, ou si elle est
 * vide, l'encadré « À compléter par l'organisateur » affiche le repli : aucune valeur inventée.
 */
export function IdentitePublique({ repli, variante = 'editeur', avant }: {
  repli: ReactNode;
  variante?: 'editeur' | 'responsable';
  /** Phrase d'introduction, affichée seulement avec l'identité. */
  avant?: ReactNode;
}) {
  const { connue, identite } = useIdentiteLegale();

  if (!connue || !identite || !identiteRemplie(identite)) {
    return <EncadreOrganisateur>{repli}</EncadreOrganisateur>;
  }
  const lignes = (variante === 'responsable' ? lignesResponsable(identite) : lignesEditeur(identite))
    .filter((ligne): ligne is string => Boolean(ligne?.trim()));
  return (
    <>
      {avant}
      <ul>
        {lignes.map((ligne) => <li key={ligne}>{ligne}</li>)}
      </ul>
    </>
  );
}
