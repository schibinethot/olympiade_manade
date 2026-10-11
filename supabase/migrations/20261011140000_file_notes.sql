-- File durable des notes du public.
--
-- L'admission reste synchrone : l'identité, l'email vérifié et l'ouverture du vote sont
-- contrôlés à l'heure de la base. Seule l'écriture matérielle dans notes_public est différée.
-- Une action admise avant la fermeture reste donc applicable après celle-ci. Le worker confirme
-- l'action et écrit la note dans une même transaction : il n'existe aucun acquittement anticipé.

create table public.file_notes (
  ordre bigint generated always as identity primary key,
  request_id uuid not null,
  votant_id uuid not null references public.profils (id) on delete cascade,
  passage_id uuid not null references public.passages (id) on delete no action,
  note smallint not null check (note between 1 and 10),
  statut text not null check (statut in ('en_attente', 'confirmee', 'rejetee')),
  motif_rejet text check (
    (statut = 'rejetee' and motif_rejet is not null)
    or (statut <> 'rejetee' and motif_rejet is null)
  ),
  soumise_le timestamptz not null default clock_timestamp(),
  confirmee_le timestamptz,
  unique (votant_id, request_id),
  check (
    (statut = 'confirmee' and confirmee_le is not null)
    or (statut <> 'confirmee' and confirmee_le is null)
  )
);

-- L'index partiel sert la prise des petits lots. Le second permet de vérifier sans balayage
-- qu'une action plus ancienne du même votant et du même passage attend encore son tour.
create index file_notes_attente_ordre_idx
  on public.file_notes (ordre) where statut = 'en_attente';
create index file_notes_attente_cible_idx
  on public.file_notes (votant_id, passage_id, ordre) where statut = 'en_attente';
create index file_notes_votant_soumise_idx
  on public.file_notes (votant_id, soumise_le desc);
create index file_notes_votant_passage_idx
  on public.file_notes (votant_id, passage_id);
create index file_notes_passage_admise_idx
  on public.file_notes (passage_id) where statut <> 'rejetee';
create index file_notes_confirmee_le_idx
  on public.file_notes (confirmee_le) where statut = 'confirmee';
create index file_notes_rejetee_soumise_le_idx
  on public.file_notes (soumise_le) where statut = 'rejetee';

alter table public.file_notes enable row level security;
revoke all on public.file_notes from public, anon, authenticated;
grant select on public.file_notes to authenticated;
grant select, insert, update, delete on public.file_notes to service_role;
revoke all on sequence public.file_notes_ordre_seq from public, anon, authenticated;
grant usage, select on sequence public.file_notes_ordre_seq to service_role;

create policy file_notes_lecture on public.file_notes for select to authenticated
  using (votant_id = (select auth.uid()) or (select prive.est_admin()));

-- Un appel REST direct historique reste possible quand aucune action de cette cible n'attend.
-- Admission, écriture directe et worker prennent le même verrou transactionnel : une écriture
-- directe plus récente ne peut ainsi jamais être écrasée ensuite par une ancienne action en file.
create function prive.garder_ordre_file_notes() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'authenticated' then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.votant_id::text || ':' || new.passage_id::text, 0)
    );
    if exists (
      select 1 from public.file_notes f
      where f.votant_id = new.votant_id
        and f.passage_id = new.passage_id
        and f.statut = 'en_attente'
    ) then
      raise exception 'Une action de note attend déjà son traitement'
        using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

create trigger notes_public_ordre_file
  before insert or update of note on public.notes_public
  for each row execute function prive.garder_ordre_file_notes();

revoke execute on function prive.garder_ordre_file_notes()
  from public, anon, authenticated;

-- Une action admise fige immédiatement l'affectation du passage, sans attendre que le worker
-- crée notes_public. On complète ici la protection installée par la migration de schéma.
create or replace function prive.verifier_passage_sans_note() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (new.epreuve_id is distinct from old.epreuve_id or new.manade_id is distinct from old.manade_id)
     and (exists (select 1 from public.notes_public np where np.passage_id = old.id)
          or exists (select 1 from public.notes_jury nj where nj.passage_id = old.id)
          or exists (
            select 1 from public.file_notes f
            where f.passage_id = old.id and f.statut <> 'rejetee'
          )) then
    raise exception 'Le passage % a déjà des notes ou des actions admises : son épreuve et sa manade ne changent plus', old.id
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

