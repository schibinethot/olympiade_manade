-- Consentements explicites aux informations de l'Olympiade. Cette liste est distincte des comptes
-- Auth et des consentements de profil : s'inscrire ici ne crée aucun compte et ne déclenche aucun envoi.

create table public.abonnements_actualites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  consentement_le timestamptz not null default now(),
  consentement_texte text not null,
  consentement_version text not null,
  source text not null default 'accueil',
  cree_le timestamptz not null default now(),
  constraint abonnements_actualites_email_normalise check (
    email = lower(btrim(email, E' \t\r\n'))
    and length(email) between 3 and 254
    and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  constraint abonnements_actualites_consentement_texte_borne check (
    length(btrim(consentement_texte, E' \t\r\n')) between 1 and 500
  ),
  constraint abonnements_actualites_consentement_version_bornee check (
    length(btrim(consentement_version, E' \t\r\n')) between 1 and 40
  ),
  constraint abonnements_actualites_source_connue check (source = 'accueil')
);

alter table public.abonnements_actualites enable row level security;

-- Supabase accorde par défaut tous les droits aux rôles de la Data API dans certains projets :
-- repartir d'une matrice vide évite qu'une nouvelle table expose la liste avant ses politiques.
revoke all on public.abonnements_actualites from public, anon, authenticated, service_role;
grant select, delete on public.abonnements_actualites to authenticated;
grant insert (email, consentement_texte, consentement_version, source)
  on public.abonnements_actualites to service_role;

create policy abonnements_actualites_depot_serveur
  on public.abonnements_actualites for insert to service_role
  with check (true);

create policy abonnements_actualites_lecture_admin
  on public.abonnements_actualites for select to authenticated
  using ((select prive.est_admin()));

create policy abonnements_actualites_suppression_admin
  on public.abonnements_actualites for delete to authenticated
  using ((select prive.est_admin()));
