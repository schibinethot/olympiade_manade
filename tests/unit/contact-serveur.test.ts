import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { creerContact, creerLimiteurContact, ipClient, validerCorpsContact } from '../../serveur/contact.mjs';

const ORIGINE = 'http://127.0.0.1:4173';
const CHAMPS = { prenom: 'Léa', email: 'lea@exemple.fr', message: 'Bonjour, quelle sera la prochaine date ?', site_web: '', turnstileToken: 'jeton-test' };

type ServeurTest = { base: string; fermer: () => Promise<void> };
const serveurs: ServeurTest[] = [];

async function lancer(contact: ReturnType<typeof creerContact>): Promise<ServeurTest> {
  const serveur = createServer((req, res) => contact.repondre(req, res));
  await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  const resultat = { base, fermer: () => new Promise<void>((ok) => serveur.close(() => ok())) };
  serveurs.push(resultat);
  return resultat;
}

afterEach(async () => {
  await Promise.all(serveurs.splice(0).map((serveur) => serveur.fermer()));
});

function configuration(fetchFn: typeof fetch, plus: Partial<Parameters<typeof creerContact>[0]> = {}) {
  return creerContact({
    supabaseUrl: 'http://127.0.0.1:54321', serviceRoleKey: 'service-secret', turnstileSecret: 'turnstile-secret', publicOrigin: ORIGINE,
    fetchFn, ...plus,
  });
}

async function deposer(base: string, champs = CHAMPS) {
  return fetch(`${base}/api/contact`, {
    method: 'POST', headers: { Origin: ORIGINE, 'Content-Type': 'application/json' }, body: JSON.stringify(champs),
  });
}