-- Ajoute une action immuable. Le verrou par votant sérialise ses admissions concurrentes,
-- stabilise l'ordre et rend effectif le plafond par passage. Les UUID acceptés ne sont jamais
-- purgés : rejouer une ancienne action ne peut donc pas écraser une note plus récente.
create function public.mettre_note_en_file(
  p_request_id uuid,
  p_passage_id uuid,
  p_note smallint
) returns table (
  request_id uuid,
  statut text,
  soumise_le timestamptz,
  confirmee_le timestamptz,
  motif text
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_votant uuid := auth.uid();
  v_action public.file_notes%rowtype;
  v_statut text;
  v_motif text;
begin
  if v_votant is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  if p_request_id is null or p_passage_id is null then
    raise exception 'Identifiants requis' using errcode = '22023';
  end if;

  -- Un spectateur ne produit normalement qu'une action à la fois. Ce verrou ne met jamais
  -- en concurrence deux spectateurs et évite deux admissions du même UUID ou au-delà du plafond.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_votant::text, 0));

  select f.* into v_action
  from public.file_notes f
  where f.votant_id = v_votant and f.request_id = p_request_id;

  if found then
    if v_action.passage_id is distinct from p_passage_id or v_action.note is distinct from p_note then
      return query select p_request_id, 'rejetee'::text, v_action.soumise_le,
                          null::timestamptz, 'identifiant_reutilise'::text;
    else
      return query select v_action.request_id, v_action.statut, v_action.soumise_le,
                          v_action.confirmee_le, v_action.motif_rejet;
    end if;
    return;
  end if;

  if p_note is null or p_note < 1 or p_note > 10 then
    return query select p_request_id, 'rejetee'::text, clock_timestamp(),
                        null::timestamptz, 'note_invalide'::text;
    return;
  end if;

  if not prive.email_verifie() then
    return query select p_request_id, 'rejetee'::text, clock_timestamp(),
                        null::timestamptz, 'email_non_verifie'::text;
    return;
  end if;

  -- Une soirée et un passage ne vivent qu'une fois. Cent saisies par personne et passage
  -- laissent une marge très large à l'usage normal tout en bornant la croissance malveillante.
  if (select count(*) from public.file_notes f
      where f.votant_id = v_votant and f.passage_id = p_passage_id) >= 100 then
    return query select p_request_id, 'rejetee'::text, clock_timestamp(),
                        null::timestamptz, 'trop_actions'::text;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_votant::text || ':' || p_passage_id::text, 0)
  );

  -- Une fermeture ou un changement concurrent des règles attend la fin de cette admission.
  -- Si la modification a déjà gagné la course, ces verrous attendent son commit puis le contrôle
  -- ci-dessous voit les nouvelles valeurs. Les trois lignes alimentent passage_votable_public.
  perform 1
  from public.passages p
  join public.epreuves e on e.id = p.epreuve_id
  join public.soirees s on s.id = e.soiree_id
  where p.id = p_passage_id
  for share of p, e, s;
  if not found then
    return query select p_request_id, 'rejetee'::text, clock_timestamp(),
                        null::timestamptz, 'passage_introuvable'::text;
    return;
  end if;

  if prive.passage_votable_public(p_passage_id) then
    v_statut := 'en_attente';
    v_motif := null;
  else
    v_statut := 'rejetee';
    v_motif := 'vote_ferme';
  end if;

  insert into public.file_notes (request_id, votant_id, passage_id, note, statut, motif_rejet)
  values (p_request_id, v_votant, p_passage_id, p_note, v_statut, v_motif)
  returning * into v_action;

  return query select v_action.request_id, v_action.statut, v_action.soumise_le,
                      v_action.confirmee_le, v_action.motif_rejet;
end;
$$;

revoke all on function public.mettre_note_en_file(uuid, uuid, smallint) from public, anon;
grant execute on function public.mettre_note_en_file(uuid, uuid, smallint) to authenticated;

-- Lecture groupée et bornée pour la reprise côté téléphone. Une absence signifie « inconnu » :
-- elle ne doit pas être interprétée comme un rejet après une erreur de transport à l'admission.
create function public.lire_statuts_file_notes(p_request_ids uuid[])
returns table (
  request_id uuid,
  statut text,
  soumise_le timestamptz,
  confirmee_le timestamptz,
  motif text
)
language plpgsql security invoker set search_path = ''
as $$
begin
  if p_request_ids is null or cardinality(p_request_ids) > 100 then
    raise exception 'Entre 0 et 100 identifiants sont requis' using errcode = '22023';
  end if;

  return query
    select f.request_id, f.statut, f.soumise_le, f.confirmee_le, f.motif_rejet
    from public.file_notes f
    where f.votant_id = auth.uid() and f.request_id = any(p_request_ids)
    order by f.ordre;
end;
$$;

revoke all on function public.lire_statuts_file_notes(uuid[]) from public, anon;
grant execute on function public.lire_statuts_file_notes(uuid[]) to authenticated;

