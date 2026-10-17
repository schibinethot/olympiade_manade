-- Séquence d'e-mails liée aux dates du calendrier (design du 17/10/2026).
--
-- Tables :
--   modeles_emails       une ligne par étape, textes et réglages édités par l'admin AAL2 ;
--   destinataires_emails une ligne par adresse (spectateur confirmé et/ou abonné aux actualités) ;
--   rattachements_emails destinataire × date du calendrier suivie ;
--   messages_inscrits    historique des messages manuels aux inscrits d'une date ;
--   envois_emails        journal des envois, réservé avant l'envoi (unicité = jamais de doublon).
--
-- Les destinataires ne sont écrits que par les déclencheurs ci-dessous et par le serveur (service_role).
-- Les modèles par défaut sont semés par le serveur au démarrage (MODELES_DEFAUT, tâche 5) : cette
-- migration n'insère aucun modèle.

-- Infos pratiques d'une date, complétées « au fur et à mesure » par l'admin (droits existants du calendrier).
alter table public.calendrier
  add column infos_pratiques text null
  constraint calendrier_infos_pratiques_bornees check (infos_pratiques is null or length(infos_pratiques) <= 1000);

-- Modèles ------------------------------------------------------------------------------------------

create table public.modeles_emails (
  cle text primary key,
  nom text not null,
  actif boolean not null default true,
  sujet text not null,
  preheader text not null default '',
  corps text not null,
  encart text null,
  jours_decalage smallint null,
  heure_envoi time null,
  modifie_le timestamptz not null default now(),
  modifie_par uuid null references auth.users (id) on delete set null,
  constraint modeles_emails_cle_connue check (
    cle in ('confirmation', 'bienvenue', 'j_moins_7', 'veille', 'jour_j', 'lendemain',
            'prochaines_dates', 'annonce', 'message')
  ),
  constraint modeles_emails_nom_borne check (length(nom) <= 80 and length(btrim(nom, E' \t\r\n')) >= 1),
  constraint modeles_emails_sujet_borne check (length(sujet) <= 200 and length(btrim(sujet, E' \t\r\n')) >= 1),
  constraint modeles_emails_preheader_borne check (length(preheader) <= 200),
  constraint modeles_emails_corps_borne check (length(corps) <= 8000 and length(btrim(corps, E' \t\r\n')) >= 1),
  -- L'encart « date proche » n'existe que pour la bienvenue (vide permis, nul interdit).
  constraint modeles_emails_encart_bienvenue check (
    (cle = 'bienvenue') = (encart is not null) and (encart is null or length(encart) <= 4000)
  ),
  constraint modeles_emails_jours_bornes check (jours_decalage is null or jours_decalage between -30 and 30),
  constraint modeles_emails_heure_bornee check (heure_envoi is null or heure_envoi between '07:00' and '21:00'),
  -- Une étape calée sur une date a toujours son échéance : sans elle, le planificateur ne saurait pas quand l'envoyer.
  constraint modeles_emails_echeance_complete check (
    cle in ('confirmation', 'bienvenue', 'message')
    or (jours_decalage is not null and heure_envoi is not null)
  )
);

-- Destinataires ------------------------------------------------------------------------------------

