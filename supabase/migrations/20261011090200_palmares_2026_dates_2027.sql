-- Compléments du 10/10/2026 : palmarès 2025-2026 et calendrier 2026-2027.
-- Sources : Midi Libre, publications publiques Instagram et Facebook des manades et des organisateurs.

update public.palmares
set statut = 'confirme',
    detail = 'Troisième victoire consécutive à Nîmes (2023, 2024, 2025), face à Lescot, Vellas, Robert Michel et Lafon.',
    source_url = 'https://www.instagram.com/p/DcLfqqljBED/'
where annee = 2025 and ville = 'Nîmes' and evenement = 'Les Grandes Olympiades des Gardians';

insert into public.palmares (annee, evenement, ville, date_soiree, vainqueur, detail, statut, source_url) values
  (2026, 'Les Grandes Olympiades des Gardians', 'Nîmes', '2026-08-21', 'Arlatenco',
   'Classement : 1. Arlatenco, 2. Vinuesa (à quelques points), 3. Robert Michel, 4. Gillet, 5. Lafon. Saut de cheval à taureau : Yannis Helly (Arlatenco).',
   'confirme', 'https://www.midilibre.fr/2026/08/22/bravoure-technique-et-tradition-la-manade-arlatenco-remporte-les-olympiades-des-gardians-dans-les-arenes-de-nimes-13518449.php'),
  (2026, 'Olympiades beaucairoises', 'Beaucaire', '2026-07-20', 'Vinuesa',
   '5e édition, arènes Paul-Laurent.', 'confirme',
   'https://www.midilibre.fr/2026/07/26/les-olympiades-ont-tenu-toutes-leurs-promesses-13484158.php'),
  (2026, 'Olympiades d''Aimargues', 'Aimargues', '2026-07-16', 'Clément',
   'Saut de cheval à cheval : ex aequo Sarah Clément et Anna Vinuesa. Ferrade en piste : Aubanel. Saut de cheval à taureau : Clément. Attente au fer : Vinuesa.',
   'confirme', 'https://www.facebook.com/patrickphoto30/posts/resultat-des-olympiades-daimargues-2026saut-cheval-%C3%A0-cheval-ex-%C3%A6quo-sarah-cl%C3%A9men/1063366019357399/'),
  (2026, 'Olympiades camarguaises', 'Mouriès', '2026-08-20', 'Clément',
   '9e édition, face à Vellas, Gillet et La Comtesse.', 'confirme', 'https://www.instagram.com/p/DcXwxzDDb8n/'),
  (2026, 'Olympiades camarguaises', 'Saint-Rémy-de-Provence', '2026-08-14', 'Bon',
   'Face à Colombet, Gillet, Saint Léonard et Arlatenco.', 'confirme', 'https://www.instagram.com/p/Dc_Ym13jTWY/'),
  (2026, 'Olympiades camarguaises', 'Eyguières', '2026-07-13', 'Clément',
   'Souvenir Sébastien Roux, arènes Chabaud.', 'confirme',
   'https://www.facebook.com/100057171741580/posts/-retour-sur-nos-olympiades-camarguaises-2026-une-soir%C3%A9e-exceptionnelle-%C3%A0-guichet/1546091557306554/'),
  (2026, 'Olympiades des gardians de la Feria', 'Béziers', '2026-08-15', 'Grand Salan',
   'Ferrade en piste : Vinuesa.', 'confirme', 'https://www.instagram.com/p/DcLfqqljBED/'),
  (2026, 'Olympiades camarguaises', 'Bezouce', '2026-08-06', 'Labourayre',
   'Labourayre et Clément très récompensées. Vainqueur vu seulement dans un extrait de recherche.', 'a_confirmer',
   'https://www.midilibre.fr/2026/08/08/les-olympiades-ont-rempli-les-arenes-13501325.php');

-- Beaucaire 2027 : veille de l'ouverture de la Madeleine (mercredi 21/07/2027), comme en 2026.
update public.calendrier set date_soiree = '2027-07-20'
where annee = 2027 and ville = 'Beaucaire';

insert into public.calendrier (annee, nom, ville, arenes, date_soiree, heure, statut, lien_billetterie) values
  (2026, 'Olympiades camarguaises', 'Eyguières', 'Arènes Chabaud', '2026-07-13', '21:30', 'confirmee', null),
  (2026, 'Olympiades camarguaises', 'Marsillargues', 'Arènes Marcel Guillarmet', '2026-07-31', '21:30', 'confirmee', null),
  (2026, 'Rencontre des manades', 'Sommières', 'Arènes Gilles Arnaud', '2026-08-01', '21:30', 'confirmee', null),
  (2026, 'Olympiades camarguaises', 'Bezouce', 'Arènes de Bezouce', '2026-08-06', '21:00', 'confirmee', null),
  (2026, 'Olympiades des gardians de la Feria', 'Béziers', 'Arènes de Béziers', '2026-08-15', null, 'confirmee', null),
  (2026, 'Olympiades camarguaises', 'Le Crès', 'Arènes du Crès', '2026-08-17', '21:00', 'confirmee', null),
  (2026, 'Olympiades camarguaises', 'Raphèle-lès-Arles', 'Arènes Pierre-Plantevin', '2026-08-28', '21:30', 'confirmee', null),
  (2027, 'Fête des Gardians, jeux de gardians', 'Arles', 'Arènes d''Arles', '2027-05-01', '15:30', 'confirmee', null),
  (2027, 'Olympiades camarguaises', 'Eyguières', 'Arènes Chabaud', '2027-07-13', '21:30', 'previsionnelle', null),
  (2027, 'Olympiades camarguaises', 'Marsillargues', 'Arènes Marcel Guillarmet', '2027-07-30', '21:30', 'previsionnelle', null),
  (2027, 'Rencontre des manades', 'Sommières', 'Arènes Gilles Arnaud', '2027-07-31', '21:30', 'previsionnelle', null),
  (2027, 'Olympiades camarguaises', 'Bezouce', 'Arènes de Bezouce', '2027-08-05', '21:00', 'previsionnelle', null),
  (2027, 'Olympiades des gardians de la Feria', 'Béziers', 'Arènes de Béziers', '2027-08-14', null, 'previsionnelle', null),
  (2027, 'Olympiades camarguaises', 'Le Crès', 'Arènes du Crès', '2027-08-16', '21:00', 'previsionnelle', null),
  (2027, 'Olympiades camarguaises', 'Raphèle-lès-Arles', 'Arènes Pierre-Plantevin', '2027-08-27', '21:30', 'previsionnelle', null);
