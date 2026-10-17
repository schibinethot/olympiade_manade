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
-- Le formulaire actualités ne vérifie pas l'adresse : un dépôt ne change rien d'effectif (annonces,
-- désinscription, confirmation) avant le clic de confirmation envoyé à cette adresse.
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
  -- De J-14 à J+7 : toute étape réglable tombe dans la fenêtre de la RPC emails_a_traiter (J-8 à J+17).
  constraint modeles_emails_jours_bornes check (jours_decalage is null or jours_decalage between -14 and 7),
  constraint modeles_emails_heure_bornee check (heure_envoi is null or heure_envoi between '07:00' and '21:00'),
  -- Une étape calée sur une date a toujours son échéance : sans elle, le planificateur ne saurait pas quand l'envoyer.
  constraint modeles_emails_echeance_complete check (
    cle in ('confirmation', 'bienvenue', 'message')
    or (jours_decalage is not null and heure_envoi is not null)
  ),
  -- Le double opt-in ne peut pas être coupé : sans confirmation, aucun abonné ne pourrait jamais confirmer.
  constraint modeles_emails_confirmation_active check (cle <> 'confirmation' or actif)
);

-- Destinataires ------------------------------------------------------------------------------------

create table public.destinataires_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  prenom text null,
  profil_id uuid null unique references public.profils (id) on delete set null,
  abonne boolean not null default false,
  -- Dépôt du formulaire actualités en attente du clic de confirmation (adresse non vérifiée par ce dépôt).
  -- Écrit seulement par les déclencheurs de abonnements_actualites et par le clic ci-dessous.
  abonnement_a_confirmer boolean not null default false,
  -- Dernier clic de confirmation d'un abonnement : seule écriture du serveur qui vaut consentement.
  abonnement_confirme_le timestamptz null,
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
    prenom is null
    or (length(prenom) <= 60 and length(btrim(prenom, E' \t\r\n')) >= 1 and prenom !~ '[[:cntrl:]]')
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
  -- Confirmation et bienvenue ne portent sur aucune date : l'unicité les borne à une par adresse et par mode.
  constraint envois_emails_sans_date check (etape not in ('confirmation', 'bienvenue') or calendrier_id is null),
  -- Réservation avant envoi : une seule ligne par destinataire, étape, date, message et mode (réel ou simulé).
  -- NULLS NOT DISTINCT : une confirmation ou une bienvenue (sans date ni message) n'est réservée qu'une fois
  -- par mode ; une nouvelle confirmation suppose la suppression de l'ancienne ligne (nouveau dépôt).
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
-- Pas de droit sur abonnement_a_confirmer : annuler une demande, c'est supprimer l'abonnement ; la confirmer,
-- c'est écrire abonnement_confirme_le (clic).
grant update (confirme_le, abonnement_confirme_le, annonces, annonces_le, annonces_texte, annonces_version,
  desinscrit_le)
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

-- Clic de confirmation d'un abonnement (action « confirmer » du serveur) : un seul update du service, qui
-- écrit abonnement_confirme_le. Seule cette écriture explicite vaut consentement. Le déclencheur en applique
-- tous les effets, avec le texte et la version acceptés au dépôt, horodatés au clic par la base :
--   abonnement_a_confirmer = false, confirme_le = coalesce(confirme_le, maintenant), desinscrit_le = null,
--   annonces = true.
-- Sans demande en attente, avec une valeur nulle, ou si l'abonnement a été retiré entre-temps, l'écriture est
-- sans effet : les champs de consentement envoyés avec elle reprennent leurs valeurs d'avant.
create function prive.confirmer_abonnement_email() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_texte text;
  v_version text;
