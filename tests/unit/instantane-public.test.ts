import { describe, expect, it } from 'vitest';
import { champParis, depuisChampParis, etapesEchange, fenetreDefaut, slugifier } from '../../app/lib/preparation';
import { composerInstantane, creerEtatSoiree, INSTANTANE_FIGE } from '../../serveur/instantane.mjs';
import { creerServeur } from '../../serveur/application.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';

describe('préparation', () => {
  it('fabrique un slug et la fenêtre 21h–23h30 à Paris', () => {
    expect(slugifier('Nîmes 2027 !')).toBe('nimes-2027');
    const fenetre = fenetreDefaut('2027-08-20');
    expect(fenetre.voteDebut).toBe('2027-08-20T19:00:00.000Z');
    expect(fenetre.voteFin).toBe('2027-08-20T21:30:00.000Z');
    expect(champParis(fenetre.voteDebut)).toBe('2027-08-20T21:00');
    expect(depuisChampParis('2027-01-15T21:00')).toBe('2027-01-15T20:00:00.000Z');
    expect(etapesEchange(2, 3)).toEqual([32_000, 2, 3]);
  });
});

describe('instantané public', () => {
  it('reste figé hors soirée tant que le drapeau n’est pas posé', async () => {
    const racine = mkdtempSync(join(tmpdir(), 'olympiade-etat-'));
    mkdirSync(racine, { recursive: true });
    writeFileSync(join(racine, 'index.html'), '<!doctype html><p>page</p>');
    writeFileSync(join(racine, '__spa-fallback.html'), '<!doctype html><p>repli</p>');
    const etat = creerEtatSoiree({ reel: false, lire: async () => ({ etat: 'ouvert', source: 'instantane', soiree: { slug: 'x' } }) });
    const serveur = creerServeur({ racine, supabase: 'abcdefgh.supabase.co', etatSoiree: etat });
    await new Promise<void>((ok) => serveur.listen(0, '127.0.0.1', ok));
    try {
      const base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
      const reponse = await fetch(`${base}/api/etat-soiree`);
      expect(reponse.status).toBe(200);
      expect(await reponse.json()).toEqual(INSTANTANE_FIGE);
      expect((await fetch(`${base}/admin/soirees/abc/direct`)).status).toBe(200);
      expect((await fetch(`${base}/ecran/nimes-2027`)).status).toBe(200);
      expect((await fetch(`${base}/jury`)).status).toBe(200);
    } finally {
      await new Promise((ok) => serveur.close(ok));
      rmSync(racine, { recursive: true, force: true });
    }
  });

  it('masque les classements et marque un passage ouvert dont l’échéance est passée', () => {
    const instantane = composerInstantane({
      maintenant: Date.parse('2027-08-20T21:10:00.000Z'),
      soiree: {
        id: 's', slug: 'ales', nom: 'Alès', lieu: 'Arènes', date_soiree: '2027-08-20', statut: 'en_cours',
        message_public: null, mode_vote: 'deblocage', mode_classement: 'separe', methode_general: 'points',
        poids_jury: 70, bareme_jury: 20, classement_visible: false,
        vote_debut: '2027-08-20T19:00:00.000Z', vote_fin: '2027-08-20T21:30:00.000Z', delai_vote_minutes: 5,
      },
      epreuves: [{ id: 'e', nom: 'Ferrade en piste', ordre: 1, notee: true, heure_debut: null, heure_fin: null }],
      passages: [{
        id: 'p', epreuve_id: 'e', manade_id: 'v', ordre: 1, statut_public: 'ouvert', statut_jury: 'ouvert',
        fin_passage_le: '2027-08-20T21:00:00.000Z', ferme_le: null,
      }],
      manades: [{ id: 'v', nom: 'Vinuesa' }],
      notesPublic: [{ passage_id: 'p', note: 8 }],
      notesJury: [{ passage_id: 'p', note: 16 }],
    });
    expect(instantane.etat).toBe('ouvert');
    expect(instantane.soiree?.classements).toBeNull();
    expect(instantane.soiree?.passages[0]?.statutEffectif).toBe('clos');
  });
});
