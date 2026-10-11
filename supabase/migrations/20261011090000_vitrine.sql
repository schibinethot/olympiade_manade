-- Lot vitrine : calendrier des soirées, palmarès des éditions passées, messages de contact (CDC 4.0).

create type public.statut_date as enum ('previsionnelle', 'confirmee', 'annulee');
create type public.statut_resultat as enum ('confirme', 'a_confirmer');

create table public.calendrier (
  id uuid primary key default gen_random_uuid(),
  annee smallint not null check (annee between 2000 and 2100),
  nom text not null check (length(btrim(nom)) > 0),
  ville text not null check (length(btrim(ville)) > 0),
  arenes text,
  date_soiree date not null,
  heure time,
  statut public.statut_date not null default 'previsionnelle',
  lien_billetterie text check (lien_billetterie is null or lien_billetterie ~ '^https://'),
  soiree_id uuid references public.soirees (id) on delete set null,
  check (extract(year from date_soiree) = annee)
);
create index calendrier_date_idx on public.calendrier (date_soiree);

create table public.palmares (
  id uuid primary key default gen_random_uuid(),
  annee smallint not null check (annee between 2000 and 2100),
  evenement text not null check (length(btrim(evenement)) > 0),
  ville text not null,
  date_soiree date,
  vainqueur text not null check (length(btrim(vainqueur)) > 0),
  detail text,
  statut public.statut_resultat not null default 'a_confirmer',
  source_url text check (source_url is null or source_url ~ '^https://')
);
create index palmares_annee_idx on public.palmares (annee);

create table public.messages_contact (
  id uuid primary key default gen_random_uuid(),
  prenom text not null check (length(prenom) <= 60 and length(btrim(prenom, E' \t\r\n')) >= 1),
  email text not null check (length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  message text not null check (length(message) <= 2000 and length(btrim(message, E' \t\r\n')) >= 10),
  cree_le timestamptz not null default now(),
  traite boolean not null default false
);

alter table public.calendrier enable row level security;
alter table public.palmares enable row level security;
alter table public.messages_contact enable row level security;

revoke all on public.calendrier, public.palmares, public.messages_contact from anon, authenticated;
grant select on public.calendrier, public.palmares to anon, authenticated;
grant insert, update, delete on public.calendrier, public.palmares to authenticated;
grant insert (prenom, email, message) on public.messages_contact to anon, authenticated;
grant select on public.messages_contact to authenticated;
grant update (traite) on public.messages_contact to authenticated;
grant select, insert, update, delete on public.calendrier, public.palmares, public.messages_contact to service_role;

create policy calendrier_lecture on public.calendrier for select to anon, authenticated using (true);
create policy calendrier_admin on public.calendrier for all to authenticated
  using ((select prive.est_admin())) with check ((select prive.est_admin()));

create policy palmares_lecture on public.palmares for select to anon, authenticated using (true);
create policy palmares_admin on public.palmares for all to authenticated
  using ((select prive.est_admin())) with check ((select prive.est_admin()));

-- Dépôt ouvert à tous : les colonnes autorisées sont limitées par les droits de colonne.
-- L'anti-robot (Turnstile) est prévu avant la mise en production publique (suivi lot 0, point 9).
create policy messages_contact_depot on public.messages_contact for insert to anon, authenticated
  with check (true);
create policy messages_contact_lecture_admin on public.messages_contact for select to authenticated
  using ((select prive.est_admin()));
create policy messages_contact_traitement_admin on public.messages_contact for update to authenticated
  using ((select prive.est_admin())) with check ((select prive.est_admin()));
