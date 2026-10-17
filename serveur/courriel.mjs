// @ts-check
// Email vers l'organisateur (CDC §4.0 contact, CA-13).
// SMTP_MODE=off (défaut) : aucun envoi, le dépôt en base reste seul.
// SMTP_MODE=log : le message est journalisé, sans réseau (recette sans identifiants).
// SMTP_MODE=smtp : envoi SMTP (STARTTLS), identifiants uniquement par l'environnement.

import net from 'node:net';
import tls from 'node:tls';
import { randomUUID } from 'node:crypto';

/** @param {string | undefined} valeur */
function texte(valeur) {
  return typeof valeur === 'string' ? valeur.trim() : '';
}

/** @param {string} valeur */
function sujetEncode(valeur) {
  return `=?UTF-8?B?${Buffer.from(valeur, 'utf8').toString('base64')}?=`;
}

/** @param {string} corps */
function corpsPoint(corps) {
  return corps.replaceAll('\r\n', '\n').split('\n').map((ligne) => (ligne.startsWith('.') ? `.${ligne}` : ligne)).join('\r\n');
}

/**
 * @param {{ from: string, to: string, subject: string, text: string, replyTo?: string }} message
 */
export function composerCourriel(message) {
  return [
    `From: ${message.from}`,
    `To: ${message.to}`,
    ...(message.replyTo ? [`Reply-To: ${message.replyTo}`] : []),
    `Subject: ${sujetEncode(message.subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    corpsPoint(message.text),
    '',
  ].join('\r\n');
}

const CRLF = String.fromCharCode(13, 10);

/** @param {string} valeur */
function sansSautDeLigne(valeur, /** @type {string} */ nom) {
  if (/[\r\n]/.test(valeur)) throw new Error(`En-tête invalide (saut de ligne) : ${nom}`);
  return valeur;
}

/** Base64 découpé à 76 caractères, lignes séparées par CRLF. */
function base64Mime(/** @type {string} */ valeur) {
  const brut = Buffer.from(valeur.replaceAll(CRLF, '\n').replaceAll('\n', CRLF), 'utf8').toString('base64');
  return (brut.match(/.{1,76}/g) ?? ['']).join(CRLF);
}

/** Mots encodés RFC 2047 (UTF-8, B) : 30 octets au plus par mot (52 caractères encodés), pour garder chaque ligne sous 76. */
function motsEncodes(/** @type {string} */ valeur) {
  /** @type {string[]} */
  const mots = [];
  let courant = '';
  for (const caractere of valeur) {
    if (Buffer.byteLength(courant + caractere, 'utf8') > 30) {
      mots.push(courant);
      courant = '';
    }
    courant += caractere;
  }
  if (courant || mots.length === 0) mots.push(courant);
  return mots.map(sujetEncode).join(`${CRLF} `);
}

/** « Nom <a@b.fr> » : nom encodé RFC 2047 s’il n’est pas ASCII simple. */
function adresseAvecNom(/** @type {string} */ adresse) {
  const m = /^\s*(.*?)\s*<([^<>]+)>\s*$/.exec(adresse);
  if (!m) return adresse;
  const nom = m[1].replace(/^"(.*)"$/, '$1');
  if (!nom) return `<${m[2]}>`;
  // L’adresse sur sa propre ligne repliée : la ligne ne dépasse jamais 76 caractères.
  return `${motsEncodes(nom)}${CRLF} <${m[2]}>`;
}

/** Adresse nue d’un « Nom <a@b.fr> » (domaine du Message-ID, sans contrôle). */
function adresseNue(/** @type {string} */ adresse) {
  const m = /<([^<>]+)>/.exec(adresse);
  return (m ? m[1] : adresse).trim();
}

/** Adresse d’enveloppe SMTP : « a@b.fr » ou « Nom <a@b.fr> » seulement, sans CR, LF, chevron ni espace dans l’adresse. */
function adresseEnveloppe(/** @type {string} */ adresse, /** @type {string} */ role, /** @type {boolean} */ avecNom) {
  const brut = String(adresse).trim();
  const m = avecNom ? /^[^<>]*<([^<>]*)>$/.exec(brut) : null;
  const nue = m ? m[1] : brut;
  if (/[\r\n]/.test(brut) || !nue || /[\r\n<>\s]/.test(nue)) throw new Error(`Adresse ${role} invalide.`);
  return nue;
}

const ENTETES_RESERVES = /^(from|to|cc|bcc|subject|date|message-id|mime-version|reply-to|content-.*)$/i;
const DESTINATAIRE_VALIDE = /^[^\s@<>,;:"()[\]\\]+@[^\s@<>,;:"()[\]\\]+\.[^\s@<>,;:"()[\]\\]+$/;

/**
 * Message RFC 5322 complet : texte seul, ou multipart/alternative si `html` est présent.
 * Corps en base64 (76 colonnes), objet et nom d’expéditeur en RFC 2047.
 * @param {{ from: string, to: string, subject: string, text: string, html?: string, replyTo?: string, headers?: Record<string, string> }} message
 * @returns {string}
 */
export function construireMessage({ from, to, subject, text, html, replyTo, headers }) {
  sansSautDeLigne(from, 'From');
  sansSautDeLigne(to, 'To');
  sansSautDeLigne(subject, 'Subject');
  if (replyTo) sansSautDeLigne(replyTo, 'Reply-To');
  const supplementaires = Object.entries(headers ?? {}).map(([nom, valeur]) => {
    if (!/^[A-Za-z0-9-]+$/.test(nom) || ENTETES_RESERVES.test(nom)) throw new Error(`Nom d’en-tête invalide ou réservé : ${nom}`);
    if (/[^\x20-\x7e\t]/.test(String(valeur))) throw new Error(`En-tête invalide (caractère non ASCII ou de contrôle) : ${nom}`);
    return `${nom}: ${String(valeur)}`;
  });
  const domaine = /@([^@<>\s]+)>?\s*$/.exec(adresseNue(from))?.[1] ?? 'localhost';
  const enTetes = [
    `From: ${adresseAvecNom(from)}`,
    `To: ${to}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${motsEncodes(subject)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${randomUUID()}@${domaine}>`,
    'MIME-Version: 1.0',
    ...supplementaires,
  ];
  if (html === undefined || html === '') {
    return [
      ...enTetes,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      base64Mime(text),
      '',
    ].join(CRLF);
  }
  const frontiere = `=_m_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
  return [
    ...enTetes,
    `Content-Type: multipart/alternative; boundary="${frontiere}"`,
    '',
    `--${frontiere}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Mime(text),
    `--${frontiere}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Mime(html),
    `--${frontiere}--`,
    '',
  ].join(CRLF);
}

/**
 * Masque une adresse pour les journaux : « camille@exemple.fr » devient « c***@exemple.fr ».
 * @param {string} email
 */
export function masquerEmail(email) {
  const arobase = String(email).lastIndexOf('@');
  if (arobase < 1) return '***';
  return `${String(email)[0]}***${String(email).slice(arobase)}`;
}

/**
 * @param {{ host: string, port: number, user: string, pass: string, timeoutMs?: number }} smtp
 * @param {{ from: string, to: string, subject: string, text: string, html?: string, replyTo?: string, headers?: Record<string, string> }} message
 */
export function envoyerSmtp(smtp, message) {
  // Contrôle avant toute connexion et quel que soit le chemin de composition.
  /** @type {string} */
  let expediteur;
  /** @type {string} */
  let destinataire;
  try {
    expediteur = adresseEnveloppe(message.from, 'expéditeur', true);
    destinataire = adresseEnveloppe(message.to, 'destinataire', false);
  } catch (erreur) {
    return Promise.reject(erreur);
  }
  const timeoutMs = smtp.timeoutMs ?? 10_000;
  // Le contact reste en texte 8bit inchangé ; les e-mails de séquence (html, en-têtes) passent en multipart.
  const contenu = message.html !== undefined || message.headers ? construireMessage(message) : composerCourriel(message);
  return new Promise((resolve, reject) => {
    const echec = (/** @type {Error} */ erreur) => {
      socket.destroy();
      reject(erreur);
    };
    const socket = net.connect(smtp.port, smtp.host);
    const delai = setTimeout(() => echec(new Error('Délai SMTP dépassé.')), timeoutMs);
    delai.unref?.();
    let tampon = '';
    /** @type {import('node:net').Socket | import('node:tls').TLSSocket} */
    let courant = socket;
    /** @type {'bonjour' | 'ehlo' | 'starttls' | 'ehlo2' | 'auth' | 'user' | 'pass' | 'from' | 'to' | 'data' | 'corps' | 'fin'} */
    let etape = 'bonjour';

    /** @param {string} commande */
    function envoyer(commande) {
      courant.write(`${commande}\r\n`);
    }

    /** @param {string} bloc */
    function lire(bloc) {
      tampon += bloc;
      if (!/\r?\n$/.test(tampon)) return;
      const lignes = tampon.split(/\r?\n/).filter(Boolean);
      tampon = '';
      const derniere = lignes.at(-1) ?? '';
      if (derniere.length >= 4 && derniere[3] === '-') return;
      const code = Number(derniere.slice(0, 3));
      if (!Number.isInteger(code)) return echec(new Error('Réponse SMTP illisible.'));
      try {
        avancer(code);
      } catch (erreur) {
        echec(erreur instanceof Error ? erreur : new Error('Échec SMTP.'));
      }
    }

    /** @param {number} code */
    function avancer(code) {
      if (etape === 'bonjour' && code === 220) {
        etape = 'ehlo';
        return envoyer('EHLO olympiade-manade');
      }
      if (etape === 'ehlo' && code === 250) {
        etape = 'starttls';
        return envoyer('STARTTLS');
      }
      if (etape === 'starttls' && code === 220) {
        const clair = courant;
        etape = 'ehlo2';
        courant = tls.connect({ socket: clair, servername: smtp.host });
        courant.on('data', (morceau) => lire(morceau.toString('utf8')));
        courant.on('error', (erreur) => echec(erreur));
        courant.once('secure', () => envoyer('EHLO olympiade-manade'));
        return;
      }
      if (etape === 'ehlo2' && code === 250) {
        etape = 'auth';
        return envoyer('AUTH LOGIN');
      }
      if (etape === 'auth' && code === 334) {
        etape = 'user';
        return envoyer(Buffer.from(smtp.user, 'utf8').toString('base64'));
      }
      if (etape === 'user' && code === 334) {
        etape = 'pass';
        return envoyer(Buffer.from(smtp.pass, 'utf8').toString('base64'));
      }
      if (etape === 'pass' && code === 235) {
        etape = 'from';
        return envoyer(`MAIL FROM:<${expediteur}>`);
      }
      if (etape === 'from' && code === 250) {
        etape = 'to';
        return envoyer(`RCPT TO:<${destinataire}>`);
      }
      if (etape === 'to' && code === 250) {
        etape = 'data';
        return envoyer('DATA');
      }
      if (etape === 'data' && code === 354) {
        etape = 'corps';
        return envoyer(`${contenu}\r\n.`);
      }
      if (etape === 'corps' && code === 250) {
        etape = 'fin';
        return envoyer('QUIT');
      }
      if (etape === 'fin' && code === 221) {
        clearTimeout(delai);
        courant.end();
        resolve(undefined);
        return;
      }
      echec(new Error(`SMTP refusé (${code}) à l'étape ${etape}.`));
    }

    socket.on('data', (morceau) => lire(morceau.toString('utf8')));
    socket.on('error', (erreur) => echec(erreur));
  });
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 * @param {{ journal?: (ligne: unknown) => void, envoyer?: typeof envoyerSmtp }} [deps]
 */
export function courrielDepuisEnvironnement(env, deps = {}) {
  const mode = env.SMTP_MODE === 'smtp' ? 'smtp' : env.SMTP_MODE === 'log' ? 'log' : 'off';
  const host = texte(env.SMTP_HOST);
  const port = Number(env.SMTP_PORT || 587);
  const user = texte(env.SMTP_USER);
  const pass = texte(env.SMTP_PASS);
  const from = texte(env.CONTACT_EMAIL_FROM);
  const to = texte(env.CONTACT_EMAIL_TO);
  const journal = deps.journal ?? ((ligne) => console.log(JSON.stringify(ligne)));
  const transport = deps.envoyer ?? envoyerSmtp;
  const pret = mode !== 'smtp' || Boolean(host && Number.isInteger(port) && port > 0 && user && pass && from && to);

  return {
    mode,
    pret,
    /**
     * @param {{ prenom: string, email: string, message: string }} contact
     * @returns {Promise<{ mode: 'off' | 'log' | 'smtp', envoye: boolean, echec: boolean }>}
     */
    async envoyer(contact) {
      if (mode === 'off') return { mode, envoye: false, echec: false };
      const sujet = `Contact Olympiade — ${contact.prenom}`;
      const text = `Prénom : ${contact.prenom}\nEmail : ${contact.email}\n\n${contact.message}\n`;
      if (mode === 'log') {
        journal({ level: 'info', message: 'courriel de contact journalisé', to: to || null, subject: sujet, text });
        return { mode, envoye: false, echec: false };
      }
      if (!pret || !from || !to) return { mode, envoye: false, echec: true };
      await transport({ host, port, user, pass }, { from, to, subject: sujet, text, replyTo: contact.email });
      return { mode, envoye: true, echec: false };
    },
  };
}

/**
 * Envoi des e-mails de la séquence (SMTP_* et EMAILS_FROM). Même modes que le contact.
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 * @param {{ journal?: (ligne: unknown) => void, envoyer?: typeof envoyerSmtp }} [deps]
 */
export function emailsDepuisEnvironnement(env, deps = {}) {
  const mode = env.SMTP_MODE === 'smtp' ? 'smtp' : env.SMTP_MODE === 'log' ? 'log' : 'off';
  const host = texte(env.SMTP_HOST);
  const port = Number(env.SMTP_PORT || 587);
  const user = texte(env.SMTP_USER);
  const pass = texte(env.SMTP_PASS);
  const from = texte(env.EMAILS_FROM);
  const journal = deps.journal ?? ((ligne) => console.log(JSON.stringify(ligne)));
  const transport = deps.envoyer ?? envoyerSmtp;
  const pret = mode !== 'smtp' || Boolean(host && Number.isInteger(port) && port > 0 && user && pass && from);

  return {
    mode,
    pret,
    /**
     * @param {{ to: string, subject: string, text: string, html?: string, headers?: Record<string, string> }} email
     * @returns {Promise<{ mode: 'off' | 'log' | 'smtp', envoye: boolean, echec: boolean }>}
     */
    async envoyer(email) {
      if (mode === 'off') return { mode, envoye: false, echec: false };
      if (mode === 'log') {
        journal({ level: 'info', message: 'email journalisé', to: masquerEmail(email.to), subject: email.subject });
        return { mode, envoye: false, echec: false };
      }
      if (!pret) {
        journal({ level: 'error', message: 'smtp non configuré' });
        return { mode, envoye: false, echec: true };
      }
      if (typeof email.to !== 'string' || !DESTINATAIRE_VALIDE.test(email.to)) {
        journal({ level: 'error', message: 'destinataire invalide', to: masquerEmail(String(email.to).split(/[\r\n]/)[0]) });
        return { mode, envoye: false, echec: true };
      }
      try {
        await transport({ host, port, user, pass }, {
          from, to: email.to, subject: email.subject, text: email.text, html: email.html, headers: email.headers ?? {},
        });
        return { mode, envoye: true, echec: false };
      } catch (erreur) {
        journal({ level: 'error', message: 'échec d’envoi email', to: masquerEmail(email.to), erreur: erreur instanceof Error ? erreur.message : 'inconnue' });
        return { mode, envoye: false, echec: true };
      }
    },
  };
}
