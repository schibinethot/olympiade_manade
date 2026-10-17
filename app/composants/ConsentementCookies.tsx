/**
 * ConsentementCookies
 *
 * Bannière de consentement cookies conforme RGPD pour l'Olympiade des Manades.
 * Port de SITE-AM/CookieConsentBanner avec la direction artistique Olympiade.
 *
 * Écarts assumés par rapport à SITE-AM :
 * 1. Bouton "Tout refuser" présent dès la première couche (CNIL).
 * 2. Mode `aucun` sur /ecran/* : rien n'est affiché.
 * 3. Mode `bandeau` (barre basse, page non bloquée) sur tunnels et admin.
 * 4. Mode `fenetre` (boîte centrée + voile) sur accueil, classements, etc.
 * 5. Reset + run quand le mode change avant consentement.
 *
 * @see docs/charte-graphique.md
 * @see plan-consentement-cookies.md
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import * as CookieConsent from 'vanilla-cookieconsent';
import './consentement-cookies.css';
import { modeConsentement } from '../lib/parcours-cookies';
import { majConsentementGoogle } from '../lib/consentement-google';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Réponse de GET /api/cookie-consent/settings (clés camelCase françaises). */
interface ParametresCookies {
  titre: string;
  description: string;
  texteToutAccepter: string;
  texteRefuser: string;
  textePersonnaliser: string;
  texteEnregistrer: string;
  urlConfidentialite: string;
  mesureActive: boolean;
  mesureTitre: string;
  mesureDescription: string;
  publiciteActive: boolean;
  publiciteTitre: string;
  publiciteDescription: string;
  dureeConsentementJours: number;
}

// ---------------------------------------------------------------------------
// Valeurs par défaut (identiques aux défauts de la migration)
// Appliquées immédiatement pour bloquer la page dès le premier rendu.
// ---------------------------------------------------------------------------

const DEFAUTS: ParametresCookies = {
  titre: "Confidentialité",
  description: "Nous mesurons l’audience du site pour améliorer nos pages. Aucun cookie de publicité n’est déposé sans votre accord.",
  texteToutAccepter: "Tout accepter",
  texteRefuser: "Tout refuser",
  textePersonnaliser: "Personnaliser",
  texteEnregistrer: "Enregistrer mes choix",
  urlConfidentialite: "/confidentialite",
  mesureActive: true,
  mesureTitre: "Mesure d’audience",
  mesureDescription: "Ces cookies nous permettent de mesurer l’audience du site et d’analyser ses performances afin d’améliorer le service.",
  publiciteActive: true,
  publiciteTitre: "Publicité et réseaux sociaux",
  publiciteDescription: "Ces cookies servent à vous proposer des publicités pertinentes et à mesurer l’efficacité de nos campagnes.",
  dureeConsentementJours: 365,
};

// ---------------------------------------------------------------------------
// Fonctions utilitaires
// ---------------------------------------------------------------------------

/** Génère ou récupère l'identifiant visiteur persisté en localStorage. */
function obtenirIdVisiteur(): string {
  try {
    let id = localStorage.getItem('cc_visitor_id');
    if (!id) {
      id = 'v_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('cc_visitor_id', id);
    }
    return id;
  } catch {
    return 'v_' + Math.random().toString(36).substring(2);
  }
}

/** Nettoie l'URL : retire la query string, le hash et garde ≤ 500 caractères. */
function nettoyerUrl(url: string): string {
  try {
    const obj = new URL(url);
    return (obj.origin + obj.pathname).substring(0, 500);
  } catch {
    return (url.split('?')[0] ?? '').substring(0, 500);
  }
}

/** Envoie le choix de consentement au serveur pour l'audit RGPD. */
async function loguerConsentement(
  action: string,
  mesureAcceptee: boolean,
  publiciteAcceptee: boolean,
): Promise<void> {
  try {
    await fetch('/api/cookie-consent/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visiteurId: obtenirIdVisiteur(),
        consentementDonne: action !== 'reject_all',
        mesureAcceptee,
        publiciteAcceptee,
        action,
        urlPage: nettoyerUrl(window.location.href),
        provenance: document.referrer ? nettoyerUrl(document.referrer) : null,
      }),
    });
  } catch (erreur) {
    console.error("Consentement : erreur d’envoi au serveur :", erreur);
  }
}

