-- Lot 0A : schéma de base (CDC section 5.2).

create type public.role_profil as enum ('admin', 'juge', 'spectateur');
create type public.mode_vote as enum ('libre', 'deblocage');
create type public.mode_classement as enum ('separe', 'combine', 'jury');
create type public.methode_general as enum ('moyenne', 'points');
create type public.statut_soiree as enum ('brouillon', 'publiee', 'en_cours', 'terminee', 'reportee', 'annulee');
create type public.statut_vote as enum ('a_venir', 'ouvert', 'clos');
create type public.statut_jury as enum ('a_venir', 'ouvert', 'clos', 'verrouille');

create table public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  prenom text not null check (length(btrim(prenom)) between 1 and 60),
  role public.role_profil not null default 'spectateur',
  consentement_le timestamptz,
  cree_le timestamptz not null default now()
);

create table public.manades (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique check (length(btrim(nom)) > 0),
  ville text,
  logo_url text
);

create table public.soirees (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nom text not null check (length(btrim(nom)) > 0),
  date_soiree date not null,
  lieu text,
  vote_debut timestamptz not null,
  vote_fin timestamptz not null,
  mode_vote public.mode_vote not null default 'deblocage',
  bareme_jury smallint not null default 20 check (bareme_jury in (10, 20)),
  mode_classement public.mode_classement not null default 'separe',
  methode_general public.methode_general not null default 'moyenne',
  poids_jury smallint not null default 70 check (poids_jury between 0 and 100),
  classement_visible boolean not null default true,
  statut public.statut_soiree not null default 'brouillon',
  message_public text,
  cree_le timestamptz not null default now(),
  check (vote_fin > vote_debut)
);

create table public.soiree_manades (
  soiree_id uuid not null references public.soirees (id) on delete cascade,
  manade_id uuid not null references public.manades (id) on delete no action,
  ordre smallint not null check (ordre > 0),
  primary key (soiree_id, manade_id)
);

create table public.soiree_juges (
  soiree_id uuid not null references public.soirees (id) on delete cascade,
  juge_id uuid not null references public.profils (id) on delete cascade,
  primary key (soiree_id, juge_id)
);

create table public.epreuves (
  id uuid primary key default gen_random_uuid(),
  soiree_id uuid not null references public.soirees (id) on delete cascade,
  ordre smallint not null check (ordre > 0),
  nom text not null check (length(btrim(nom)) > 0),
  description text,
  description_ia boolean not null default false,
  notee boolean not null default true,
  heure_debut timestamptz,
  heure_fin timestamptz,
  constraint epreuves_ordre_unique unique (soiree_id, ordre) deferrable initially deferred
);

create table public.passages (
  id uuid primary key default gen_random_uuid(),
  epreuve_id uuid not null references public.epreuves (id) on delete cascade,
  manade_id uuid not null references public.manades (id) on delete no action,
  ordre smallint not null check (ordre > 0),
  statut_public public.statut_vote not null default 'a_venir',
  statut_jury public.statut_jury not null default 'a_venir',
  jury_lie_au_public boolean not null default true,
  constraint passages_manade_unique unique (epreuve_id, manade_id),
  constraint passages_ordre_unique unique (epreuve_id, ordre) deferrable initially deferred
);

create table public.notes_public (
  passage_id uuid not null references public.passages (id) on delete cascade,
  votant_id uuid not null references public.profils (id) on delete cascade,
  note smallint not null check (note between 1 and 10),
  maj_le timestamptz not null default now(),
  primary key (passage_id, votant_id)
);

create table public.notes_jury (
  passage_id uuid not null references public.passages (id) on delete cascade,
  juge_id uuid not null references public.profils (id) on delete cascade,
  note numeric not null check (note >= 0 and note * 2 = trunc(note * 2)),
  commentaire text check (length(commentaire) <= 1000),
  maj_le timestamptz not null default now(),
  primary key (passage_id, juge_id)
);

create table public.avis_soiree (
  soiree_id uuid not null references public.soirees (id) on delete cascade,
  votant_id uuid not null references public.profils (id) on delete cascade,
  etoiles smallint not null check (etoiles between 1 and 5),
  commentaire text check (length(commentaire) <= 500),
  maj_le timestamptz not null default now(),
  primary key (soiree_id, votant_id)
);

-- Horodatage des modifications
create function public.horodater_maj() returns trigger
language plpgsql
as $$
begin
  new.maj_le := now();
  return new;
end;
$$;

create trigger notes_public_horodatage before update on public.notes_public
  for each row execute function public.horodater_maj();
create trigger notes_jury_horodatage before update on public.notes_jury
  for each row execute function public.horodater_maj();
create trigger avis_soiree_horodatage before update on public.avis_soiree
  for each row execute function public.horodater_maj();

-- Un passage ne concerne qu'une manade engagée dans la soirée de l'épreuve
create function public.verifier_manade_du_passage() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.epreuves e
    join public.soiree_manades sm on sm.soiree_id = e.soiree_id
    where e.id = new.epreuve_id and sm.manade_id = new.manade_id
  ) then
    raise exception 'La manade % ne participe pas à la soirée de cette épreuve', new.manade_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger passages_manade_participante
  before insert or update of epreuve_id, manade_id on public.passages
  for each row execute function public.verifier_manade_du_passage();

-- Une note de jury ne dépasse pas le barème de la soirée
create function public.verifier_bareme_note_jury() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_bareme smallint;
begin
  select s.bareme_jury into v_bareme
  from public.passages p
  join public.epreuves e on e.id = p.epreuve_id
  join public.soirees s on s.id = e.soiree_id
  where p.id = new.passage_id;

  if new.note > v_bareme then
    raise exception 'Note % supérieure au barème de la soirée (%)', new.note, v_bareme
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger notes_jury_bareme
  before insert or update of note, passage_id on public.notes_jury
  for each row execute function public.verifier_bareme_note_jury();

-- Chaque compte créé reçoit un profil spectateur.
-- Le prénom et le consentement viennent des métadonnées envoyées à l'inscription.
-- Les rôles admin et juge sont attribués ensuite, par le serveur.
create function public.creer_profil_spectateur() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profils (id, prenom, role, consentement_le)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'prenom'), ''), 'Spectateur'), 60),
    'spectateur',
    case when (new.raw_user_meta_data ->> 'consentement') = 'true' then now() end
  );
  return new;
end;
$$;

create trigger auth_users_creer_profil after insert on auth.users
  for each row execute function public.creer_profil_spectateur();
