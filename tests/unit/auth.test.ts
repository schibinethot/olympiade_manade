import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Client Supabase simulé : aucun appel réseau, aucune variable d'environnement nécessaire.
const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  signInWithPassword: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
  mfa: {
    listFactors: vi.fn(),
    enroll: vi.fn(),
    unenroll: vi.fn(),
    challengeAndVerify: vi.fn(),
  },
}));
vi.mock('../../app/lib/supabase', () => ({ supabase: () => ({ auth }) }));

import {
  demanderCode,
  commencerEnrolementTotp,
  connecterAdmin,
  ErreurAuth,
  formaterDecompte,
  lireDemande,
  MESSAGES_AUTH,
  normaliserCode,
  normaliserEmail,
  seDeconnecter,
  traduireErreurAuth,
  validerInscription,
  verifierCode,
  verifierTotp,
} from '../../app/lib/auth';

describe('normaliserCode', () => {
  it('accepte 6 chiffres collés avec espaces, tirets ou texte autour', () => {
    expect(normaliserCode('123456')).toBe('123456');
    expect(normaliserCode(' 123 456 ')).toBe('123456');
    expect(normaliserCode('123-456')).toBe('123456');
    expect(normaliserCode('Votre code : 123456')).toBe('123456');
  });

  it('refuse moins ou plus de 6 chiffres', () => {
    expect(normaliserCode('12345')).toBeNull();
    expect(normaliserCode('1234567')).toBeNull();
    expect(normaliserCode('')).toBeNull();
  });

  // Gardes ajoutées : chiffres d'autres écritures, retours à la ligne d'un collage.
  it('ne garde que les chiffres 0 à 9, y compris sur plusieurs lignes', () => {
    expect(normaliserCode('123\n456\n')).toBe('123456');
    expect(normaliserCode('١٢٣٤٥٦')).toBeNull();
  });
});

describe('normaliserEmail', () => {
  it('supprime les espaces et met en minuscules', () => {
    expect(normaliserEmail('  Lea@Exemple.FR ')).toBe('lea@exemple.fr');
  });

  it('retire aussi les espaces glissés au milieu (saisie au téléphone)', () => {
    expect(normaliserEmail('lea @exemple.fr')).toBe('lea@exemple.fr');
  });
});

describe('validerInscription', () => {
  const valide = { prenom: 'Léa', email: 'lea@exemple.fr', consentement: true };

  it('accepte un prénom, un email valide et le consentement', () => {
    expect(validerInscription(valide)).toEqual({});
  });

  it('exige le consentement à la politique de confidentialité', () => {
    expect(validerInscription({ ...valide, consentement: false }).consentement).toMatch(
      /accepter la politique de confidentialité/,
    );
  });

  it('exige un prénom de 1 à 60 caractères, comme la base (profils.prenom)', () => {
    expect(validerInscription({ ...valide, prenom: '   ' }).prenom).toBe('Indiquez votre prénom.');
    expect(validerInscription({ ...valide, prenom: 'é'.repeat(60) }).prenom).toBeUndefined();
    expect(validerInscription({ ...valide, prenom: 'é'.repeat(61) }).prenom).toBe(
      'Le prénom ne doit pas dépasser 60 caractères.',
    );
  });

  it('refuse un email absent ou mal formé, après normalisation', () => {
    expect(validerInscription({ ...valide, email: '' }).email).toBe('Indiquez votre adresse email.');
    expect(validerInscription({ ...valide, email: 'lea@exemple' }).email).toBe('Cette adresse email n’est pas valide.');
    expect(validerInscription({ ...valide, email: ' Lea@Exemple.FR ' }).email).toBeUndefined();
  });
});

