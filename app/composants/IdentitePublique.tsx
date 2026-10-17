import { useEffect, useState, type ReactNode } from 'react';
import { identiteRemplie, type IdentiteLegale } from '../lib/identite';
import { supabase } from '../lib/supabase';
import { EncadreOrganisateur } from './TexteLegal';

export function IdentitePublique({ repli }: { repli: ReactNode }) {
  const [identite, setIdentite] = useState<IdentiteLegale | null>(null);
  const [connue, setConnue] = useState(false);

  useEffect(() => {
    let actif = true;
    supabase().then((client) => client.from('identite_legale').select('raison_sociale, forme_juridique, adresse, telephone, email, immatriculation, capital, tva, directeur_publication').limit(1).maybeSingle())
      .then(({ data }) => { if (actif) setIdentite((data ?? null) as IdentiteLegale | null); })
      .catch(() => undefined)
      .finally(() => { if (actif) setConnue(true); });
    return () => { actif = false; };
  }, []);

  if (!connue || !identiteRemplie(identite) || !identite) {
    return <EncadreOrganisateur>{repli}</EncadreOrganisateur>;
  }
  const lignes = [
    identite.raison_sociale,
    identite.forme_juridique,
    identite.adresse,
    identite.telephone,
    identite.email,
    identite.immatriculation,
    identite.capital,
    identite.tva,
    identite.directeur_publication ? `Directeur de la publication : ${identite.directeur_publication}` : null,
  ].filter((ligne): ligne is string => Boolean(ligne?.trim()));
  return (
    <ul>
      {lignes.map((ligne) => <li key={ligne}>{ligne}</li>)}
    </ul>
  );
}
