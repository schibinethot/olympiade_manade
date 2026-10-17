import type { Calendrier } from './donnees';

export type EvenementStructure = {
  '@type': 'Event';
  name: string;
  startDate: string;
  eventStatus: 'https://schema.org/EventScheduled' | 'https://schema.org/EventCancelled';
  eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode';
  location: {
    '@type': 'Place';
    name: string;
    address: { '@type': 'PostalAddress'; addressLocality: string; addressCountry: 'FR' };
  };
  description?: string;
  offers?: { '@type': 'Offer'; url: string };
};

/** Données structurées des dates (CDC référencement). Aucune personne n’est inventée. */
export function evenementsDesDates(calendrier: Calendrier[]): { '@context': 'https://schema.org'; '@graph': EvenementStructure[] } {
  const graph = calendrier.map((soiree) => {
    const heure = soiree.heure ? soiree.heure.slice(0, 5) : null;
    const evenement: EvenementStructure = {
      '@type': 'Event',
      name: soiree.nom,
      startDate: heure ? `${soiree.date_soiree}T${heure}` : soiree.date_soiree,
      eventStatus: soiree.statut === 'annulee' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place',
        name: soiree.arenes || soiree.ville,
        address: { '@type': 'PostalAddress', addressLocality: soiree.ville, addressCountry: 'FR' },
      },
    };
    if (soiree.statut === 'previsionnelle') evenement.description = 'Date prévisionnelle.';
    if (soiree.lien_billetterie) evenement.offers = { '@type': 'Offer', url: soiree.lien_billetterie };
    return evenement;
  });
  return { '@context': 'https://schema.org', '@graph': graph };
}