begin
  if new.abonnement_confirme_le is not distinct from old.abonnement_confirme_le then
    return new;
  end if;
  if new.abonnement_confirme_le is not null and old.abonnement_a_confirmer then
    select a.consentement_texte, a.consentement_version into v_texte, v_version
    from public.abonnements_actualites a
    where a.email = new.email;
    if found then
      new.abonnement_a_confirmer := false;
      new.abonnement_confirme_le := now();
      new.confirme_le := coalesce(old.confirme_le, now());
      new.desinscrit_le := null;
      new.annonces := true;
      new.annonces_le := now();
      new.annonces_texte := v_texte;
      new.annonces_version := v_version;
      return new;
    end if;
  end if;
  new.abonnement_confirme_le := old.abonnement_confirme_le;
  new.confirme_le := old.confirme_le;
  new.desinscrit_le := old.desinscrit_le;
  new.annonces := old.annonces;
  new.annonces_le := old.annonces_le;
  new.annonces_texte := old.annonces_texte;
  new.annonces_version := old.annonces_version;
  return new;
end
$$;

create trigger destinataires_emails_confirmer_abonnement
  before update on public.destinataires_emails
  for each row execute function prive.confirmer_abonnement_email();

-- Rattachement à une date ----------------------------------------------------------------------------

-- Jour de soirée (Paris) d'un instant : une soirée finit après minuit, une date compte donc encore comme
-- « aujourd'hui » jusqu'à 06:00 le lendemain. Une inscription le 01/08 à 00:30 suit la soirée du 31/07.
create function prive.jour_des_soirees(p_instant timestamptz) returns date
language sql stable set search_path = ''
as $$
  select ((p_instant at time zone 'Europe/Paris') - interval '6 hours')::date;
$$;

-- Prochaine date confirmée à partir du jour de soirée. Un rattachement existant n'est jamais doublé.
create function prive.rattacher_prochaine_date(p_destinataire uuid, p_origine text, p_instant timestamptz default now())
returns void
language sql security definer set search_path = ''
as $$
  insert into public.rattachements_emails (destinataire_id, calendrier_id, origine)
  select p_destinataire, c.id, p_origine
  from public.calendrier c
  where c.statut = 'confirmee'
    and c.date_soiree >= prive.jour_des_soirees(p_instant)
  order by c.date_soiree, c.heure nulls last, c.id
  limit 1
  on conflict do nothing;
$$;

