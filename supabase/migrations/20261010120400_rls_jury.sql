-- Lot 0A : sécurité par ligne des notes du jury (CDC section 4.5).

grant select, insert, update on public.notes_jury to authenticated;

create policy notes_jury_lecture on public.notes_jury for select to authenticated
  using (juge_id = (select auth.uid()) or (select public.est_admin()));

create policy notes_jury_insertion on public.notes_jury for insert to authenticated
  with check (juge_id = (select auth.uid()) and public.passage_votable_jury(passage_id));

create policy notes_jury_modification on public.notes_jury for update to authenticated
  using (juge_id = (select auth.uid()) and public.passage_votable_jury(passage_id))
  with check (juge_id = (select auth.uid()) and public.passage_votable_jury(passage_id));

-- Les clés d'une note de jury ne bougent jamais : sinon un update déplacerait
-- la note hors d'un passage verrouillé, en contournant le using.
create function public.figer_cles_note_jury() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  if new.passage_id is distinct from old.passage_id or new.juge_id is distinct from old.juge_id then
    raise exception 'passage_id et juge_id d''une note de jury ne sont pas modifiables'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger notes_jury_figer_cles before update of passage_id, juge_id on public.notes_jury
  for each row execute function public.figer_cles_note_jury();
