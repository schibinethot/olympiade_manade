-- Un avis suit la fermeture réelle du vote public. En mode déblocage,
-- vote_fin ne ferme pas les passages : tous les passages notés doivent être clos.
create or replace function prive.avis_ouvert(p_soiree_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.soirees s
    where s.id = p_soiree_id
      and (
        s.statut = 'terminee'
        or (
          s.statut in ('publiee', 'en_cours')
          and (
            (s.mode_vote = 'libre' and now() >= s.vote_fin)
            or (
              s.mode_vote = 'deblocage'
              and exists (
                select 1 from public.epreuves e
                join public.passages p on p.epreuve_id = e.id
                where e.soiree_id = s.id and e.notee
              )
              and not exists (
                select 1 from public.epreuves e
                join public.passages p on p.epreuve_id = e.id
                where e.soiree_id = s.id and e.notee and p.statut_public <> 'clos'
              )
            )
          )
        )
      )
  )
$$;
