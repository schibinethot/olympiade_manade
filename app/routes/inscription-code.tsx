import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { CadreInscription, TitreEtape } from '../composants/CadreInscription';
import { FormulaireCode } from '../composants/FormulaireCode';
import { Icone } from '../composants/Icone';
import { demandeEnCours, demandeValide } from '../lib/auth';
import { useSession } from '../lib/useSession';
import type { Route } from './+types/inscription-code';

export const meta: Route.MetaFunction = () => [
  { title: 'Code reçu · Olympiade des Manades' },
  { name: 'robots', content: 'noindex' },
];

/** Paramètres d'une adresse (« ?a=1 » ou « #a=1 »). */
function parametres(texte: string): URLSearchParams {
  return new URLSearchParams(texte.replace(/^[?#]/, ''));
}

/**
 * Étape 2 de l'inscription. On y arrive :
 * - depuis /inscription, avec la demande en cours (état de navigation ou stockage de l'onglet) ;
 * - par le lien de secours de l'email : supabase-js échange le « code » de l'adresse (PKCE) contre
 *   une session, puis la page mène à /noter. Supabase renvoie ici aussi un lien expiré, avec
 *   « error_code » dans l'adresse.
 */
export default function InscriptionCode() {
  const { session, chargement } = useSession();
  const { state, search, hash } = useLocation();
  const [demande] = useState(() => demandeValide(state) ?? demandeEnCours());
  const [adresse] = useState(() => {
    const requete = parametres(search);
    const fragment = parametres(hash);
    return {
      lienExpire: [requete, fragment].some((p) => p.has('error_code') || p.has('error_description')),
      echangeEnCours: requete.has('code'),
    };
  });

  if (session) return <Navigate to="/noter" replace />;

  return (
    <CadreInscription etape={2}>
      <TitreEtape titre="Entrez le code reçu">
        {demande ? (
          <p>
            Nous avons envoyé un code à 6 chiffres à <b className="font-semibold text-encre [overflow-wrap:anywhere]">{demande.email}</b>. Il est
            valable 1 heure.
          </p>
        ) : null}
      </TitreEtape>

      {adresse.lienExpire ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[13px] bg-[rgba(194,59,29,.08)] px-3.5 py-3 text-[14px] font-semibold text-rouge"
        >
          <Icone nom="alerte" className="mt-0.5 size-[18px]" />
          <span>
            Ce lien de connexion n’est plus valable. Saisissez le code à 6 chiffres reçu dans le même email, ou demandez un
            nouveau code.
          </span>
        </p>
      ) : null}

      {adresse.echangeEnCours && chargement ? (
        <p role="status" className="text-encre-2">
          Connexion en cours…
        </p>
      ) : demande ? (
        <FormulaireCode demande={demande} />
      ) : (
        <div className="grid gap-3 text-encre-2">
          <p>Aucune demande de code en cours sur cet appareil.</p>
          <p>
            Le lien de connexion de l’email s’ouvre dans le navigateur où le code a été demandé. Ailleurs, demandez un
            nouveau code&nbsp;: il arrive en quelques instants.
          </p>
          <Link
            to="/inscription"
            className="inline-flex min-h-12 items-center gap-1.5 self-start font-semibold text-rouge underline underline-offset-2"
          >
            Recevoir un code
            <Icone nom="fleche" className="size-4" />
          </Link>
        </div>
      )}
    </CadreInscription>
  );
}
