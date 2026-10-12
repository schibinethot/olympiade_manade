import { useEffect, useRef, useState } from 'react';

const URL_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const ID_SCRIPT = 'cloudflare-turnstile';

type Turnstile = {
  render: (conteneur: HTMLElement, options: Record<string, unknown>) => string;
  remove: (idWidget: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let chargementScript: Promise<Turnstile> | null = null;

function chargerTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (chargementScript) return chargementScript;
  chargementScript = new Promise((resolve, reject) => {
    const existant = document.getElementById(ID_SCRIPT) as HTMLScriptElement | null;
    const script = existant ?? document.createElement('script');
    const charge = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile indisponible'));
    const echec = () => {
      chargementScript = null;
      script.remove();
      reject(new Error('Chargement de Turnstile impossible'));
    };
    script.addEventListener('load', charge, { once: true });
    script.addEventListener('error', echec, { once: true });
    if (!existant) {
      script.id = ID_SCRIPT;
      script.src = URL_SCRIPT;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
  return chargementScript;
}

export type VerificationHumaineProps = {
  onJetonChange: (jeton: string | null) => void;
  /** Incrémenter après chaque appel réseau : un jeton Turnstile ne doit servir qu'une fois. */
  reinitialisation?: number;
  action?: string;
  classe?: string;
};

/** Widget Turnstile partagé. Une clé absente ou un script bloqué laisse toujours le formulaire fermé. */
export function VerificationHumaine({
  onJetonChange,
  reinitialisation = 0,
  action = 'formulaire',
  classe = '',
}: VerificationHumaineProps) {
  const conteneur = useRef<HTMLDivElement>(null);
  const rappel = useRef(onJetonChange);
  const [erreur, setErreur] = useState<string | null>(null);
  rappel.current = onJetonChange;
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();

  useEffect(() => {
    rappel.current(null);
    setErreur(null);
    if (!siteKey) {
      setErreur('La vérification anti-robot est indisponible. Réessayez plus tard.');
      return;
    }
    let actif = true;
    let idWidget: string | null = null;
    void chargerTurnstile()
      .then((turnstile) => {
        if (!actif || !conteneur.current) return;
        idWidget = turnstile.render(conteneur.current, {
          sitekey: siteKey,
          action,
          language: 'fr',
          appearance: 'always',
          callback: (jeton: string) => {
            setErreur(null);
            rappel.current(jeton);
          },
          'expired-callback': () => rappel.current(null),
          'timeout-callback': () => rappel.current(null),
          'error-callback': () => {
            rappel.current(null);
            setErreur('La vérification anti-robot a échoué. Rechargez-la puis réessayez.');
          },
        });
      })
      .catch(() => {
        if (actif) setErreur('La vérification anti-robot est indisponible. Réessayez plus tard.');
      });
    return () => {
      actif = false;
      rappel.current(null);
      if (idWidget && window.turnstile) window.turnstile.remove(idWidget);
    };
  }, [action, reinitialisation, siteKey]);

  return (
    <div className={classe}>
      <div ref={conteneur} />
      <div role="status" aria-live="polite">
        {erreur ? <p className="mt-2 text-sm font-medium text-rouge-alerte">{erreur}</p> : null}
      </div>
    </div>
  );
}
