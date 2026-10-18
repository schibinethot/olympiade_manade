import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  appelerLien, ErreurLien, etatValide, garderJeton, jetonDeLAdresse, oublierJeton, recupererJeton, signalAvecDelai,
} from '../../app/lib/lienEmail';

describe('jeton des liens d’email (fragment #j=, repli ?j=)', () => {
  const ORIGINE = 'https://olympiadedesmanades.fr';

  it('lit le fragment en priorité, puis la query', () => {
    expect(jetonDeLAdresse(`${ORIGINE}/emails/confirmation#j=abc.def`)).toEqual({ jeton: 'abc.def', present: true });
    expect(jetonDeLAdresse(`${ORIGINE}/emails/confirmation?j=ancien`)).toEqual({ jeton: 'ancien', present: true });
    expect(jetonDeLAdresse(`${ORIGINE}/emails/confirmation?j=ancien#j=nouveau`)).toEqual({ jeton: 'nouveau', present: true });
    expect(jetonDeLAdresse(`${ORIGINE}/emails/confirmation?j=ancien#j=`)).toEqual({ jeton: 'ancien', present: true });
  });

  it('dit si l’adresse porte un jeton, même vide, pour le retirer', () => {
    expect(jetonDeLAdresse(`${ORIGINE}/emails/desinscription`)).toEqual({ jeton: '', present: false });
    expect(jetonDeLAdresse(`${ORIGINE}/emails/desinscription#j=`)).toEqual({ jeton: '', present: true });
    expect(jetonDeLAdresse(`${ORIGINE}/emails/desinscription#autre=1`)).toEqual({ jeton: '', present: false });
  });

  describe('recupererJeton', () => {
    afterEach(() => vi.unstubAllGlobals());

    function onglet() {
      const valeurs = new Map<string, string>();
      vi.stubGlobal('window', {
        sessionStorage: {
          getItem: (cle: string) => valeurs.get(cle) ?? null,
          setItem: (cle: string, valeur: string) => { valeurs.set(cle, valeur); },
          removeItem: (cle: string) => { valeurs.delete(cle); },
        },
      });
    }

    it('garde le jeton de l’adresse dans l’onglet et demande de le retirer de l’adresse', () => {
      onglet();
      expect(recupererJeton('/emails/confirmation', `${ORIGINE}/emails/confirmation#j=secret`)).toEqual({ jeton: 'secret', retirer: true });
      // Rechargement : l'adresse est propre, le jeton vient de l'onglet.
      expect(recupererJeton('/emails/confirmation', `${ORIGINE}/emails/confirmation`)).toEqual({ jeton: 'secret', retirer: false });
      // Un jeton gardé pour une autre page ne sert pas.
      expect(recupererJeton('/emails/desinscription', `${ORIGINE}/emails/desinscription`)).toEqual({ jeton: '', retirer: false });
    });

    it('oublie le jeton de l’onglet quand on quitte la page, et peut le remettre (nouveau montage)', () => {
      onglet();
      recupererJeton('/emails/confirmation', `${ORIGINE}/emails/confirmation#j=secret`);
      oublierJeton();
      expect(recupererJeton('/emails/confirmation', `${ORIGINE}/emails/confirmation`)).toEqual({ jeton: '', retirer: false });
      garderJeton('/emails/confirmation', 'secret');
      expect(recupererJeton('/emails/confirmation', `${ORIGINE}/emails/confirmation`)).toEqual({ jeton: 'secret', retirer: false });
    });

    it('un stockage refusé ne casse rien', () => {
      vi.stubGlobal('window', {
        get sessionStorage(): Storage { throw new DOMException('refusé', 'SecurityError'); },
      });
      expect(() => oublierJeton()).not.toThrow();
      expect(() => garderJeton('/emails/confirmation', 'x')).not.toThrow();
      expect(recupererJeton('/emails/confirmation', `${ORIGINE}/emails/confirmation#j=x`)).toEqual({ jeton: 'x', retirer: true });
    });
  });
});

const DATE = { nom: 'Soirée des arènes', ville: 'Nîmes', date: '2027-07-24' };

