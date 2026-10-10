-- Lot 0A : règles de vote (CDC sections 4.4, 4.5 et 4.9).
-- Fonctions appelées par les politiques RLS. security definer pour lire les tables
-- sans dépendre des droits de l'appelant, search_path vide contre le détournement de noms.

create function public.est_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profils where id = auth.uid() and role = 'admin'
  )
$$;

create function public.email_verifie() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null
  )
$$;

-- Mode libre : fenêtre de la soirée, borne de fin exclue. Mode déblocage : statut du passage.
create function public.passage_votable_public(p_passage_id uuid) returns boolean
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
  )
$$;

-- Le jury suit le vote du public, sauf si l'admin l'a dissocié. Un passage verrouillé est figé.
create function public.passage_votable_jury(p_passage_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.passages p
    join public.epreuves e on e.id = p.epreuve_id
    join public.soirees s on s.id = e.soiree_id
    join public.soiree_juges sj on sj.soiree_id = s.id and sj.juge_id = auth.uid()
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

-- Avis : après l'heure de fin des votes, ou une fois la soirée terminée.
create function public.avis_ouvert(p_soiree_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.soirees s
    where s.id = p_soiree_id
      and (s.statut = 'terminee' or (s.statut = 'en_cours' and now() >= s.vote_fin))
  )
$$;
