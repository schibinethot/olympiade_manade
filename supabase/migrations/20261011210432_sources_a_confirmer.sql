-- Vérification des sources du 11/10/2026 (CDC 2.3 à 2.3 ter) et décisions du même jour.
-- Nîmes 2025 : seule une publication de la manade (2026) l'annonce, aucun compte rendu de 2025.
-- Nîmes 2024 : l'article cité ne nomme que le vainqueur et ses adversaires.
-- Arles 2027 : les agendas notent « programme en attente de validation ».
-- Annuaire : Bon, Du Juge et Labourayre, cités au palmarès 2026, manquaient.

update public.palmares
set statut = 'a_confirmer',
    detail = 'Victoire revendiquée par la manade (« trois victoires consécutives à Nîmes ») ; aucun compte rendu de la soirée 2025 trouvé.'
where annee = 2025 and ville = 'Nîmes' and evenement = 'Les Grandes Olympiades des Gardians';

update public.palmares
set detail = 'Deuxième victoire consécutive, face à Lescot, Aubanel et Robert Michel. 3 000 spectateurs. Vainqueurs par épreuve non publiés.'
where annee = 2024 and ville = 'Nîmes' and evenement = 'Les Grandes Olympiades des Gardians';

-- Bezouce 2026 : trois manades, vainqueur général non nommé par la source.
update public.palmares
set detail = 'Face à Clément et Du Juge. Labourayre et Clément très récompensées, vainqueur général non nommé.'
where annee = 2026 and ville = 'Bezouce';

update public.calendrier
set statut = 'previsionnelle'
where annee = 2027 and ville = 'Arles' and date_soiree = '2027-05-01';

insert into public.manades (nom) values ('Bon'), ('Du Juge'), ('Labourayre')
on conflict (nom) do nothing;

-- Décision du 11/10/2026 (CDC 4.6) : classement général au cumul de points par place par défaut.
alter table public.soirees alter column methode_general set default 'points';
