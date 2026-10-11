# Lot 0B : projet Supabase, migrations et Auth. Plan

**Goal :** mettre en service le projet Supabase `olympiade-manade` (organisation TPMGE, ref `khwlwpzydlrfocfpvywv`, région Paris). Il reçoit les migrations du lot 0A, avec Auth configurée pour les trois types de comptes. Chaque point est vérifié sur le projet réel.

**Spec :** `docs/CDC-MASTER.md` v0.5, sections 3, 4.4, 4.5, 5.1, 5.2 et 6 (RGPD).

**Contraintes :**
- le mot de passe de la base et les clés ne s'affichent jamais dans une sortie de commande ni dans un fichier commité. Ils vivent dans `/Users/tpmge/Dev/olympiade_manade/.env.local` (ignoré par git) ;
- on lit `.env.local` par variable d'environnement, jamais en clair dans une ligne de commande ;
- toute écriture distante passe d'abord par un `--dry-run` quand la commande le propose ;
- aucun `git push`.

## Étapes

### 1. Durcissement du schéma `prive` (code, TDD)

Retirer `grant usage on schema prive to anon, authenticated` de `20261010120000_schema.sql`. Les politiques et les déclencheurs appellent les fonctions par identifiant interne, sans avoir besoin du droit d'usage. Seul `service_role` garde ce droit.

Dans `tests/db/catalogue.test.ts`, vérifier que `has_schema_privilege(role, 'prive', 'usage')` vaut faux pour `anon` et `authenticated`.

Critère : `pnpm test` vert, dont le nouveau test, et RED observé avant le correctif.

### 2. Configuration du projet en fichier

Créer `supabase/config.toml` avec `supabase init`, puis régler :

- **API**
  - `[api] schemas` = `public`, `graphql_public`. Le schéma `prive` n'est jamais exposé.
- **Comptes**
  - Connexions anonymes désactivées.
  - Inscriptions par email activées.
  - Confirmation d'email **obligatoire** (« Confirm email »). Sans elle, une inscription par mot de passe remplirait `email_confirmed_at` sans preuve.
  - Mot de passe de 12 caractères minimum (admins).
- **Code de connexion**
  - Code à 6 chiffres, valable 1 heure.
- **Gabarits d'email en français**
  - Gabarits « confirmation » et « lien magique ».
  - Ils affichent le code `{{ .Token }}` en grand, avec le lien `{{ .ConfirmationURL }}` en secours.
  - Fichiers dans `supabase/templates/`.
- **URL**
  - `site_url` et `additional_redirect_urls` pour le développement local (`http://localhost:5173`).
  - L'URL de production sera ajoutée au lot du front.

Critère : le fichier est relu, aucun secret n'y figure.

### 3. Liaison et état du projet distant

- Lier le worktree au projet avec `supabase link`, mot de passe lu dans `.env.local`.
- Vérifier sur le projet distant :
  - le schéma `public` ne contient aucune table ;
  - l'historique des migrations est vide.

Critère : les deux vérifications sont consignées dans le rapport. **Si l'une échoue, arrêt et rapport.**

### 4. Migrations

`supabase db push --dry-run`, puis `supabase db push`.

Critère : `supabase migration list` montre les 5 migrations, en local comme à distance.

### 5. Auth

`supabase config push`.

Critère : les réglages Auth du projet distant correspondent au fichier :
- connexions anonymes désactivées ;
- confirmation d'email obligatoire ;
- code à 6 chiffres.

### 6. Vérifications sur le projet réel

- Advisors sécurité et performance : aucune alerte de sécurité. Les alertes de performance sont listées.
- Relevé du catalogue :
  - RLS sur les 10 tables ;
  - aucune fonction dans `public` ;
  - droits d'`anon` et d'`authenticated` identiques à l'instantané de `catalogue.test.ts`.
- API REST, avec la clé publique :
  - `GET /rest/v1/soirees` renvoie 200 avec une liste vide ;
  - un appel RPC à `est_admin` est refusé (fonction introuvable) ;
  - un `POST` sur `notes_public` sans session est refusé.
- Déclencheur d'inscription :
  - créer un utilisateur de test par l'API d'administration, avec `prenom` dans les métadonnées ;
  - vérifier que son profil `spectateur` existe ;
  - supprimer l'utilisateur de test et vérifier qu'aucune donnée de test ne reste.

### 7. Variables du front

- `.env.example` commité, avec des valeurs vides : `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Les vraies valeurs vont dans `.env.local`.

## Hors de ce plan

- **SMTP Brevo** (porte : compte externe). Sans lui, Supabase envoie 2 emails par heure au maximum : assez pour tester, pas pour une soirée. Les limites d'envoi se règlent une fois le SMTP branché.
- **Turnstile** (anti-robot) : lot du front.
- **Création du premier compte admin** : l'email de l'organisateur n'est pas encore connu. La commande SQL à lancer sera documentée.