create table public.destinataires_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  prenom text null,
  profil_id uuid null unique references public.profils (id) on delete set null,
  abonne boolean not null default false,
  annonces boolean not null default false,
  annonces_le timestamptz null,
  annonces_texte text null,
  annonces_version text null,
  confirme_le timestamptz null,
  inscrit_le timestamptz not null default now(),
  desinscrit_le timestamptz null,
  modifie_le timestamptz not null default now(),
  -- Même normalisation que abonnements_actualites : une adresse, une ligne.
  constraint destinataires_emails_email_normalise check (
    email = lower(btrim(email, E' \t\r\n'))
    and length(email) between 3 and 254
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  constraint destinataires_emails_prenom_borne check (
    prenom is null or (length(prenom) <= 60 and length(btrim(prenom, E' \t\r\n')) >= 1)
  ),
  constraint destinataires_emails_annonces_texte_borne check (
    annonces_texte is null or length(btrim(annonces_texte, E' \t\r\n')) between 1 and 500
  ),
  constraint destinataires_emails_annonces_version_bornee check (
    annonces_version is null or length(btrim(annonces_version, E' \t\r\n')) between 1 and 40
  ),
  -- Pas d'annonce sans preuve du consentement : date, texte accepté et version.
  constraint destinataires_emails_annonces_prouvees check (
    not annonces or (annonces_le is not null and annonces_texte is not null and annonces_version is not null)
  )
);

-- Rattachements, messages, envois ------------------------------------------------------------------

create table public.rattachements_emails (
  destinataire_id uuid not null references public.destinataires_emails (id) on delete cascade,
  calendrier_id uuid not null references public.calendrier (id) on delete cascade,
  origine text not null,
  cree_le timestamptz not null default now(),
  primary key (destinataire_id, calendrier_id),
  constraint rattachements_emails_origine_connue check (origine in ('inscription', 'je_viens', 'premiere_confirmation'))
);
create index rattachements_emails_calendrier_idx on public.rattachements_emails (calendrier_id);

create table public.messages_inscrits (
  id uuid primary key default gen_random_uuid(),
  calendrier_id uuid null references public.calendrier (id) on delete set null,
  sujet text not null,
  corps text not null,
  cree_par uuid null references auth.users (id) on delete set null,
  cree_le timestamptz not null default now(),
  destinataires integer not null,
  constraint messages_inscrits_sujet_borne check (length(sujet) <= 200 and length(btrim(sujet, E' \t\r\n')) >= 1),
  constraint messages_inscrits_corps_borne check (length(corps) <= 8000 and length(btrim(corps, E' \t\r\n')) >= 1),
  constraint messages_inscrits_destinataires_positif check (destinataires >= 0)
);
create index messages_inscrits_calendrier_idx on public.messages_inscrits (calendrier_id);

create table public.envois_emails (
  id uuid primary key default gen_random_uuid(),
  destinataire_id uuid not null references public.destinataires_emails (id) on delete cascade,
  etape text not null,
  calendrier_id uuid null references public.calendrier (id) on delete cascade,
  message_id uuid null references public.messages_inscrits (id) on delete cascade,
  reel boolean not null,
  statut text not null default 'en_attente',
  raison text null,
  tentatives smallint not null default 0,
  prevu_le timestamptz not null default now(),
  envoye_le timestamptz null,
  cree_le timestamptz not null default now(),
  constraint envois_emails_etape_connue check (
    etape in ('confirmation', 'bienvenue', 'j_moins_7', 'veille', 'jour_j', 'lendemain',
              'prochaines_dates', 'annonce', 'message')
  ),
  constraint envois_emails_statut_connu check (statut in ('en_attente', 'envoye', 'simule', 'echec', 'saute')),
  constraint envois_emails_raison_bornee check (raison is null or length(raison) between 1 and 200),
  constraint envois_emails_tentatives_positives check (tentatives >= 0),
  -- La clé d'unicité distingue les dates et les messages : une étape de date porte sa date, un message
  -- porte son message. Sans cela, deux dates ou deux messages partageraient la même réservation.
  constraint envois_emails_date_requise check (
    etape in ('confirmation', 'bienvenue', 'message') or calendrier_id is not null
  ),
  constraint envois_emails_message_requis check ((etape = 'message') = (message_id is not null)),
  -- Réservation avant envoi : une seule ligne par destinataire, étape, date, message et mode (réel ou simulé).
  -- NULLS NOT DISTINCT : une confirmation (sans date ni message) ne peut être réservée qu'une fois.
  constraint envois_emails_unique unique nulls not distinct (destinataire_id, etape, calendrier_id, message_id, reel)
);
create index envois_emails_calendrier_idx on public.envois_emails (calendrier_id);
create index envois_emails_message_idx on public.envois_emails (message_id);
create index envois_emails_en_attente_idx on public.envois_emails (reel, prevu_le) where statut = 'en_attente';
create index envois_emails_cree_le_idx on public.envois_emails (cree_le);

