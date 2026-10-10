import { OTPInput, OTPInputContext } from 'input-otp';
import { useContext, useEffect, useRef } from 'react';
import { normaliserCode } from '../lib/auth';

// Saisie du code à 6 chiffres, reprise du composant input-otp de SITE-AM
// (client/src/components/ui/input-otp.tsx, enveloppe shadcn de la bibliothèque input-otp) :
// - React 19 : plus de forwardRef, le ref est une prop ordinaire ;
// - Tailwind 4 : animation du curseur déclarée dans @theme (app.css, --animate-caret-blink) ;
// - style de la maquette (écran spect:inscription, bloc .otp).
//
// Une seule <input> réelle, invisible et posée sur les 6 cases : clavier numérique, remplissage
// automatique du code (autocomplete="one-time-code") et collage sont ceux du navigateur.

const LONGUEUR = 6;

type Props = {
  id: string;
  valeur: string;
  onChange: (valeur: string) => void;
  invalide?: boolean;
  /** Identifiants des textes d'aide et d'erreur (aria-describedby). */
  description?: string;
};

/** Ne garde que les chiffres (une lettre tapée au clavier d'ordinateur est ignorée). */
const chiffres = (texte: string) => texte.replace(/[^0-9]/g, '').slice(0, LONGUEUR);

export function SaisieCode({ id, valeur, onChange, invalide = false, description }: Props) {
  const champ = useRef<HTMLInputElement>(null);
  const changer = useRef(onChange);
  useEffect(() => {
    changer.current = onChange;
  }, [onChange]);

  // Code reçu d'un bloc (« 123 456 », « Votre code : 123456 ») par collage, remplissage automatique
  // ou saisie d'un trait : les 6 chiffres remplacent la saisie. Sans cela, la limite de 6 caractères
  // de l'<input> couperait « 123 456 » en « 123 45 » avant tout traitement.
  useEffect(() => {
    const input = champ.current;
    if (!input) return;
    const remplacer = (texte: string | null | undefined, evenement: Event) => {
      const code = texte ? normaliserCode(texte) : null;
      if (!code) return;
      evenement.preventDefault();
      evenement.stopPropagation();
      changer.current(code);
    };
    const avantSaisie = (evenement: InputEvent) => {
      if (evenement.data && evenement.data.length > 1) remplacer(evenement.data, evenement);
    };
    const coller = (evenement: ClipboardEvent) => remplacer(evenement.clipboardData?.getData('text/plain'), evenement);
    input.addEventListener('beforeinput', avantSaisie);
    input.addEventListener('paste', coller);
    return () => {
      input.removeEventListener('beforeinput', avantSaisie);
      input.removeEventListener('paste', coller);
    };
  }, []);

  return (
    <OTPInput
      ref={champ}
      id={id}
      name="code"
      value={valeur}
      onChange={(texte) => onChange(chiffres(texte))}
      maxLength={LONGUEUR}
      // Indication du clavier numérique pour les anciens iOS ; les chiffres sont filtrés ci-dessus.
      pattern="[0-9]*"
      inputMode="numeric"
      autoComplete="one-time-code"
      // Collage partiel (moins de 6 chiffres) : seuls les chiffres sont gardés.
      pasteTransformer={chiffres}
      // La page exige JavaScript : pas de feuille de style de repli dans un <noscript>.
      noScriptCSSFallback={null}
      aria-invalid={invalide || undefined}
      aria-describedby={description}
      containerClassName="w-full max-w-[440px]"
    >
      <div aria-hidden="true" className="grid grid-cols-6 gap-2">
        {Array.from({ length: LONGUEUR }, (_, index) => (
          <Case key={index} index={index} invalide={invalide} />
        ))}
      </div>
    </OTPInput>
  );
}

function Case({ index, invalide }: { index: number; invalide: boolean }) {
  const { char, hasFakeCaret, isActive } = useContext(OTPInputContext).slots[index];
  // Bordures à 3:1 au moins sur crème (WCAG 1.4.11), comme les champs du formulaire de contact :
  // #958a77 au repos, or foncé une fois remplie, rouge sur la case active ou en erreur.
  const bordure = invalide || isActive ? 'border-rouge' : char ? 'border-or-ink' : 'border-[#958a77]';
  return (
    <div
      className={`relative grid aspect-[.84] place-items-center rounded-[15px] border-[1.5px] bg-creme font-display text-[30px] leading-none font-semibold text-encre lining-nums tabular-nums transition-[border-color,box-shadow] ${bordure} ${
        isActive ? 'shadow-[0_0_0_4px_rgba(236,116,51,.16)]' : ''
      }`}
    >
      {char}
      {hasFakeCaret ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-[30px] w-0.5 animate-caret-blink bg-orange" />
        </div>
      ) : null}
    </div>
  );
}