describe('traduireErreurAuth', () => {
  it('traduit la limite d’envoi de Supabase', () => {
    const erreur = new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit');
    expect(traduireErreurAuth(erreur, 'demande')).toBe('Trop de demandes de code. Réessayez dans quelques minutes.');
    expect(traduireErreurAuth(new AuthApiError('Too many', 429, 'over_request_rate_limit'), 'verification')).toBe(
      MESSAGES_AUTH.tropDeDemandes,
    );
  });

  it('traduit un code expiré ou faux', () => {
    const attendu = 'Code incorrect ou expiré. Vérifiez vos emails ou demandez un nouveau code.';
    expect(traduireErreurAuth(new AuthApiError('Token has expired or is invalid', 403, 'otp_expired'), 'verification')).toBe(
      attendu,
    );
    expect(traduireErreurAuth(new AuthApiError('Invalid', 400, 'validation_failed'), 'verification')).toBe(attendu);
    expect(traduireErreurAuth(new AuthApiError('Invalid', 400, undefined), 'verification')).toBe(attendu);
  });

  it('traduit une coupure réseau', () => {
    expect(traduireErreurAuth(new AuthRetryableFetchError('Failed to fetch', 0), 'demande')).toBe(
      'Connexion impossible. Vérifiez votre réseau et réessayez.',
    );
    expect(traduireErreurAuth(new TypeError('Failed to fetch'), 'verification')).toBe(MESSAGES_AUTH.reseau);
  });

  it('traduit les refus d’envoi et les erreurs inconnues, sans jamais afficher le texte anglais', () => {
    expect(traduireErreurAuth(new AuthApiError('Invalid', 400, 'email_address_invalid'), 'demande')).toBe(
      MESSAGES_AUTH.emailInvalide,
    );
    expect(traduireErreurAuth(new AuthApiError('Signups not allowed', 422, 'signup_disabled'), 'demande')).toBe(
      MESSAGES_AUTH.inscriptionsFermees,
    );
    expect(traduireErreurAuth(new AuthApiError('Email address not authorized', 400, 'email_address_not_authorized'), 'demande')).toBe(
      MESSAGES_AUTH.envoiRefuse,
    );
    expect(traduireErreurAuth(new AuthRetryableFetchError('Bad gateway', 502), 'demande')).toBe(MESSAGES_AUTH.inconnue);
    expect(traduireErreurAuth('n’importe quoi', 'demande')).toBe('Une erreur est survenue. Réessayez dans un instant.');
  });
});

describe('formaterDecompte', () => {
  it('affiche minutes et secondes, comme la maquette (« 0:42 »)', () => {
    expect(formaterDecompte(42)).toBe('0:42');
    expect(formaterDecompte(60)).toBe('1:00');
    expect(formaterDecompte(5)).toBe('0:05');
    expect(formaterDecompte(0)).toBe('0:00');
  });
});

describe('lireDemande', () => {
  it('relit une demande enregistrée et ignore une valeur absente ou abîmée', () => {
    const demande = { prenom: 'Léa', email: 'lea@exemple.fr', envoyeeLe: 1_700_000_000_000 };
    expect(lireDemande(JSON.stringify(demande))).toEqual(demande);
    expect(lireDemande(null)).toBeNull();
    expect(lireDemande('{pas du json')).toBeNull();
    expect(lireDemande(JSON.stringify({ prenom: 'Léa' }))).toBeNull();
  });
});