-- Bilan pour l'admin : la RLS de envois_emails s'applique à l'appelant (security_invoker).
create view public.bilan_envois_emails
  with (security_invoker = on) as
  select e.etape, e.calendrier_id, e.reel, e.statut,
         count(*)::integer as nombre,
         max(e.envoye_le) as dernier_envoi
  from public.envois_emails e
  group by e.etape, e.calendrier_id, e.reel, e.statut;

-- Droits ---------------------------------------------------------------------------------------------

alter table public.modeles_emails enable row level security;
alter table public.destinataires_emails enable row level security;
alter table public.rattachements_emails enable row level security;
alter table public.messages_inscrits enable row level security;
alter table public.envois_emails enable row level security;

-- Supabase accorde par défaut tous les droits aux rôles de la Data API : repartir d'une matrice vide.
revoke all on public.modeles_emails, public.destinataires_emails, public.rattachements_emails,
  public.messages_inscrits, public.envois_emails, public.bilan_envois_emails
  from public, anon, authenticated, service_role;

-- Admin (AAL2 via prive.est_admin()) : lecture de tout, édition des seuls textes et réglages des modèles.
-- La clé, le nom, l'horodatage et l'auteur ne sont pas modifiables (ce dernier couple est forcé par déclencheur).
grant select on public.modeles_emails, public.destinataires_emails, public.rattachements_emails,
  public.messages_inscrits, public.envois_emails, public.bilan_envois_emails
  to authenticated;
grant update (actif, sujet, preheader, corps, encart, jours_decalage, heure_envoi)
  on public.modeles_emails to authenticated;

-- Serveur (service_role) : semis des modèles, liens publics (confirmation, désinscription, « Je viens »),
-- messages aux inscrits, réservation et suivi des envois, purges.
grant select on public.modeles_emails to service_role;
grant insert (cle, nom, actif, sujet, preheader, corps, encart, jours_decalage, heure_envoi)
  on public.modeles_emails to service_role;
grant select, delete on public.destinataires_emails to service_role;
grant update (confirme_le, annonces, annonces_le, annonces_texte, annonces_version, desinscrit_le)
  on public.destinataires_emails to service_role;
grant select, insert on public.rattachements_emails to service_role;
grant select, insert on public.messages_inscrits to service_role;
grant select, insert, delete on public.envois_emails to service_role;
grant update (statut, raison, tentatives, prevu_le, envoye_le) on public.envois_emails to service_role;

-- La désinscription supprime l'abonnement aux actualités par son adresse : le filtre sur email exige
-- le droit de lecture de cette seule colonne.
grant delete on public.abonnements_actualites to service_role;
grant select (email) on public.abonnements_actualites to service_role;

create policy modeles_emails_lecture_admin on public.modeles_emails for select to authenticated
  using ((select prive.est_admin()));
create policy modeles_emails_maj_admin on public.modeles_emails for update to authenticated
  using ((select prive.est_admin())) with check ((select prive.est_admin()));
create policy destinataires_emails_lecture_admin on public.destinataires_emails for select to authenticated
  using ((select prive.est_admin()));
create policy rattachements_emails_lecture_admin on public.rattachements_emails for select to authenticated
  using ((select prive.est_admin()));
create policy messages_inscrits_lecture_admin on public.messages_inscrits for select to authenticated
  using ((select prive.est_admin()));
create policy envois_emails_lecture_admin on public.envois_emails for select to authenticated
  using ((select prive.est_admin()));

