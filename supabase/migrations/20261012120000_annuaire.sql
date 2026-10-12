-- Les résultats éditoriaux citent déjà ces manades (CDC §2.3 et palmarès 2026).
-- Ne pas modifier les anciennes graines : cette correction s'applique aussi aux bases existantes.
insert into public.manades (nom) values ('Bon'), ('Labourayre')
on conflict (nom) do nothing;