describe('validation serveur du contact', () => {
  it('refuse tout champ inattendu et normalise les valeurs avant insertion', () => {
    expect(validerCorpsContact({ ...CHAMPS, intrus: true }).valide).toBe(false);
    expect(validerCorpsContact({ ...CHAMPS, message: 'court' }).valide).toBe(false);
    expect(validerCorpsContact({ ...CHAMPS, prenom: '  Léa\t', email: ' lea@exemple.fr ', message: ' Bonjour, quelle sera la prochaine date ? ' })).toMatchObject({
      valide: true, champs: { prenom: 'Léa', email: 'lea@exemple.fr', message: 'Bonjour, quelle sera la prochaine date ?' },
    });
  });

  it('est fermé quand une configuration sensible manque et refuse une origine tierce', async () => {
    const ferme = await lancer(creerContact());
    const indisponible = await fetch(`${ferme.base}/api/contact`, { method: 'POST' });
    expect(indisponible.status).toBe(503);
    expect(await indisponible.json()).toMatchObject({ error: expect.stringMatching(/momentanément indisponible/) });

    const ouvert = await lancer(configuration(async () => new Response('{}')));
    const origineTiers = await fetch(`${ouvert.base}/api/contact`, {
      method: 'POST', headers: { Origin: 'https://tiers.example', 'Content-Type': 'application/json' }, body: JSON.stringify(CHAMPS),
    });
    expect(origineTiers.status).toBe(403);
  });

  it('valide Siteverify côté serveur puis insère seulement avec service_role', async () => {
    const appels: Array<{ url: string; init?: RequestInit }> = [];
    const contact = configuration(async (url, init) => {
      appels.push({ url: String(url), init });
      if (String(url).includes('siteverify')) return new Response(JSON.stringify({ success: true, action: 'contact', hostname: '127.0.0.1' }));
      return new Response('', { status: 201 });
    });
    const serveur = await lancer(contact);
    const reponse = await deposer(serveur.base);
    expect(reponse.status).toBe(200);
    expect(appels).toHaveLength(2);
    expect(appels[0].url).toContain('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(String(appels[0].init?.body)).toContain('secret=turnstile-secret');
    expect(appels[1].url).toBe('http://127.0.0.1:54321/rest/v1/messages_contact');
    expect(appels[1].init?.headers).toMatchObject({ apikey: 'service-secret', Authorization: 'Bearer service-secret', Prefer: 'return=minimal' });
    expect(appels[1].init?.body).toBe(JSON.stringify({ prenom: 'Léa', email: 'lea@exemple.fr', message: 'Bonjour, quelle sera la prochaine date ?' }));
  });

  it('n’appelle ni Turnstile ni la base pour le honeypot, et exige un jeton sinon', async () => {
    let appels = 0;
    const serveur = await lancer(configuration(async () => { appels += 1; return new Response('{}'); }));
    expect((await deposer(serveur.base, { ...CHAMPS, site_web: 'https://robot.example' })).status).toBe(200);
    expect(appels).toBe(0);
    expect((await deposer(serveur.base, { ...CHAMPS, turnstileToken: '' })).status).toBe(400);
    expect(appels).toBe(0);
  });

  it('refuse un Siteverify invalide, une action erronée ou un hostname inattendu sans insertion', async () => {
    for (const resultat of [
      { success: false, action: 'contact', hostname: '127.0.0.1' },
      { success: true, action: 'inscription', hostname: '127.0.0.1' },
      { success: true, action: 'contact', hostname: 'tiers.example' },
    ]) {
      let insertions = 0;
      const contact = configuration(async (url) => {
        if (String(url).includes('siteverify')) return new Response(JSON.stringify(resultat));
        insertions += 1;
        return new Response('', { status: 201 });
      });
      const serveur = await lancer(contact);
      expect((await deposer(serveur.base)).status).toBe(400);
      expect(insertions).toBe(0);
    }
  });

  it('borne le corps et rejette le JSON illisible avant tout appel amont', async () => {
    let appels = 0;
    const serveur = await lancer(configuration(async () => { appels += 1; return new Response('{}'); }));
    const tropGrand = await fetch(`${serveur.base}/api/contact`, {
      method: 'POST', headers: { Origin: ORIGINE, 'Content-Type': 'application/json' }, body: 'x'.repeat(16_385),
    });
    expect(tropGrand.status).toBe(413);
    const invalide = await fetch(`${serveur.base}/api/contact`, {
      method: 'POST', headers: { Origin: ORIGINE, 'Content-Type': 'application/json' }, body: '{',
    });
    expect(invalide.status).toBe(400);
    expect(appels).toBe(0);
  });

  it('borne les tentatives par IP et le plafond global ne compte qu’après Turnstile', async () => {
    let verifications = 0;
    let insertions = 0;
    const contact = configuration(async (url) => {
      if (String(url).includes('siteverify')) {
        verifications += 1;
        return new Response(JSON.stringify({ success: verifications > 1, action: 'contact', hostname: '127.0.0.1' }));
      }
      insertions += 1;
      return new Response('', { status: 201 });
    }, { ipLimit: 3, globalLimit: 1 });
    const serveur = await lancer(contact);
    expect((await deposer(serveur.base)).status).toBe(400);
    expect((await deposer(serveur.base)).status).toBe(200);
    expect((await deposer(serveur.base)).status).toBe(429);
    expect(verifications).toBe(3);
    expect(insertions).toBe(1);
  });

  it('utilise l’adresse TCP par défaut et le dernier maillon X-Forwarded-For seulement derrière le proxy déclaré', () => {
    const req = { headers: { 'x-forwarded-for': '203.0.113.8, 198.51.100.9' }, socket: { remoteAddress: '192.0.2.1' } } as never;
    expect(ipClient(req, false)).toBe('192.0.2.1');
    expect(ipClient(req, true)).toBe('198.51.100.9');
  });

  it('évacue les clés IP les plus anciennes lorsque la mémoire est pleine', () => {
    const limite = creerLimiteurContact({ maxAdresses: 100, parIp: 2, global: 1_000 });
    for (let i = 0; i < 120; i++) expect(limite.accepter(`2001:db8::${i.toString(16)}`)).toBe(true);
    expect(limite.taille()).toBeLessThanOrEqual(100);
  });
});
