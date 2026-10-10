import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Câblage du drapeau VITE_INSCRIPTION_OUVERTE dans les composants, sans second build : la valeur est
// lue à l'import du module (import.meta.env), on la pose donc avant de recharger les modules.
// Le build des tests e2e garde le drapeau à faux (playwright.config.ts) ; ce test couvre le cas vrai.

async function rendre(valeur: string | undefined) {
  vi.resetModules();
  vi.stubEnv('VITE_INSCRIPTION_OUVERTE', valeur);
  const { BlocNoter } = await import('../../app/composants/BlocNoter');
  const inscription = await import('../../app/routes/inscription');
  const carte = renderToString(
    createElement(
      MemoryRouter,
      null,
      createElement(BlocNoter, { etat: 'hors-soiree', soiree: null, calendrierDisponible: true, maintenant: new Date() }),
    ),
  );
  // meta() n'utilise pas ses arguments.
  const meta = (inscription.meta as () => Record<string, string>[])();
  return { carte, robots: meta.find((m) => m.name === 'robots')?.content ?? null };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('drapeau VITE_INSCRIPTION_OUVERTE dans les pages', () => {
  // La page d'inscription reste hors des moteurs de recherche quel que soit le drapeau : le serveur
  // l'envoie toujours avec X-Robots-Tag: noindex (page monopage, sans contenu à indexer).
  it('à vrai : lien vers /inscription sur la carte de l’accueil, page d’inscription toujours en noindex', async () => {
    const { carte, robots } = await rendre('true');
    expect(carte).toContain('href="/inscription"');
    expect(carte).toContain('Inscrivez-vous dès maintenant, vous serez prêt le soir venu');
    expect(carte).not.toContain('Inscriptions bientôt ouvertes');
    expect(robots).toBe('noindex');
  });

  it('à faux ou absent : « Inscriptions bientôt ouvertes », sans lien, page hors des moteurs de recherche', async () => {
    for (const valeur of ['false', undefined]) {
      const { carte, robots } = await rendre(valeur);
      expect(carte, String(valeur)).toContain('Inscriptions bientôt ouvertes');
      expect(carte, String(valeur)).not.toContain('href="/inscription"');
      expect(robots, String(valeur)).toBe('noindex');
    }
  });
});
