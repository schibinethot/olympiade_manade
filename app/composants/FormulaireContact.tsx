import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router';
import { LIMITES_CONTACT, longueur, normaliserContact, validerContact, type ChampsContact, type ErreursContact } from '../lib/contact';
import { envoyerMessageContact } from '../lib/donnees';
import { Icone } from './Icone';
import { VerificationHumaine } from './VerificationHumaine';

type Envoi = 'repos' | 'en-cours' | 'succes' | 'echec';

const VIDE: ChampsContact = { prenom: '', email: '', message: '' };

const LIBELLE = 'text-[12px] font-semibold text-encre-2';
// Bordure #958a77 : 3,28:1 sur crème et 3,09:1 sur sable (WCAG 1.4.11, contour d'un champ). Le
// trait #e3dacb de la maquette n'a que 1,2:1.
const CHAMP =
  'min-h-12 w-full rounded-[13px] border border-[#958a77] bg-sable px-3.5 py-3 text-base text-encre aria-invalid:border-rouge';
const ERREUR = 'flex items-start gap-1.5 text-[13px] leading-snug text-rouge';

/**
 * Formulaire de contact (maquette : carte « Infos & dates »), partagé par l'accueil et /contact.
 *
 * - Validation identique aux contraintes de public.messages_contact (app/lib/contact.ts).
 * - Champ piège « site_web », invisible, contrôlé par le serveur sans confirmer sa détection.
 * - Un seul envoi à la fois : verrou synchrone et bouton désactivé pendant l'envoi.
 * - Insertion sans .select() (envoyerMessageContact).
 */