describe('etatValide', () => {
  it('lit un état complet, désinscrit compris', () => {
    expect(etatValide({ type: 'je_viens', date: DATE, abonne: false, annonces: true, desinscrit: true })).toEqual({
      type: 'je_viens', date: DATE, abonne: false, annonces: true, desinscrit: true,
    });
  });

  it('prend des valeurs prudentes quand les booléens manquent : désinscrit et annonces faux', () => {
    expect(etatValide({ type: 'confirmation' })).toEqual({ type: 'confirmation', date: undefined, abonne: true, annonces: false, desinscrit: false });
  });

  it('refuse un type inconnu, une valeur qui n’est pas un objet et une date mal formée', () => {
    expect(etatValide({ type: 'autre' })).toBeNull();
    expect(etatValide(null)).toBeNull();
    expect(etatValide('confirmation')).toBeNull();
    expect(etatValide({ type: 'je_viens', date: { ...DATE, date: '24/07/2027' } })).toBeNull();
    expect(etatValide({ type: 'je_viens', date: { nom: 1, ville: 'Nîmes', date: '2027-07-24' } })).toBeNull();
    expect(etatValide({ type: 'je_viens', date: 'demain' })).toBeNull();
  });
});

describe('appelerLien', () => {
  afterEach(() => vi.unstubAllGlobals());

  const reponse = (statut: number, corps: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(corps), { status: statut }));

  it('envoie le jeton et l’action en JSON', async () => {
    const fetchSimule = reponse(200, { ok: true, etat: 'fait' });
    vi.stubGlobal('fetch', fetchSimule);
    await expect(appelerLien('jeton', 'confirmer')).resolves.toEqual({ ok: true, etat: 'fait' });
    const [url, options] = fetchSimule.mock.calls[0];
    expect(url).toBe('/api/emails/lien');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ jeton: 'jeton', action: 'confirmer' });
  });

  it('rend deja_fait tel quel', async () => {
    vi.stubGlobal('fetch', reponse(200, { ok: true, etat: 'deja_fait' }));
    await expect(appelerLien('jeton', 'confirmer')).resolves.toEqual({ ok: true, etat: 'deja_fait' });
  });

  it.each([
    [400, 'invalide', true],
    [410, 'expire', true],
    [429, 'indisponible', false],
    [503, 'indisponible', false],
  ] as const)('statut %i : %s', async (statut, nature, definitif) => {
    vi.stubGlobal('fetch', reponse(statut, { error: 'x' }));
    const erreur = await appelerLien('jeton', 'decrire').catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(ErreurLien);
    expect(erreur).toMatchObject({ nature, definitif });
  });

  it('une erreur réseau ou une réponse sans ok:true est « indisponible »', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(appelerLien('jeton', 'decrire')).rejects.toMatchObject({ nature: 'indisponible' });
    vi.stubGlobal('fetch', reponse(200, { ok: false }));
    await expect(appelerLien('jeton', 'decrire')).rejects.toMatchObject({ nature: 'indisponible' });
  });

  it('un abandon demandé par l’appelant n’est pas transformé en erreur de service', async () => {
    const controle = new AbortController();
    controle.abort();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('abandon', 'AbortError')));
    await expect(appelerLien('jeton', 'decrire', controle.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('signalAvecDelai', () => {
  it('s’arrête quand l’appelant abandonne, avec ou sans AbortSignal.any', () => {
    const controle = new AbortController();
    expect(signalAvecDelai(controle.signal).aborted).toBe(false);
    controle.abort();
    expect(signalAvecDelai(controle.signal).aborted).toBe(true);

    const original = AbortSignal.any;
    // @ts-expect-error simulation d'un navigateur sans AbortSignal.any
    AbortSignal.any = undefined;
    try {
      const autre = new AbortController();
      const signal = signalAvecDelai(autre.signal);
      expect(signal.aborted).toBe(false);
      autre.abort();
      expect(signal.aborted).toBe(true);
    } finally {
      AbortSignal.any = original;
    }
  });
});
