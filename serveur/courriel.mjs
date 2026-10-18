// @ts-check
// Email vers l'organisateur (CDC §4.0 contact, CA-13) et transport des e-mails de la séquence.
// SMTP_MODE=off (défaut) : aucun envoi, le dépôt en base reste seul.
// SMTP_MODE=log : le message est journalisé (adresse masquée, sans corps), sans réseau (recette).
// SMTP_MODE=smtp : envoi SMTP (STARTTLS), identifiants uniquement par l'environnement.
// La séquence suit EMAILS_MODE (off, log, smtp), ou SMTP_MODE à défaut : la recette de la séquence en log ne
// touche pas au formulaire de contact.

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

/** « Nom <a@b.fr> » : nom toujours encodé RFC 2047 (mots de 30 octets), adresse sur sa propre ligne repliée. */
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
 * Étapes du dialogue SMTP propres à ce message : un refus 5xx y est définitif pour lui (adresse, contenu). MAIL FROM
 * n'en est pas : l'expéditeur est le même pour toute la file (réglage, domaine pas encore authentifié).
 */
const ETAPES_DU_MESSAGE = new Set(['to', 'data', 'corps']);

/**
 * Le message ne passera jamais tel quel (refus 5xx du serveur pour ce message, adresse ou en-tête invalides), ou il
 * est peut-être déjà parti (corps envoyé sans réponse : `incertain`). Un 4xx, un délai dépassé ou une erreur réseau
 * avant le corps se réessaient ; un 5xx à l'authentification ou à MAIL FROM (réglage) aussi.
 * @param {unknown} erreur
 */
export function echecDefinitif(erreur) {
  const e = /** @type {{ definitif?: unknown, codeSmtp?: unknown, etapeSmtp?: unknown }} */ (erreur ?? {});
  if (e.definitif === true) return true;
  return typeof e.codeSmtp === 'number' && e.codeSmtp >= 500 && e.codeSmtp < 600 && ETAPES_DU_MESSAGE.has(String(e.etapeSmtp));
}

/**
 * Envoi d'un message, au plus une fois. La promesse se résout dès que le serveur accepte le corps (250 après DATA) :
 * QUIT part ensuite sans attendre sa réponse, et un délai ou une erreur qui suivent sont ignorés. Un message accepté
 * n'est donc jamais compté comme un échec. Corps envoyé mais ni 250 ni refus (délai dépassé, coupure) : le relais a pu
 * l'accepter, l'erreur porte `incertain` et `definitif` (aucun nouvel essai, donc aucun doublon).
 * @param {{ host: string, port: number, user: string, pass: string, timeoutMs?: number, ca?: string | Buffer }} smtp
 *   `ca` : autorité de certification supplémentaire (relais interne, tests)
 * @param {{ from: string, to: string, subject: string, text: string, html?: string, replyTo?: string, headers?: Record<string, string> }} message
 */
export function envoyerSmtp(smtp, message) {
  // Contrôle avant toute connexion et quel que soit le chemin de composition.
  /** @type {string} */
  let expediteur;
  /** @type {string} */
  let destinataire;
  /** @type {string} */
  let contenu;
  try {
    expediteur = adresseEnveloppe(message.from, 'expéditeur', true);
    destinataire = adresseEnveloppe(message.to, 'destinataire', false);
    // Le contact reste en texte 8bit inchangé ; les e-mails de séquence (html, en-têtes) passent en multipart.
    contenu = message.html !== undefined || message.headers ? construireMessage(message) : composerCourriel(message);
  } catch (erreur) {
    return Promise.reject(Object.assign(erreur instanceof Error ? erreur : new Error('Message invalide.'), { definitif: true }));
  }
  const timeoutMs = smtp.timeoutMs ?? 10_000;
  return new Promise((resolve, reject) => {
    /** Vrai dès que le corps est accepté : plus rien ne peut faire échouer cet envoi. */
    let accepte = false;
    const echec = (/** @type {Error} */ erreur) => {
      clearTimeout(delai);
      courant.destroy();
      socket.destroy();
      if (accepte) return;
      // Corps envoyé sans réponse (délai, coupure, réponse illisible) : le relais a pu l'accepter. Pas de nouvel essai.
      if (etape === 'corps' && !('codeSmtp' in erreur)) Object.assign(erreur, { definitif: true, incertain: true });
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
        // SNI pour un nom d'hôte seulement (RFC 6066) ; une adresse IP sert à la seule vérification du certificat.
        courant = tls.connect({
          socket: clair, ...(net.isIP(smtp.host) ? { host: smtp.host } : { servername: smtp.host }), ...(smtp.ca ? { ca: smtp.ca } : {}),
        });
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
        // Accepté : l'envoi est réussi. QUIT part sans attendre ; la connexion se ferme au plus tard 5 s après.
        accepte = true;
        etape = 'fin';
        clearTimeout(delai);
        resolve(undefined);
        try {
          courant.end('QUIT\r\n');
        } catch {
          // Connexion déjà rompue : sans effet sur un message accepté.
        }
        const fermeture = setTimeout(() => { courant.destroy(); socket.destroy(); }, 5_000);
        fermeture.unref?.();
        courant.once('close', () => clearTimeout(fermeture));
        return;
      }
      // Réponse au QUIT (221 ou autre) : ignorée.
      if (etape === 'fin') return;
      echec(Object.assign(new Error(`SMTP refusé (${code}) à l'étape ${etape}.`), { codeSmtp: code, etapeSmtp: etape }));
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
        // Ni le corps (adresse et message du visiteur) ni l'objet (prénom) : l'adresse de l'organisateur, masquée.
        journal({ level: 'info', message: 'courriel de contact journalisé', to: to ? masquerEmail(to) : null, longueur: text.length });
        return { mode, envoye: false, echec: false };
      }
      if (!pret || !from || !to) return { mode, envoye: false, echec: true };
      await transport({ host, port, user, pass }, { from, to, subject: sujet, text, replyTo: contact.email });
      return { mode, envoye: true, echec: false };
    },
  };
}