-- service_role contourne la RLS sur Supabase ; ces politiques documentent son accès, borné par les droits ci-dessus.
create policy modeles_emails_serveur on public.modeles_emails for all to service_role
  using (true) with check (true);
create policy destinataires_emails_serveur on public.destinataires_emails for all to service_role
  using (true) with check (true);
create policy rattachements_emails_serveur on public.rattachements_emails for all to service_role
  using (true) with check (true);
create policy messages_inscrits_serveur on public.messages_inscrits for all to service_role
  using (true) with check (true);
create policy envois_emails_serveur on public.envois_emails for all to service_role
  using (true) with check (true);
create policy abonnements_actualites_lecture_serveur on public.abonnements_actualites for select to service_role
  using (true);
create policy abonnements_actualites_suppression_serveur on public.abonnements_actualites for delete to service_role
  using (true);

-- Horodatages forcés -------------------------------------------------------------------------------

-- Comme prive.marquer_parametres_cookies : l'auteur et la date d'une modification viennent de la session,
-- jamais de la requête.
create function prive.marquer_modele_email() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.modifie_le := now();
  new.modifie_par := auth.uid();
  return new;
end
$$;

create trigger modeles_emails_marquer
  before insert or update on public.modeles_emails
  for each row execute function prive.marquer_modele_email();

create function prive.horodater_destinataire_email() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.modifie_le := now();
  return new;
end
$$;

create trigger destinataires_emails_horodater
  before update on public.destinataires_emails
  for each row execute function prive.horodater_destinataire_email();

-- Rattachement à une date ----------------------------------------------------------------------------

-- Prochaine date confirmée à partir d'aujourd'hui (Paris). Un rattachement existant n'est jamais doublé.
create function prive.rattacher_prochaine_date(p_destinataire uuid, p_origine text) returns void
language sql security definer set search_path = ''
as $$
  insert into public.rattachements_emails (destinataire_id, calendrier_id, origine)
  select p_destinataire, c.id, p_origine
  from public.calendrier c
  where c.statut = 'confirmee'
    and c.date_soiree >= (now() at time zone 'Europe/Paris')::date
  order by c.date_soiree, c.heure nulls last, c.id
  limit 1
  on conflict do nothing;
$$;

-- Une adresse devient confirmée (insertion déjà confirmée, ou confirme_le qui passe de nul à une date) :
-- elle suit la prochaine date. Une adresse désinscrite n'est rattachée à rien.
create function prive.rattacher_destinataire_confirme() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.confirme_le is null or new.desinscrit_le is not null then
    return null;
  end if;
  if tg_op = 'UPDATE' then
    if old.confirme_le is not null then
      return null;
    end if;
  end if;
  perform prive.rattacher_prochaine_date(new.id, 'inscription');
  return null;
end
$$;

create trigger destinataires_emails_rattacher
  after insert or update of confirme_le on public.destinataires_emails
  for each row execute function prive.rattacher_destinataire_confirme();

-- Une date qui passe à confirmée et devient la prochaine accueille les confirmés qui n'ont plus de date
-- active (aucun rattachement à une date d'au moins aujourd'hui - 7 jours, fin de la séquence à J+7).
create function prive.rattacher_premiere_confirmation() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_jour date := (now() at time zone 'Europe/Paris')::date;
begin
  if new.statut <> 'confirmee' then
    return null;
  end if;
  if tg_op = 'UPDATE' then
    if old.statut = 'confirmee' then
      return null;
    end if;
  end if;
  if new.id is distinct from (
    select c.id from public.calendrier c
    where c.statut = 'confirmee' and c.date_soiree >= v_jour
    order by c.date_soiree, c.heure nulls last, c.id
    limit 1
  ) then
    return null;
  end if;

  insert into public.rattachements_emails (destinataire_id, calendrier_id, origine)
  select d.id, new.id, 'premiere_confirmation'
  from public.destinataires_emails d
  where d.confirme_le is not null
    and d.desinscrit_le is null
    and not exists (
      select 1
      from public.rattachements_emails r
      join public.calendrier c on c.id = r.calendrier_id
      where r.destinataire_id = d.id and c.date_soiree >= v_jour - 7
    )
  on conflict do nothing;
  return null;
