-- Lot 0A : sécurité par ligne des notes du public et des avis (CDC sections 4.4 et 4.9).

grant select, insert, update on public.notes_public, public.avis_soiree to authenticated;

create policy notes_public_lecture on public.notes_public for select to authenticated
  using (votant_id = (select auth.uid()) or (select public.est_admin()));

create policy notes_public_insertion on public.notes_public for insert to authenticated
  with check (
    votant_id = (select auth.uid())
    and (select public.email_verifie())
    and public.passage_votable_public(passage_id)
  );

create policy notes_public_modification on public.notes_public for update to authenticated
  using (votant_id = (select auth.uid()))
  with check (
    votant_id = (select auth.uid())
    and (select public.email_verifie())
    and public.passage_votable_public(passage_id)
  );

create policy avis_lecture on public.avis_soiree for select to authenticated
  using (votant_id = (select auth.uid()) or (select public.est_admin()));

create policy avis_insertion on public.avis_soiree for insert to authenticated
  with check (
    votant_id = (select auth.uid())
    and (select public.email_verifie())
    and public.avis_ouvert(soiree_id)
  );

create policy avis_modification on public.avis_soiree for update to authenticated
  using (votant_id = (select auth.uid()))
  with check (votant_id = (select auth.uid()) and public.avis_ouvert(soiree_id));
