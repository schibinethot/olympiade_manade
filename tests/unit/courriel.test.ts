import net from 'node:net';
import { describe, expect, it } from 'vitest';
import { composerCourriel, courrielDepuisEnvironnement } from '../../serveur/courriel.mjs';
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