end
$$;

create trigger calendrier_rattacher_premiere_confirmation
  after insert or update of statut on public.calendrier
  for each row execute function prive.rattacher_premiere_confirmation();

-- Abonnés aux actualités -------------------------------------------------------------------------------

-- Dépôt du formulaire de l'accueil : l'adresse n'est pas vérifiée, sauf si un compte spectateur l'a déjà
-- confirmée par son code. Une adresse désinscrite qui revient repart de zéro (nouvelle confirmation,
-- nouvelle bienvenue) : ses anciens envois de ces deux étapes ne doivent pas bloquer les nouveaux.
create function prive.inscrire_abonne_emails() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_etait_desinscrit boolean;
begin
  select d.desinscrit_le is not null into v_etait_desinscrit
  from public.destinataires_emails d
  where d.email = new.email
  for update;

  insert into public.destinataires_emails as d
    (email, abonne, annonces, annonces_le, annonces_texte, annonces_version)
  values (new.email, true, true, new.consentement_le, new.consentement_texte, new.consentement_version)
  on conflict (email) do update set
    abonne = true,
    annonces = true,
    annonces_le = excluded.annonces_le,
    annonces_texte = excluded.annonces_texte,
    annonces_version = excluded.annonces_version,
    desinscrit_le = null,
    confirme_le = case when d.profil_id is null then null else d.confirme_le end
  returning d.id into v_id;

  if coalesce(v_etait_desinscrit, false) then
    delete from public.envois_emails e
    where e.destinataire_id = v_id and e.etape in ('confirmation', 'bienvenue');
  end if;
  return null;
end
$$;

create trigger abonnements_actualites_inscrire_destinataire
  after insert on public.abonnements_actualites
  for each row execute function prive.inscrire_abonne_emails();

