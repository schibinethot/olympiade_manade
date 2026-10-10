import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Calendrier, Palmares } from '../../app/lib/donnees';

// Lecture des pages vitrine dans le navigateur (relecture à la première interaction, navigations).
// Repli par table : données fraîches, puis celles du pré-rendu (.data), puis les dernières données
// affichées dans l'onglet. Hors ligne, une page ne se vide donc jamais.

const { lireCalendrier, lirePalmares } = vi.hoisted(() => ({ lireCalendrier: vi.fn(), lirePalmares: vi.fn() }));

vi.mock('../../app/lib/donnees', async (original) => ({
  ...(await original<typeof import('../../app/lib/donnees')>()),
  lireCalendrier,
  lirePalmares,
}));

const soiree = (ville: string): Calendrier => ({
  id: `${ville}-2027`,
  annee: 2027,
  nom: `Olympiades de ${ville}`,
  ville,
  arenes: null,
  date_soiree: '2027-08-20',
  heure: '21:00:00',
  statut: 'previsionnelle',
  lien_billetterie: null,
});

const resultat = (vainqueur: string): Palmares => ({
  id: `nimes-2026-${vainqueur}`,
  annee: 2026,
  evenement: 'Les Grandes Olympiades des Gardians',
  ville: 'Nîmes',
  date_soiree: '2026-08-21',
  vainqueur,
  detail: null,
  statut: 'confirme',
  source_url: null,
});

const PRE_RENDU = { calendrier: [soiree('Nîmes')], palmares: [resultat('Arlatenco')], lueLe: '2026-10-10T10:00:00.000Z' };
const FRAIS = { calendrier: [soiree('Mouriès')], palmares: [resultat('Vinuesa')] };
const horsLigne = () => Promise.reject(new TypeError('Failed to fetch'));

/** Modules rechargés à chaque test : l'état de la relecture vit dans le module, pour tout l'onglet. */
async function charger() {
  vi.resetModules();
  const vitrine = await import('../../app/lib/donnees-vitrine');
  const relecture = await import('../../app/lib/relecture');
  return { ...vitrine, ...relecture };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  lireCalendrier.mockReset();
  lirePalmares.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('lireDonneesVitrineNavigateur', () => {
  it('données fraîches complètes : rendues telles quelles, et la relecture est faite', async () => {
    const { lireDonneesVitrineNavigateur, donneesRelues } = await charger();
    lireCalendrier.mockResolvedValue(FRAIS.calendrier);
    lirePalmares.mockResolvedValue(FRAIS.palmares);
    const serverLoader = vi.fn(horsLigne);
    const donnees = await lireDonneesVitrineNavigateur(serverLoader);
    expect(donnees.calendrier).toEqual(FRAIS.calendrier);
    expect(donnees.palmares).toEqual(FRAIS.palmares);
    expect(serverLoader).not.toHaveBeenCalled();
    expect(donneesRelues()).toBe(true);
  });

  it('hors ligne : ni Supabase ni le pré-rendu, les données affichées restent, et la relecture reste à faire', async () => {
    const { lireDonneesVitrineNavigateur, retenirDonnees, donneesRelues } = await charger();
    // Hydratation : la page affiche les données du pré-rendu.
    retenirDonnees(PRE_RENDU);
    lireCalendrier.mockImplementation(horsLigne);
    lirePalmares.mockImplementation(horsLigne);
    const donnees = await lireDonneesVitrineNavigateur(horsLigne);
    expect(donnees.calendrier).toEqual(PRE_RENDU.calendrier);
    expect(donnees.palmares).toEqual(PRE_RENDU.palmares);
    expect(donneesRelues()).toBe(false);
  });

  it('repli table par table : fraîche, sinon pré-rendu, sinon dernière affichée', async () => {
    const { lireDonneesVitrineNavigateur, retenirDonnees, donneesRelues } = await charger();
    retenirDonnees(PRE_RENDU);
    lireCalendrier.mockResolvedValue(FRAIS.calendrier);
    lirePalmares.mockImplementation(horsLigne);
    // Le pré-rendu servi n'a pas de palmarès (build dégradé) : le palmarès vient des dernières données.
    const archive = { calendrier: [soiree('Arles')], palmares: null, lueLe: PRE_RENDU.lueLe };
    const donnees = await lireDonneesVitrineNavigateur(() => Promise.resolve(archive));
    expect(donnees.calendrier).toEqual(FRAIS.calendrier);
    expect(donnees.palmares).toEqual(PRE_RENDU.palmares);
    expect(donneesRelues()).toBe(false);

    // Calendrier illisible, palmarès frais : le calendrier vient du pré-rendu servi.
    lireCalendrier.mockImplementation(horsLigne);
    lirePalmares.mockResolvedValue(FRAIS.palmares);
    const suivantes = await lireDonneesVitrineNavigateur(() => Promise.resolve(archive));
    expect(suivantes.calendrier).toEqual(archive.calendrier);
    expect(suivantes.palmares).toEqual(FRAIS.palmares);
    expect(donneesRelues()).toBe(false);
  });

  it('une lecture fraîche réussie devient le repli d’une lecture suivante hors ligne', async () => {
    const { lireDonneesVitrineNavigateur } = await charger();
    lireCalendrier.mockResolvedValueOnce(FRAIS.calendrier).mockImplementation(horsLigne);
    lirePalmares.mockResolvedValueOnce(FRAIS.palmares).mockImplementation(horsLigne);
    await lireDonneesVitrineNavigateur(horsLigne);
    const hors = await lireDonneesVitrineNavigateur(horsLigne);
    expect(hors.calendrier).toEqual(FRAIS.calendrier);
    expect(hors.palmares).toEqual(FRAIS.palmares);
  });

  it('sans aucune donnée nulle part : null, la page affiche son message de repli', async () => {
    const { lireDonneesVitrineNavigateur } = await charger();
    lireCalendrier.mockImplementation(horsLigne);
    lirePalmares.mockImplementation(horsLigne);
    const donnees = await lireDonneesVitrineNavigateur(horsLigne);
    expect(donnees.calendrier).toBeNull();
    expect(donnees.palmares).toBeNull();
  });
});
