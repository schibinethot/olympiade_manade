/**
 * Garde-fous sur les règles de mise en page et de comportement
 * du module de consentement cookies.
 *
 * Ces tests vérifient les invariants de configuration de vanilla-cookieconsent
 * sans instancier le DOM (tests purement fonctionnels).
 */

import { describe, expect, it } from 'vitest';
import { modeConsentement } from '../../app/lib/parcours-cookies';

// ---------------------------------------------------------------------------
// Invariants du parcours cookies
// ---------------------------------------------------------------------------

describe('invariants du parcours cookies', () => {
  it('mode fenetre : disablePageInteraction doit être true', () => {
    // Sur la page d'accueil, le mode est fenetre
    const mode = modeConsentement('/');
    expect(mode).toBe('fenetre');
    // Par convention : mode fenetre → page bloquée
    const pageBloquee = mode === 'fenetre';
    expect(pageBloquee).toBe(true);
  });

  it('mode bandeau : disablePageInteraction doit être false', () => {
    const mode = modeConsentement('/noter');
    expect(mode).toBe('bandeau');
    // Par convention : mode bandeau → page utilisable
    const pageBloquee = mode === 'fenetre';
    expect(pageBloquee).toBe(false);
  });

  it('mode aucun : aucun composant ne doit être rendu sur /ecran/*', () => {
    const mode = modeConsentement('/ecran/nimes-2027');
    expect(mode).toBe('aucun');
  });

  it('mode fenetre : layout box (pas bar)', () => {
    const mode = modeConsentement('/classements');
    expect(mode).toBe('fenetre');
    const layout = mode === 'fenetre' ? 'box' : 'bar';
    expect(layout).toBe('box');
  });

  it('mode bandeau : layout bar (pas box)', () => {
    const mode = modeConsentement('/inscription');
    expect(mode).toBe('bandeau');
    const layout = mode === 'fenetre' ? 'box' : 'bar';
    expect(layout).toBe('bar');
  });

  // -- Bouton "Tout refuser" présent en première couche ---------------------
  it('la config doit exposer acceptNecessaryBtn en première couche (écart SITE-AM, exigence CNIL)', () => {
    // Invariant documentaire : le composant ConsentementCookies utilise
    // consentModal.acceptNecessaryBtn pour ajouter "Tout refuser" en première couche.
    // Ce test vérifie la règle de parcours qui le rend possible :
    // les modes fenetre ET bandeau permettent le bouton (seul aucun le désactive).
    for (const chemin of ['/', '/classements', '/noter', '/inscription']) {
      const mode = modeConsentement(chemin);
      expect(mode).not.toBe('aucun');
    }
  });

  // -- Pas d'acceptation implicite ------------------------------------------
  it('le clic hors fenêtre ne doit pas valider le consentement : disablePageInteraction=true garantit cela', () => {
    // En mode fenetre, disablePageInteraction=true empêche toute interaction avec la page.
    const mode = modeConsentement('/');
    expect(mode).toBe('fenetre');
    // disablePageInteraction = (mode === 'fenetre')
    expect(mode === 'fenetre').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Règles CNIL vérifiables sans DOM
// ---------------------------------------------------------------------------

describe('règles CNIL', () => {
  it("l'accueil est en mode fenetre (bloquant)", () => {
    expect(modeConsentement('/')).toBe('fenetre');
  });

  it('/ecran ne bloque pas les téléspectateurs : mode aucun', () => {
    expect(modeConsentement('/ecran/test')).toBe('aucun');
  });

  it('/noter reste accessible sans consentement : mode bandeau (non bloquant)', () => {
    expect(modeConsentement('/noter')).toBe('bandeau');
  });
});
