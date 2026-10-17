-- Reste du CDC v0.11 : identité légale, vitrine éditable, import de planning,
-- notifications, avis déjà en table, suppression et purge, coque Android fermée.
-- Aucune personne n'est inscrite : les champs d'identité restent vides.

create table public.identite_legale (
  id boolean primary key default true check (id),
  raison_sociale text check (raison_sociale is null or length(btrim(raison_sociale)) between 1 and 160),
  forme_juridique text check (forme_juridique is null or length(btrim(forme_juridique)) between 1 and 80),
  adresse text check (adresse is null or length(btrim(adresse)) between 1 and 300),
  telephone text check (telephone is null or length(btrim(telephone)) between 1 and 30),
  email text check (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  immatriculation text check (immatriculation is null or length(btrim(immatriculation)) between 1 and 40),
  capital text check (capital is null or length(btrim(capital)) between 1 and 40),
  tva text check (tva is null or length(btrim(tva)) between 1 and 20),
  directeur_publication text check (directeur_publication is null or length(btrim(directeur_publication)) between 1 and 120),
  maj_le timestamptz not null default now()
);

create table public.contenus_vitrine (
  cle text primary key check (cle ~ '^[a-z0-9_]{1,40}$'),
  valeur text not null check (length(valeur) <= 2000),
  maj_le timestamptz not null default now()
);

create table public.photos_vitrine (
  id uuid primary key default gen_random_uuid(),
  url text not null check (url ~ '^https://'),
  legende text not null check (length(btrim(legende)) between 1 and 160),
  auteur text not null check (length(btrim(auteur)) between 1 and 120),
  licence text not null check (length(btrim(licence)) between 1 and 80),
  ordre smallint not null default 1 check (ordre > 0),
  maj_le timestamptz not null default now()
);

create table public.imports_planning (
  id uuid primary key default gen_random_uuid(),
  soiree_id uuid not null references public.soirees (id) on delete cascade,
  nom_fichier text not null check (length(btrim(nom_fichier)) between 1 and 180),
  type_fichier text not null check (type_fichier in ('pdf', 'photo', 'docx', 'tableur', 'csv')),
  empreinte text not null check (empreinte ~ '^[a-f0-9]{64}$'),
  statut text not null default 'brouillon' check (statut in ('brouillon', 'applique', 'erreur')),
  resultat jsonb,
  erreur text,
  auteur_id uuid references public.profils (id) on delete set null,
  cree_le timestamptz not null default now(),
  applique_le timestamptz
);

alter table public.profils
  add column notifications_choix text check (notifications_choix in ('accepte', 'refuse')),
  add column notifications_choix_le timestamptz,
  add constraint notifications_choix_complet check ((notifications_choix is null) = (notifications_choix_le is null));

create table public.abonnements_push (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null references public.profils (id) on delete cascade,
  endpoint text not null unique check (length(endpoint) between 12 and 2000),
  p256dh text not null check (length(p256dh) between 8 and 200),
  auth_secret text not null check (length(auth_secret) between 8 and 80),
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);

create table public.parametres (
  id boolean primary key default true check (id),
  app_ouverte_au_public boolean not null default false
);

insert into public.parametres (id, app_ouverte_au_public) values (true, false);

alter table public.identite_legale enable row level security;
alter table public.contenus_vitrine enable row level security;
alter table public.photos_vitrine enable row level security;
alter table public.imports_planning enable row level security;
alter table public.abonnements_push enable row level security;
alter table public.parametres enable row level security;

revoke all on public.identite_legale, public.contenus_vitrine, public.photos_vitrine,
  public.imports_planning, public.abonnements_push, public.parametres from anon, authenticated;

grant select on public.identite_legale, public.contenus_vitrine, public.photos_vitrine, public.parametres to anon, authenticated;
grant insert, update, delete on public.identite_legale, public.contenus_vitrine, public.photos_vitrine to authenticated;
grant select, insert, update, delete on public.imports_planning, public.abonnements_push to authenticated;
grant update (app_ouverte_au_public) on public.parametres to authenticated;
grant select, insert, update, delete on public.identite_legale, public.contenus_vitrine, public.photos_vitrine,
  public.imports_planning, public.abonnements_push, public.parametres to service_role;

create policy identite_lecture on public.identite_legale for select to anon, authenticated using (true);
create policy identite_admin on public.identite_legale for all to authenticated
  using ((select prive.est_admin())) with check ((select prive.est_admin()));

create policy contenus_lecture on public.contenus_vitrine for select to anon, authenticated using (true);
create policy contenus_admin on public.contenus_vitrine for all to authenticated
  using ((select prive.est_admin())) with check ((select prive.est_admin()));

create policy photos_lecture on public.photos_vitrine for select to anon, authenticated using (true);
create policy photos_admin on public.photos_vitrine for all to authenticated
  using ((select prive.est_admin())) with check ((select prive.est_admin()));

create policy imports_admin on public.imports_planning for all to authenticated
  using ((select prive.est_admin())) with check ((select prive.est_admin()));

create policy parametres_lecture on public.parametres for select to anon, authenticated using (true);
create policy parametres_admin on public.parametres for update to authenticated
  using ((select prive.est_admin())) with check ((select prive.est_admin()));

create policy abonnements_lecture on public.abonnements_push for select to authenticated
  using (utilisateur_id = (select auth.uid()) or (select prive.est_admin()));
create policy abonnements_insertion on public.abonnements_push for insert to authenticated
  with check (
    utilisateur_id = (select auth.uid())
    and exists (
      select 1 from public.profils p
      where p.id = (select auth.uid()) and p.notifications_choix = 'accepte'
    )
  );
create policy abonnements_modification on public.abonnements_push for update to authenticated
  using (utilisateur_id = (select auth.uid()) or (select prive.est_admin()))
  with check (utilisateur_id = (select auth.uid()) or (select prive.est_admin()));
create policy abonnements_suppression on public.abonnements_push for delete to authenticated
  using (utilisateur_id = (select auth.uid()) or (select prive.est_admin()));

-- Le navigateur ne peut pas horodater lui-même son consentement.
create function prive.figer_choix_notifications() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.notifications_choix is distinct from old.notifications_choix
     or new.notifications_choix_le is distinct from old.notifications_choix_le then
    if current_setting('olympiade.notifications', true) is distinct from '1' then
      new.notifications_choix := old.notifications_choix;
      new.notifications_choix_le := old.notifications_choix_le;
    end if;
  end if;
  return new;
end;
$$;

create trigger profils_figer_notifications
  before update on public.profils
  for each row execute function prive.figer_choix_notifications();

revoke all on function prive.figer_choix_notifications() from public, anon, authenticated;

create function public.enregistrer_choix_notifications(p_choix text) returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_le timestamptz := clock_timestamp();
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if p_choix not in ('accepte', 'refuse') then
    raise exception 'Choix invalide' using errcode = '22023';
  end if;
  perform set_config('olympiade.notifications', '1', true);
  update public.profils
  set notifications_choix = p_choix, notifications_choix_le = v_le
  where id = auth.uid();
  if p_choix = 'refuse' then
    update public.abonnements_push set actif = false where utilisateur_id = auth.uid();
  end if;
  return v_le;
end;
$$;

revoke all on function public.enregistrer_choix_notifications(text) from public, anon;
grant execute on function public.enregistrer_choix_notifications(text) to authenticated;

-- Comptes spectateurs sans activité depuis 24 mois. Appel réservé au rôle service.
create function public.purger_spectateurs_inactifs() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  n integer;
begin
  with cibles as (
    select p.id
    from public.profils p
    left join public.presences_authentifiees s on s.utilisateur_id = p.id
    where p.role = 'spectateur'
      and coalesce(s.dernier_signal, p.cree_le) < now() - interval '24 months'
  ),
  suppr as (
    delete from auth.users u using cibles c where u.id = c.id returning u.id
  )
  select count(*)::integer into n from suppr;
  return coalesce(n, 0);
end;
$$;

revoke all on function public.purger_spectateurs_inactifs() from public, anon, authenticated;
grant execute on function public.purger_spectateurs_inactifs() to service_role;
