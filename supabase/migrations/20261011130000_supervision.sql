-- Supervision de charge : présence authentifiée minimale et agrégats serveur par minute.
-- Aucune adresse, aucun jeton et aucune identité ne sont exposés dans les statistiques.

create table public.presences_authentifiees (
  utilisateur_id uuid primary key references public.profils (id) on delete cascade,
  dernier_signal timestamptz not null default now()
);
create index presences_authentifiees_dernier_signal_idx
  on public.presences_authentifiees (dernier_signal);

alter table public.presences_authentifiees enable row level security;
revoke all on public.presences_authentifiees from anon, authenticated;
grant select, insert, update, delete on public.presences_authentifiees to service_role;

-- Le client ne choisit jamais l'identité. Un appel répété dans la même minute ne produit
-- aucune écriture, ce qui borne la pression en base lors d'une forte affluence.
create function public.enregistrer_presence() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_utilisateur uuid := auth.uid();
begin
  if v_utilisateur is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  insert into public.presences_authentifiees (utilisateur_id, dernier_signal)
  values (v_utilisateur, clock_timestamp())
  on conflict (utilisateur_id) do update
    set dernier_signal = excluded.dernier_signal
    where public.presences_authentifiees.dernier_signal
          <= excluded.dernier_signal - interval '60 seconds';
end;
$$;
revoke all on function public.enregistrer_presence() from public, anon;
grant execute on function public.enregistrer_presence() to authenticated;

create table public.supervision_serveur_minutes (
  minute timestamptz not null,
  instance_id text not null check (instance_id ~ '^[a-z0-9_-]{1,64}$'),
  requetes integer not null check (requetes >= 0),
  erreurs_5xx integer not null check (erreurs_5xx between 0 and requetes),
  octets_reponse bigint not null check (octets_reponse >= 0),
  cpu_ms integer not null check (cpu_ms >= 0),
  rss_octets bigint not null check (rss_octets >= 0),
  retard_boucle_ms numeric(10, 3) not null check (retard_boucle_ms >= 0),
  requetes_simultanees_max integer not null check (requetes_simultanees_max >= 0),
  connexions_http_max integer not null check (connexions_http_max >= 0),
  utilisateurs_authentifies_actifs integer not null check (utilisateurs_authentifies_actifs >= 0),
  latence_10 integer not null check (latence_10 >= 0),
  latence_25 integer not null check (latence_25 >= 0),
  latence_50 integer not null check (latence_50 >= 0),
  latence_100 integer not null check (latence_100 >= 0),
  latence_250 integer not null check (latence_250 >= 0),
  latence_500 integer not null check (latence_500 >= 0),
  latence_1000 integer not null check (latence_1000 >= 0),
  latence_3000 integer not null check (latence_3000 >= 0),
  latence_sup_3000 integer not null check (latence_sup_3000 >= 0),
  primary key (minute, instance_id),
  check (minute = date_trunc('minute', minute)),
  check (
    latence_10 + latence_25 + latence_50 + latence_100 + latence_250 +
    latence_500 + latence_1000 + latence_3000 + latence_sup_3000 = requetes
  )
);

alter table public.supervision_serveur_minutes enable row level security;
revoke all on public.supervision_serveur_minutes from anon, authenticated;
grant select, insert, update, delete on public.supervision_serveur_minutes to service_role;