-- Une adresse suit la prochaine date quand elle devient confirmée (insertion déjà confirmée, ou confirme_le
-- qui passe de nul à une date), ou quand sa désinscription est levée par un clic de confirmation alors
-- qu'elle n'a plus de date active (aucune date d'au moins J-7). Une adresse désinscrite n'est rattachée à rien.
-- Sans liste de colonnes : le clic passe confirme_le et desinscrit_le par le déclencheur BEFORE, que
-- « update of » ne verrait pas.
create function prive.rattacher_destinataire_confirme() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.confirme_le is null or new.desinscrit_le is not null then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform prive.rattacher_prochaine_date(new.id, 'inscription');
    return null;
  end if;
  if old.confirme_le is null then
    perform prive.rattacher_prochaine_date(new.id, 'inscription');
  elsif old.desinscrit_le is not null
        and not exists (
          select 1
          from public.rattachements_emails r
          join public.calendrier c on c.id = r.calendrier_id
          where r.destinataire_id = new.id and c.date_soiree >= prive.jour_des_soirees(now()) - 7
        ) then
    perform prive.rattacher_prochaine_date(new.id, 'inscription');
  end if;
  return null;
end
$$;

create trigger destinataires_emails_rattacher
  after insert or update on public.destinataires_emails
  for each row execute function prive.rattacher_destinataire_confirme();

-- Une date qui passe à confirmée et devient la prochaine accueille les confirmés qui n'ont plus de date
-- active (aucun rattachement à une date d'au moins aujourd'hui - 7 jours, fin de la séquence à J+7).
create function prive.rattacher_premiere_confirmation() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_jour date := prive.jour_des_soirees(now());
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

-- Dépôt du formulaire de l'accueil : n'importe qui peut saisir n'importe quelle adresse. Le dépôt ne fait
-- que demander une confirmation : abonne et abonnement_a_confirmer passent à vrai, sans toucher aux
-- annonces, à la confirmation ni à une désinscription (une personne opposée reçoit au plus cette demande).
-- L'ancien envoi de confirmation est supprimé pour qu'une nouvelle demande puisse partir ; la bienvenue,
-- elle, ne part qu'une fois par adresse.
create function prive.inscrire_abonne_emails() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.destinataires_emails as d (email, abonne, abonnement_a_confirmer)
  values (new.email, true, true)
  on conflict (email) do update set
    abonne = true,
    abonnement_a_confirmer = true
  returning d.id into v_id;

  delete from public.envois_emails e
  where e.destinataire_id = v_id and e.etape = 'confirmation';
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
-- Une demande de confirmation en attente est annulée.
create function prive.retirer_abonne_emails() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.destinataires_emails d
  where d.email = old.email and d.profil_id is null and d.desinscrit_le is null;

  update public.destinataires_emails d
  set abonne = false,
      abonnement_a_confirmer = false,
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
  -- Caractères de contrôle remplacés par une espace avant le nettoyage (en-têtes et version texte des e-mails).
  v_prenom text := left(
    nullif(btrim(regexp_replace(new.raw_user_meta_data ->> 'prenom', '[[:cntrl:]]', ' ', 'g'), E' \t\r\n'), ''),
    60
  );
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

  -- Première confirmation seulement : aucune autre ligne ne peut déjà porter ce profil. Si un cas imprévu
  -- (confirmation annulée puis refaite, adresse changée entre-temps) violait l'unicité de profil_id,
  -- le bloc d'exception ci-dessous l'absorbe.
  begin
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

-- Compte supprimé : la ligne disparaît, sauf si l'adresse est aussi abonnée aux actualités. Elle perd alors
-- le prénom venu du compte (minimisation) ; profil_id passe à nul par la clé étrangère. Si l'abonnement
-- attend encore son clic, l'adresse n'était vérifiée que par le compte : elle redevient non confirmée et
-- ne reçoit plus de rappel de date.
create function prive.retirer_profil_emails() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.destinataires_emails d
  where d.profil_id = old.id and not d.abonne;
  update public.destinataires_emails d
  set prenom = null,
      confirme_le = case when d.abonnement_a_confirmer then null else d.confirme_le end
  where d.profil_id = old.id;
  return old;
end
$$;

create trigger profils_retirer_destinataire_emails
  before delete on public.profils
  for each row execute function prive.retirer_profil_emails();

revoke execute on function prive.marquer_modele_email() from public, anon, authenticated;
revoke execute on function prive.horodater_destinataire_email() from public, anon, authenticated;
revoke execute on function prive.confirmer_abonnement_email() from public, anon, authenticated;
revoke execute on function prive.jour_des_soirees(timestamptz) from public, anon, authenticated;
revoke execute on function prive.rattacher_prochaine_date(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function prive.rattacher_destinataire_confirme() from public, anon, authenticated;
revoke execute on function prive.rattacher_premiere_confirmation() from public, anon, authenticated;
revoke execute on function prive.inscrire_abonne_emails() from public, anon, authenticated;
revoke execute on function prive.retirer_abonne_emails() from public, anon, authenticated;
revoke execute on function prive.inscrire_spectateur_emails() from public, anon, authenticated;
revoke execute on function prive.retirer_profil_emails() from public, anon, authenticated;

-- RPC du planificateur -------------------------------------------------------------------------------------

-- Tout ce dont calculerEnvois (serveur/echeances-emails.mjs) a besoin à l'instant p_maintenant, en un appel,
-- pour le mode courant (p_reel = SMTP_MODE smtp). Les jours sont ceux de Paris ; le fuseau de la session
-- n'influe sur rien (horodatages rendus en UTC).
create function public.emails_a_traiter(p_maintenant timestamptz, p_reel boolean) returns jsonb
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
  destinataires as (
    select d.id, d.email, d.prenom, d.profil_id, d.abonne, d.abonnement_a_confirmer,
           d.desinscrit_le is not null as desinscrit, d.annonces, d.confirme_le, d.inscrit_le
    from public.destinataires_emails d cross join jour
    where
      -- confirmation à envoyer, y compris à une adresse désinscrite (une seule demande par dépôt) :
      -- inscrite depuis moins de 30 jours, ou sans tentative réelle aboutie ni vieille de 30 jours
      -- (mode log jusqu'ici : la demande partira au premier passage en smtp) ;
      (
        d.abonnement_a_confirmer
        and (
          d.inscrit_le > p_maintenant - interval '30 days'
          or not exists (
            select 1 from public.envois_emails e
            where e.destinataire_id = d.id and e.etape = 'confirmation' and e.reel
              and (e.statut = 'envoye' or e.cree_le <= p_maintenant - interval '30 days')
          )
        )
      )
      or (
        d.desinscrit_le is null
        and (
          -- rattachés à une date de la fenêtre ;
          exists (
            select 1 from public.rattachements_emails r join fenetre f on f.id = r.calendrier_id
            where r.destinataire_id = d.id
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
  ),
  -- Candidats à la bienvenue (confirmés depuis moins de 24 h, non désinscrits) : leur date à venir est
  -- renvoyée même au-delà de J+17, pour que la bienvenue d'un abonné du printemps cite sa prochaine date.
  -- Les dates passées hors fenêtre ne servent à rien et ne sont pas ajoutées.
  bienvenue as (
    select r.destinataire_id, r.calendrier_id
    from public.rattachements_emails r
    join destinataires d on d.id = r.destinataire_id
    join public.calendrier c on c.id = r.calendrier_id
    cross join jour
    where d.confirme_le > p_maintenant - interval '24 hours'
      and not d.desinscrit
      and c.date_soiree > jour.j + 17
  ),
  dates_renvoyees as (
    select f.id from fenetre f
    union
    select b.calendrier_id from bienvenue b
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
    where c.id in (select dr.id from dates_renvoyees dr) or c.id in (select p.id from prochaines p)
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
      from enrichies e join dates_renvoyees dr on dr.id = e.id
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
                 'abonnement_a_confirmer', d.abonnement_a_confirmer,
                 'desinscrit', d.desinscrit,
                 'annonces', d.annonces,
                 'confirme_le', d.confirme_le,
                 'inscrit_le', d.inscrit_le
               )
               order by d.inscrit_le, d.id
             ), '[]'::jsonb)
      from destinataires d
    ),
    -- Vers une date de la fenêtre, ou date à venir d'un candidat à la bienvenue. Seulement ceux des adresses
    -- confirmées et non désinscrites : aucun rappel de date vers une adresse opposée, même quand elle figure
    -- ici pour sa seule demande de confirmation.
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
      where d.confirme_le is not null and not d.desinscrit
        and (
          r.calendrier_id in (select f.id from fenetre f)
          or exists (
            select 1 from bienvenue b
            where b.destinataire_id = r.destinataire_id and b.calendrier_id = r.calendrier_id
          )
        )
    ),
    -- Envois du mode courant : de moins de 10 jours ou portant sur une date renvoyée dans `dates` ;
    -- confirmation et bienvenue quel que soit leur âge, puisqu'elles ne partent qu'une fois.
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
      where e.reel = p_reel
        and (
          e.cree_le > p_maintenant - interval '10 days'
          or e.calendrier_id in (select dr.id from dates_renvoyees dr)
          or e.etape in ('confirmation', 'bienvenue')
        )
    )
  );
$$;

revoke all on function public.emails_a_traiter(timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.emails_a_traiter(timestamptz, boolean) to service_role;

-- Reprise des abonnés déjà inscrits : comme un dépôt, ils attendent leur clic et recevront une seule
-- demande de confirmation au premier passage en smtp (design, section 2).
insert into public.destinataires_emails (email, abonne, abonnement_a_confirmer, inscrit_le)
select a.email, true, true, a.cree_le
from public.abonnements_actualites a
on conflict (email) do nothing;
