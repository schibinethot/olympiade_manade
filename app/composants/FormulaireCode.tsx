import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  demanderCode,
  formaterDecompte,
  memoriserDemande,
  normaliserCode,
  oublierDemande,
  traduireErreurAuth,
  verifierCode,
  type DemandeCode,
} from '../lib/auth';
import { delaiRestant, useOtpCooldown } from '../lib/useOtpCooldown';
import { BOUTON_PRINCIPAL } from './FormulaireInscription';
import { Icone } from './Icone';
import { SaisieCode } from './SaisieCode';

type Etat = 'repos' | 'verification' | 'renvoi';

const CODE_INCOMPLET = 'Saisissez les 6 chiffres du code reçu par email.';

/**
 * Étape 2 : saisie du code reçu, « Renvoyer le code » après 60 s, « Changer d'email ».
 *
 * - Pas de vérification automatique à 6 chiffres (le projet d'origine la faisait) : le parcours du
 *   plan valide par le bouton « Valider », ou la touche Entrée.
 * - Verrou synchrone sur la vérification et sur le renvoi : un double clic ne part qu'une fois.
 * - Code refusé : message, saisie vidée et remise au focus, pour réessayer tout de suite. La
 *   saisie n'est donc jamais désactivée (un champ désactivé ne peut pas reprendre le focus).
 */
export function FormulaireCode({ demande }: { demande: DemandeCode }) {
  const id = useId();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [etat, setEtat] = useState<Etat>('repos');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const verrou = useRef(false);
  const { cooldownSeconds, isOnCooldown, startCooldown } = useOtpCooldown();

  // Décompte repris là où il en était (rechargement de la page) : l'heure d'envoi est connue.
  useEffect(() => {
    startCooldown(delaiRestant(demande.envoyeeLe));
  }, [demande.envoyeeLe, startCooldown]);

  const champ = `${id}-code`;
  const focaliser = () => document.getElementById(champ)?.focus();

  async function valider(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (verrou.current) return;
    const saisi = normaliserCode(code);
    if (!saisi) {
      setErreur(CODE_INCOMPLET);
      setInfo(null);
      focaliser();
      return;
    }
    verrou.current = true;
    setEtat('verification');
    setErreur(null);
    setInfo(null);
    try {
      await verifierCode(demande.email, saisi);
      oublierDemande();
      navigate('/noter', { replace: true });
    } catch (echec) {
      setErreur(traduireErreurAuth(echec, 'verification'));
      setCode('');
      setEtat('repos');
      verrou.current = false;
      focaliser();
    }
  }

  async function renvoyer() {
    if (verrou.current || isOnCooldown) return;
    verrou.current = true;
    setEtat('renvoi');
    setErreur(null);
    setInfo(null);
    try {
      await demanderCode(demande.prenom, demande.email);
      memoriserDemande({ ...demande, envoyeeLe: Date.now() });
      startCooldown();
      setInfo(`Un nouveau code a été envoyé à ${demande.email}.`);
    } catch (echec) {
      setErreur(traduireErreurAuth(echec, 'demande'));
    } finally {
      setEtat('repos');
      verrou.current = false;
    }
  }

  const occupe = etat !== 'repos';

  return (
    <form noValidate onSubmit={valider} aria-busy={occupe} className="grid gap-[18px]">
      <div className="grid gap-2">
        <label htmlFor={champ} className="text-[12px] font-semibold text-encre-2">
          Code à 6 chiffres
        </label>
        <SaisieCode
          id={champ}
          valeur={code}
          onChange={(valeur) => {
            setCode(valeur);
            if (erreur === CODE_INCOMPLET) setErreur(null);
          }}
          invalide={erreur !== null}
          description={`${id}-aide${erreur ? ` ${id}-erreur` : ''}`}
        />
        <p id={`${id}-aide`} className="text-[12.5px] text-encre-2">
          Vous pouvez coller le code reçu, même avec des espaces.
        </p>
        {/* Régions annoncées présentes dès le départ, sans hauteur tant qu'elles sont vides. */}
        <div>
          <div role="alert" id={`${id}-erreur`}>
            {erreur ? (
              <p className="mt-1 flex items-start gap-2 rounded-[13px] bg-[rgba(194,59,29,.08)] px-3.5 py-3 text-[14px] font-semibold text-rouge">
                <Icone nom="alerte" className="mt-0.5 size-[18px]" />
                {erreur}
              </p>
            ) : null}
          </div>
          <div role="status">
            {info ? (
              <p className="mt-1 flex items-start gap-2 rounded-[13px] bg-[rgba(47,122,79,.1)] px-3.5 py-3 text-[14px] font-semibold text-[#286b44]">
                <Icone nom="valide" className="mt-0.5 size-[18px]" />
                {info}
              </p>
            ) : null}
            {etat === 'verification' ? <span className="sr-only">Vérification du code…</span> : null}
            {etat === 'renvoi' ? <span className="sr-only">Envoi d’un nouveau code…</span> : null}
          </div>
        </div>
      </div>

      {/* Maquette : .ins-meta */}
      <div className="grid gap-0.5 text-[12.5px] leading-snug">
        <div className="flex flex-wrap items-center justify-between gap-x-2.5">
          <button
            type="button"
            onClick={renvoyer}
            disabled={isOnCooldown || occupe}
            className="inline-flex min-h-12 items-center font-semibold text-rouge underline underline-offset-2 disabled:cursor-not-allowed disabled:font-medium disabled:text-encre-2 disabled:no-underline"
          >
            {isOnCooldown ? `Renvoyer le code dans ${formaterDecompte(cooldownSeconds)}` : 'Renvoyer le code'}
          </button>
          <Link
            to="/inscription"
            className="inline-flex min-h-12 items-center font-semibold text-rouge underline underline-offset-2"
          >
            Changer d’email
          </Link>
        </div>
        <p className="text-encre-2">Le lien de connexion du même email marche aussi.</p>
      </div>

      <div className="grid gap-2.5">
        <button type="submit" disabled={occupe} className={BOUTON_PRINCIPAL}>
          Valider
          <Icone nom="fleche" />
        </button>
        <p className="flex items-center gap-2 text-[12px] text-encre-2">
          <Icone nom="cadenas" className="size-[15px]" />
          Vous restez connecté sur cet appareil, sans mot de passe.
        </p>
      </div>
    </form>
  );
}
