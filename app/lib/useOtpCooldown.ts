import { useCallback, useEffect, useRef, useState } from 'react';

// Repris d'un projet interne, même logique et même API.
// Seul ajout : startCooldown accepte une durée, pour reprendre le décompte après un rechargement
// de la page du code (l'heure d'envoi est gardée dans l'onglet).

const OTP_COOLDOWN_SECONDS = 60;

/**
 * Délai de 60 s entre deux envois de code (« Renvoyer le code »). Supabase refuse de toute façon
 * un nouvel envoi avant 60 s (auth.email.max_frequency).
 */
export function useOtpCooldown() {
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const actif = cooldownSeconds > 0;

  useEffect(() => {
    if (actif) {
      timerRef.current = setInterval(() => {
        setCooldownSeconds((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [actif]);

  const startCooldown = useCallback((secondes: number = OTP_COOLDOWN_SECONDS) => {
    setCooldownSeconds(Math.max(0, Math.min(OTP_COOLDOWN_SECONDS, Math.ceil(secondes))));
  }, []);

  const resetCooldown = useCallback(() => {
    setCooldownSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return {
    cooldownSeconds,
    isOnCooldown: cooldownSeconds > 0,
    startCooldown,
    resetCooldown,
  };
}

/** Secondes restantes avant de pouvoir renvoyer un code envoyé à `envoyeeLe` (ms). */
export function delaiRestant(envoyeeLe: number, maintenant: number = Date.now()): number {
  return Math.max(0, OTP_COOLDOWN_SECONDS - Math.floor((maintenant - envoyeeLe) / 1000));
}
