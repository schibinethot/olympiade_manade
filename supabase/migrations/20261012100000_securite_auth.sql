-- Durcissement Auth/admin : un rôle admin n'accorde des droits élevés qu'à une session AAL2.
-- Le parcours TOTP du front promeut ensuite le JWT de aal1 vers aal2.
create or replace function prive.est_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (
      select 1 from public.profils where id = auth.uid() and role = 'admin'
    )
$$;

-- Un admin éventuellement affecté comme juge reste soumis à AAL2. Un compte dont le rôle propre
-- est juge conserve le parcours jury normal.
create or replace function prive.passage_votable_jury(p_passage_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.passages p
    join public.epreuves e on e.id = p.epreuve_id
    join public.soirees s on s.id = e.soiree_id
    join public.soiree_juges sj on sj.soiree_id = s.id and sj.juge_id = auth.uid()
    join public.profils pr on pr.id = sj.juge_id
      and (pr.role = 'juge' or (pr.role = 'admin' and prive.est_admin()))
    where p.id = p_passage_id
      and e.notee
      and s.statut in ('publiee', 'en_cours')
      and p.statut_jury <> 'verrouille'
      and case
            when not p.jury_lie_au_public then p.statut_jury = 'ouvert'
            when s.mode_vote = 'libre' then now() >= s.vote_debut and now() < s.vote_fin
            else p.statut_public = 'ouvert'
          end
  )
$$;

-- Le consentement n'est horodaté qu'une fois l'adresse confirmée. Les métadonnées indiquent que
-- la case a été cochée ; email_confirmed_at fournit la preuve temporelle de la confirmation.
create or replace function prive.creer_profil_spectateur() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profils (id, prenom, role, consentement_le)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'prenom'), ''), 'Spectateur'), 60),
    'spectateur',
    case
      when new.email_confirmed_at is not null
        and (new.raw_user_meta_data ->> 'consentement') = 'true'
      then new.email_confirmed_at
    end
  );
  return new;
end;
$$;

create function prive.horodater_consentement_confirmation() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.email_confirmed_at is null
     and new.email_confirmed_at is not null
     and (new.raw_user_meta_data ->> 'consentement') = 'true' then
    update public.profils
    set consentement_le = new.email_confirmed_at
    where id = new.id and consentement_le is null;
  end if;
  return new;
end;
$$;

create trigger auth_users_horodater_consentement
  after update of email_confirmed_at on auth.users
  for each row execute function prive.horodater_consentement_confirmation();

revoke execute on function prive.horodater_consentement_confirmation() from public, anon, authenticated;
grant execute on function prive.horodater_consentement_confirmation() to service_role;

-- Corrige les lignes historiques avec l'horodatage Auth disponible ; aucune date n'est inventée.
update public.profils p
set consentement_le = case
  when (u.raw_user_meta_data ->> 'consentement') = 'true' then u.email_confirmed_at
end
from auth.users u
where u.id = p.id
  and p.consentement_le is distinct from case
    when (u.raw_user_meta_data ->> 'consentement') = 'true' then u.email_confirmed_at
  end;
