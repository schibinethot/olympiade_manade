-- Lot 0A : sécurité par ligne des notes du public et des avis (CDC sections 4.4 et 4.9).

grant select, insert, update on public.notes_public, public.avis_soiree to authenticated;

create policy notes_public_lecture on public.notes_public for select to authenticated
  using (votant_id = (select auth.uid()) or (select prive.est_admin()));

create policy notes_public_insertion on public.notes_public for insert to authenticated
  with check (
    votant_id = (select auth.uid())
    and (select prive.email_verifie())
    and prive.passage_votable_public(passage_id)
  );

create policy notes_public_modification on public.notes_public for update to authenticated
  using (votant_id = (select auth.uid()) and prive.passage_votable_public(passage_id))
  with check (
    votant_id = (select auth.uid())
    and (select prive.email_verifie())
    and prive.passage_votable_public(passage_id)
  );

create policy avis_lecture on public.avis_soiree for select to authenticated
  using (votant_id = (select auth.uid()) or (select prive.est_admin()));

create policy avis_insertion on public.avis_soiree for insert to authenticated
  with check (
    votant_id = (select auth.uid())
    and (select prive.email_verifie())
    and prive.avis_ouvert(soiree_id)
  );

create policy avis_modification on public.avis_soiree for update to authenticated
  using (votant_id = (select auth.uid()) and prive.avis_ouvert(soiree_id))
  with check (
    votant_id = (select auth.uid())
    and (select prive.email_verifie())
    and prive.avis_ouvert(soiree_id)
  );

-- Les clés d'une note ou d'un avis ne bougent jamais : sinon un update déplacerait
-- la ligne hors d'un passage clos ou d'une soirée, en contournant le using.
create function prive.figer_cles_note_public() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  if new.passage_id is distinct from old.passage_id or new.votant_id is distinct from old.votant_id then
    raise exception 'passage_id et votant_id d''une note ne sont pas modifiables'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger notes_public_figer_cles before update of passage_id, votant_id on public.notes_public
  for each row execute function prive.figer_cles_note_public();

create function prive.figer_cles_avis() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  if new.soiree_id is distinct from old.soiree_id or new.votant_id is distinct from old.votant_id then
    raise exception 'soiree_id et votant_id d''un avis ne sont pas modifiables'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger avis_figer_cles before update of soiree_id, votant_id on public.avis_soiree
  for each row execute function prive.figer_cles_avis();

revoke execute on function prive.figer_cles_note_public(), prive.figer_cles_avis()
  from public, anon, authenticated;