// ---------------------------------------------------------------------------
// Construction de la configuration vanilla-cookieconsent
// ---------------------------------------------------------------------------

function construireConfig(
  params: ParametresCookies,
  mode: 'fenetre' | 'bandeau',
): Parameters<typeof CookieConsent.run>[0] {
  const estFenetre = mode === 'fenetre';
  const hote = typeof window !== 'undefined' ? window.location.hostname : 'olympiadedesmanades.fr';

  return {
    // hideFromBots reste à sa valeur par défaut (vrai), comme sur SITE-AM : les robots
    // d'indexation ne voient pas la fenêtre. Les e2e masquent navigator.webdriver pour l'afficher.
    guiOptions: {
      consentModal: estFenetre
        ? {
            layout: 'box',
            position: 'middle center',
            flipButtons: true,
            // Exigence CNIL : « Tout refuser » et « Tout accepter » strictement même poids
            equalWeightButtons: true,
          }
        : {
            layout: 'bar',
            position: 'bottom center',
            flipButtons: true,
            equalWeightButtons: true,
          },
      preferencesModal: {
        layout: 'box',
        position: 'right',
        flipButtons: true,
        equalWeightButtons: true,
      },
    },

    // Mode fenêtre : la page est bloquée jusqu'au choix.
    // Mode bandeau : la page reste utilisable.
    disablePageInteraction: estFenetre,

    cookie: {
      expiresAfterDays: params.dureeConsentementJours,
    },

    categories: {
      necessary: {
        enabled: true,
        readOnly: true,
      },
      ...(params.mesureActive && {
        analytics: {
          enabled: false,
          autoClear: {
            cookies: [
              { name: /^_ga/ },
              { name: '_gid' },
              { name: '_gat' },
              { name: '__utma' },
              { name: '__utmb' },
              { name: '__utmc' },
              { name: '__utmt' },
              { name: '__utmz' },
            ],
          },
        },
      }),
      ...(params.publiciteActive && {
        marketing: {
          enabled: false,
          autoClear: {
            cookies: [
              { name: /^_fbp/ },
              { name: /^_fbc/ },
              { name: /^_gcl_/ },
              { name: /^fr/ },
            ],
          },
        },
      }),
    },

    language: {
      default: 'fr',
      translations: {
        fr: {
          consentModal: {
            title: params.titre,
            description: params.description,
            acceptAllBtn: params.texteToutAccepter,
            // Bouton "Tout refuser" en première couche (écart SITE-AM – exigence CNIL)
            acceptNecessaryBtn: params.texteRefuser,
            showPreferencesBtn: params.textePersonnaliser,
            footer: `<a href="${params.urlConfidentialite}">Confidentialité</a>`,
          },
          preferencesModal: {
            title: "Choisir ce que nous déposons.",
            acceptAllBtn: params.texteToutAccepter,
            acceptNecessaryBtn: params.texteRefuser,
            savePreferencesBtn: params.texteEnregistrer,
            closeIconLabel: "Fermer",
            serviceCounterLabel: "Service|Services",
            sections: [
              {
                title: "Utilisation des traceurs",
                description: "Le site utilise des traceurs pour fonctionner et pour mesurer son audience. Les traceurs nécessaires assurent votre connexion et la mémorisation de vos notes. Les autres ne sont déposés qu’avec votre accord.",
              },
              {
                title: `Traceurs nécessaires <span class="pm__badge">Toujours actifs</span>`,
                description: "Ces traceurs sont indispensables au fonctionnement du site. Ils conservent vos préférences de consentement, votre accès à la préversion, votre session de vote et votre identifiant de consentement.",
                linkedCategory: 'necessary',
                cookieTable: {
                  headers: {
                    name: "Traceur",
                    domain: "Domaine",
                    expiration: "Durée",
                    description: "Rôle",
                  },
                  body: [
                    {
                      name: 'cc_cookie',
                      domain: hote,
                      expiration: `${params.dureeConsentementJours} jours`,
                      description: "Mémorise votre choix de consentement.",
                    },
                    {
                      name: 'cc_visitor_id',
                      domain: hote,
                      expiration: "Persistant",
                      description: "Identifiant pseudonyme pour la preuve du choix.",
                    },
                    {
                      name: 'olympiade_acces',
                      domain: hote,
                      expiration: "1 an",
                      description: "Accès à la préversion du site.",
                    },
                    {
                      name: 'sb-khwlwpzydlrfocfpvywv-auth-token (localStorage)',
                      domain: hote,
                      expiration: "Jusqu’à la déconnexion",
                      description: "Session de vote et de jury (stockage local, supprimé à la déconnexion).",
                    },
                  ],
                },
              },
              ...(params.mesureActive
                ? [
                    {
                      title: params.mesureTitre,
                      description: params.mesureDescription,
                      linkedCategory: 'analytics',
                      cookieTable: {
                        headers: {
                          name: "Traceur",
                          domain: "Domaine",
                          expiration: "Durée",
                          description: "Rôle",
                        },
                        body: [
                          {
                            name: '_ga',
                            domain: '.' + hote,
                            expiration: "2 ans",
                            description: "Google Analytics : identifie les visiteurs.",
                          },
                          {
                            name: '_ga_*',
                            domain: '.' + hote,
                            expiration: "2 ans",
                            description: "Google Analytics : stocke l’état de session.",
                          },
                          {
                            name: '_gid',
                            domain: '.' + hote,
                            expiration: "24 heures",
                            description: "Google Analytics : distingue les visiteurs.",
                          },
                        ],
                      },
                    },
                  ]
                : []),
              ...(params.publiciteActive
                ? [
                    {
                      title: params.publiciteTitre,
                      description: params.publiciteDescription,
                      linkedCategory: 'marketing',
                      cookieTable: {
                        headers: {
                          name: "Traceur",
                          domain: "Domaine",
                          expiration: "Durée",
                          description: "Rôle",
                        },
                        body: [
                          {
                            name: '_fbp',
                            domain: '.' + hote,
                            expiration: "3 mois",
                            description: "Facebook : identifie les visiteurs pour le ciblage publicitaire.",
                          },
                          {
                            name: '_gcl_au',
                            domain: '.' + hote,
                            expiration: "3 mois",
                            description: "Google : suivi des conversions publicitaires.",
                          },
                          {
                            name: 'fr',
                            domain: '.facebook.com',
                            expiration: "3 mois",
                            description: "Facebook : ciblage publicitaire.",
                          },
                        ],
                      },
                    },
                  ]
                : []),
              {
                title: "Plus d’informations",
                description: `Pour toute question sur nos traceurs, <a class="cc__link" href="/contact">contactez-nous</a> ou consultez notre <a class="cc__link" href="${params.urlConfidentialite}">page Confidentialité</a>.`,
              },
            ],
          },
        },
      },
    },

    onModalShow: ({ modalName }: { modalName: string }) => {
      if (modalName === 'preferencesModal') {
        document.documentElement.classList.add('cc-hide-consent-modal');
        CookieConsent.hide();
      }
    },

    onModalHide: ({ modalName }: { modalName: string }) => {
      if (modalName === 'preferencesModal') {
        document.documentElement.classList.remove('cc-hide-consent-modal');
      }
    },

    onFirstConsent: ({ cookie }: { cookie: { categories: string[] } }) => {
      const mesureAcceptee = cookie.categories.includes('analytics');
      const publiciteAcceptee = cookie.categories.includes('marketing');

      let action = 'custom';
      if (mesureAcceptee && publiciteAcceptee) action = 'accept_all';
      else if (!mesureAcceptee && !publiciteAcceptee) action = 'reject_all';

      void loguerConsentement(action, mesureAcceptee, publiciteAcceptee);
      majConsentementGoogle(mesureAcceptee, publiciteAcceptee);

      if (typeof window !== 'undefined' && window.dataLayer) {
        (window.dataLayer as unknown[]).push({
          event: 'cookie_consent_given',
          analytics_consent: mesureAcceptee,
          marketing_consent: publiciteAcceptee,
        });
      }
    },

    onConsent: ({ cookie }: { cookie: { categories: string[] } }) => {
      const mesureAcceptee = cookie.categories.includes('analytics');
      const publiciteAcceptee = cookie.categories.includes('marketing');

      majConsentementGoogle(mesureAcceptee, publiciteAcceptee);

      if (typeof window !== 'undefined' && window.dataLayer) {
        (window.dataLayer as unknown[]).push({
          event: 'cookie_consent_update',
          analytics_consent: mesureAcceptee,
          marketing_consent: publiciteAcceptee,
        });
      }
    },

    onChange: ({
      cookie,
      changedCategories,
    }: {
      cookie: { categories: string[] };
      changedCategories: string[];
    }) => {
      const mesureAcceptee = cookie.categories.includes('analytics');
      const publiciteAcceptee = cookie.categories.includes('marketing');

      void loguerConsentement('custom', mesureAcceptee, publiciteAcceptee);
      majConsentementGoogle(mesureAcceptee, publiciteAcceptee);

      if (typeof window !== 'undefined' && window.dataLayer) {
        (window.dataLayer as unknown[]).push({
          event: 'cookie_consent_changed',
          changed_categories: changedCategories,
          analytics_consent: mesureAcceptee,
          marketing_consent: publiciteAcceptee,
        });
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

/**
 * Monte vanilla-cookieconsent selon la route.
 * Doit être rendu une seule fois dans App (app/root.tsx).
 * Inerte au pré-rendu (tout dans useEffect).
 */
export function ConsentementCookies() {
  const { pathname } = useLocation();
  const mode = modeConsentement(pathname);

  // Défauts appliqués immédiatement, puis mis à jour en arrière-plan
  const [params, setParams] = useState<ParametresCookies>(DEFAUTS);

  // Chargement des paramètres depuis l'API (en arrière-plan)
  useEffect(() => {
    void fetch('/api/cookie-consent/settings')
      .then((res) => res.json())
      .then((donnees: Partial<ParametresCookies>) => {
        setParams((avant) => ({ ...avant, ...donnees }));
      })
      .catch((erreur) => {
        console.error("Consentement : paramètres indisponibles :", erreur);
      });
  }, []);

  // Initialisation / réinitialisation de vanilla-cookieconsent
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Mode aucun : pas de bandeau. Une fenêtre ouverte sur la page précédente est retirée,
    // le choix déjà enregistré est conservé.
    if (mode === 'aucun') {
      document.documentElement.classList.remove('cc-consent-site', 'cc-consent-bandeau', 'cc-hide-consent-modal');
      CookieConsent.reset(false);
      return;
    }

    // Classe CSS selon le mode (pilote l'overlay et la mise en page)
    document.documentElement.classList.toggle('cc-consent-site', mode === 'fenetre');
    document.documentElement.classList.toggle('cc-consent-bandeau', mode === 'bandeau');

    // Si un consentement valide existe déjà, on ne réaffiche pas le bandeau.
    if (CookieConsent.validConsent()) return;

    document.documentElement.classList.remove('cc-hide-consent-modal');
    CookieConsent.reset(false);

    void CookieConsent.run(construireConfig(params, mode));

    return () => {
      document.documentElement.classList.remove('cc-hide-consent-modal');
    };
  }, [mode, params]);

  return null;
}

// ---------------------------------------------------------------------------
// Hook pour les composants enfants
// ---------------------------------------------------------------------------

/**
 * Hook exposant les actions du module de consentement.
 * À utiliser dans PiedDePage ou toute autre page.
 */
export function useConsentementCookies() {
  const afficherPreferences = () => {
    CookieConsent.showPreferences();
  };

  const afficherBandeau = () => {
    CookieConsent.show(true);
  };

  const toutAccepter = () => {
    CookieConsent.acceptCategory('all');
  };

  const toutRefuser = () => {
    CookieConsent.acceptCategory([]);
  };

  const aConsenti = () => CookieConsent.validConsent();

  const preferences = () => CookieConsent.getUserPreferences();

  return { afficherPreferences, afficherBandeau, toutAccepter, toutRefuser, aConsenti, preferences };
}

export default ConsentementCookies;