export function FormulaireContact() {
  const id = useId();
  const [champs, setChamps] = useState<ChampsContact>(VIDE);
  const [erreurs, setErreurs] = useState<ErreursContact>({});
  const [verifier, setVerifier] = useState(false);
  const [envoi, setEnvoi] = useState<Envoi>('repos');
  const [jetonTurnstile, setJetonTurnstile] = useState<string | null>(null);
  const [reinitialisationVerification, setReinitialisationVerification] = useState(0);
  const [erreurEnvoi, setErreurEnvoi] = useState('');
  const verrou = useRef(false);
  // Bouton inactif tant que React n'est pas monté : un clic avant l'hydratation ne doit rien envoyer.
  const [pret, setPret] = useState(false);
  useEffect(() => setPret(true), []);
  const { pathname } = useLocation();
  const piege = useRef<HTMLInputElement>(null);

  function modifier(nom: keyof ChampsContact, valeur: string) {
    const suivant = { ...champs, [nom]: valeur };
    setChamps(suivant);
    if (verifier) setErreurs(validerContact(suivant));
    if (envoi === 'succes' || envoi === 'echec') setEnvoi('repos');
    setErreurEnvoi('');
  }

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (verrou.current) return;

    const trouvees = validerContact(champs);
    setVerifier(true);
    setErreurs(trouvees);
    if (Object.keys(trouvees).length > 0) {
      const premier = (['prenom', 'email', 'message'] as const).find((nom) => trouvees[nom]);
      document.getElementById(`${id}-${premier}`)?.focus();
      return;
    }

    verrou.current = true;
    setEnvoi('en-cours');
    try {
      await envoyerMessageContact(normaliserContact(champs), jetonTurnstile, piege.current?.value ?? '');
      setChamps(VIDE);
      setVerifier(false);
      setEnvoi('succes');
    } catch (erreur) {
      setErreurEnvoi(erreur instanceof Error ? erreur.message : 'L’envoi a échoué, réessayez dans un instant.');
      setEnvoi('echec');
    } finally {
      // Un jeton Turnstile est à usage unique, même si le dépôt a ensuite échoué.
      setJetonTurnstile(null);
      setReinitialisationVerification((compteur) => compteur + 1);
      verrou.current = false;
    }
  }

  const champ = (nom: keyof ChampsContact) => ({
    id: `${id}-${nom}`,
    name: nom,
    value: champs[nom],
    'aria-invalid': erreurs[nom] ? true : undefined,
    'aria-describedby': [erreurs[nom] ? `${id}-${nom}-erreur` : null, nom === 'message' ? `${id}-compteur` : null]
      .filter(Boolean)
      .join(' ') || undefined,
  });

  const erreur = (nom: keyof ChampsContact) =>
    erreurs[nom] ? (
      <p id={`${id}-${nom}-erreur`} className={ERREUR}>
        <Icone nom="alerte" className="mt-px size-4" />
        {erreurs[nom]}
      </p>
    ) : null;

  const enCours = envoi === 'en-cours';
  const restants = LIMITES_CONTACT.messageMax - longueur(champs.message);

  return (
    <form noValidate method="post" action={pathname} onSubmit={soumettre} className="mt-3.5 grid gap-3 paysage:grid-cols-2" aria-busy={enCours}>
      <div className="grid content-start gap-1.5">
        <label htmlFor={`${id}-prenom`} className={LIBELLE}>
          Prénom
        </label>
        <input
          {...champ('prenom')}
          type="text"
          autoComplete="given-name"
          maxLength={LIMITES_CONTACT.prenom}
          onChange={(e) => modifier('prenom', e.target.value)}
          className={CHAMP}
        />
        {erreur('prenom')}
      </div>

      <div className="grid content-start gap-1.5">
        <label htmlFor={`${id}-email`} className={LIBELLE}>
          Email
        </label>
        <input
          {...champ('email')}
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          maxLength={LIMITES_CONTACT.email}
          onChange={(e) => modifier('email', e.target.value)}
          className={CHAMP}
        />
        {erreur('email')}
      </div>

      <div className="grid gap-1.5 paysage:col-span-2">
        <label htmlFor={`${id}-message`} className={LIBELLE}>
          Message
        </label>
        <textarea
          {...champ('message')}
          rows={3}
          maxLength={LIMITES_CONTACT.messageMax}
          onChange={(e) => modifier('message', e.target.value)}
          className={`${CHAMP} resize-y`}
        />
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          {erreur('message') ?? <span />}
          <p id={`${id}-compteur`} className="ml-auto text-[12px] text-encre-2 tabular-nums">
            {longueur(champs.message)}&nbsp;/&nbsp;2&nbsp;000 caractères
            <span className="sr-only">, {restants} restants, 10 au minimum</span>
          </p>
        </div>
      </div>

      {/* Champ piège : hors écran et hors de la tabulation, ignoré par les humains. */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label htmlFor={`${id}-site_web`}>Site web, à laisser vide</label>
        <input ref={piege} id={`${id}-site_web`} name="site_web" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <noscript>
        <p className="text-[13px] font-semibold text-rouge paysage:col-span-2">Ce formulaire nécessite JavaScript.</p>
      </noscript>

      <VerificationHumaine
        onJetonChange={setJetonTurnstile}
        reinitialisation={reinitialisationVerification}
        action="contact"
        classe="paysage:col-span-2"
      />

      <div className="paysage:col-span-2">
        <button
          type="submit"
          disabled={enCours || !pret || !jetonTurnstile}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-encre px-5 text-[15px] leading-none font-semibold text-sable transition-[filter,transform] hover:brightness-125 active:scale-[0.97] disabled:cursor-wait disabled:opacity-70"
        >
          Envoyer le message
        </button>
        {/* Régions annoncées présentes dès le départ, vides tant qu'il n'y a rien à dire. */}
        <div role="status">
          {enCours ? <p className="sr-only">Envoi en cours…</p> : null}
          {envoi === 'succes' ? (
            <p className="mt-3 flex items-center gap-2 rounded-[13px] bg-[rgba(47,122,79,.1)] px-3.5 py-3 text-[14px] font-semibold text-[#286b44]">
              <Icone nom="valide" />
              Merci, votre message est enregistré. Il n’est pas envoyé par email automatiquement.
            </p>
          ) : null}
        </div>
        <div role="alert">
          {envoi === 'echec' ? (
            <p className="mt-3 flex items-center gap-2 rounded-[13px] bg-[rgba(194,59,29,.08)] px-3.5 py-3 text-[14px] font-semibold text-rouge-alerte">
              <Icone nom="alerte" />
              {erreurEnvoi || 'L’envoi a échoué, réessayez dans un instant.'}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  );
}
