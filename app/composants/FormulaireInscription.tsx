import { useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  demanderCode,
  memoriserDemande,
  normaliserEmail,
  traduireErreurAuth,
  validerInscription,
  type ChampsInscription,
  type ErreursInscription,
} from '../lib/auth';
import { Icone } from './Icone';
import { VerificationHumaine } from './VerificationHumaine';

type Envoi = 'repos' | 'en-cours' | 'echec';

const LIBELLE = 'text-[12px] font-semibold text-encre-2';
// Bordure #958a77 : 3:1 au moins sur sable (WCAG 1.4.11), comme le formulaire de contact.
const CHAMP =
  'min-h-12 w-full rounded-[13px] border border-[#958a77] bg-sable px-3.5 py-3 text-base text-encre aria-invalid:border-rouge';
const ERREUR = 'flex items-start gap-1.5 text-[13px] leading-snug text-rouge';
/** Bouton principal en dégradé couchant (maquette : .btn-sun.btn-lg). */
export const BOUTON_PRINCIPAL =
  'inline-flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[17px] bg-couchant-bouton px-6 text-[16.5px] leading-none font-semibold text-white shadow-[0_10px_24px_-10px_rgba(194,59,29,0.75),inset_0_1px_0_rgba(255,255,255,0.25)] transition-[filter,transform] hover:brightness-105 active:scale-[0.97] disabled:cursor-wait disabled:opacity-70';

type Props = {
  /** Prénom et email d'une demande précédente (« Changer d'email »). */
  initial: { prenom: string; email: string } | null;
};

/**
 * Étape 1 : prénom, email et consentement, puis envoi du code (supabase.auth.signInWithOtp).
 *
 * - Un seul envoi à la fois : verrou synchrone (repris d'un projet interne) et bouton
 *   désactivé pendant l'envoi.
 * - Même suite pour un email déjà inscrit : rien ne révèle qu'un compte existe.
 * - La demande (prénom, email, heure d'envoi) passe à /inscription/code par l'onglet
 *   (sessionStorage) et par l'état de navigation, si le stockage est refusé.
 */
