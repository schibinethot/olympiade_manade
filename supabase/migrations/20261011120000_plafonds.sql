-- Vague de corrections du lot Vitrine : plafond des messages de contact, longueur brute du prénom.

-- 1. Plafond des messages de contact.
-- Le dépôt est ouvert à la clé publique : sans plafond, n'importe qui peut remplir la table. Au-delà
-- de 10 messages créés dans les 10 dernières minutes, tous visiteurs confondus, le dépôt est refusé.
-- Ce n'est qu'un garde-fou : Turnstile et le dépôt par une fonction serveur restent obligatoires
-- avant toute communication publique du site (docs/superpowers/plans/suivi-apres-lot0.md).
create index if not exists messages_contact_cree_le_idx on public.messages_contact (cree_le);

-- security definer : anon n'a pas le droit de relire la table, le compte se fait avec les droits du
-- propriétaire. Code PT429 : PostgREST répond 429 (Too Many Requests), et le formulaire affiche
-- son message d'échec habituel.
create function prive.plafonner_messages_contact() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Dépôts simultanés : un compte à la fois, sinon chacun verrait moins de 10 messages et passerait.
  perform pg_advisory_xact_lock(hashtext('public.messages_contact:plafond'));
  if (
    select count(*)
    from public.messages_contact m
    where m.cree_le > now() - interval '10 minutes'
  ) >= 10 then
    raise exception 'Trop de messages de contact reçus ces 10 dernières minutes. Réessayez plus tard.'
      using errcode = 'PT429';
  end if;
  return new;
end;
$$;

create trigger messages_contact_plafond before insert on public.messages_contact
  for each row execute function prive.plafonner_messages_contact();

-- Une fonction déclencheur ne s'appelle jamais directement.
revoke all on function prive.plafonner_messages_contact() from public, anon, authenticated;

-- 2. Prénom des profils : 60 caractères au plus, blancs compris.
-- L'ancienne contrainte ne bornait que le prénom rogné : une lettre suivie de 100 000 espaces
-- passait. Les prénoms déjà enregistrés au-delà de 60 caractères bruts sont rognés d'abord (ils
-- font 60 caractères au plus une fois rognés), pour que la nouvelle contrainte s'applique sans échec.
update public.profils set prenom = btrim(prenom) where length(prenom) > 60;

alter table public.profils drop constraint profils_prenom_check;
alter table public.profils
  add constraint profils_prenom_check check (length(prenom) <= 60 and length(btrim(prenom)) >= 1);
