import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Icone } from './Icone';
import { VerificationHumaine } from './VerificationHumaine';

export function InscriptionActualites() {
  const id = useId();
  const [email, setEmail] = useState('');
  const [consentement, setConsentement] = useState(false);
  const [pret, setPret] = useState(false);
  const [verification, setVerification] = useState(false);
  const [jeton, setJeton] = useState<string | null>(null);
  const [reinitialisation, setReinitialisation] = useState(0);
  const [enCours, setEnCours] = useState(false);
  const [succes, setSucces] = useState<'enregistre' | 'confirmation' | null>(null);
  const [erreur, setErreur] = useState('');
  const [champInvalide, setChampInvalide] = useState<'email' | 'consentement' | null>(null);
  const verrou = useRef(false);
  const piege = useRef<HTMLInputElement>(null);
  useEffect(() => setPret(true), []);

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (verrou.current) return;
    setErreur('');
    setChampInvalide(null);
    const adresse = email.trim().toLowerCase();
    if (adresse.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adresse)) {
      setChampInvalide('email');
      setErreur('Indiquez une adresse email valide.');
      document.getElementById(`${id}-email`)?.focus();
      return;
    }
    if (!consentement) {
      setChampInvalide('consentement');
      setErreur('Cochez la case pour accepter de recevoir les nouvelles de l’Olympiade.');
      document.getElementById(`${id}-consentement`)?.focus();
      return;
    }
    if (!jeton) {
      setVerification(true);
      setErreur('Terminez la vérification anti-robot avant de vous inscrire.');
      return;
    }
    verrou.current = true;
    setEnCours(true);
    try {
      const reponse = await fetch('/api/actualites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adresse, consentement: true, site_web: piege.current?.value ?? '', turnstileToken: jeton }),
        signal: AbortSignal.timeout(15_000),
      });
      const resultat = await reponse.json().catch(() => null);
      if (!reponse.ok || resultat?.ok !== true) {
        throw new Error(reponse.status === 429
          ? 'Trop de demandes. Réessayez dans quelques minutes.'
          : 'L’inscription est momentanément indisponible. Réessayez dans un instant.');
      }
      setSucces(resultat.confirmation === true ? 'confirmation' : 'enregistre');
      setEmail('');
      setConsentement(false);
    } catch (echec) {
      setErreur(echec instanceof Error && echec.name === 'Error'
        ? echec.message
        : 'La connexion a été interrompue. Réessayez dans un instant.');
    } finally {
      setJeton(null);
      setReinitialisation((valeur) => valeur + 1);
      setEnCours(false);
      verrou.current = false;
    }
  }

  return (
    <section id="actualites" aria-labelledby={`${id}-titre`} className="mx-4 mt-3.5 rounded-[22px] border border-or/45 bg-creme p-5 tablette:mx-7 tablette:mt-[22px] paysage:mx-10 paysage:mt-[26px] paysage:grid paysage:grid-cols-[.9fr_1.1fr] paysage:items-center paysage:gap-8 paysage:px-7 bureau:mx-14">
      <div>
        <p className="flex items-center gap-2 text-[11px] font-bold tracking-[.16em] text-or-ink uppercase">
          <Icone nom="mail" className="size-4" /> Gardez le lien
        </p>
        <h2 id={`${id}-titre`} className="mt-2 font-display text-[25px] leading-[1.15] font-bold paysage:text-[29px]">
          Toute l’Olympiade, dans votre boîte mail.
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-encre-2">Dates, infos pratiques, ouverture des votes, notations et résultats&nbsp;: recevez toutes les nouvelles des manades.</p>
      </div>
      <div className="mt-4 min-w-0 paysage:mt-0">
        <div role="status">
          {succes ? <p className="flex items-start gap-3 rounded-2xl bg-lin p-5 text-[15px] font-semibold text-encre">
            <Icone nom="valide" className="mt-0.5 size-5 text-ok" /> {succes === 'confirmation'
              ? 'Merci\u00a0! Un email de confirmation vient de partir\u00a0: cliquez sur le bouton qu’il contient pour valider votre inscription.'
              : 'Merci, votre inscription est enregistrée. À bientôt pour les nouvelles de l’Olympiade\u00a0!'}
          </p> : null}
        </div>
        {!succes ? <form method="post" action="/api/actualites" noValidate onSubmit={soumettre} onFocus={() => setVerification(true)} aria-label="Recevoir les nouvelles de l’Olympiade" aria-busy={enCours}>
          <label htmlFor={`${id}-email`} className="text-[12px] font-semibold text-encre-2">Votre adresse email</label>
          <div className="mt-1.5 flex flex-col gap-2 tablette:flex-row">
            <input id={`${id}-email`} name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254}
              value={email} onChange={(e) => { setEmail(e.target.value); setErreur(''); setChampInvalide(null); }} disabled={enCours}
              aria-invalid={champInvalide === 'email' || undefined} aria-describedby={champInvalide === 'email' ? `${id}-erreur` : undefined}
              placeholder="vous@exemple.fr" className="min-h-12 w-full min-w-0 rounded-[13px] border border-[#958a77] bg-sable px-3.5 text-base text-encre placeholder:text-encre-2 aria-invalid:border-rouge" />
            <button type="submit" disabled={!pret || enCours} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[13px] bg-encre px-5 text-[14px] font-semibold text-sable hover:brightness-125 disabled:opacity-60">
              {enCours ? 'Inscription…' : 'Je m’inscris'} <Icone nom="fleche" className="size-4" />
            </button>
          </div>
          <label htmlFor={`${id}-consentement`} className="mt-2 flex cursor-pointer items-start gap-2.5 py-1 text-[12px] leading-relaxed text-encre-2">
            <input id={`${id}-consentement`} name="consentement" type="checkbox" required checked={consentement} disabled={enCours}
              onChange={(e) => { setConsentement(e.target.checked); setErreur(''); setChampInvalide(null); }}
              aria-invalid={champInvalide === 'consentement' || undefined} aria-describedby={champInvalide === 'consentement' ? `${id}-erreur` : undefined}
              className="mt-1 size-4 shrink-0 accent-encre" />
            J’accepte de recevoir par email les actualités, informations pratiques, résultats et notations de l’Olympiade des Manades.
          </label>
          <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
            <label htmlFor={`${id}-site`}>Site web, à laisser vide</label>
            <input ref={piege} id={`${id}-site`} name="site_web" type="text" tabIndex={-1} autoComplete="off" />
          </div>
          {verification ? <VerificationHumaine action="actualites" onJetonChange={setJeton} reinitialisation={reinitialisation} classe="mt-2" /> : null}
          <div id={`${id}-erreur`} role="alert">{erreur ? <p className="mt-2 text-[13px] font-semibold text-rouge-alerte">{erreur}</p> : null}</div>
          <noscript><p className="mt-2 text-[13px] text-rouge-alerte">Activez JavaScript pour vous inscrire.</p></noscript>
        </form> : null}
        <p className="mt-2 text-[11px] leading-relaxed text-encre-2">Retrait à tout moment via le <Link to="/contact" className="underline underline-offset-2">contact</Link>. <Link to="/confidentialite" className="underline underline-offset-2">Confidentialité</Link></p>
      </div>
    </section>
  );
}