export function FormulaireInscription({ initial }: Props) {
  const id = useId();
  const navigate = useNavigate();
  const [champs, setChamps] = useState<ChampsInscription>({
    prenom: initial?.prenom ?? '',
    email: initial?.email ?? '',
    consentement: false,
  });
  const [erreurs, setErreurs] = useState<ErreursInscription>({});
  const [verifier, setVerifier] = useState(false);
  const [envoi, setEnvoi] = useState<Envoi>('repos');
  const [echec, setEchec] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [reinitialisationCaptcha, setReinitialisationCaptcha] = useState(0);
  const verrou = useRef(false);

  function modifier<K extends keyof ChampsInscription>(nom: K, valeur: ChampsInscription[K]) {
    const suivant = { ...champs, [nom]: valeur };
    setChamps(suivant);
    if (verifier) setErreurs(validerInscription(suivant));
  }

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (verrou.current) return;

    const trouvees = validerInscription(champs);
    setVerifier(true);
    setErreurs(trouvees);
    if (Object.keys(trouvees).length > 0) {
      const premier = (['prenom', 'email', 'consentement'] as const).find((nom) => trouvees[nom]);
      document.getElementById(`${id}-${premier}`)?.focus();
      return;
    }
    if (!captchaToken) {
      setEchec('Validez la vérification anti-robot avant de continuer.');
      return;
    }

    verrou.current = true;
    setEnvoi('en-cours');
    setEchec(null);
    const prenom = champs.prenom.trim();
    const email = normaliserEmail(champs.email);
    try {
      await demanderCode(prenom, email, captchaToken);
      const demande = { prenom, email, envoyeeLe: Date.now() };
      memoriserDemande(demande);
      navigate('/inscription/code', { state: demande });
    } catch (erreur) {
      setEchec(traduireErreurAuth(erreur, 'demande'));
      setEnvoi('echec');
      verrou.current = false;
    } finally {
      setCaptchaToken(null);
      setReinitialisationCaptcha((valeur) => valeur + 1);
    }
  }

  const description = (nom: keyof ChampsInscription, ...autres: string[]) =>
    [erreurs[nom] ? `${id}-${nom}-erreur` : null, ...autres].filter(Boolean).join(' ') || undefined;

  const erreur = (nom: keyof ChampsInscription) =>
    erreurs[nom] ? (
      <p id={`${id}-${nom}-erreur`} className={ERREUR}>
        <Icone nom="alerte" className="mt-px size-4" />
        {erreurs[nom]}
      </p>
    ) : null;

  const enCours = envoi === 'en-cours';

  return (
    <form noValidate onSubmit={soumettre} aria-busy={enCours} className="grid gap-[18px]">
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-prenom`} className={LIBELLE}>
            Prénom
          </label>
          <input
            id={`${id}-prenom`}
            name="prenom"
            type="text"
            autoComplete="given-name"
            maxLength={60}
            value={champs.prenom}
            onChange={(e) => modifier('prenom', e.target.value)}
            aria-invalid={erreurs.prenom ? true : undefined}
            aria-describedby={description('prenom')}
            className={CHAMP}
          />
          {erreur('prenom')}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-email`} className={LIBELLE}>
            Email
          </label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={254}
            value={champs.email}
            onChange={(e) => modifier('email', e.target.value)}
            aria-invalid={erreurs.email ? true : undefined}
            aria-describedby={description('email')}
            className={CHAMP}
          />
          {erreur('email')}
        </div>
      </div>

      {/* Consentement (maquette : .check). Case native, restylée ; l'explication est sa description. */}
      <div className="grid grid-cols-[22px_1fr] gap-x-2.5 gap-y-1 text-[13px] leading-[1.45] text-encre-2">
        <span className="relative mt-px grid size-[22px] place-items-center">
          <input
            id={`${id}-consentement`}
            name="consentement"
            type="checkbox"
            checked={champs.consentement}
            onChange={(e) => modifier('consentement', e.target.checked)}
            aria-invalid={erreurs.consentement ? true : undefined}
            aria-describedby={description('consentement', `${id}-usage`)}
            className="peer size-[22px] cursor-pointer appearance-none rounded-[7px] border-[1.5px] border-[#958a77] bg-creme checked:border-encre checked:bg-encre aria-invalid:border-rouge"
          />
          <Icone nom="valide" className="pointer-events-none absolute size-[15px] text-sable opacity-0 peer-checked:opacity-100" />
        </span>
        <label htmlFor={`${id}-consentement`} className="cursor-pointer">
          J’accepte la{' '}
          <Link
            to="/confidentialite"
            target="_blank"
            rel="noopener"
            className="font-semibold text-rouge underline underline-offset-2"
          >
            politique de confidentialité
            <span className="sr-only"> (nouvel onglet)</span>
          </Link>
        </label>
        <p id={`${id}-usage`} className="col-start-2">
          Votre prénom et votre email servent uniquement à l’inscription et au vote du public.
        </p>
        <div className="col-start-2">{erreur('consentement')}</div>
      </div>

      <div className="grid gap-2.5">
        <VerificationHumaine
          action="inscription"
          reinitialisation={reinitialisationCaptcha}
          onJetonChange={setCaptchaToken}
        />
        <button type="submit" disabled={enCours} className={BOUTON_PRINCIPAL}>
          Recevoir mon code
          <Icone nom="fleche" />
        </button>
        <div role="status" className="sr-only">
          {enCours ? 'Envoi du code…' : ''}
        </div>
        <div role="alert">
          {echec ? (
            <p className="flex items-start gap-2 rounded-[13px] bg-[rgba(194,59,29,.08)] px-3.5 py-3 text-[14px] font-semibold text-rouge-alerte">
              <Icone nom="alerte" className="mt-0.5 size-[18px]" />
              {echec}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
