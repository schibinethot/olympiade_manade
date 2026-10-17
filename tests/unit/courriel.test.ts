import net from 'node:net';
import { describe, expect, it } from 'vitest';
import { composerCourriel, construireMessage, courrielDepuisEnvironnement, emailsDepuisEnvironnement, envoyerSmtp, masquerEmail } from '../../serveur/courriel.mjs';
import { creerContact } from '../../serveur/contact.mjs';

describe('courriel organisateur', () => {
  it('n’envoie rien quand le mode est éteint', async () => {
    const courriel = courrielDepuisEnvironnement({});
    expect(courriel.mode).toBe('off');
    await expect(courriel.envoyer({ prenom: 'Léa', email: 'lea@exemple.fr', message: 'Bonjour à tous' })).resolves.toEqual({
      mode: 'off', envoye: false, echec: false,
    });
  });

  it('journalise le message en mode log, sans réseau', async () => {
    const journaux: unknown[] = [];
    const courriel = courrielDepuisEnvironnement({ SMTP_MODE: 'log', CONTACT_EMAIL_TO: 'orga@exemple.fr' }, {
      journal: (ligne) => journaux.push(ligne),
    });
    const resultat = await courriel.envoyer({ prenom: 'Léa', email: 'lea@exemple.fr', message: 'Quelle est la date ?' });
    expect(resultat).toMatchObject({ mode: 'log', envoye: false, echec: false });
    expect(JSON.stringify(journaux[0])).toContain('lea@exemple.fr');
  });

  it('délègue l’envoi SMTP injecté et signale un réglage incomplet', async () => {
    const appels: unknown[] = [];
    const courriel = courrielDepuisEnvironnement({
      SMTP_MODE: 'smtp', SMTP_HOST: 'smtp.exemple.fr', SMTP_PORT: '587',
      SMTP_USER: 'cle', SMTP_PASS: 'secret', CONTACT_EMAIL_FROM: 'site@exemple.fr', CONTACT_EMAIL_TO: 'orga@exemple.fr',
    }, {
      envoyer: async (_smtp, message) => { appels.push(message.subject); },
    });
    await expect(courriel.envoyer({ prenom: 'Léa', email: 'lea@exemple.fr', message: 'Bonjour' })).resolves.toMatchObject({ envoye: true, echec: false });
    expect(appels).toHaveLength(1);
    const incomplet = courrielDepuisEnvironnement({ SMTP_MODE: 'smtp' });
    await expect(incomplet.envoyer({ prenom: 'Léa', email: 'lea@exemple.fr', message: 'Bonjour' })).resolves.toMatchObject({ echec: true });
    expect(composerCourriel({ from: 'a@b.c', to: 'd@e.f', subject: 'Café', text: 'Ligne\n.point' })).toContain('..point');
  });
});

describe('contact et email', () => {
  it('répond 502 si l’email SMTP échoue après l’enregistrement', async () => {
    const contact = creerContact({
      supabaseUrl: 'http://127.0.0.1:54321',
      serviceRoleKey: 'service',
      turnstileSecret: 'secret',
      publicOrigin: 'http://127.0.0.1:4173',
      fetchFn: async (url) => {
        const adresse = String(url);
        if (adresse.includes('siteverify')) return new Response(JSON.stringify({ success: true, action: 'contact', hostname: '127.0.0.1' }));
        return new Response('', { status: 201 });
      },
      envoyer: async () => ({ echec: true }),
    });
    const serveur = (await import('node:http')).createServer((req, res) => void contact.repondre(req, res));
    await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
    const port = (serveur.address() as net.AddressInfo).port;
    try {
      const reponse = await fetch(`http://127.0.0.1:${port}/api/contact`, {
        method: 'POST',
        headers: { origin: 'http://127.0.0.1:4173', 'content-type': 'application/json' },
        body: JSON.stringify({ prenom: 'Léa', email: 'lea@exemple.fr', message: 'Bonjour, quelle sera la prochaine date ?', site_web: '', turnstileToken: 'jeton' }),
      });
      expect(reponse.status).toBe(502);
    } finally {
      await new Promise((ok) => serveur.close(ok));
    }
  });
});

