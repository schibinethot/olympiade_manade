-- Consentement cookies (CNIL / RGPD) : paramètres éditables par un admin et journal d'audit.
-- Les paramètres sont une ligne unique, créée par la migration ; le serveur applique les mêmes
-- valeurs par défaut si la table est inaccessible. Le journal garde l'IP seulement hachée
-- (HMAC-SHA256 côté serveur) et aucune donnée directement identifiante.

create table public.parametres_cookies (
  id smallint primary key default 1,
  titre text not null default 'Confidentialité',
  description text not null default 'Nous mesurons l’audience du site pour améliorer nos pages. Aucun cookie de publicité n’est déposé sans votre accord.',
  texte_tout_accepter text not null default 'Tout accepter',
  texte_refuser text not null default 'Tout refuser',
  texte_personnaliser text not null default 'Personnaliser',
  texte_enregistrer text not null default 'Enregistrer mes choix',
  url_confidentialite text not null default '/confidentialite',
  mesure_active boolean not null default true,
  mesure_titre text not null default 'Mesure d’audience',
  mesure_description text not null default 'Ces cookies nous permettent de mesurer l’audience du site et d’analyser ses performances afin d’améliorer le service.',
  publicite_active boolean not null default true,
  publicite_titre text not null default 'Publicité et réseaux sociaux',
  publicite_description text not null default 'Ces cookies servent à vous proposer des publicités pertinentes et à mesurer l’efficacité de nos campagnes.',
  duree_consentement_jours integer not null default 365,
  modifie_le timestamptz not null default now(),
  modifie_par uuid null references auth.users (id) on delete set null,
  constraint parametres_cookies_ligne_unique check (id = 1),
  constraint parametres_cookies_titre_borne check (length(btrim(titre, E' \t\r\n')) between 1 and 80),
  constraint parametres_cookies_description_bornee check (length(btrim(description, E' \t\r\n')) between 1 and 600),
  constraint parametres_cookies_bouton_accepter_borne check (length(btrim(texte_tout_accepter, E' \t\r\n')) between 1 and 80),
  constraint parametres_cookies_bouton_refuser_borne check (length(btrim(texte_refuser, E' \t\r\n')) between 1 and 80),
  constraint parametres_cookies_bouton_personnaliser_borne check (length(btrim(texte_personnaliser, E' \t\r\n')) between 1 and 80),
  constraint parametres_cookies_bouton_enregistrer_borne check (length(btrim(texte_enregistrer, E' \t\r\n')) between 1 and 80),
  constraint parametres_cookies_url_relative check (
    length(url_confidentialite) between 1 and 200
    and url_confidentialite like '/%'
    and url_confidentialite not like '//%'
  ),
  constraint parametres_cookies_mesure_titre_borne check (length(btrim(mesure_titre, E' \t\r\n')) between 1 and 80),
  constraint parametres_cookies_mesure_description_bornee check (length(btrim(mesure_description, E' \t\r\n')) between 1 and 600),
  constraint parametres_cookies_publicite_titre_borne check (length(btrim(publicite_titre, E' \t\r\n')) between 1 and 80),
  constraint parametres_cookies_publicite_description_bornee check (length(btrim(publicite_description, E' \t\r\n')) between 1 and 600),
  constraint parametres_cookies_duree_bornee check (duree_consentement_jours between 1 and 395)
);

-- Ligne unique insérée dès la migration : le front et le serveur lisent toujours des valeurs
-- cohérentes, même avant la première ouverture de l'écran d'administration.
insert into public.parametres_cookies (id) values (1);

create table public.consentements_cookies (
  id uuid primary key default gen_random_uuid(),
  visiteur_id text not null,
  ip_hachee text null,
  agent_utilisateur text null,
  consentement_donne boolean not null,
  mesure_acceptee boolean not null default false,
  publicite_acceptee boolean not null default false,
  action text not null,
  url_page text null,
  provenance text null,
  cree_le timestamptz not null default now(),
  constraint consentements_cookies_visiteur_borne check (length(visiteur_id) between 1 and 100),
  constraint consentements_cookies_ip_hex check (ip_hachee is null or (length(ip_hachee) = 16 and ip_hachee ~ '^[0-9a-f]{16}$')),
  constraint consentements_cookies_agent_borne check (agent_utilisateur is null or length(agent_utilisateur) <= 500),
  constraint consentements_cookies_url_bornee check (url_page is null or length(url_page) <= 500),
  constraint consentements_cookies_provenance_bornee check (provenance is null or length(provenance) <= 500),
  constraint consentements_cookies_action_connue check (action in ('accept_all', 'reject_all', 'custom'))
);

create index consentements_cookies_visiteur_idx on public.consentements_cookies (visiteur_id);
create index consentements_cookies_cree_le_idx on public.consentements_cookies (cree_le desc);
create index consentements_cookies_action_idx on public.consentements_cookies (action);

alter table public.parametres_cookies enable row level security;
alter table public.consentements_cookies enable row level security;

-- Supabase accorde par défaut tous les droits aux rôles de la Data API : repartir d'une
-- matrice vide ferme la table tant que ses politiques ne sont pas en place.
revoke all on public.parametres_cookies from public, anon, authenticated, service_role;
revoke all on public.consentements_cookies from public, anon, authenticated, service_role;

-- parametres_cookies : lecture et mise à jour réservées à un admin (AAL2 via prive.est_admin()).
-- Le serveur public lit la configuration en service_role (politique séparée).
grant select, update on public.parametres_cookies to authenticated;
grant select on public.parametres_cookies to service_role;

create policy parametres_cookies_lecture_admin
  on public.parametres_cookies for select to authenticated
  using ((select prive.est_admin()));

create policy parametres_cookies_maj_admin
  on public.parametres_cookies for update to authenticated
  using ((select prive.est_admin()))
  with check ((select prive.est_admin()));

create policy parametres_cookies_lecture_serveur
  on public.parametres_cookies for select to service_role
  using (true);

-- consentements_cookies : le serveur public (service_role) dépose les entrées. Un admin
-- consulte le journal et peut purger les entrées anciennes.
grant insert (visiteur_id, ip_hachee, agent_utilisateur, consentement_donne, mesure_acceptee,
              publicite_acceptee, action, url_page, provenance)
  on public.consentements_cookies to service_role;
grant select, delete on public.consentements_cookies to authenticated;

create policy consentements_cookies_depot_serveur
  on public.consentements_cookies for insert to service_role
  with check (true);

create policy consentements_cookies_lecture_admin
  on public.consentements_cookies for select to authenticated
  using ((select prive.est_admin()));

create policy consentements_cookies_suppression_admin
  on public.consentements_cookies for delete to authenticated
  using ((select prive.est_admin()));
