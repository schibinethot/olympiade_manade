-- Le dépôt public passe exclusivement par /api/contact, qui vérifie Turnstile puis utilise la
-- clé service_role. Les clients anon/authenticated ne peuvent plus contourner ces contrôles via
-- PostgREST directement.

drop policy if exists messages_contact_depot on public.messages_contact;
revoke insert on public.messages_contact from anon, authenticated;
revoke insert (prenom, email, message) on public.messages_contact from anon, authenticated;

-- Le rôle de service conserve le dépôt serveur ; les droits de lecture/traitement administrateur
-- existants restent inchangés.
grant insert (prenom, email, message) on public.messages_contact to service_role;

-- Ne dépend pas de BYPASSRLS : les environnements locaux peuvent définir service_role sans ce
-- privilège de cluster. La politique n'est accordée à aucun rôle exposé au navigateur.
create policy messages_contact_depot_serveur on public.messages_contact for insert to service_role
  with check (true);
