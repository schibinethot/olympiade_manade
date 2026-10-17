// @ts-check
// Web Push (CDC §4.10). Sans clés VAPID, aucun envoi : la bannière locale reste le secours.
// Premier envoi immédiat, les suivants de la même soirée sont regroupés pendant 30 s.

import webpush from 'web-push';

const FENETRE_MS = 30_000;

/**
 * @param {{ maintenant?: () => number }} [options]
 */
export function creerRegroupement({ maintenant = Date.now } = {}) {
  /** @type {Map<string, { debut: number, textes: string[] }>} */
  const fenetres = new Map();
  return {
    /**
     * @param {string} cle
     * @param {string} texte
     */
    proposer(cle, texte) {
      const instant = maintenant();
      const fenetre = fenetres.get(cle);
      if (!fenetre || instant - fenetre.debut >= FENETRE_MS) {
        fenetres.set(cle, { debut: instant, textes: [texte] });
        return { envoyer: true, titre: 'C’est le moment de noter !', corps: texte };
      }
      fenetre.textes.push(texte);
      return { envoyer: false, titre: 'C’est le moment de noter !', corps: fenetre.textes.join(' · ') };
    },
  };
}

/**
 * @param {{ publicKey?: string, privateKey?: string, sujet?: string, envoyer?: (abonnement: unknown, charge: string) => Promise<void> }} options
 */
export function creerPoussoir(options) {
  const publicKey = options.publicKey?.trim() ?? '';
  const privateKey = options.privateKey?.trim() ?? '';
  const sujet = options.sujet?.trim() || 'mailto:contact@olympiade-manade.local';
  const configure = Boolean(publicKey && privateKey);
  if (configure && !options.envoyer) webpush.setVapidDetails(sujet, publicKey, privateKey);
  const envoyer = options.envoyer ?? (async (abonnement, charge) => {
    await webpush.sendNotification(/** @type {import('web-push').PushSubscription} */ (abonnement), charge);
  });
  return {
    configure,
    publicKey,
    /**
     * @param {{ endpoint: string, p256dh: string, auth_secret: string }[]} abonnements
     * @param {{ titre: string, corps: string, url: string }} message
     */
    async diffuser(abonnements, message) {
      if (!configure) return { mode: 'off', envoye: 0, echecs: 0 };
      const charge = JSON.stringify({ title: message.titre, body: message.corps, url: message.url });
      let envoye = 0;
      let echecs = 0;
      for (const abonnement of abonnements) {
        try {
          await envoyer({ endpoint: abonnement.endpoint, keys: { p256dh: abonnement.p256dh, auth: abonnement.auth_secret } }, charge);
          envoye += 1;
        } catch {
          echecs += 1;
        }
      }
      return { mode: 'vapid', envoye, echecs };
    },
  };
}