/** @param {string | undefined} valeur @returns {'off' | 'log' | 'smtp'} */
const modeDe = (valeur) => (valeur === 'smtp' ? 'smtp' : valeur === 'log' ? 'log' : 'off');

/**
 * Mode de la séquence : EMAILS_MODE s'il est renseigné (une valeur inconnue vaut off), sinon SMTP_MODE.
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 */
export function modeEmails(env) {
  const propre = texte(env.EMAILS_MODE);
  return propre ? modeDe(propre) : modeDe(env.SMTP_MODE);
}

/**
 * Envoi des e-mails de la séquence (EMAILS_MODE, SMTP_* et EMAILS_FROM). Mêmes modes que le contact. En mode log,
 * le journal porte l'adresse masquée et l'étape, jamais l'objet ni le corps (prénom, liens signés).
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 * @param {{ journal?: (ligne: unknown) => void, envoyer?: typeof envoyerSmtp }} [deps]
 */
export function emailsDepuisEnvironnement(env, deps = {}) {
  const mode = modeEmails(env);
  const host = texte(env.SMTP_HOST);
  const port = Number(env.SMTP_PORT || 587);
  const user = texte(env.SMTP_USER);
  const pass = texte(env.SMTP_PASS);
  const from = texte(env.EMAILS_FROM);
  const journal = deps.journal ?? ((ligne) => console.log(JSON.stringify(ligne)));
  const transport = deps.envoyer ?? envoyerSmtp;
  /** @type {string[]} */
  const manques = [];
  if (mode === 'smtp' && !(host && Number.isInteger(port) && port > 0 && user && pass)) manques.push('smtp_incomplet');
  if (mode === 'smtp' && !from) manques.push('expediteur');
  const pret = manques.length === 0;

  return {
    mode,
    pret,
    manques,
    /**
     * `incertain` : le corps est parti sans réponse du relais, l'e-mail a peut-être été remis (jamais réessayé).
     * @param {{ to: string, subject: string, text: string, html?: string, headers?: Record<string, string>, etape?: string }} email
     * @returns {Promise<{ mode: 'off' | 'log' | 'smtp', envoye: boolean, echec: boolean, definitif: boolean, incertain: boolean }>}
     */
    async envoyer(email) {
      if (mode === 'off') return { mode, envoye: false, echec: false, definitif: false, incertain: false };
      if (mode === 'log') {
        journal({ level: 'info', message: 'email journalisé', to: masquerEmail(email.to), etape: email.etape ?? null });
        return { mode, envoye: false, echec: false, definitif: false, incertain: false };
      }
      if (!pret) {
        journal({ level: 'error', message: 'smtp non configuré' });
        return { mode, envoye: false, echec: true, definitif: false, incertain: false };
      }
      if (typeof email.to !== 'string' || !DESTINATAIRE_VALIDE.test(email.to)) {
        journal({ level: 'error', message: 'destinataire invalide', to: masquerEmail(String(email.to).split(/[\r\n]/)[0]) });
        return { mode, envoye: false, echec: true, definitif: true, incertain: false };
      }
      try {
        await transport({ host, port, user, pass }, {
          from, to: email.to, subject: email.subject, text: email.text, html: email.html, headers: email.headers ?? {},
        });
        return { mode, envoye: true, echec: false, definitif: false, incertain: false };
      } catch (erreur) {
        const definitif = echecDefinitif(erreur);
        const incertain = /** @type {{ incertain?: unknown }} */ (erreur ?? {}).incertain === true;
        journal({
          level: 'error', message: 'échec d’envoi email', to: masquerEmail(email.to), etape: email.etape ?? null, definitif, incertain,
          erreur: erreur instanceof Error ? erreur.message : 'inconnue',
        });
        return { mode, envoye: false, echec: true, definitif, incertain };
      }
    },
  };
}
