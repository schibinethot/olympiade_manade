/**
 * Consent Mode v2 et chargeur Google Tag Manager.
 *
 * Le bootstrap Consent Mode est exécuté en module (pas de script en ligne dans le HTML)
 * afin de respecter la CSP `script-src 'self'` du site.
 *
 * @see plan-consentement-cookies.md section « CSP quand GTM est configuré »
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

// Bootstrap Consent Mode v2 (défauts = denied), exécuté à l'import du module.
// Doit se produire AVANT tout chargement de GTM. Comme GTM n'est chargé que
// dynamiquement (chargerGoogleTagManager) après accord explicite, cet ordre est garanti.
if (typeof window !== 'undefined') {
  window.dataLayer = window.dataLayer ?? [];
  // La fonction gtag enveloppe arguments (pas les rest params) comme préconisé par Google.
  // eslint-disable-next-line prefer-rest-params
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    (window.dataLayer as unknown[]).push(arguments as unknown);
  };

  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    personalization_storage: 'denied',
    security_storage: 'granted',
    wait_for_update: 500,
  });

  window.gtag('set', 'url_passthrough', true);
  window.gtag('set', 'ads_data_redaction', true);
}

/**
 * Charge Google Tag Manager une seule fois, sous conditions :
 * - `VITE_GTM_ID` est défini
 * - l'hôte est olympiadedesmanades.fr ou www.olympiadedesmanades.fr
 * - au moins une catégorie (mesure ou publicité) est acceptée
 * - le script `#olympiade-gtm` n'est pas encore présent dans le DOM
 */
export function chargerGoogleTagManager(mesure: boolean, publicite: boolean): void {
  if (!import.meta.env.VITE_GTM_ID) return;
  const hote = typeof window !== 'undefined' ? window.location.hostname : '';
  if (hote !== 'olympiadedesmanades.fr' && hote !== 'www.olympiadedesmanades.fr') return;
  if (!mesure && !publicite) return;
  if (typeof document === 'undefined') return;
  if (document.getElementById('olympiade-gtm')) return;

  window.dataLayer = window.dataLayer ?? [];
  (window.dataLayer as unknown[]).push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

  const script = document.createElement('script');
  script.id = 'olympiade-gtm';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${import.meta.env.VITE_GTM_ID}`;
  document.head.appendChild(script);
}

/**
 * Met à jour le Consent Mode v2 avec le choix de l'utilisateur,
 * puis charge GTM si les conditions sont remplies.
 */
export function majConsentementGoogle(mesureAcceptee: boolean, publiciteAcceptee: boolean): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  window.gtag('consent', 'update', {
    analytics_storage: mesureAcceptee ? 'granted' : 'denied',
    ad_storage: publiciteAcceptee ? 'granted' : 'denied',
    ad_user_data: publiciteAcceptee ? 'granted' : 'denied',
    ad_personalization: publiciteAcceptee ? 'granted' : 'denied',
    personalization_storage: publiciteAcceptee ? 'granted' : 'denied',
  });
  chargerGoogleTagManager(mesureAcceptee, publiciteAcceptee);
}
