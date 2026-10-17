import { useEffect } from 'react';

/** Une seule PWA : le manifeste est lié dans la racine, ce worker gère le push. */
export function ServiceTravailleur() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return null;
}
