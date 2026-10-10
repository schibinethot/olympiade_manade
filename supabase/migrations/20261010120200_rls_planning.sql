-- Lot 0A : sécurité par ligne du planning et des profils (CDC section 5.2).

alter table public.profils enable row level security;
alter table public.manades enable row level security;
alter table public.soirees enable row level security;
alter table public.soiree_manades enable row level security;
alter table public.soiree_juges enable row level security;
alter table public.epreuves enable row level security;
alter table public.passages enable row level security;
alter table public.notes_public enable row level security;
alter table public.notes_jury enable row level security;
alter table public.avis_soiree enable row level security;

-- Supabase accorde par défaut tous les droits aux rôles de l'API sur toute table créée
-- dans public. On repart de zéro : seuls les grants explicites ci-dessous s'appliquent.
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.manades, public.soirees, public.soiree_manades, public.epreuves, public.passages
  to anon, authenticated;
grant insert, update, delete on public.manades, public.soirees, public.soiree_manades,
  public.epreuves, public.passages, public.soiree_juges to authenticated;
grant select on public.profils, public.soiree_juges to authenticated;
-- Seul le prénom est modifiable depuis l'app. Les rôles changent côté serveur (service_role).
grant update (prenom) on public.profils to authenticated;

-- Défense en profondeur : même si un droit de colonne ressurgit, le rôle ne change pas via l'API.
-- security invoker (défaut) : current_user est le rôle appelant. Superutilisateur et service_role passent.
create function public.figer_role_profil() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and new.role is distinct from old.role then
    raise exception 'le rôle d''un profil ne se modifie que côté serveur' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;

create trigger profils_figer_role before update of role on public.profils
  for each row execute function public.figer_role_profil();

create function public.soiree_visible(p_soiree_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.soirees s
    where s.id = p_soiree_id and (s.statut <> 'brouillon' or public.est_admin())
  )
$$;

create function public.epreuve_visible(p_epreuve_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.epreuves e
    where e.id = p_epreuve_id and public.soiree_visible(e.soiree_id)
  )
$$;

-- Profils
create policy profils_lecture on public.profils for select to authenticated
  using (id = (select auth.uid()) or (select public.est_admin()));
create policy profils_modification on public.profils for update to authenticated
  using (id = (select auth.uid()) or (select public.est_admin()))
  with check (id = (select auth.uid()) or (select public.est_admin()));

-- Annuaire des manades
create policy manades_lecture on public.manades for select to anon, authenticated
  using (true);
create policy manades_admin on public.manades for all to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));

-- Soirées
create policy soirees_lecture on public.soirees for select to anon, authenticated
  using (statut <> 'brouillon' or (select public.est_admin()));
create policy soirees_admin on public.soirees for all to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));

-- Manades engagées
create policy soiree_manades_lecture on public.soiree_manades for select to anon, authenticated
  using (public.soiree_visible(soiree_id));
create policy soiree_manades_admin on public.soiree_manades for all to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));

-- Épreuves
create policy epreuves_lecture on public.epreuves for select to anon, authenticated
  using (public.soiree_visible(soiree_id));
create policy epreuves_admin on public.epreuves for all to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));

-- Passages
create policy passages_lecture on public.passages for select to anon, authenticated
  using (public.epreuve_visible(epreuve_id));
create policy passages_admin on public.passages for all to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));

-- Juges rattachés
create policy soiree_juges_lecture on public.soiree_juges for select to authenticated
  using (juge_id = (select auth.uid()) or (select public.est_admin()));
create policy soiree_juges_admin on public.soiree_juges for all to authenticated
  using ((select public.est_admin())) with check ((select public.est_admin()));
