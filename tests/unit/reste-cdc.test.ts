import { describe, expect, it } from 'vitest';
import { evenementsDesDates } from '../../app/lib/evenements';
import { ordresApresGlisser, etapesReordre } from '../../app/lib/ordre';
import { documentPdf, matriceQr } from '../../app/lib/pdf';
import { echeanceVote, libelleTempsRestant } from '../../app/lib/temps-restant';
import { composerCourriel } from '../../serveur/courriel.mjs';
import { brouillonDepuisCsv, extrairePlanning, pretAEcrire } from '../../serveur/extraire-planning.mjs';
import { creerRegroupement } from '../../serveur/notifications.mjs';
import { ecrireZip } from '../../serveur/zip.mjs';
import type { Calendrier } from '../../app/lib/donnees';

const MAINTENANT = Date.parse('2026-10-17T20:00:00.000Z');

describe('temps restant', () => {
  it('prend ferme_le avant le délai et la fenêtre libre', () => {
    const ferme = Date.parse('2026-10-17T20:02:00.000Z');
    expect(echeanceVote({
      mode: 'libre',
      fermeLe: '2026-10-17T20:02:00.000Z',
      voteFin: '2026-10-17T21:00:00.000Z',
      delaiMinutes: 5,
      finPassage: '2026-10-17T19:50:00.000Z',
    })).toBe(ferme);
  });

  it('borne le délai libre par la fin de fenêtre', () => {
    expect(echeanceVote({
      mode: 'libre',
      voteFin: '2026-10-17T20:04:00.000Z',
      delaiMinutes: 10,
      heureFin: '2026-10-17T20:00:00.000Z',
    })).toBe(Date.parse('2026-10-17T20:04:00.000Z'));
  });

  it('annonce un vote ouvert sans fermeture automatique', () => {
    expect(libelleTempsRestant(null, MAINTENANT, true)).toBe('Vote ouvert, sans heure de fermeture automatique.');
    expect(libelleTempsRestant(MAINTENANT + 90_000, MAINTENANT, true)).toBe('Temps restant : 1 min 30 s');
    expect(libelleTempsRestant(MAINTENANT + 90_000, MAINTENANT, false)).toBeNull();
    expect(libelleTempsRestant(MAINTENANT - 1, MAINTENANT, true)).toBe('Temps de vote écoulé.');
  });
});

describe('ordre du planning', () => {
  it('décale puis réécrit des ordres uniques', () => {
    const liste = [{ id: 'a', ordre: 1 }, { id: 'b', ordre: 2 }, { id: 'c', ordre: 3 }];
    expect(ordresApresGlisser(liste, 0, 2).map((ligne) => ligne.id)).toEqual(['b', 'c', 'a']);
    const etapes = etapesReordre(liste, 0, 2);
    expect(etapes.slice(0, 3).every((ligne) => ligne.ordre >= 30_000)).toBe(true);
    expect(etapes.slice(3).map((ligne) => ligne.ordre)).toEqual([1, 2, 3]);
    expect(etapesReordre(liste, 1, 1)).toEqual([]);
  });
});

describe('pdf et qr', () => {
  it('produit un PDF et une matrice', () => {
    const qr = matriceQr('https://exemple.fr/noter');
    expect(qr.length).toBeGreaterThan(10);
    const pdf = documentPdf({ titre: 'Affiche', lignes: ['Votez maintenant'], qr, legendeQr: 'Écran' });
    expect(new TextDecoder().decode(pdf.slice(0, 8))).toBe('%PDF-1.4');
    expect(new TextDecoder().decode(pdf)).toContain('%%EOF');
  });
});

describe('données Event', () => {
  it('marque une date prévisionnelle et une date annulée', () => {
    const calendrier: Calendrier[] = [
      { id: '1', annee: 2027, nom: 'Arles', ville: 'Arles', arenes: 'Arènes', date_soiree: '2027-07-14', heure: '21:00:00', statut: 'previsionnelle', lien_billetterie: 'https://billet.exemple.fr' },
      { id: '2', annee: 2026, nom: 'Nîmes', ville: 'Nîmes', arenes: null, date_soiree: '2026-08-01', heure: null, statut: 'annulee', lien_billetterie: null },
    ];
    const graph = evenementsDesDates(calendrier)['@graph'];
    expect(graph[0]?.startDate).toBe('2027-07-14T21:00');
    expect(graph[0]?.description).toBe('Date prévisionnelle.');
    expect(graph[0]?.offers?.url).toBe('https://billet.exemple.fr');
    expect(graph[1]?.eventStatus).toBe('https://schema.org/EventCancelled');
    expect(graph[1]?.location.name).toBe('Nîmes');
  });
});

describe('import de planning', () => {
  it('lit un CSV sans écrire', () => {
    const brouillon = brouillonDepuisCsv('manade;epreuve;debut\nVinuesa;Ferrade en piste;21:00\n');
    expect(brouillon.manades.map((manade) => manade.nom)).toEqual(['Vinuesa']);
    expect(brouillon.epreuves[0]?.nom).toBe('Ferrade en piste');
    expect(pretAEcrire(false)).toBe(false);
    expect(pretAEcrire(undefined)).toBe(false);
    expect(pretAEcrire(true)).toBe(true);
  });

  it('lit un docx et refuse d’appliquer un PDF sans clé', async () => {
    const xml = '<w:document><w:t>Lafon</w:t><w:t>Ferrade en piste 21h00</w:t></w:document>';
    const archive = ecrireZip({ 'word/document.xml': xml });
    const docx = await extrairePlanning({ nom: 'planning.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', octets: archive });
    expect(docx.erreur).toBeNull();
    expect(docx.brouillon.manades.some((manade) => manade.nom === 'Lafon')).toBe(true);
    const pdf = await extrairePlanning({ nom: 'planning.pdf', type: 'application/pdf', octets: Buffer.from('%PDF') });
    expect(pdf.brouillon.epreuves).toEqual([]);
    expect(pdf.brouillon.avertissements.join(' ')).toMatch(/clé Anthropic/);
  });
});

describe('notifications', () => {
  it('envoie le premier message tout de suite et regroupe les suivants', () => {
    let instant = 1_000;
    const groupe = creerRegroupement({ maintenant: () => instant });
    expect(groupe.proposer('soiree', 'Ferrade').envoyer).toBe(true);
    instant += 10_000;
    expect(groupe.proposer('soiree', 'Saut').envoyer).toBe(false);
    instant += 30_000;
    expect(groupe.proposer('soiree', 'Attente').envoyer).toBe(true);
  });
});

describe('courriel', () => {
  it('ajoute Reply-To seulement lorsqu’il est fourni', () => {
    const avec = composerCourriel({ from: 'site@exemple.fr', to: 'orga@exemple.fr', replyTo: 'lea@exemple.fr', subject: 'Contact', text: 'Bonjour' });
    expect(avec).toContain('Reply-To: lea@exemple.fr');
    const sans = composerCourriel({ from: 'site@exemple.fr', to: 'orga@exemple.fr', subject: 'Contact', text: 'Bonjour' });
    expect(sans).not.toContain('Reply-To:');
  });
});