describe('construireMessage', () => {
  const base = { from: 'Olympiade des Manades <bonjour@olympiadedesmanades.fr>', to: 'camille@exemple.fr', subject: 'Demain : l’Olympiade à Sommières !', text: 'Bonjour Camille,\n.à demain', html: '<p>Bonjour Camille</p>' };

  it('produit un multipart/alternative en base64 avec objet RFC 2047', () => {
    const message = construireMessage(base);
    expect(message).toContain('Subject: =?UTF-8?B?');
    expect(message).toContain('multipart/alternative');
    expect(message).toContain('Content-Type: text/plain; charset=utf-8');
    expect(message).toContain('Content-Type: text/html; charset=utf-8');
    expect(message).toMatch(/\r\nMIME-Version: 1\.0\r\n/);
    expect(message).toMatch(/\r\nDate: /);
    expect(message).toMatch(/\r\nMessage-ID: <[^@>\s]+@olympiadedesmanades\.fr>\r\n/);
    expect(message).toMatch(/^From: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=\r\n <bonjour@olympiadedesmanades\.fr>\r\n/);
    expect(message).not.toContain('Sommières');
    const lignes = message.split('\r\n');
    const base64 = lignes.filter((ligne) => /^[A-Za-z0-9+/=]{20,}$/.test(ligne));
    expect(base64.length).toBeGreaterThan(0);
    expect(base64.every((ligne) => ligne.length <= 76)).toBe(true);
    expect(lignes.some((ligne) => ligne.startsWith('.'))).toBe(false);
    expect(lignes.every((ligne) => ligne.length <= 998)).toBe(true);
  });

  it('reste mono-partie sans html, et rejette un en-tête avec CR ou LF', () => {
    const simple = construireMessage({ ...base, html: undefined });
    expect(simple).not.toContain('multipart/alternative');
    expect(simple).toContain('Content-Type: text/plain; charset=utf-8');
    expect(() => construireMessage({ ...base, headers: { 'List-Unsubscribe': '<https://x>\r\nBcc: pirate@exemple.fr' } })).toThrow();
    expect(() => construireMessage({ ...base, headers: { 'X-Test': 'a\nb' } })).toThrow();
    expect(() => construireMessage({ ...base, subject: 'a\r\nBcc: x@y.z' })).toThrow();
    expect(construireMessage({ ...base, headers: { 'List-Unsubscribe': '<https://x>' } })).toContain('List-Unsubscribe: <https://x>\r\n');
  });

  it('masque les adresses', () => {
    expect(masquerEmail('camille@exemple.fr')).toBe('c***@exemple.fr');
  });

  it('garde chaque ligne d’en-tête sous 76 caractères (From et Subject longs)', () => {
    const message = construireMessage({
      ...base,
      from: 'Olympiade des Manades de Sommières et du Gard <bonjour@olympiadedesmanades.fr>',
      subject: 'Demain : l’Olympiade à Sommières ! Rendez-vous à 18 h 30 aux arènes, venez nombreux avec vos amis',
    });
    const entete = message.split('\r\n\r\n')[0].split('\r\n');
    expect(entete.every((ligne) => ligne.length <= 76)).toBe(true);
    expect(entete.some((ligne) => ligne.startsWith(' =?UTF-8?B?'))).toBe(true);
  });

  it('découpe les corps longs à 76 colonnes, en texte comme en html', () => {
    const long = 'Ligne très longue éàü '.repeat(30);
    for (const message of [construireMessage({ ...base, text: long, html: `<p>${long}</p>` }), construireMessage({ ...base, text: long, html: undefined })]) {
      const lignes = message.split('\r\n');
      const base64 = lignes.filter((ligne) => /^[A-Za-z0-9+/=]{40,}$/.test(ligne));
      expect(base64.length).toBeGreaterThan(5);
      expect(lignes.every((ligne) => ligne.length <= 76 || ligne.startsWith('Content-Type: multipart'))).toBe(true);
    }
  });

  it('refuse les en-têtes réservés et les valeurs non ASCII', () => {
    for (const nom of ['From', 'to', 'Cc', 'Bcc', 'Subject', 'Date', 'Message-ID', 'MIME-Version', 'Content-Type', 'content-transfer-encoding', 'Reply-To']) {
      expect(() => construireMessage({ ...base, headers: { [nom]: 'x' } })).toThrow();
    }
    expect(() => construireMessage({ ...base, headers: { 'X-A': 'é' } })).toThrow();
    expect(() => construireMessage({ ...base, headers: { 'X-A': 'a\u0000b' } })).toThrow();
    expect(construireMessage({ ...base, headers: { 'List-Unsubscribe': '<https://x/y?j=a-b_c>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } })).toContain('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
  });
});

describe('envoyerSmtp : adresses d’enveloppe', () => {
  const cfg = { host: '127.0.0.1', port: 1, user: 'u', pass: 'p' };
  it('refuse un expéditeur ou un destinataire piégé avant toute connexion', async () => {
    const ok = { from: 'site@exemple.fr', subject: 's', text: 't' };
    for (const to of ['a@b.fr\r\nRCPT TO:<x@y.fr>', 'a@b.fr> NOTIFY=NEVER', 'a@b.fr <c@d.fr>', 'a b@c.fr']) {
      await expect(envoyerSmtp(cfg, { ...ok, to })).rejects.toThrow(/invalide/);
    }
    await expect(envoyerSmtp(cfg, { ...ok, from: 'x@y.fr\r\nDATA', to: 'a@b.fr' })).rejects.toThrow(/invalide/);
    await expect(envoyerSmtp(cfg, { ...ok, from: 'Nom <x@y.fr> <z@w.fr>', to: 'a@b.fr', html: '<p>x</p>' })).rejects.toThrow(/invalide/);
  });
});

describe('emailsDepuisEnvironnement', () => {
  const smtp = { SMTP_MODE: 'smtp', SMTP_HOST: 'smtp.exemple.fr', SMTP_PORT: '587', SMTP_USER: 'u', SMTP_PASS: 'p', EMAILS_FROM: 'Olympiade <bonjour@exemple.fr>' };

  it('journalise en mode log sans corps ni adresse en clair', async () => {
    const journaux: unknown[] = [];
    const emails = emailsDepuisEnvironnement({ SMTP_MODE: 'log' }, { journal: (ligne) => journaux.push(ligne) });
    const resultat = await emails.envoyer({ to: 'camille@exemple.fr', subject: 'Sujet', text: 'secret du corps', html: '<p>secret</p>' });
    expect(resultat).toEqual({ mode: 'log', envoye: false, echec: false });
    expect(journaux).toEqual([{ level: 'info', message: 'email journalisé', to: 'c***@exemple.fr', subject: 'Sujet' }]);
    expect(JSON.stringify(journaux)).not.toContain('camille@exemple.fr');
    expect(JSON.stringify(journaux)).not.toContain('secret');
  });

  it('ne fait rien en mode off', async () => {
    const emails = emailsDepuisEnvironnement({});
    expect(emails.mode).toBe('off');
    await expect(emails.envoyer({ to: 'a@b.fr', subject: 's', text: 't' })).resolves.toEqual({ mode: 'off', envoye: false, echec: false });
  });

  it('exige toutes les valeurs en smtp et délègue au transport', async () => {
    expect(emailsDepuisEnvironnement({ ...smtp, EMAILS_FROM: '' }).pret).toBe(false);
    expect(emailsDepuisEnvironnement({ ...smtp, SMTP_PASS: '' }).pret).toBe(false);
    const appels: Array<{ from: string; to: string; html?: string; headers?: Record<string, string> }> = [];
    const emails = emailsDepuisEnvironnement(smtp, { envoyer: async (_cfg, message) => { appels.push(message); } });
    expect(emails.pret).toBe(true);
    await expect(emails.envoyer({ to: 'a@b.fr', subject: 's', text: 't', html: '<p>t</p>', headers: { 'X-A': 'b' } })).resolves.toEqual({ mode: 'smtp', envoye: true, echec: false });
    expect(appels[0]).toMatchObject({ from: 'Olympiade <bonjour@exemple.fr>', to: 'a@b.fr', html: '<p>t</p>', headers: { 'X-A': 'b' } });
    const casse = emailsDepuisEnvironnement(smtp, { envoyer: async () => { throw new Error('boum'); }, journal: () => undefined });
    await expect(casse.envoyer({ to: 'a@b.fr', subject: 's', text: 't' })).resolves.toEqual({ mode: 'smtp', envoye: false, echec: true });
    const journaux: unknown[] = [];
    const incomplet = emailsDepuisEnvironnement({ SMTP_MODE: 'smtp' }, { journal: (ligne) => journaux.push(ligne) });
    await expect(incomplet.envoyer({ to: 'a@b.fr', subject: 's', text: 't' })).resolves.toEqual({ mode: 'smtp', envoye: false, echec: true });
    expect(journaux).toEqual([{ level: 'error', message: 'smtp non configuré' }]);
  });

  it('refuse un destinataire invalide sans appeler le transport, et force construireMessage', async () => {
    const appels: Array<{ headers?: Record<string, string> }> = [];
    const journaux: unknown[] = [];
    const emails = emailsDepuisEnvironnement(smtp, { envoyer: async (_cfg, message) => { appels.push(message); }, journal: (ligne) => journaux.push(ligne) });
    for (const to of ['a@b.fr\r\nRCPT TO:<x@y.fr>', 'a@b.fr> NOTIFY=NEVER', 'a@b.fr <c@d.fr>', 'sans-arobase', 'a@b']) {
      await expect(emails.envoyer({ to, subject: 's', text: 't' })).resolves.toEqual({ mode: 'smtp', envoye: false, echec: true });
    }
    expect(appels).toHaveLength(0);
    expect(journaux).toHaveLength(5);
    expect(JSON.stringify(journaux)).not.toContain('RCPT');
    await emails.envoyer({ to: 'a@b.fr', subject: 's', text: 't' });
    expect(appels[0].headers).toEqual({});
  });

  it('une séquence en texte seul passe par construireMessage (Date et Message-ID)', async () => {
    // envoyerSmtp choisit construireMessage dès que `headers` est défini (même vide) : emailsDepuisEnvironnement le fournit toujours.
    const message = construireMessage({ from: 'a@exemple.fr', to: 'b@exemple.fr', subject: 's', text: 't', headers: {} });
    expect(message).toMatch(/\r\nDate: /);
    expect(message).toMatch(/\r\nMessage-ID: </);
  });
});
