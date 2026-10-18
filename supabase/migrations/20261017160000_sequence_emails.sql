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
  -- Plafond des demandes de confirmation réelles (C6), compté à la réservation : les envois de confirmation
  -- sont supprimés à chaque nouvelle demande, le compteur vit donc ici. Fenêtre de 30 jours ouverte par
  -- la première demande ; écrit seulement par le déclencheur envois_emails_plafonner_confirmation.
  demandes_confirmation smallint not null default 0,
  premiere_demande_le timestamptz null,
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
  ),
  constraint destinataires_emails_demandes_positives check (demandes_confirmation >= 0)
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
  -- Clé d'idempotence fournie par l'admin (une par ouverture du formulaire) : un nouvel essai réutilise le
  -- même message. Nulle pour un appel sans clé (l'idempotence en mémoire du serveur s'applique alors).
  cle uuid null,
  constraint messages_inscrits_cle_unique unique (cle),
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

-- Bilan pour l'admin (une seule requête pour l'onglet Envois) : la RLS de envois_emails s'applique à
-- l'appelant (security_invoker). La raison distingue les sauts et les échecs (plafond, interrompu…).
create view public.bilan_envois_emails
  with (security_invoker = on) as
  select e.etape, e.calendrier_id, e.reel, e.statut, e.raison,
         count(*)::integer as nombre,
         max(e.envoye_le) as dernier_envoi
  from public.envois_emails e
  group by e.etape, e.calendrier_id, e.reel, e.statut, e.raison;

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
-- Aucun droit du serveur sur abonnements_actualites hors du dépôt : la désinscription et la purge passent par
-- public.retirer_abonnement_destinataire (identifiant dans le corps d'un POST, jamais d'adresse dans une URL).

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
-- Sans consentement aux annonces, seule une personne qui n'a encore suivi aucune date y est rattachée
-- (revue juridique B2) : un spectateur d'une saison passée ne suit une nouvelle date que par « Je viens ».
-- Corollaire : les rattachements ne sont jamais purgés.
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
    -- Sans consentement aux annonces, seule une personne qui n’a encore suivi aucune date est rattachée d’office.
    and (
      d.annonces
      or not exists (select 1 from public.rattachements_emails r0 where r0.destinataire_id = d.id)
    )
  on conflict do nothing;
  return null;
end
$$;

create trigger calendrier_rattacher_premiere_confirmation
  after insert or update of statut on public.calendrier
  for each row execute function prive.rattacher_premiere_confirmation();

-- Date déplacée (QA B1) : les étapes de date sautées pour l'ancienne échéance (déjà passée à l'inscription, même jour
-- que la bienvenue, plafond, fenêtre…) sont effacées, pour que la nouvelle échéance se calcule ; sinon l'unicité la
-- bloquerait. Une étape partie, réservée ou en échec reste : elle n'est pas renvoyée pour la nouvelle échéance (le
-- message n° 8 annonce un report), et la RPC la montre au calcul (pas de réservation fantôme sous le plafond).
create function prive.effacer_sauts_date_deplacee() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.envois_emails e
  where e.calendrier_id = new.id and e.statut = 'saute'
    and e.etape in ('j_moins_7', 'veille', 'jour_j', 'lendemain', 'prochaines_dates');
  return null;
end
$$;

create trigger calendrier_effacer_sauts_date_deplacee
  after update of date_soiree on public.calendrier
  for each row when (old.date_soiree is distinct from new.date_soiree)
  execute function prive.effacer_sauts_date_deplacee();

-- Abonnés aux actualités -------------------------------------------------------------------------------

-- Plafond des demandes de confirmation réelles (revue juridique C6, sécurité I3) : au plus 1 par 30 jours
-- pour une adresse désinscrite, au plus 3 pour les autres. La fenêtre s'ouvre à la première demande et se
-- referme 30 jours plus tard.
create function prive.confirmation_permise(
  p_demandes smallint, p_premiere timestamptz, p_desinscrit_le timestamptz, p_maintenant timestamptz
) returns boolean
language sql immutable set search_path = ''
as $$
  select p_premiere is null
      or p_premiere <= p_maintenant - interval '30 days'
      or p_demandes < case when p_desinscrit_le is null then 3 else 1 end;