-- Fin d'un abonnement :
--   - adresse désinscrite : la ligne reste comme liste d'opposition, sans annonces ;
--   - ni profil ni désinscription (effacement demandé à l'admin) : la ligne disparaît ;
--   - spectateur : il garde ses rappels de date, mais plus les annonces acceptées par cet abonnement.
create function prive.retirer_abonne_emails() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.destinataires_emails d
  where d.email = old.email and d.profil_id is null and d.desinscrit_le is null;

  update public.destinataires_emails d
  set abonne = false,
      annonces = case
        when d.desinscrit_le is not null then false
        when d.annonces_texte = old.consentement_texte and d.annonces_version = old.consentement_version then false
        else d.annonces
      end
  where d.email = old.email;
  return null;
end
$$;

create trigger abonnements_actualites_retirer_destinataire
  after delete on public.abonnements_actualites
  for each row execute function prive.retirer_abonne_emails();

-- Spectateurs ---------------------------------------------------------------------------------------------

-- Adresse confirmée par le code à 6 chiffres et case de consentement cochée : le spectateur entre dans la
-- séquence. La case facultative des annonces (raw_user_meta_data->>'annonces') est horodatée à la
-- confirmation, avec le texte de CONSENTEMENT_ANNONCES_TEXTE (serveur/gabarits-emails.mjs), copié à
-- l'identique. Un juge créé par l'admin n'a pas de consentement et n'entre jamais.
-- Ce déclencheur est sur le chemin de l'inscription : une erreur imprévue est journalisée sans bloquer
-- la création du compte ni la confirmation de l'adresse.
create function prive.inscrire_spectateur_emails() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(btrim(new.email, E' \t\r\n'));
  v_prenom text := left(nullif(btrim(new.raw_user_meta_data ->> 'prenom', E' \t\r\n'), ''), 60);
  v_annonces boolean := coalesce((new.raw_user_meta_data ->> 'annonces') = 'true', false);
begin
  if new.email_confirmed_at is null
     or (new.raw_user_meta_data ->> 'consentement') is distinct from 'true' then
    return null;
  end if;
  -- Seule la première confirmation compte : une réécriture ultérieure de email_confirmed_at ne réactive
  -- ni des annonces arrêtées ni un rattachement.
  if tg_op = 'UPDATE' then
    if old.email_confirmed_at is not null then
      return null;
    end if;
  end if;
  if v_email is null
     or length(v_email) not between 3 and 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or not exists (select 1 from public.profils p where p.id = new.id) then
    return null;
  end if;

  begin
    -- Un profil ne suit qu'une adresse : une ancienne ligne d'une autre adresse est détachée,
    -- ou supprimée si elle n'avait plus d'autre raison d'exister.
    delete from public.destinataires_emails d
    where d.profil_id = new.id and d.email <> v_email and not d.abonne;
    update public.destinataires_emails d
    set profil_id = null
    where d.profil_id = new.id and d.email <> v_email;

    insert into public.destinataires_emails as d
      (email, prenom, profil_id, confirme_le, annonces, annonces_le, annonces_texte, annonces_version)
    values (
      v_email,
      v_prenom,
      new.id,
      new.email_confirmed_at,
      v_annonces,
      case when v_annonces then new.email_confirmed_at end,
      case when v_annonces then 'J’accepte de recevoir par email l’annonce des prochaines dates de l’Olympiade des Manades.' end,
      case when v_annonces then '2026-10-17' end
    )
    on conflict (email) do update set
      profil_id = excluded.profil_id,
      prenom = coalesce(excluded.prenom, d.prenom),
      confirme_le = coalesce(d.confirme_le, excluded.confirme_le),
      annonces = d.annonces or excluded.annonces,
      annonces_le = case when excluded.annonces then excluded.annonces_le else d.annonces_le end,
      annonces_texte = case when excluded.annonces then excluded.annonces_texte else d.annonces_texte end,
      annonces_version = case when excluded.annonces then excluded.annonces_version else d.annonces_version end;
  exception when others then
    -- Aucune donnée personnelle dans le journal : l'identifiant du compte et le code d'erreur suffisent.
    raise warning 'Séquence d''e-mails : compte % non inscrit (SQLSTATE %)', new.id, sqlstate;
  end;
  return null;
end
$$;

-- Nommé après auth_users_creer_profil : les déclencheurs d'un même événement s'exécutent par ordre de nom,
-- le profil existe donc déjà quand la ligne de destinataire y fait référence.
create trigger auth_users_destinataire_emails
  after insert or update of email_confirmed_at on auth.users
  for each row execute function prive.inscrire_spectateur_emails();

-- Compte supprimé : la ligne disparaît, sauf si l'adresse est aussi abonnée aux actualités (profil_id
-- passe alors à nul par la clé étrangère).
create function prive.retirer_profil_emails() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.destinataires_emails d
  where d.profil_id = old.id and not d.abonne;
  return old;
end
$$;

create trigger profils_retirer_destinataire_emails
  before delete on public.profils
  for each row execute function prive.retirer_profil_emails();

revoke execute on function prive.marquer_modele_email() from public, anon, authenticated;
revoke execute on function prive.horodater_destinataire_email() from public, anon, authenticated;
revoke execute on function prive.rattacher_prochaine_date(uuid, text) from public, anon, authenticated;
revoke execute on function prive.rattacher_destinataire_confirme() from public, anon, authenticated;
revoke execute on function prive.rattacher_premiere_confirmation() from public, anon, authenticated;
revoke execute on function prive.inscrire_abonne_emails() from public, anon, authenticated;
revoke execute on function prive.retirer_abonne_emails() from public, anon, authenticated;
revoke execute on function prive.inscrire_spectateur_emails() from public, anon, authenticated;
revoke execute on function prive.retirer_profil_emails() from public, anon, authenticated;

