import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import tls from 'node:tls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  composerCourriel,
  construireMessage,
  courrielDepuisEnvironnement,
  echecDefinitif,
  emailsDepuisEnvironnement,
  envoyerSmtp,
  masquerEmail,
  modeEmails,
} from '../../serveur/courriel.mjs';
import { creerContact } from '../../serveur/contact.mjs';

describe('courriel organisateur', () => {
  it('n’envoie rien quand le mode est éteint', async () => {
    const courriel = courrielDepuisEnvironnement({});
    expect(courriel.mode).toBe('off');
    await expect(courriel.envoyer({ prenom: 'Léa', email: 'lea@exemple.fr', message: 'Bonjour à tous' })).resolves.toEqual({
      mode: 'off', envoye: false, echec: false,
    });
  });

  it('journalise le message en mode log, sans réseau, sans corps ni adresse en clair (mineur T4)', async () => {
    const journaux: unknown[] = [];
    const courriel = courrielDepuisEnvironnement({ SMTP_MODE: 'log', CONTACT_EMAIL_TO: 'orga@exemple.fr' }, {
      journal: (ligne) => journaux.push(ligne),
    });
    const resultat = await courriel.envoyer({ prenom: 'Léa', email: 'lea@exemple.fr', message: 'Quelle est la date ?' });
    expect(resultat).toMatchObject({ mode: 'log', envoye: false, echec: false });
    expect(journaux).toEqual([{ level: 'info', message: 'courriel de contact journalisé', to: 'o***@exemple.fr', longueur: expect.any(Number) }]);
    for (const secret of ['lea@exemple.fr', 'orga@exemple.fr', 'Quelle est la date', 'Léa']) expect(JSON.stringify(journaux)).not.toContain(secret);
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

  it('journalise en mode log l’étape, sans objet, corps ni adresse en clair (sécurité M5)', async () => {
    const journaux: unknown[] = [];
    const emails = emailsDepuisEnvironnement({ SMTP_MODE: 'log' }, { journal: (ligne) => journaux.push(ligne) });
    const resultat = await emails.envoyer({ to: 'camille@exemple.fr', subject: 'Bonjour Camille', text: 'secret du corps', html: '<p>secret</p>', etape: 'veille' });
    expect(resultat).toEqual({ mode: 'log', envoye: false, echec: false, definitif: false, incertain: false });
    expect(journaux).toEqual([{ level: 'info', message: 'email journalisé', to: 'c***@exemple.fr', etape: 'veille' }]);
    expect(JSON.stringify(journaux)).not.toContain('camille@exemple.fr');
    expect(JSON.stringify(journaux)).not.toContain('Camille');
    expect(JSON.stringify(journaux)).not.toContain('secret');
  });

  it('ne fait rien en mode off', async () => {
    const emails = emailsDepuisEnvironnement({});
    expect(emails.mode).toBe('off');
    await expect(emails.envoyer({ to: 'a@b.fr', subject: 's', text: 't' })).resolves.toEqual({ mode: 'off', envoye: false, echec: false, definitif: false, incertain: false });
  });

  it('EMAILS_MODE pilote la séquence, SMTP_MODE à défaut ; une valeur inconnue vaut off (F6)', () => {
    expect(modeEmails({ EMAILS_MODE: 'log', SMTP_MODE: 'smtp' })).toBe('log');
    expect(modeEmails({ EMAILS_MODE: ' smtp ', SMTP_MODE: 'log' })).toBe('smtp');
    expect(modeEmails({ EMAILS_MODE: '', SMTP_MODE: 'log' })).toBe('log');
    expect(modeEmails({ SMTP_MODE: 'smtp' })).toBe('smtp');
    expect(modeEmails({ EMAILS_MODE: 'smpt', SMTP_MODE: 'smtp' })).toBe('off');
    expect(modeEmails({})).toBe('off');
    // La recette de la séquence en log ne touche pas au contact, qui reste en smtp.
    const env = { ...smtp, EMAILS_MODE: 'log', CONTACT_EMAIL_FROM: 'site@exemple.fr', CONTACT_EMAIL_TO: 'orga@exemple.fr' };
    expect(emailsDepuisEnvironnement(env).mode).toBe('log');
    expect(courrielDepuisEnvironnement(env).mode).toBe('smtp');
  });

  it('exige toutes les valeurs en smtp, dit ce qui manque, et délègue au transport', async () => {
    expect(emailsDepuisEnvironnement({ ...smtp, EMAILS_FROM: '' })).toMatchObject({ pret: false, manques: ['expediteur'] });
    expect(emailsDepuisEnvironnement({ ...smtp, SMTP_PASS: '' })).toMatchObject({ pret: false, manques: ['smtp_incomplet'] });
    expect(emailsDepuisEnvironnement({ SMTP_MODE: 'smtp' })).toMatchObject({ pret: false, manques: ['smtp_incomplet', 'expediteur'] });
    expect(emailsDepuisEnvironnement({ SMTP_MODE: 'log' })).toMatchObject({ pret: true, manques: [] });
    const appels: Array<{ from: string; to: string; html?: string; headers?: Record<string, string> }> = [];
    const emails = emailsDepuisEnvironnement(smtp, { envoyer: async (_cfg, message) => { appels.push(message); } });
    expect(emails.pret).toBe(true);
    await expect(emails.envoyer({ to: 'a@b.fr', subject: 's', text: 't', html: '<p>t</p>', headers: { 'X-A': 'b' } }))
      .resolves.toEqual({ mode: 'smtp', envoye: true, echec: false, definitif: false, incertain: false });
    expect(appels[0]).toMatchObject({ from: 'Olympiade <bonjour@exemple.fr>', to: 'a@b.fr', html: '<p>t</p>', headers: { 'X-A': 'b' } });
    const casse = emailsDepuisEnvironnement(smtp, { envoyer: async () => { throw new Error('boum'); }, journal: () => undefined });
    await expect(casse.envoyer({ to: 'a@b.fr', subject: 's', text: 't' })).resolves.toEqual({ mode: 'smtp', envoye: false, echec: true, definitif: false, incertain: false });
    const refuse = emailsDepuisEnvironnement(smtp, {
      envoyer: async () => { throw Object.assign(new Error('SMTP refusé (550)'), { codeSmtp: 550, etapeSmtp: 'to' }); }, journal: () => undefined,
    });
    await expect(refuse.envoyer({ to: 'a@b.fr', subject: 's', text: 't' })).resolves.toEqual({ mode: 'smtp', envoye: false, echec: true, definitif: true, incertain: false });
    const journaux: unknown[] = [];
    const incomplet = emailsDepuisEnvironnement({ SMTP_MODE: 'smtp' }, { journal: (ligne) => journaux.push(ligne) });
    await expect(incomplet.envoyer({ to: 'a@b.fr', subject: 's', text: 't' })).resolves.toEqual({ mode: 'smtp', envoye: false, echec: true, definitif: false, incertain: false });
    expect(journaux).toEqual([{ level: 'error', message: 'smtp non configuré' }]);
  });

  it('refuse un destinataire invalide sans appeler le transport (définitif), et force construireMessage', async () => {
    const appels: Array<{ headers?: Record<string, string> }> = [];
    const journaux: unknown[] = [];
    const emails = emailsDepuisEnvironnement(smtp, { envoyer: async (_cfg, message) => { appels.push(message); }, journal: (ligne) => journaux.push(ligne) });
    for (const to of ['a@b.fr\r\nRCPT TO:<x@y.fr>', 'a@b.fr> NOTIFY=NEVER', 'a@b.fr <c@d.fr>', 'sans-arobase', 'a@b']) {
      await expect(emails.envoyer({ to, subject: 's', text: 't' })).resolves.toEqual({ mode: 'smtp', envoye: false, echec: true, definitif: true, incertain: false });
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

// ——— Faux serveur SMTP (STARTTLS réel, certificat de test généré à la volée) ———

type Refus = { commande: 'AUTH' | 'MAIL' | 'RCPT' | 'DATA' | 'CORPS'; code: number };
/**
 * `corps` : après le corps, le serveur répond (défaut), se tait (« muet ») ou coupe la connexion (« coupe ») ;
 * `delaiCorpsMs` : il répond, mais après ce délai (relais lent).
 */
type Scenario = { quit: 'muet' | 'repond'; refus?: Refus; corps?: 'muet' | 'coupe'; delaiCorpsMs?: number };

let certificat: { cle: string; cert: string };

beforeAll(() => {
  const dossier = mkdtempSync(join(tmpdir(), 'smtp-test-'));
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1',
    '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', join(dossier, 'cle.pem'), '-out', join(dossier, 'cert.pem'),
  ], { stdio: 'ignore' });
  certificat = { cle: readFileSync(join(dossier, 'cle.pem'), 'utf8'), cert: readFileSync(join(dossier, 'cert.pem'), 'utf8') };
});

const serveursSmtp: net.Server[] = [];
afterAll(async () => {
  await Promise.all(serveursSmtp.map((serveur) => new Promise((ok) => serveur.close(ok))));
});

/** Dialogue SMTP minimal : EHLO, STARTTLS, AUTH LOGIN, MAIL, RCPT, DATA, corps, QUIT. */
async function fauxSmtp(scenario: Scenario) {
  const recu: string[] = [];
  const connexions: net.Socket[] = [];
  const serveur = net.createServer((brut) => {
    connexions.push(brut);
    brut.write('220 faux\r\n');
    let tampon = '';
    let corps = false;
    /** @param {net.Socket | tls.TLSSocket} s */
    const traiter = (s: net.Socket, ligne: string) => {
      recu.push(corps ? `corps:${ligne}` : ligne.split(' ')[0]);
      const refus = (commande: Refus['commande']) => scenario.refus?.commande === commande ? `${scenario.refus.code} refus\r\n` : null;
      if (corps) {
        if (ligne !== '.') return;
        corps = false;
        if (scenario.corps === 'muet') return;
        if (scenario.corps === 'coupe') {
          s.destroy();
          brut.destroy();
          return;
        }
        const reponse = refus('CORPS') ?? '250 accepte\r\n';
        if (scenario.delaiCorpsMs) setTimeout(() => { if (!s.destroyed) s.write(reponse); }, scenario.delaiCorpsMs);
        else s.write(reponse);
        return;
      }
      if (/^EHLO/.test(ligne)) s.write(s === brut ? '250-faux\r\n250 STARTTLS\r\n' : '250 ok\r\n');
      else if (ligne === 'STARTTLS') {
        s.write('220 go\r\n');
        brut.removeAllListeners('data');
        const securise = new tls.TLSSocket(brut, { isServer: true, key: certificat.cle, cert: certificat.cert });
        connexions.push(securise);
        let t = '';
        securise.on('data', (morceau) => {
          t += morceau.toString('utf8');
          let fin;
          while ((fin = t.indexOf('\r\n')) >= 0) {
            const l = t.slice(0, fin);
            t = t.slice(fin + 2);
            traiter(securise, l);
          }
        });
        securise.on('error', () => undefined);
      } else if (ligne === 'AUTH LOGIN') s.write(refus('AUTH') ?? '334 VXNlcm5hbWU6\r\n');
      else if (recu.at(-2) === 'AUTH') s.write('334 UGFzc3dvcmQ6\r\n');
      else if (recu.at(-3) === 'AUTH') s.write('235 ok\r\n');
      else if (/^MAIL FROM/.test(ligne)) s.write(refus('MAIL') ?? '250 ok\r\n');
      else if (/^RCPT TO/.test(ligne)) s.write(refus('RCPT') ?? '250 ok\r\n');
      else if (ligne === 'DATA') {
        const r = refus('DATA');
        if (r) s.write(r);
        else {
          corps = true;
          s.write('354 envoyez\r\n');
        }
      } else if (ligne === 'QUIT') {
        if (scenario.quit === 'repond') s.end('221 au revoir\r\n');
        // « muet » : ni réponse ni fermeture.
      }
    };
    brut.on('data', (morceau) => {
      tampon += morceau.toString('utf8');
      let fin;
      while ((fin = tampon.indexOf('\r\n')) >= 0) {
        const ligne = tampon.slice(0, fin);
        tampon = tampon.slice(fin + 2);
        traiter(brut, ligne);
      }
    });
    brut.on('error', () => undefined);
  });
  await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
  serveursSmtp.push(serveur);
  const port = (serveur.address() as net.AddressInfo).port;
  return {
    recu,
    smtp: { host: '127.0.0.1', port, user: 'u', pass: 'p', ca: certificat.cert },
    fermer: () => { for (const c of connexions) c.destroy(); },
  };
}

const MESSAGE = { from: 'Olympiade <bonjour@exemple.fr>', to: 'camille@exemple.fr', subject: 'Sujet', text: 'Corps.', html: '<p>Corps.</p>', headers: {} };

describe('envoyerSmtp : fin de dialogue et refus (F1)', () => {
  it('résout dès le 250 du corps : un serveur muet au QUIT, puis le délai qui expire, ne font pas un échec', async () => {
    const faux = await fauxSmtp({ quit: 'muet' });
    const debut = Date.now();
    await expect(envoyerSmtp({ ...faux.smtp, timeoutMs: 400 }, MESSAGE)).resolves.toBeUndefined();
    expect(Date.now() - debut).toBeLessThan(400);
    // Le délai de 400 ms expire ensuite sans rien changer (aucun rejet non traité) ; QUIT est bien parti.
    await new Promise((ok) => setTimeout(ok, 600));
    expect(faux.recu).toContain('QUIT');
    expect(faux.recu.filter((l) => l.startsWith('corps:')).length).toBeGreaterThan(0);
    faux.fermer();
  });

  it('un serveur qui répond au QUIT : succès aussi', async () => {
    const faux = await fauxSmtp({ quit: 'repond' });
    await expect(envoyerSmtp({ ...faux.smtp, timeoutMs: 2_000 }, MESSAGE)).resolves.toBeUndefined();
    faux.fermer();
  });

  it('un refus 5xx pour ce message est définitif ; un 4xx, un 5xx d’authentification ou de MAIL FROM, un délai se réessaient', async () => {
    const cas: [Refus, boolean][] = [
      [{ commande: 'RCPT', code: 550 }, true],
      [{ commande: 'DATA', code: 554 }, true],
      [{ commande: 'CORPS', code: 554 }, true],
      [{ commande: 'DATA', code: 451 }, false],
      [{ commande: 'RCPT', code: 452 }, false],
      [{ commande: 'AUTH', code: 535 }, false],
      // Expéditeur refusé (domaine pas encore authentifié chez le relais) : un réglage, comme l'AUTH (mineur n° 1).
      [{ commande: 'MAIL', code: 550 }, false],
      [{ commande: 'MAIL', code: 451 }, false],
    ];
    for (const [refus, definitif] of cas) {
      const faux = await fauxSmtp({ quit: 'repond', refus });
      const erreur = await envoyerSmtp({ ...faux.smtp, timeoutMs: 2_000 }, MESSAGE).then(() => null, (e: unknown) => e);
      expect(erreur, `${refus.commande} ${refus.code}`).toMatchObject({ codeSmtp: refus.code });
      expect(echecDefinitif(erreur), `${refus.commande} ${refus.code}`).toBe(definitif);
      // Même verdict au travers du transport de la séquence.
      const emails = emailsDepuisEnvironnement(
        { SMTP_MODE: 'smtp', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(faux.smtp.port), SMTP_USER: 'u', SMTP_PASS: 'p', EMAILS_FROM: MESSAGE.from },
        { envoyer: (cfg, message) => envoyerSmtp({ ...cfg, ca: certificat.cert, timeoutMs: 2_000 }, message), journal: () => undefined },
      );
      await expect(emails.envoyer({ to: MESSAGE.to, subject: 's', text: 't' }), `${refus.commande} ${refus.code}`)
        .resolves.toMatchObject({ echec: true, definitif, incertain: false });
      faux.fermer();
    }
    // Un délai dépassé (serveur muet dès l'accueil) se réessaie.
    const muet = net.createServer(() => undefined);
    await new Promise<void>((ok) => muet.listen(0, '127.0.0.1', ok));
    serveursSmtp.push(muet);
    const delai = await envoyerSmtp({ host: '127.0.0.1', port: (muet.address() as net.AddressInfo).port, user: 'u', pass: 'p', timeoutMs: 200 }, MESSAGE)
      .then(() => null, (e: unknown) => e);
    expect(String(delai)).toMatch(/Délai SMTP dépassé/);
    expect(echecDefinitif(delai)).toBe(false);
    expect(delai).not.toHaveProperty('incertain');
    // Un message invalide (en-tête interdit) est définitif, sans connexion.
    expect(echecDefinitif(await envoyerSmtp({ host: '127.0.0.1', port: 1, user: 'u', pass: 'p' }, { ...MESSAGE, headers: { From: 'x' } })
      .then(() => null, (e: unknown) => e))).toBe(true);
  });

  it('corps reçu sans réponse (délai) ou connexion coupée après le corps : incertain et définitif, jamais réessayé (Important n° 2)', async () => {
    for (const corps of ['muet', 'coupe'] as const) {
      const faux = await fauxSmtp({ quit: 'repond', corps });
      const erreur = await envoyerSmtp({ ...faux.smtp, timeoutMs: 2_000, timeoutCorpsMs: 300 }, MESSAGE).then(() => null, (e: unknown) => e);
      // Le relais a bien reçu le corps : il a pu l'accepter.
      expect(faux.recu.filter((l) => l.startsWith('corps:')).length, corps).toBeGreaterThan(0);
      expect(erreur, corps).toMatchObject({ incertain: true, definitif: true });
      expect(erreur, corps).not.toHaveProperty('codeSmtp');
      expect(echecDefinitif(erreur), corps).toBe(true);
      faux.fermer();

      const autre = await fauxSmtp({ quit: 'repond', corps });
      const emails = emailsDepuisEnvironnement(
        { SMTP_MODE: 'smtp', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(autre.smtp.port), SMTP_USER: 'u', SMTP_PASS: 'p', EMAILS_FROM: MESSAGE.from },
        { envoyer: (cfg, message) => envoyerSmtp({ ...cfg, ca: certificat.cert, timeoutMs: 2_000, timeoutCorpsMs: 300 }, message), journal: () => undefined },
      );
      await expect(emails.envoyer({ to: MESSAGE.to, subject: 's', text: 't' }), corps)
        .resolves.toMatchObject({ envoye: false, echec: true, definitif: true, incertain: true });
      autre.fermer();
    }
  });

  it('le 250 a son propre délai après le corps : un relais lent au-delà du délai du dialogue réussit (mineur n° 9)', async () => {
    // Dialogue borné à 300 ms, mais le relais met 600 ms à accepter le corps : l'envoi réussit, il n'est pas incertain.
    const lent = await fauxSmtp({ quit: 'repond', delaiCorpsMs: 600 });
    const debut = Date.now();
    await expect(envoyerSmtp({ ...lent.smtp, timeoutMs: 300 }, MESSAGE)).resolves.toBeUndefined();
    expect(Date.now() - debut).toBeGreaterThanOrEqual(550);
    lent.fermer();
    // Le délai du 250 reste borné : au-delà de timeoutCorpsMs, incertain.
    const tropLent = await fauxSmtp({ quit: 'repond', delaiCorpsMs: 1_000 });
    const erreur = await envoyerSmtp({ ...tropLent.smtp, timeoutMs: 300, timeoutCorpsMs: 400 }, MESSAGE).then(() => null, (e: unknown) => e);
    expect(String(erreur)).toMatch(/après le corps/);
    expect(erreur).toMatchObject({ incertain: true, definitif: true });
    tropLent.fermer();
    // Avant le corps, le délai du dialogue s'applique toujours.
    const muet = net.createServer(() => undefined);
    await new Promise<void>((ok) => muet.listen(0, '127.0.0.1', ok));
    serveursSmtp.push(muet);
    const avant = await envoyerSmtp({ host: '127.0.0.1', port: (muet.address() as net.AddressInfo).port, user: 'u', pass: 'p', timeoutMs: 200 }, MESSAGE)
      .then(() => null, (e: unknown) => e);
    expect(String(avant)).toMatch(/Délai SMTP dépassé\.$/);
    expect(avant).not.toHaveProperty('incertain');
  });
});
