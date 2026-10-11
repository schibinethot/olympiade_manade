import { useState } from 'react';
import { Navigate } from 'react-router';
import { CadreInscription, TitreEtape } from '../composants/CadreInscription';
import { FormulaireInscription } from '../composants/FormulaireInscription';
import { demandeEnCours } from '../lib/auth';
import { useSession } from '../lib/useSession';
import type { Route } from './+types/inscription';

export const meta: Route.MetaFunction = () => [
  { title: 'Inscription · Olympiade des Manades' },
  {
    name: 'description',
    content: 'Inscrivez-vous en 30 secondes pour noter les manades : prénom, email, puis un code à 6 chiffres reçu par email.',
  },
  // Hors des moteurs de recherche en permanence, quel que soit le drapeau VITE_INSCRIPTION_OUVERTE :
  // page monopage, sans contenu à indexer, que le serveur envoie toujours avec
  // X-Robots-Tag: noindex (serveur/application.mjs).
  { name: 'robots', content: 'noindex' },
];

// Route sans pré-rendu (repli monopage) : elle ne s'affiche que dans le navigateur.
export default function Inscription() {
  const { session } = useSession();
  // Prénom et email d'une demande précédente : « Changer d'email » revient ici, formulaire rempli.
  const [precedente] = useState(demandeEnCours);

  if (session) return <Navigate to="/noter" replace />;

  return (
    <CadreInscription etape={1}>
      <TitreEtape titre="Le soir venu, vous notez aussi">
        <p>Votre prénom et votre email suffisent. Pas de mot de passe.</p>
      </TitreEtape>
      <FormulaireInscription initial={precedente} />
    </CadreInscription>
  );
}