$$;

-- Toute réservation d'une confirmation réelle passe ici, quel que soit le chemin qui a supprimé la
-- précédente : au-delà du plafond, la ligne n'est pas insérée (sans erreur, comme un doublon ignoré).
create function prive.plafonner_confirmation_email() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.etape <> 'confirmation' or not new.reel then
    return new;
  end if;
  -- Doublon (déjà réservée) : l'unicité l'écarte, rien n'est compté.
  if exists (
    select 1 from public.envois_emails e
    where e.destinataire_id = new.destinataire_id and e.etape = 'confirmation' and e.reel
  ) then
    return new;
  end if;
  update public.destinataires_emails d
  set demandes_confirmation = case
        when d.premiere_demande_le is null or d.premiere_demande_le <= now() - interval '30 days' then 1
        else d.demandes_confirmation + 1
      end,
      premiere_demande_le = case
        when d.premiere_demande_le is null or d.premiere_demande_le <= now() - interval '30 days' then now()
        else d.premiere_demande_le
      end
  where d.id = new.destinataire_id
    and prive.confirmation_permise(d.demandes_confirmation, d.premiere_demande_le, d.desinscrit_le, now());
  if not found then
    return null;
  end if;
  return new;
end
$$;

create trigger envois_emails_plafonner_confirmation
  before insert on public.envois_emails
  for each row execute function prive.plafonner_confirmation_email();

