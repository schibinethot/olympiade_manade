// @ts-check
// Email vers l'organisateur (CDC §4.0 contact, CA-13).
// SMTP_MODE=off (défaut) : aucun envoi, le dépôt en base reste seul.
// SMTP_MODE=log : le message est journalisé, sans réseau (recette sans identifiants).
// SMTP_MODE=smtp : envoi SMTP (STARTTLS), identifiants uniquement par l'environnement.

import net from 'node:net';
import tls from 'node:tls';

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

/**
 * @param {{ host: string, port: number, user: string, pass: string, timeoutMs?: number }} smtp
 * @param {{ from: string, to: string, subject: string, text: string, replyTo?: string }} message
 */
export function envoyerSmtp(smtp, message) {
  const timeoutMs = smtp.timeoutMs ?? 10_000;
  const contenu = composerCourriel(message);
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
        return envoyer(`MAIL FROM:<${message.from}>`);
      }
      if (etape === 'from' && code === 250) {
        etape = 'to';
        return envoyer(`RCPT TO:<${message.to}>`);
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