describe('appels Supabase Auth', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'https://exemple.fr' } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('demanderCode crée le compte au besoin, avec le prénom et le consentement, et un lien de secours vers /inscription/code', async () => {
    auth.signInWithOtp.mockResolvedValue({ data: { user: null, session: null }, error: null });
    await demanderCode('Léa', 'lea@exemple.fr', 'captcha-valide', false);
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'lea@exemple.fr',
      options: {
        shouldCreateUser: true,
        data: { prenom: 'Léa', consentement: true, annonces: false },
        emailRedirectTo: 'https://exemple.fr/inscription/code',
        captchaToken: 'captcha-valide',
      },
    });
  });

  it('demanderCode transmet annonces: true quand la case est cochée', async () => {
    auth.signInWithOtp.mockResolvedValue({ data: { user: null, session: null }, error: null });
    await demanderCode('Léa', 'lea@exemple.fr', 'captcha-valide', true);
    expect(auth.signInWithOtp.mock.calls[0][0].options.data).toEqual({ prenom: 'Léa', consentement: true, annonces: true });
  });

  it('demanderCode transforme une erreur Supabase en ErreurAuth au message français', async () => {
    auth.signInWithOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit'),
    });
    const promesse = demanderCode('Léa', 'lea@exemple.fr', 'captcha-valide');
    await expect(promesse).rejects.toBeInstanceOf(ErreurAuth);
    await expect(promesse).rejects.toThrow(MESSAGES_AUTH.tropDeDemandes);
  });

  it('refuse un envoi OTP sans preuve Turnstile avant tout appel Supabase', async () => {
    await expect(demanderCode('Léa', 'lea@exemple.fr', '')).rejects.toThrow(MESSAGES_AUTH.verificationHumaine);
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('transmet Turnstile à la connexion par mot de passe admin', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
    await connecterAdmin(' Admin@Exemple.FR ', 'Mot-de-passe!42', 'captcha-admin');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@exemple.fr',
      password: 'Mot-de-passe!42',
      options: { captchaToken: 'captcha-admin' },
    });
  });

  it('nettoie un enrôlement TOTP abandonné avant de produire un nouveau QR code', async () => {
    auth.mfa.listFactors.mockResolvedValue({
      data: {
        all: [{ id: 'ancien', factor_type: 'totp', status: 'unverified' }],
        totp: [], phone: [], webauthn: [], recovery_code: [],
      },
      error: null,
    });
    auth.mfa.unenroll.mockResolvedValue({ data: { id: 'ancien' }, error: null });
    auth.mfa.enroll.mockResolvedValue({
      data: { id: 'nouveau', type: 'totp', totp: { qr_code: 'data:image/svg+xml,qr', secret: 'SECRET', uri: 'otpauth://totp/test' } },
      error: null,
    });
    await expect(commencerEnrolementTotp()).resolves.toEqual({
      facteurId: 'nouveau', qrCode: 'data:image/svg+xml,qr', secret: 'SECRET',
    });
    expect(auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'ancien' });
  });

  it('vérifie le TOTP par challenge et promeut la session', async () => {
    auth.mfa.challengeAndVerify.mockResolvedValue({ data: { access_token: 'aal2' }, error: null });
    await verifierTotp('facteur-1', '123 456');
    expect(auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'facteur-1', code: '123456' });
  });

  it('verifierCode vérifie le code avec le type « email » (inscription comme connexion)', async () => {
    auth.verifyOtp.mockResolvedValue({ data: { user: {}, session: {} }, error: null });
    await verifierCode('lea@exemple.fr', '123456');
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'lea@exemple.fr', token: '123456', type: 'email' });
  });

  it('verifierCode refuse une réponse sans session', async () => {
    auth.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: null });
    await expect(verifierCode('lea@exemple.fr', '123456')).rejects.toThrow(MESSAGES_AUTH.codeRefuse);
  });

  it('verifierCode traduit un code refusé', async () => {
    auth.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('Token has expired or is invalid', 403, 'otp_expired'),
    });
    await expect(verifierCode('lea@exemple.fr', '000000')).rejects.toThrow(MESSAGES_AUTH.codeRefuse);
  });

  it('seDeconnecter ne ferme que la session de cet appareil', async () => {
    auth.signOut.mockResolvedValue({ error: null });
    await seDeconnecter();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('seDeconnecter signale un échec en français', async () => {
    auth.signOut.mockResolvedValue({ error: new AuthRetryableFetchError('Failed to fetch', 0) });
    await expect(seDeconnecter()).rejects.toThrow(MESSAGES_AUTH.reseau);
  });
});
