-- Pilotage d'une soirée (CDC §4.1, §4.4, §4.6, §4.7, §5.2).
-- Défauts inchangés pour le public : mode_fenetre ajustable, le site reste hors soirée
-- tant que le serveur n'a pas ETAT_SOIREE_REEL=true. Le délai de 5 minutes ne ferme rien
-- tant qu'aucune fin de passage ni heure de fin d'épreuve n'est renseignée.

create type public.mode_fenetre as enum ('ajustable', 'automatique');

alter table public.soirees
  add column mode_fenetre public.mode_fenetre not null default 'ajustable',
  add column delai_vote_minutes smallint default 5
    check (delai_vote_minutes is null or delai_vote_minutes between 1 and 30);

alter table public.passages
  add column fin_passage_le timestamptz,
  add column ferme_le timestamptz;

-- Instantané public : statuts et classements agrégés. Écrit par le serveur (service_role).
create table public.etat_soiree (
  soiree_id uuid primary key references public.soirees (id) on delete cascade,
  instantane jsonb not null,
  calcule_le timestamptz not null default now()
);

alter table public.etat_soiree enable row level security;
revoke all on public.etat_soiree from anon, authenticated;
grant select on public.etat_soiree to anon, authenticated;
grant select, insert, update, delete on public.etat_soiree to service_role;

create policy etat_soiree_lecture on public.etat_soiree for select to anon, authenticated
  using (prive.soiree_visible(soiree_id));

-- Fermeture automatique du public (CDC §4.4). Le jury n'est pas concerné.
-- ferme_le fixé par l'admin l'emporte. Sinon, fin du passage + délai, ou, en mode libre
-- sans fin saisie, l'heure de fin prévue de l'épreuve. Délai null : pas de fermeture auto.
create or replace function prive.passage_votable_public(p_passage_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.passages p
    join public.epreuves e on e.id = p.epreuve_id
    join public.soirees s on s.id = e.soiree_id
    where p.id = p_passage_id
      and e.notee
      and s.statut in ('publiee', 'en_cours')
      and case s.mode_vote
            when 'libre' then now() >= s.vote_debut and now() < s.vote_fin
            else p.statut_public = 'ouvert'
          end
      and now() < coalesce(
            p.ferme_le,
            case
              when s.delai_vote_minutes is null then null
              when p.fin_passage_le is not null
                then p.fin_passage_le + make_interval(mins => s.delai_vote_minutes::integer)
              when s.mode_vote = 'libre' and e.heure_fin is not null
                then e.heure_fin + make_interval(mins => s.delai_vote_minutes::integer)
              else null
            end,
            'infinity'::timestamptz
          )
  )
$$;

-- Fenêtre automatique : vote_debut = début de la première épreuve notée,
-- vote_fin = fin de la dernière + délai (ou la fin seule si le délai est désactivé).
create function prive.appliquer_fenetre_automatique(p_soiree uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_mode public.mode_fenetre;
  v_delai smallint;
  v_debut timestamptz;
  v_fin timestamptz;
begin
  select s.mode_fenetre, s.delai_vote_minutes into v_mode, v_delai
  from public.soirees s where s.id = p_soiree;
  if v_mode is distinct from 'automatique' then
    return;
  end if;

  select min(e.heure_debut), max(e.heure_fin) into v_debut, v_fin
  from public.epreuves e
  where e.soiree_id = p_soiree and e.notee
    and e.heure_debut is not null and e.heure_fin is not null;

  if v_debut is null or v_fin is null then
    return;
  end if;
  if v_delai is not null then
    v_fin := v_fin + make_interval(mins => v_delai::integer);
  end if;
  if v_fin <= v_debut then
    return;
  end if;

  update public.soirees
  set vote_debut = v_debut, vote_fin = v_fin
  where id = p_soiree
    and (vote_debut is distinct from v_debut or vote_fin is distinct from v_fin);
end;
$$;

create function prive.epreuves_fenetre_automatique() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform prive.appliquer_fenetre_automatique(coalesce(new.soiree_id, old.soiree_id));
  if tg_op = 'UPDATE' and new.soiree_id is distinct from old.soiree_id then
    perform prive.appliquer_fenetre_automatique(old.soiree_id);
  end if;
  return null;
end;
$$;

create trigger epreuves_fenetre_automatique
  after insert or update of heure_debut, heure_fin, notee, soiree_id or delete on public.epreuves
  for each row execute function prive.epreuves_fenetre_automatique();

create function prive.soirees_fenetre_automatique() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform prive.appliquer_fenetre_automatique(new.id);
  return null;
end;
$$;

create trigger soirees_fenetre_automatique
  after update of mode_fenetre, delai_vote_minutes on public.soirees
  for each row execute function prive.soirees_fenetre_automatique();

revoke execute on function prive.epreuves_fenetre_automatique(), prive.soirees_fenetre_automatique()
  from public, anon, authenticated;

-- Annuaire des comptes pour l'admin AAL2. Aucune ligne si la session n'est pas admin.
create function public.lire_participants()
returns table (
  id uuid,
  prenom text,
  role public.role_profil,
  email text,
  consentement_le timestamptz,
  cree_le timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.prenom, p.role, u.email::text, p.consentement_le, p.cree_le
  from public.profils p
  join auth.users u on u.id = p.id
  where (select prive.est_admin())
  order by p.cree_le desc, p.prenom
$$;

revoke all on function public.lire_participants() from public, anon;
grant execute on function public.lire_participants() to authenticated;
