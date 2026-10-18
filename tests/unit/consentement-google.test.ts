import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Chargeur GTM : jamais sur une page de lien d'email, dont l'adresse a porté un jeton signé (I4).

type Script = { id?: string; async?: boolean; src?: string };

function navigateur(pathname: string, stockage = new Map<string, string>()) {
  const ajoutes: Script[] = [];
  vi.stubGlobal('window', {
    location: { pathname, hostname: 'olympiadedesmanades.fr' },
    dataLayer: [],
    sessionStorage: {
      getItem: (cle: string) => stockage.get(cle) ?? null,
      setItem: (cle: string, valeur: string) => { stockage.set(cle, valeur); },
      removeItem: (cle: string) => { stockage.delete(cle); },
    },
  });
  vi.stubGlobal('document', {
    getElementById: () => null,
    createElement: (): Script => ({}),
    head: { appendChild: (script: Script) => { ajoutes.push(script); } },
  });
  return ajoutes;
}

describe('chargerGoogleTagManager', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_GTM_ID', 'GTM-TEST');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('charge GTM sur une page vitrine après accord', async () => {
    const ajoutes = navigateur('/');
    const { chargerGoogleTagManager } = await import('../../app/lib/consentement-google');
    chargerGoogleTagManager(true, false);
    expect(ajoutes).toHaveLength(1);
    expect(ajoutes[0].src).toBe('https://www.googletagmanager.com/gtm.js?id=GTM-TEST');
  });

  it('retire de l’onglet un jeton de lien d’email resté là avant de charger GTM (mineur n° 8)', async () => {
    const stockage = new Map([['olympiade-lien-email', JSON.stringify({ chemin: '/emails/confirmation', jeton: 'secret' })]]);
    const ajoutes = navigateur('/dates', stockage);
    const { chargerGoogleTagManager } = await import('../../app/lib/consentement-google');
    chargerGoogleTagManager(true, false);
    expect(ajoutes).toHaveLength(1);
    expect(stockage.has('olympiade-lien-email')).toBe(false);
  });

  it.each(['/emails/confirmation', '/emails/desinscription', '/emails/je-viens'])('ne charge jamais GTM sur %s, même après accord', async (chemin) => {
    const ajoutes = navigateur(chemin);
    const { chargerGoogleTagManager, majConsentementGoogle } = await import('../../app/lib/consentement-google');
    chargerGoogleTagManager(true, true);
    majConsentementGoogle(true, true);
    expect(ajoutes).toEqual([]);
  });
});