-- Plusieurs instances peuvent appeler cette fonction. SKIP LOCKED répartit les cibles entre
-- elles. Seule la première action encore en attente d'un couple votant/passage est éligible.
-- L'upsert et la confirmation font partie de la transaction de l'appel RPC.
create table prive.file_notes_workers (
  instance_id text primary key check (instance_id ~ '^file-[a-f0-9]{24}$'),
  dernier_signal timestamptz not null,
  actions_confirmees bigint not null default 0 check (actions_confirmees >= 0)
);
revoke all on prive.file_notes_workers from public, anon, authenticated;
grant select, insert, update, delete on prive.file_notes_workers to service_role;

create function public.traiter_file_notes(
  p_limite integer default 100,
  p_instance_id text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_action public.file_notes%rowtype;
  v_traite integer := 0;
  v_signal_ecrit boolean := false;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Rôle de service requis' using errcode = '42501';
  end if;
  if p_limite is null or p_limite < 1 or p_limite > 100 then
    raise exception 'La limite doit être comprise entre 1 et 100' using errcode = '22023';
  end if;
  if p_instance_id is null or p_instance_id !~ '^file-[a-f0-9]{24}$' then
    raise exception 'Identifiant de worker invalide' using errcode = '22023';
  end if;

  for v_action in
    select f.*
    from public.file_notes f
    where f.statut = 'en_attente'
      and f.ordre = (
        select min(avant.ordre)
        from public.file_notes avant
        where avant.votant_id = f.votant_id
          and avant.passage_id = f.passage_id
          and avant.statut = 'en_attente'
      )
    order by f.ordre
    for update of f skip locked
    limit p_limite
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_action.votant_id::text || ':' || v_action.passage_id::text, 0)
    );

    insert into public.notes_public (passage_id, votant_id, note)
    values (v_action.passage_id, v_action.votant_id, v_action.note)
    on conflict (passage_id, votant_id) do update set note = excluded.note;

    update public.file_notes
    set statut = 'confirmee', confirmee_le = clock_timestamp()
    where ordre = v_action.ordre;
    v_traite := v_traite + 1;
  end loop;

  -- Un worker inactif appelle ce RPC quatre fois par seconde. Son heartbeat n'écrit pourtant
  -- qu'une fois toutes les dix secondes; un lot effectivement traité actualise immédiatement.
  update prive.file_notes_workers w
  set dernier_signal = clock_timestamp(),
      actions_confirmees = w.actions_confirmees + v_traite
  where w.instance_id = p_instance_id
    and (v_traite > 0 or w.dernier_signal <= clock_timestamp() - interval '10 seconds');
  v_signal_ecrit := found;

  if not v_signal_ecrit
     and not exists (select 1 from prive.file_notes_workers w where w.instance_id = p_instance_id) then
    insert into prive.file_notes_workers (instance_id, dernier_signal, actions_confirmees)
    values (p_instance_id, clock_timestamp(), v_traite)
    on conflict (instance_id) do nothing;
    v_signal_ecrit := found;
  end if;

  if v_signal_ecrit then
    delete from prive.file_notes_workers
    where dernier_signal < clock_timestamp() - interval '30 days';
  end if;

  return jsonb_build_object('prises', v_traite, 'confirmees', v_traite);
end;
$$;

revoke all on function public.traiter_file_notes(integer, text) from public, anon, authenticated;
grant execute on function public.traiter_file_notes(integer, text) to service_role;

-- Agrégats sans UUID, identité ni contenu de note. L'administration les fusionne avec la
-- supervision générale, mais une panne de cette lecture ne bloque jamais le worker.
create function public.lire_statistiques_file_notes() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_resultat jsonb;
begin
  if not coalesce(prive.est_admin(), false) then
    raise exception 'Accès administrateur requis' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'queued', count(*) filter (where f.statut = 'en_attente'),
    'oldestQueuedAt', min(f.soumise_le) filter (where f.statut = 'en_attente'),
    'confirmedLast5m', count(*) filter (
      where f.statut = 'confirmee' and f.confirmee_le > statement_timestamp() - interval '5 minutes'
    ),
    'confirmedLastHour', count(*) filter (
      where f.statut = 'confirmee' and f.confirmee_le > statement_timestamp() - interval '1 hour'
    ),
    'rejectedLastHour', count(*) filter (
      where f.statut = 'rejetee' and f.soumise_le > statement_timestamp() - interval '1 hour'
    ),
    'workersActive', (
      select count(*) from prive.file_notes_workers w
      where w.dernier_signal > statement_timestamp() - interval '30 seconds'
    ),
    'lastWorkerAt', (select max(w.dernier_signal) from prive.file_notes_workers w)
  ) into v_resultat
  from public.file_notes f
  where f.statut = 'en_attente'
     or (f.statut = 'confirmee' and f.confirmee_le > statement_timestamp() - interval '1 hour')
     or (f.statut = 'rejetee' and f.soumise_le > statement_timestamp() - interval '1 hour');

  return v_resultat;
end;
$$;

revoke all on function public.lire_statistiques_file_notes() from public, anon;
grant execute on function public.lire_statistiques_file_notes() to authenticated;