-- Dépôt du formulaire de l'accueil : n'importe qui peut saisir n'importe quelle adresse. Le dépôt ne fait
-- que demander une confirmation : abonne et abonnement_a_confirmer passent à vrai, sans toucher aux
-- annonces, à la confirmation ni à une désinscription (une personne opposée reçoit au plus cette demande).
-- L'ancien envoi de confirmation est supprimé pour qu'une nouvelle demande puisse partir, si le plafond le
-- permet (sinon l'ancien lien reste le seul valable) ; la bienvenue, elle, ne part qu'une fois par adresse.
create function prive.inscrire_abonne_emails() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_permise boolean;
begin
  insert into public.destinataires_emails as d (email, abonne, abonnement_a_confirmer)
  values (new.email, true, true)
  on conflict (email) do update set
    abonne = true,
    abonnement_a_confirmer = true
  returning d.id, prive.confirmation_permise(d.demandes_confirmation, d.premiere_demande_le, d.desinscrit_le, now())
  into v_id, v_permise;

  delete from public.envois_emails e
  where e.destinataire_id = v_id and e.etape = 'confirmation' and (v_permise or not e.reel);
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
revoke execute on function prive.effacer_sauts_date_deplacee() from public, anon, authenticated;
revoke execute on function prive.confirmation_permise(smallint, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function prive.plafonner_confirmation_email() from public, anon, authenticated;
revoke execute on function prive.inscrire_abonne_emails() from public, anon, authenticated;
revoke execute on function prive.retirer_abonne_emails() from public, anon, authenticated;
revoke execute on function prive.inscrire_spectateur_emails() from public, anon, authenticated;
revoke execute on function prive.retirer_profil_emails() from public, anon, authenticated;

-- RPC du planificateur -------------------------------------------------------------------------------------

-- Milliseconde Unix d'un instant : la RPC rend ses horodatages en nombres, plus courts qu'un texte ISO.
create function prive.ms(p_instant timestamptz) returns bigint
language sql immutable set search_path = ''
as $$
  select floor(extract(epoch from p_instant) * 1000)::bigint;
$$;

-- Tout ce dont calculerEnvois (serveur/echeances-emails.mjs) a besoin à l'instant p_maintenant, en un appel,
-- pour le mode courant (p_reel = EMAILS_MODE smtp), et rien de plus : 5 000 destinataires suivant la même
-- date tiennent sous 2 Mo. Les jours sont ceux de Paris ; le fuseau de la session n'influe sur rien.
--
-- Forme, décodée par lireEmailsATraiter (serveur/echeances-emails.mjs) :
--   modeles, dates, prochaines : objets ;
--   destinataires : une ligne par personne, en tableau
--     [id, a_demander, desinscrit, annonces, confirme_le_ms,
--      [[date, origine, cree_le_ms], …], [[etape, date, statut, raison, prevu_le_ms], …]]
--   a_demander : demande de confirmation en attente, et encore permise par le plafond (C6) en mode réel ;
--   date : position de la date dans `dates` (nombre), ou son identifiant si elle n'y figure pas, ou null.
-- Ni adresse ni prénom : le planificateur relit le destinataire juste avant l'envoi.
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
  -- Dates des listes : confirmées, à venir, sans soirée liée annulée ou reportée (sécurité M8).
  prochaines as (
    select c.id
    from public.calendrier c
    cross join jour
    left join public.soirees s on s.id = c.soiree_id
    where c.statut = 'confirmee' and c.date_soiree > jour.j
      and (s.id is null or s.statut not in ('annulee', 'reportee'))
    order by c.date_soiree, c.heure nulls last, c.id
    limit 6
  ),
  -- L'annonce ne part que dans sa plage du jour (calculerEnvois : de heure_envoi à heure_envoi + 12 h, heure
  -- de Paris), modèle actif, et s'il reste une date confirmée à venir dans la fenêtre.
  annonce_ouverte as (
    select 1 as ouverte
    from public.modeles_emails m cross join jour
    where m.cle = 'annonce' and m.actif and m.heure_envoi is not null
      and p_maintenant >= (jour.j + m.heure_envoi) at time zone 'Europe/Paris'
      and p_maintenant <= ((jour.j + m.heure_envoi) at time zone 'Europe/Paris') + interval '12 hours'
      and exists (
        select 1 from public.calendrier c join fenetre f on f.id = c.id
        where c.statut = 'confirmee' and c.date_soiree >= jour.j
      )
  ),
  destinataires as (
    select d.id, d.abonnement_a_confirmer, d.desinscrit_le is not null as desinscrit, d.annonces, d.confirme_le,
           d.abonnement_a_confirmer
             and (not p_reel
                  or prive.confirmation_permise(d.demandes_confirmation, d.premiere_demande_le, d.desinscrit_le, p_maintenant))
             as a_demander
    from public.destinataires_emails d
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
          -- consentants aux annonces : dans la plage de l'annonce du jour seulement, et sans annonce comptée
          -- (envoyée, simulée, en attente ou interrompue) depuis 7 jours.
          or (
            d.annonces
            and exists (select 1 from annonce_ouverte)
            and not exists (
              select 1 from public.envois_emails e
              where e.destinataire_id = d.id and e.etape = 'annonce' and e.reel = p_reel
                and (e.statut in ('envoye', 'simule', 'en_attente') or (e.statut = 'echec' and e.raison = 'interrompu'))
                and e.prevu_le > p_maintenant - interval '7 days'
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
  -- Position de chaque date dans `dates` (même ordre que son agrégat) : les lignes des personnes la citent.
  dates_indexees as (
    select c.id, (row_number() over (order by c.date_soiree, c.heure nulls last, c.id) - 1)::integer as i
    from public.calendrier c
    where c.id in (select dr.id from dates_renvoyees dr)
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
               jsonb_build_array(
                 d.id,
                 d.a_demander,
                 d.desinscrit,
                 d.annonces,
                 prive.ms(d.confirme_le),
                 -- Rattachements d'une adresse confirmée et non désinscrite : vers une date de la fenêtre, ou date
                 -- à venir d'un candidat à la bienvenue. Aucun rappel de date vers une adresse opposée, même
                 -- quand elle figure ici pour sa seule demande de confirmation.
                 (
                   select coalesce(jsonb_agg(
                            jsonb_build_array(di.i, r.origine, prive.ms(r.cree_le))
                            order by r.cree_le, r.calendrier_id
                          ), '[]'::jsonb)
                   from public.rattachements_emails r
                   join dates_indexees di on di.id = r.calendrier_id
                   where r.destinataire_id = d.id and d.confirme_le is not null and not d.desinscrit
                     and (
                       r.calendrier_id in (select f.id from fenetre f)
                       or exists (
                         select 1 from bienvenue b
                         where b.destinataire_id = r.destinataire_id and b.calendrier_id = r.calendrier_id
                       )
                     )
                 ),
                 -- Envois du mode courant dont calculerEnvois a besoin, et eux seuls (paires personne-date) :
                 (
                   select coalesce(jsonb_agg(
                            jsonb_build_array(
                              e.etape, coalesce(to_jsonb(di.i), to_jsonb(e.calendrier_id)), e.statut, e.raison,
                              prive.ms(e.prevu_le)
                            )
                            order by e.prevu_le, e.id
                          ), '[]'::jsonb)
                   from public.envois_emails e
                   left join dates_indexees di on di.id = e.calendrier_id
                   where e.destinataire_id = d.id and e.reel = p_reel
                     and (
                       -- la demande de confirmation d'une adresse qui attend son clic, quel que soit son âge ;
                       (e.etape = 'confirmation' and d.abonnement_a_confirmer)
                       -- la bienvenue d'un confirmé depuis moins de 24 h (règle 2) ;
                       or (e.etape = 'bienvenue' and d.confirme_le > p_maintenant - interval '24 hours')
                       -- les envois des 4 derniers jours : plafond du jour, étapes de date des 48 dernières heures ;
                       or e.prevu_le > p_maintenant - interval '4 days'
                       -- pour un consentant : délais glissants de 7 jours et dates déjà annoncées ;
                       or (d.annonces and e.etape in ('annonce', 'prochaines_dates') and e.prevu_le > p_maintenant - interval '7 days')
                       or (d.annonces and e.etape = 'annonce' and e.calendrier_id in (select f.id from fenetre f))
                       -- les étapes de date d'une date de la fenêtre, quel que soit leur âge, sauf les sautées (effacées si
                       -- la date bouge) : après un report, une étape partie pour l'ancienne échéance n'est ni recalculée
                       -- ni comptée sous le plafond comme une réservation fantôme (QA B1) ;
                       or (e.etape in ('j_moins_7', 'veille', 'jour_j', 'lendemain', 'prochaines_dates') and e.statut <> 'saute'
                           and e.calendrier_id in (select f.id from fenetre f))
                       -- toutes les étapes d'un rattachement de moins de 48 h (étapes déjà passées à l'inscription).
                       or exists (
                         select 1 from public.rattachements_emails r
                         where r.destinataire_id = e.destinataire_id and r.calendrier_id = e.calendrier_id
                           and r.cree_le > p_maintenant - interval '48 hours'
                       )
                     )
                 )
               )
               order by d.id
             ), '[]'::jsonb)
      from destinataires d
    )
  );