-- RPC du planificateur -------------------------------------------------------------------------------------

-- Tout ce dont calculerEnvois (serveur/echeances-emails.mjs) a besoin à l'instant p_maintenant, en un appel.
-- Les jours sont ceux de Paris ; le fuseau de la session n'influe sur rien (horodatages rendus en UTC).
create function public.emails_a_traiter(p_maintenant timestamptz) returns jsonb
language sql stable security definer
set search_path = ''
set timezone = 'UTC'
as $$
  with jour as (
    select (p_maintenant at time zone 'Europe/Paris')::date as j
  ),
  -- Dates de J-8 à J+17, tous statuts : couvre J-7 à J+7 de chaque date et les annonces à J-10.
  fenetre as (
    select c.id
    from public.calendrier c cross join jour
    where c.date_soiree between jour.j - 8 and jour.j + 17
  ),
  prochaines as (
    select c.id
    from public.calendrier c cross join jour
    where c.statut = 'confirmee' and c.date_soiree > jour.j
    order by c.date_soiree, c.heure nulls last, c.id
    limit 6
  ),
  enrichies as (
    select c.id, c.date_soiree, c.heure,
           jsonb_build_object(
             'id', c.id,
             'nom', c.nom,
             'ville', c.ville,
             'arenes', c.arenes,
             'date_soiree', c.date_soiree,
             'heure', c.heure,
             'statut', c.statut,
             'lien_billetterie', c.lien_billetterie,
             'infos_pratiques', c.infos_pratiques,
             'soiree', case when s.id is null then null
                            else jsonb_build_object('slug', s.slug, 'statut', s.statut) end,
             'manades', coalesce((
               select jsonb_agg(m.nom order by sm.ordre, m.nom)
               from public.soiree_manades sm
               join public.manades m on m.id = sm.manade_id
               where sm.soiree_id = c.soiree_id
             ), '[]'::jsonb),
             'vainqueur', (
               select p.vainqueur
               from public.palmares p
               where p.statut = 'confirme' and p.date_soiree = c.date_soiree and p.ville = c.ville
               order by p.id
               limit 1
             )
           ) as donnees
    from public.calendrier c
    left join public.soirees s on s.id = c.soiree_id
    where c.id in (select f.id from fenetre f) or c.id in (select p.id from prochaines p)
  ),
  destinataires as (
    select d.id, d.email, d.prenom, d.profil_id, d.abonne, d.annonces, d.confirme_le, d.inscrit_le
    from public.destinataires_emails d cross join jour
    where d.desinscrit_le is null
      and (
        -- rattachés à une date de la fenêtre ;
        exists (
          select 1 from public.rattachements_emails r join fenetre f on f.id = r.calendrier_id
          where r.destinataire_id = d.id
        )
        -- abonnés non confirmés inscrits depuis moins de 30 jours, ou dont la confirmation n'est jamais
        -- vraiment partie (mode log jusqu'ici) : ils la recevront au premier passage en smtp ;
        or (
          d.abonne and d.confirme_le is null
          and (
            d.inscrit_le > p_maintenant - interval '30 days'
            or not exists (
              select 1 from public.envois_emails e
              where e.destinataire_id = d.id and e.etape = 'confirmation' and e.reel and e.statut = 'envoye'
            )
          )
        )
        -- confirmés depuis moins de 24 h (bienvenue) ;
        or d.confirme_le > p_maintenant - interval '24 hours'
        -- consentants aux annonces quand une date confirmée de la fenêtre est à venir.
        or (
          d.annonces
          and exists (
            select 1 from public.calendrier c join fenetre f on f.id = c.id
            where c.statut = 'confirmee' and c.date_soiree >= jour.j
          )
        )
      )
  )
  select jsonb_build_object(
    'modeles', (
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'cle', m.cle,
                 'nom', m.nom,
                 'actif', m.actif,
                 'sujet', m.sujet,
                 'preheader', m.preheader,
                 'corps', m.corps,
                 'encart', m.encart,
                 'jours_decalage', m.jours_decalage,
                 'heure_envoi', m.heure_envoi
               )
               order by array_position(
                 array['confirmation', 'bienvenue', 'j_moins_7', 'veille', 'jour_j', 'lendemain',
                       'prochaines_dates', 'annonce', 'message'],
                 m.cle
               )
             ), '[]'::jsonb)
      from public.modeles_emails m
    ),
    'dates', (
      select coalesce(jsonb_agg(e.donnees order by e.date_soiree, e.heure nulls last, e.id), '[]'::jsonb)
      from enrichies e join fenetre f on f.id = e.id
    ),
    'prochaines', (
      select coalesce(jsonb_agg(e.donnees order by e.date_soiree, e.heure nulls last, e.id), '[]'::jsonb)
      from enrichies e join prochaines p on p.id = e.id
    ),
    'destinataires', (
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'id', d.id,
                 'email', d.email,
                 'prenom', d.prenom,
                 'profil_id', d.profil_id,
                 'abonne', d.abonne,
                 'annonces', d.annonces,
                 'confirme_le', d.confirme_le,
                 'inscrit_le', d.inscrit_le
               )
               order by d.inscrit_le, d.id
             ), '[]'::jsonb)
      from destinataires d
    ),
    -- Seulement ceux des adresses confirmées : tant qu'une adresse revenue après désinscription n'a pas
    -- reconfirmé, aucun rappel de date ne part vers elle.
    'rattachements', (
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'destinataire_id', r.destinataire_id,
                 'calendrier_id', r.calendrier_id,
                 'origine', r.origine,
                 'cree_le', r.cree_le
               )
               order by r.cree_le, r.destinataire_id, r.calendrier_id
             ), '[]'::jsonb)
      from public.rattachements_emails r
      join destinataires d on d.id = r.destinataire_id
      join fenetre f on f.id = r.calendrier_id
      where d.confirme_le is not null
    ),
    -- Envois de moins de 10 jours ou portant sur une date de la fenêtre ; confirmation et bienvenue
    -- quel que soit leur âge, puisqu'elles ne partent qu'une fois.
    'envois', (
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'id', e.id,
                 'destinataire_id', e.destinataire_id,
                 'etape', e.etape,
                 'calendrier_id', e.calendrier_id,
                 'message_id', e.message_id,
                 'reel', e.reel,
                 'statut', e.statut,
                 'raison', e.raison,
                 'tentatives', e.tentatives,
                 'prevu_le', e.prevu_le,
                 'envoye_le', e.envoye_le,
                 'cree_le', e.cree_le
               )
               order by e.cree_le, e.id
             ), '[]'::jsonb)
      from public.envois_emails e
      join destinataires d on d.id = e.destinataire_id
      where e.cree_le > p_maintenant - interval '10 days'
         or e.calendrier_id in (select f.id from fenetre f)
         or e.etape in ('confirmation', 'bienvenue')
    )
  );
$$;

revoke all on function public.emails_a_traiter(timestamptz) from public, anon, authenticated;
grant execute on function public.emails_a_traiter(timestamptz) to service_role;

-- Reprise des abonnés déjà inscrits : ils entrent non confirmés et recevront une seule demande de
-- confirmation au premier passage en smtp (design, section 2).
insert into public.destinataires_emails (email, abonne, annonces, annonces_le, annonces_texte, annonces_version, inscrit_le)
select a.email, true, true, a.consentement_le, a.consentement_texte, a.consentement_version, a.cree_le
from public.abonnements_actualites a
on conflict (email) do nothing;
