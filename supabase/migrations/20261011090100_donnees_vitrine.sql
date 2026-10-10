-- Lot vitrine : données de référence (CDC 2.3, 2.3 bis et 2.3 ter, recherche du 2026-10-10).

insert into public.manades (nom) values
  ('Agu'), ('Arlatenco'), ('Aubanel'), ('Clément'), ('Colombet'), ('Conti'), ('Des Chanoines'),
  ('Devaux'), ('Du Soleil'), ('Gillet'), ('Grand Salan'), ('La Comtesse'), ('La Galère'),
  ('La Lauze'), ('Lafon'), ('Lescot'), ('Robert Michel'), ('Roumanille'), ('Saint Léonard'),
  ('Vellas'), ('Vinuesa')
on conflict (nom) do nothing;

insert into public.calendrier (annee, nom, ville, arenes, date_soiree, heure, statut, lien_billetterie) values
  (2025, 'Olympiades melgoriennes', 'Mauguio', 'Arènes de Mauguio', '2025-08-13', '22:30', 'confirmee', null),
  (2025, 'Olympiades camarguaises', 'Saint-Rémy-de-Provence', 'Arènes Chomel-Coinon', '2025-08-15', '22:00', 'confirmee', null),
  (2025, 'Olympiades camarguaises', 'Mouriès', 'Arènes André Blanc', '2025-08-21', '21:00', 'confirmee', null),
  (2025, 'Les Grandes Olympiades des Gardians', 'Nîmes', 'Arènes de Nîmes', '2025-08-22', '21:00', 'confirmee', 'https://billetterie.arenesdenimes.com'),
  (2026, 'Soirée alésienne des gardians', 'Alès', 'Arènes du Tempéras', '2026-05-15', '21:30', 'confirmee', null),
  (2026, 'Olympiades d''Aimargues', 'Aimargues', 'Arènes d''Aimargues', '2026-07-16', '21:00', 'confirmee', null),
  (2026, 'Olympiades beaucairoises', 'Beaucaire', 'Arènes Paul-Laurent', '2026-07-20', null, 'confirmee', null),
  (2026, 'La Nuit des Gardians', 'Pérols', 'Arènes de Pérols', '2026-08-03', '21:30', 'confirmee', null),
  (2026, 'Soirée jeux de gardians', 'Fontvieille', 'Arènes de Fontvieille', '2026-08-05', '21:30', 'confirmee', null),
  (2026, 'Olympiades melgoriennes', 'Mauguio', 'Arènes de Mauguio', '2026-08-12', '22:30', 'confirmee', null),
  (2026, 'Olympiades camarguaises', 'Saint-Rémy-de-Provence', 'Arènes Chomel-Coinon', '2026-08-14', '22:00', 'confirmee', null),
  (2026, 'Olympiades de Beauvoisin', 'Beauvoisin', 'Arènes de Beauvoisin', '2026-08-17', '21:30', 'confirmee', null),
  (2026, 'Olympiades camarguaises', 'Mouriès', 'Arènes André Blanc', '2026-08-20', '21:30', 'confirmee', null),
  (2026, 'Les Grandes Olympiades des Gardians', 'Nîmes', 'Arènes de Nîmes', '2026-08-21', '21:00', 'confirmee', 'https://billetterie.arenesdenimes.com'),
  (2027, 'Soirée alésienne des gardians', 'Alès', 'Arènes du Tempéras', '2027-05-07', '21:30', 'previsionnelle', null),
  (2027, 'Olympiades d''Aimargues', 'Aimargues', 'Arènes d''Aimargues', '2027-07-15', '21:00', 'previsionnelle', null),
  (2027, 'Olympiades beaucairoises', 'Beaucaire', 'Arènes Paul-Laurent', '2027-07-19', null, 'previsionnelle', null),
  (2027, 'La Nuit des Gardians', 'Pérols', 'Arènes de Pérols', '2027-08-02', '21:30', 'previsionnelle', null),
  (2027, 'Soirée jeux de gardians', 'Fontvieille', 'Arènes de Fontvieille', '2027-08-04', '21:30', 'previsionnelle', null),
  (2027, 'Olympiades melgoriennes', 'Mauguio', 'Arènes de Mauguio', '2027-08-11', '22:30', 'previsionnelle', null),
  (2027, 'Olympiades camarguaises', 'Saint-Rémy-de-Provence', 'Arènes Chomel-Coinon', '2027-08-13', '22:00', 'previsionnelle', null),
  (2027, 'Olympiades de Beauvoisin', 'Beauvoisin', 'Arènes de Beauvoisin', '2027-08-16', '21:30', 'previsionnelle', null),
  (2027, 'Olympiades camarguaises', 'Mouriès', 'Arènes André Blanc', '2027-08-19', '21:30', 'previsionnelle', null),
  (2027, 'Les Grandes Olympiades des Gardians', 'Nîmes', 'Arènes de Nîmes', '2027-08-20', '21:00', 'previsionnelle', 'https://billetterie.arenesdenimes.com');

insert into public.palmares (annee, evenement, ville, date_soiree, vainqueur, detail, statut, source_url) values
  (2023, 'Les Grandes Olympiades des Gardians', 'Nîmes', '2023-08-18', 'Vinuesa',
   'Face à Lescot, Clément et Robert Michel. Plus de 3 500 spectateurs.', 'confirme',
   'https://www.arenesdenimes.com/actu/2023/temporada-grand-succès-populaire-des-spectacles-camarguais-aux-arènes.html'),
  (2024, 'Les Grandes Olympiades des Gardians', 'Nîmes', '2024-08-23', 'Vinuesa',
   'Ferrade et attente au fer : Vinuesa. Saut de cheval à cheval : Baptiste Benabent (Grand Salan).', 'confirme',
   'https://www.arenesdenimes.com/actu/2024/iie-grandes-olympiades-des-gardians-un-nouveau-sacre-pour-la-manade-vinuesa.html'),
  (2025, 'Les Grandes Olympiades des Gardians', 'Nîmes', '2025-08-22', 'Vinuesa',
   'Face à Lescot, Vellas, Robert Michel et Lafon. Présentée comme tenante du titre en 2026.', 'a_confirmer', null),
  (2026, 'Soirée alésienne des gardians', 'Alès', '2026-05-15', 'Vinuesa',
   'Trophée de la régularité : 2e de toutes les épreuves, face à Devaux et Robert Michel.', 'confirme',
   'https://www.objectifsud.fr/actualites/ales-en-feria-les-gardians-rendent-hommage-a-leur-tradition-dans-une-soiree-de-concours-164007.php'),
  (2026, 'Olympiades de Beauvoisin', 'Beauvoisin', '2026-08-17', 'Devaux',
   'Face à Clément et La Lauze. Saut de cheval à cheval : Simon Lestevin. Rodéo : Anthony Da Silva. Saut de cheval à taureau : Bastien Fernandez. Attente au fer : Dylan Guyon et Yoan Visin. Capture de la vache : manade Clément.',
   'confirme', 'https://voir-plus.com/2026/08/19/la-fete-votive-de-beauvoisin-incontournable-et-festive/');