$$;

revoke all on function public.emails_a_traiter(timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.emails_a_traiter(timestamptz, boolean) to service_role;
revoke execute on function prive.ms(timestamptz) from public, anon, authenticated;

-- RPC du serveur : liens, dépôt, purge ------------------------------------------------------------------

-- Fin de l'abonnement aux actualités d'un destinataire (désinscription, purge) : l'identifiant passe dans le
-- corps d'un POST, jamais l'adresse dans une URL (journaux de l'API). Les déclencheurs de retrait font le reste.
create function public.retirer_abonnement_destinataire(p_destinataire uuid) returns void
language sql security definer set search_path = ''
as $$
  delete from public.abonnements_actualites a using public.destinataires_emails d
  where d.id = p_destinataire and a.email = d.email;
$$;

-- Nouveau dépôt d'une adresse déjà abonnée (409 du formulaire) dont la demande attend encore son clic : la
-- confirmation réelle échouée, sautée, ou partie depuis plus de 24 h est supprimée pour qu'une nouvelle parte
-- au passage suivant, dans la limite du plafond (C6). Jamais pour une adresse désinscrite par ce chemin (I3) :
-- elle ne reçoit une nouvelle demande que par un nouveau dépôt, après la fin de l'abonnement. Aucun résultat :
-- la réponse au formulaire ne dit pas si l'adresse existait.
create function public.renvoyer_confirmation_email(p_email text, p_maintenant timestamptz) returns void
language sql security definer set search_path = ''
as $$
  delete from public.envois_emails e using public.destinataires_emails d
  where d.email = lower(btrim(p_email, E' \t\r\n')) and d.abonnement_a_confirmer and d.desinscrit_le is null
    and prive.confirmation_permise(d.demandes_confirmation, d.premiere_demande_le, d.desinscrit_le, p_maintenant)
    and e.destinataire_id = d.id and e.etape = 'confirmation' and e.reel
    and (e.statut in ('echec', 'saute')
         or (e.statut <> 'en_attente' and coalesce(e.envoye_le, e.cree_le) < p_maintenant - interval '24 hours'));
$$;

-- Purge quotidienne des demandes jamais confirmées (revue juridique C5, sécurité M7), en mode réel seulement :
--   A. 30 jours après l'envoi réel de la confirmation, ou après sa réclamation si elle a été interrompue (peut-être
--      partie) : c'est le délai annoncé par l'e-mail ;
--   B. si rien n'est parti (échec, saut, aucun envoi), 30 jours sans dépôt NI tentative de confirmation. Une panne
--      SMTP au premier passage en smtp (abonnés repris, dépôt ancien) ne vide donc pas la liste la nuit suivante.
-- Une confirmation en attente (nouvel essai compris) protège la demande. Chaque retrait passe par
-- retirer_abonnement_destinataire. Par lots de p_limite ; rend le nombre de demandes retirées.
create function public.purger_demandes_non_confirmees(p_maintenant timestamptz, p_limite integer) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_nombre integer := 0;
begin
  for v_id in
    select d.id
    from public.destinataires_emails d
    join public.abonnements_actualites a on a.email = d.email
    where d.abonnement_a_confirmer
      and (
        -- A. Confirmation partie, ou peut-être partie (interrompue), il y a plus de 30 jours.
        exists (
          select 1 from public.envois_emails e
          where e.destinataire_id = d.id and e.etape = 'confirmation' and e.reel
            and (e.statut = 'envoye' or (e.statut = 'echec' and e.raison = 'interrompu'))
            and coalesce(e.envoye_le, e.cree_le) < p_maintenant - interval '30 days'
        )
        -- B. Rien n'est parti : ni dépôt ni tentative de confirmation depuis 30 jours.
        or (
          a.cree_le < p_maintenant - interval '30 days'
          and not exists (
            select 1 from public.envois_emails e
            where e.destinataire_id = d.id and e.etape = 'confirmation' and e.reel
              and (e.statut in ('envoye', 'en_attente')
                   or (e.statut = 'echec' and e.raison = 'interrompu')
                   or e.cree_le >= p_maintenant - interval '30 days'
                   or e.envoye_le >= p_maintenant - interval '30 days')
          )
        )
      )
    order by d.id
    limit greatest(p_limite, 0)
  loop
    perform public.retirer_abonnement_destinataire(v_id);
    v_nombre := v_nombre + 1;
  end loop;
  return v_nombre;
end
$$;

revoke all on function public.retirer_abonnement_destinataire(uuid), public.renvoyer_confirmation_email(text, timestamptz),
  public.purger_demandes_non_confirmees(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.retirer_abonnement_destinataire(uuid), public.renvoyer_confirmation_email(text, timestamptz),
  public.purger_demandes_non_confirmees(timestamptz, integer)
  to service_role;

-- Reprise des abonnés déjà inscrits : comme un dépôt, ils attendent leur clic et recevront une seule
-- demande de confirmation au premier passage en smtp (design, section 2).
insert into public.destinataires_emails (email, abonne, abonnement_a_confirmer, inscrit_le)
select a.email, true, true, a.cree_le
from public.abonnements_actualites a
on conflict (email) do nothing;