-- Une seule écriture par instance et par minute. Le nombre d'utilisateurs actifs est calculé
-- côté base au même instant et ne peut donc pas être inventé par le serveur appelant.
create function public.enregistrer_metrique_serveur(
  p_minute timestamptz,
  p_instance_id text,
  p_requetes integer,
  p_erreurs_5xx integer,
  p_octets_reponse bigint,
  p_cpu_ms integer,
  p_rss_octets bigint,
  p_retard_boucle_ms numeric,
  p_requetes_simultanees_max integer,
  p_connexions_http_max integer,
  p_latences integer[]
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(array_length(p_latences, 1), 0) <> 9 then
    raise exception 'Histogramme de latence invalide' using errcode = '22023';
  end if;

  insert into public.supervision_serveur_minutes (
    minute, instance_id, requetes, erreurs_5xx, octets_reponse, cpu_ms, rss_octets,
    retard_boucle_ms, requetes_simultanees_max, connexions_http_max,
    utilisateurs_authentifies_actifs, latence_10, latence_25, latence_50, latence_100,
    latence_250, latence_500, latence_1000, latence_3000, latence_sup_3000
  ) values (
    date_trunc('minute', p_minute), p_instance_id, p_requetes, p_erreurs_5xx,
    p_octets_reponse, p_cpu_ms, p_rss_octets, p_retard_boucle_ms,
    p_requetes_simultanees_max, p_connexions_http_max,
    (select count(*)::integer from public.presences_authentifiees
       where dernier_signal > clock_timestamp() - interval '2 minutes'),
    p_latences[1], p_latences[2], p_latences[3], p_latences[4], p_latences[5],
    p_latences[6], p_latences[7], p_latences[8], p_latences[9]
  )
  on conflict (minute, instance_id) do update set
    requetes = excluded.requetes,
    erreurs_5xx = excluded.erreurs_5xx,
    octets_reponse = excluded.octets_reponse,
    cpu_ms = excluded.cpu_ms,
    rss_octets = excluded.rss_octets,
    retard_boucle_ms = excluded.retard_boucle_ms,
    requetes_simultanees_max = excluded.requetes_simultanees_max,
    connexions_http_max = excluded.connexions_http_max,
    utilisateurs_authentifies_actifs = excluded.utilisateurs_authentifies_actifs,
    latence_10 = excluded.latence_10,
    latence_25 = excluded.latence_25,
    latence_50 = excluded.latence_50,
    latence_100 = excluded.latence_100,
    latence_250 = excluded.latence_250,
    latence_500 = excluded.latence_500,
    latence_1000 = excluded.latence_1000,
    latence_3000 = excluded.latence_3000,
    latence_sup_3000 = excluded.latence_sup_3000;
end;
$$;
revoke all on function public.enregistrer_metrique_serveur(
  timestamptz, text, integer, integer, bigint, integer, bigint, numeric, integer, integer, integer[]
) from public, anon, authenticated;
grant execute on function public.enregistrer_metrique_serveur(
  timestamptz, text, integer, integer, bigint, integer, bigint, numeric, integer, integer, integer[]
) to service_role;

create function public.nettoyer_metriques_serveur() returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_supprimees integer;
  v_presences integer;
begin
  delete from public.supervision_serveur_minutes
  where minute < date_trunc('minute', clock_timestamp()) - interval '30 days';
  get diagnostics v_supprimees = row_count;
  delete from public.presences_authentifiees
  where dernier_signal < date_trunc('minute', clock_timestamp()) - interval '30 days';
  get diagnostics v_presences = row_count;
  return v_supprimees + v_presences;
end;
$$;
revoke all on function public.nettoyer_metriques_serveur() from public, anon, authenticated;
grant execute on function public.nettoyer_metriques_serveur() to service_role;

-- Snapshot et historique agrégés. La fonction revérifie le rôle stocké dans profils ; les
-- métadonnées du JWT ne sont jamais une source d'autorisation.
create function public.lire_supervision(p_heures integer default 1) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_resultat jsonb;
begin
  if not coalesce(prive.est_admin(), false) then
    raise exception 'Accès administrateur requis' using errcode = '42501';
  end if;
  if p_heures not in (1, 24) then
    raise exception 'Fenêtre invalide' using errcode = '22023';
  end if;

  with agrege as (
    select
      m.minute,
      sum(m.requetes)::bigint as requetes,
      sum(m.erreurs_5xx)::bigint as erreurs_5xx,
      sum(m.octets_reponse)::bigint as octets_reponse,
      sum(m.cpu_ms)::bigint as cpu_ms,
      max(m.rss_octets)::bigint as rss_octets,
      max(m.retard_boucle_ms)::numeric as retard_boucle_ms,
      max(m.requetes_simultanees_max)::integer as requetes_simultanees_max,
      sum(m.connexions_http_max)::integer as connexions_http_max,
      max(m.utilisateurs_authentifies_actifs)::integer as utilisateurs_authentifies_actifs,
      count(*)::integer as instances,
      sum(m.latence_10)::bigint as b10,
      sum(m.latence_25)::bigint as b25,
      sum(m.latence_50)::bigint as b50,
      sum(m.latence_100)::bigint as b100,
      sum(m.latence_250)::bigint as b250,
      sum(m.latence_500)::bigint as b500,
      sum(m.latence_1000)::bigint as b1000,
      sum(m.latence_3000)::bigint as b3000,
      sum(m.latence_sup_3000)::bigint as binf
    from public.supervision_serveur_minutes m
    where m.minute >= date_trunc('minute', clock_timestamp()) - make_interval(hours => p_heures)
    group by m.minute
    order by m.minute
    limit 1440
  ), historique as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'minute', minute,
      'requests', requetes,
      'errors5xx', erreurs_5xx,
      'responseBytes', octets_reponse,
      'cpuMs', cpu_ms,
      'rssBytes', rss_octets,
      'eventLoopLagMs', retard_boucle_ms,
      'inflightMax', requetes_simultanees_max,
      'httpConnectionsMax', connexions_http_max,
      'authenticatedActiveUsers', utilisateurs_authentifies_actifs,
      'instances', instances,
      'p95Ms', case
        when requetes = 0 then null
        when b10 >= ceil(requetes * 0.95) then 10
        when b10 + b25 >= ceil(requetes * 0.95) then 25
        when b10 + b25 + b50 >= ceil(requetes * 0.95) then 50
        when b10 + b25 + b50 + b100 >= ceil(requetes * 0.95) then 100
        when b10 + b25 + b50 + b100 + b250 >= ceil(requetes * 0.95) then 250
        when b10 + b25 + b50 + b100 + b250 + b500 >= ceil(requetes * 0.95) then 500
        when b10 + b25 + b50 + b100 + b250 + b500 + b1000 >= ceil(requetes * 0.95) then 1000
        when b10 + b25 + b50 + b100 + b250 + b500 + b1000 + b3000 >= ceil(requetes * 0.95) then 3000
        else 3001
      end
    ) order by minute), '[]'::jsonb) as valeur
    from agrege
  ), totaux as (
    select
      coalesce(sum(requetes), 0)::bigint as requetes,
      coalesce(sum(erreurs_5xx), 0)::bigint as erreurs_5xx,
      coalesce(sum(octets_reponse), 0)::bigint as octets_reponse,
      coalesce(sum(cpu_ms), 0)::bigint as cpu_ms,
      coalesce(sum(b10), 0)::bigint as b10,
      coalesce(sum(b25), 0)::bigint as b25,
      coalesce(sum(b50), 0)::bigint as b50,
      coalesce(sum(b100), 0)::bigint as b100,
      coalesce(sum(b250), 0)::bigint as b250,
      coalesce(sum(b500), 0)::bigint as b500,
      coalesce(sum(b1000), 0)::bigint as b1000,
      coalesce(sum(b3000), 0)::bigint as b3000
    from agrege
  )
  select jsonb_build_object(
    'activeUsers', jsonb_build_object(
      'authenticatedLast2m', (select count(*) from public.presences_authentifiees
        where dernier_signal > clock_timestamp() - interval '2 minutes'),
      'profilesTotal', (select count(*) from public.profils),
      'lastHeartbeatAt', (select max(dernier_signal) from public.presences_authentifiees)
    ),
    'votes', jsonb_build_object(
      'public', jsonb_build_object(
        'total', (select count(*) from public.notes_public),
        'modifiedLast5m', (select count(*) from public.notes_public where maj_le > clock_timestamp() - interval '5 minutes'),
        'modifiedLastHour', (select count(*) from public.notes_public where maj_le > clock_timestamp() - interval '1 hour')
      ),
      'jury', jsonb_build_object(
        'total', (select count(*) from public.notes_jury),
        'modifiedLast5m', (select count(*) from public.notes_jury where maj_le > clock_timestamp() - interval '5 minutes'),
        'modifiedLastHour', (select count(*) from public.notes_jury where maj_le > clock_timestamp() - interval '1 hour')
      )
    ),
    'database', jsonb_build_object(
      'sizeBytes', pg_database_size(current_database()),
      'connections', jsonb_build_object(
        'current', (select count(*) from pg_catalog.pg_stat_activity where datname = current_database()),
        'max', current_setting('max_connections')::integer
      )
    ),
    'serverHistory', (select valeur from historique),
    'serverTotals', (select jsonb_build_object(
      'requests', requetes,
      'errors5xx', erreurs_5xx,
      'responseBytes', octets_reponse,
      'cpuMs', cpu_ms,
      'p95', case
        when requetes = 0 then null
        when b10 >= ceil(requetes * 0.95) then 10
        when b10 + b25 >= ceil(requetes * 0.95) then 25
        when b10 + b25 + b50 >= ceil(requetes * 0.95) then 50
        when b10 + b25 + b50 + b100 >= ceil(requetes * 0.95) then 100
        when b10 + b25 + b50 + b100 + b250 >= ceil(requetes * 0.95) then 250
        when b10 + b25 + b50 + b100 + b250 + b500 >= ceil(requetes * 0.95) then 500
        when b10 + b25 + b50 + b100 + b250 + b500 + b1000 >= ceil(requetes * 0.95) then 1000
        when b10 + b25 + b50 + b100 + b250 + b500 + b1000 + b3000 >= ceil(requetes * 0.95) then 3000
        else 3001
      end
    ) from totaux)
  ) into v_resultat;

  return v_resultat;
end;
$$;
revoke all on function public.lire_supervision(integer) from public, anon;
grant execute on function public.lire_supervision(integer) to authenticated;
