-- Lot 0A : schéma de base (CDC section 5.2).

-- Toutes les fonctions vivent dans prive, que la Data API n'expose pas : aucune n'est appelable en RPC.
-- Les politiques et les déclencheurs les appellent par leur nom qualifié, d'où l'usage accordé aux rôles de l'API.
create schema prive;
grant usage on schema prive to anon, authenticated, service_role;

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
  -- NO ACTION et non RESTRICT : RESTRICT renvoie 23001 sous PostgreSQL 18, NO ACTION renvoie 23503 sous PostgreSQL 17 et 18.
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
  -- NO ACTION et non RESTRICT : RESTRICT renvoie 23001 sous PostgreSQL 18, NO ACTION renvoie 23503 sous PostgreSQL 17 et 18.
  manade_id uuid not null references public.manades (id) on delete no action,
  ordre smallint not null check (ordre > 0),
  statut_public public.statut_vote not null default 'a_venir',
  statut_jury public.statut_jury not null default 'a_venir',
  jury_lie_au_public boolean not null default true,
  constraint passages_manade_unique unique (epreuve_id, manade_id),
  constraint passages_ordre_unique unique (epreuve_id, ordre) deferrable initially deferred
);

create table public.notes_public (
  -- Une soirée qui a des votes s'annule, elle ne se supprime pas.
  passage_id uuid not null references public.passages (id) on delete no action,
  votant_id uuid not null references public.profils (id) on delete cascade,
  note smallint not null check (note between 1 and 10),
  maj_le timestamptz not null default now(),
  primary key (passage_id, votant_id)
);

create table public.notes_jury (
  -- Une soirée qui a des votes s'annule, elle ne se supprime pas.
  passage_id uuid not null references public.passages (id) on delete no action,
  juge_id uuid not null references public.profils (id) on delete cascade,
  -- note <= 20 refuse aussi NaN et Infinity, que note >= 0 laisse passer.
  note numeric not null check (note >= 0 and note <= 20 and note * 2 = trunc(note * 2)),
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

-- La clé primaire commence par le passage ou la soirée : ces index servent la suppression
-- de compte en cascade et la lecture des votes d'une personne.
create index notes_public_votant_idx on public.notes_public (votant_id);
create index notes_jury_juge_idx on public.notes_jury (juge_id);
create index avis_soiree_votant_idx on public.avis_soiree (votant_id);

-- Horodatage par la base, à l'insertion comme à la modification : un maj_le fourni par le client est écrasé.
create function prive.horodater_maj() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.maj_le := now();
  return new;
end;
$$;

create trigger notes_public_horodatage before insert or update on public.notes_public
  for each row execute function prive.horodater_maj();
create trigger notes_jury_horodatage before insert or update on public.notes_jury
  for each row execute function prive.horodater_maj();
create trigger avis_soiree_horodatage before insert or update on public.avis_soiree
  for each row execute function prive.horodater_maj();

-- Un passage ne concerne qu'une manade engagée dans la soirée de l'épreuve
create function prive.verifier_manade_du_passage() returns trigger
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
  for each row execute function prive.verifier_manade_du_passage();

-- Un passage noté ne change ni d'épreuve ni de manade : ses notes seraient réattribuées.
create function prive.verifier_passage_sans_note() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (new.epreuve_id is distinct from old.epreuve_id or new.manade_id is distinct from old.manade_id)
     and (exists (select 1 from public.notes_public np where np.passage_id = old.id)
          or exists (select 1 from public.notes_jury nj where nj.passage_id = old.id)) then
    raise exception 'Le passage % a déjà des notes : son épreuve et sa manade ne changent plus', old.id
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create trigger passages_notes_figees
  before update of epreuve_id, manade_id on public.passages
  for each row execute function prive.verifier_passage_sans_note();

-- Une note de jury ne dépasse pas le barème de la soirée
create function prive.verifier_bareme_note_jury() returns trigger
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
  for each row execute function prive.verifier_bareme_note_jury();

-- Chaque compte créé reçoit un profil spectateur.
-- Le prénom et le consentement viennent des métadonnées envoyées à l'inscription.
-- Les rôles admin et juge sont attribués ensuite, par le serveur.
create function prive.creer_profil_spectateur() returns trigger
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
  for each row execute function prive.creer_profil_spectateur();

-- Une manade ne peut pas être retirée ni remplacée dans une soirée où elle a des passages.
-- Sur une suppression en cascade de la soirée, la soirée n'existe plus : pas de contrôle.
create function prive.verifier_retrait_manade() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.soiree_id is not distinct from old.soiree_id
     and new.manade_id is not distinct from old.manade_id then
    return new;
  end if;

  if exists (select 1 from public.soirees s where s.id = old.soiree_id)
     and exists (
       select 1
       from public.passages p
       join public.epreuves e on e.id = p.epreuve_id
       where e.soiree_id = old.soiree_id and p.manade_id = old.manade_id
     ) then
    raise exception 'La manade % a des passages dans cette soirée', old.manade_id
      using errcode = 'foreign_key_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger soiree_manades_retrait
  before delete or update of soiree_id, manade_id on public.soiree_manades
  for each row execute function prive.verifier_retrait_manade();

-- Une épreuve ne change jamais de soirée
create function prive.verifier_soiree_de_epreuve() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.soiree_id is distinct from old.soiree_id then
    raise exception 'Une épreuve ne peut pas changer de soirée'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger epreuves_soiree_fixe
  before update of soiree_id on public.epreuves
  for each row execute function prive.verifier_soiree_de_epreuve();

-- Le barème d'une soirée est figé dès qu'une note de jury existe : une note se lit sur le barème
-- où elle a été saisie (9 sur 20 ne devient jamais 9 sur 10).
create function prive.verifier_changement_bareme() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.bareme_jury is distinct from old.bareme_jury
     and exists (
       select 1
       from public.notes_jury nj
       join public.passages p on p.id = nj.passage_id
       join public.epreuves e on e.id = p.epreuve_id
       where e.soiree_id = old.id
     ) then
    raise exception 'Des notes de jury existent : le barème de la soirée (%) ne change plus', old.bareme_jury
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger soirees_bareme_coherent
  before update of bareme_jury on public.soirees
  for each row execute function prive.verifier_changement_bareme();

-- Une fonction déclencheur ne s'appelle jamais directement : le déclencheur s'exécute
-- sans que l'utilisateur ait EXECUTE sur sa fonction.
revoke execute on function
  prive.horodater_maj(),
  prive.verifier_manade_du_passage(),
  prive.verifier_passage_sans_note(),
  prive.verifier_bareme_note_jury(),
  prive.creer_profil_spectateur(),
  prive.verifier_retrait_manade(),
  prive.verifier_soiree_de_epreuve(),
  prive.verifier_changement_bareme()
  from public, anon, authenticated;
