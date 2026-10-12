# Audit de sécurité — olympiade_manade

- **Date** : 12 octobre 2026
- **Périmètre** : dépôt `/Users/tpmge/Dev/olympiade_manade` tel qu’il est aujourd’hui (code, migrations, policies, front, serveur Railway, config Supabase, dépendances)
- **Auteur** : Casey (revue cybersécurité)
- **Méthode** : inspection du code et du schéma, pas un diff git. Aucune exploitation active contre la production. Aucun secret lu dans `.env.local`.

## 1. Synthèse exécutive

Le socle d’autorisation (RLS, grants par colonne, fonctions `prive` en `security definer` avec `search_path` vide, tests `tests/db`) est **au-dessus de la moyenne** pour une SPA Supabase. Aucune faille d’élévation de rôle, d’IDOR de notes, d’injection SQL ou de secret commité n’a été confirmée. `pnpm audit` ne remonte aucune CVE.

Les risques réels avant une soirée publique portent sur **l’abus des API Auth et Contact** (clé publishable dans le navigateur, pas de captcha, drapeau d’inscription seulement côté front) et sur **l’administration à un seul facteur** (rôle `admin` dans `profils`, TOTP activable mais jamais exigé). Ce n’est pas du théâtre : un attaquant n’a pas besoin de XSS pour bombarder `/auth/v1/otp` ou `messages_contact`.

**Score global : 7 / 10**

Le score reflète un modèle de données défendu, des en-têtes HTTP soignés et l’absence de secrets en git, contre des contrôles d’abus et d’administration encore ouverts. Il n’est pas 8 tant que Turnstile, l’AAL2 admin et le dépôt de contact côté serveur ne sont pas en place.

### État des corrections du 12 octobre 2026

Le dépôt corrige H1 et H2, ainsi que M1, M2, M3, M5 et M7. Les inscriptions Auth sont fermées
par défaut, les appels OTP et mot de passe transmettent un jeton Turnstile, le rôle admin exige un
JWT `aal2` dans la RLS et l'API de supervision, et `/admin` permet l'enrôlement puis la vérification
TOTP. Le consentement est désormais horodaté à `email_confirmed_at`, pas à la création du compte.

Ces changements ne prouvent pas l'état du projet hébergé et aucune configuration Auth réelle n'a
été poussée pendant cette correction. Avant ouverture, fournir `VITE_TURNSTILE_SITE_KEY` au build
et `TURNSTILE_SECRET_KEY` à Supabase Auth et au serveur, appliquer les migrations, puis vérifier le
Dashboard Auth. `supabase start` et `config push` échouent volontairement sans le secret Turnstile.
Pour ouvrir les inscriptions, il faut ensuite passer `auth.enable_signup` et
`auth.email.enable_signup` à `true` dans la configuration déployée ; le seul drapeau
`VITE_INSCRIPTION_OUVERTE=true` ne suffit plus. Utiliser les clés de test officielles Cloudflare
uniquement en local. La CSP doit autoriser `https://challenges.cloudflare.com` pour les scripts,
cadres et connexions, ainsi que `data:` pour l'image du QR TOTP.

| Sévérité | Confirmés | Hypothèses |
| --- | ---: | ---: |
| Critique | 0 | 0 |
| Haute | 3 | 0 |
| Moyenne | 7 | 2 |
| Basse | 8 | 1 |
| Info | 5 | 1 |

**Aucune vulnérabilité critique confirmée.** Aucun secret en clair dans git. Un fichier `.env.local` existe en local, ignoré par git ; son contenu n’a pas été ouvert.

## 2. Périmètre et méthode

### In scope

- Auth Supabase (OTP, mot de passe admin, JWT, redirects, MFA)
- RLS / grants / fonctions (`supabase/migrations/*.sql`)
- Front React Router (`app/`) et serveur Node (`serveur/`)
- File de notes, supervision, planning
- Secrets, `.gitignore`, `.env.example`
- Headers, CSP, CORS, uploads
- Dépendances (`package.json` / `pnpm audit`)
- Traces d’infra : `railway.json`, `supabase/config.toml`
- Mention RGPD (constat technique, pas un avis juridique)

### Hors scope

- Pentest réseau Railway / projet hébergé Supabase
- Revue des DPA et des contrats (à Rebecca)
- Correction du code (non demandée)

### Méthode

Lecture des 9 migrations, des policies, du serveur statique, des RPC, des formulaires, des tests RLS. Recherche de `dangerouslySetInnerHTML`, `eval`, clés, CORS. `pnpm audit`. Vérification que `.env` / `.env.*` sont ignorés.

**Légende des findings** : *confirmé* = visible dans le code ; *hypothèse* = dépend d’un écart config hébergée / runtime non inspecté ici.

## 3. Threat model

### Acteurs

| Acteur | Motivation | Capacité |
| --- | --- | --- |
| Visiteur anonyme | Spam, énumération, DoS du contact, création de comptes | Clé publishable, API Supabase, pages publiques |
| Spectateur authentifié | Noter pour un autre, lire le jury, modifier un rôle | JWT `authenticated`, RLS |
| Juge | Voir / modifier les notes d’un confrère | JWT + ligne `soiree_juges` |
| Admin compromis (email ou mot de passe) | Fausser le planning, lire PII, stats | Rôle `profils.role = admin` |
| Site tiers malveillant | CSRF vers l’API Supabase (origine quelconque, modèle SPA) | Origine étrangère + clé publique |
| Opérateur / insider | Clé `service_role` Railway | Contourne la RLS |

### Assets

- Comptes (`auth.users`, `profils`) : email, prénom, consentement, rôle
- Votes public / jury / file (`notes_public`, `notes_jury`, `file_notes`)
- Messages de contact (PII)
- Intégrité des soirées et classements
- Clé `service_role` (serveur seulement)
- Disponibilité le soir de vote

### Surfaces

- SPA Railway + `/api/notation/planning` (public) + `/api/admin/supervision` (JWT admin)
- API Supabase REST / Auth / Realtime / (GraphQL si exposé)
- Emails OTP (sujet + corps + lien)
- `localStorage` (`olympiade-auth`) et IndexedDB (file locale)

### Hypothèses d’attaquant réalistes

1. Extraire la clé publishable du JS (normale pour une SPA).
2. Appeler Auth et REST sans passer par l’UI.
3. Compromettre une boîte mail (OTP 6 chiffres = un seul facteur).
4. XSS un jour : vol de session dans `localStorage` (la CSP actuelle réduit fortement ce risque).

## 4. Findings

### Tableau

| # | Sévérité | Statut | OWASP | Titre | Fichier |
| --- | --- | --- | --- | --- | --- |
| H1 | Haute | Corrigé dans le dépôt, déploiement requis | A07 / A04 | Auth OTP et signup sans captcha ; drapeau d’inscription seulement au build | `app/lib/auth.ts`, `app/lib/inscription-ouverte.ts`, `supabase/config.toml` |
| H2 | Haute | Corrigé dans le dépôt, migration requise | A07 | Admin : MFA non exigée, même facteur email que le public | `supabase/migrations/20261010120100_regles_vote.sql`, `config.toml` |
| H3 | Haute | Confirmé | A04 / A05 | Contact : INSERT anon mondial, plafond global, pas de captcha serveur | `20261011090000_vitrine.sql`, `20261011120000_plafonds.sql` |
| M1 | Moyenne | Corrigé dans le dépôt, déploiement requis | A01 | Redirects Auth : `localhost` et `/auth/confirm` sans route front | `supabase/config.toml` L156–165, `app/routes.ts` |
| M2 | Moyenne | Corrigé dans le dépôt, déploiement requis | A07 | OTP en clair dans le **sujet** de l’email | `config.toml` L252–257 |
| M3 | Moyenne | Corrigé dans le dépôt, déploiement requis | A07 | Mot de passe admin : complexité vide, `secure_password_change = false` | `config.toml` L188, L232 |
| M4 | Moyenne | Confirmé | A07 | Session JWT dans `localStorage` | `app/lib/supabase.ts` L41–48 |
| M5 | Moyenne | Corrigé pour l’horodatage, limite de preuve restante | A04 (RGPD) | Consentement posé à la création du compte depuis les métadonnées client | `20261010120000_schema.sql` L213–223, `app/lib/auth.ts` L114–122 |
| M6 | Moyenne | Confirmé | A04 (RGPD) | Politique 24 mois / droits : pas d’implémentation (suppression, purge, messages) | `app/routes/confidentialite.tsx`, migrations |
| M7 | Moyenne | Corrigé dans le dépôt, déploiement requis | A05 | Schéma `graphql_public` exposé alors qu’il ne sert pas | `supabase/config.toml` L14 |
| HYP-M1 | Moyenne | Hypothèse | A07 | Préouverture antivirus du lien magique consommant le one-time token | `suivi-apres-lot0.md` point 8 |
| HYP-M2 | Moyenne | Hypothèse | A05 | Dérive config Auth hébergée vs `config.toml` du dépôt | non vérifiable ici |
| B1 | Basse | Confirmé | A05 | HSTS sans `includeSubDomains` ; dépend de `X-Forwarded-Proto` | `serveur/application.mjs` L34, L263–266 |
| B2 | Basse | Confirmé | A05 | Surfaces Supabase inutilisées (Storage 50 MiB, S3, Realtime) | `config.toml` |
| B3 | Basse | Confirmé | A01 | `logo_url` sans contrainte `https://` (colonne dormante) | `20261010120000_schema.sql` L29 |
| B4 | Basse | Confirmé | A05 | Pas de pipeline CI dans le dépôt | absence de `.github/` |
| B5 | Basse | Confirmé | A04 | Rate limit supervision **global** (pas par jeton) | `serveur/supervision.mjs` L365–372 |
| B6 | Basse | Confirmé | A04 | Piège « site_web » du contact uniquement dans le navigateur | `FormulaireContact.tsx` L62–63 |
| B7 | Basse | Confirmé | A05 | `ssl_enforcement` commenté dans la config locale | `config.toml` L78–80 |
| B8 | Basse | Confirmé | A01 | Lien confidentialité : `rel="noopener"` sans `noreferrer` | `FormulaireInscription.tsx` L163–167 |
| HYP-B1 | Basse | Hypothèse | A05 | Grants `service_role` non explicites sur les 10 tables du socle si le défaut Supabase change | migrations socle vs vitrine |
| I1 | Info | Confirmé | — | Hôte projet Supabase en dur dans le serveur (CSP de repli) | `serveur/application.mjs` L22 |
| I2 | Info | Confirmé | — | `pnpm audit` : 0 vulnérabilité | lockfile |
| I3 | Info | Confirmé | — | Mentions / confidentialité : encadrés organisateur vides | pages légales |
| I4 | Info | Confirmé | — | `.env.example` vide ; `.env.local` gitignoré (non lu) | `.gitignore`, `.env.example` |
| I5 | Info | Confirmé | — | Uploads utilisateur : aucune surface applicative | — |
| HYP-I1 | Info | Hypothèse | — | Écart RLS projet hébergé vs migrations (non poussées / partielles) | — |

### Détail

#### H1 — Auth OTP / signup sans captcha (Haute, confirmé)

**Correction dépôt** : Turnstile est transmis à `signInWithOtp` et `signInWithPassword`, le widget
échoue fermé, `[auth.captcha]` exige `TURNSTILE_SECRET_KEY`, et les inscriptions globales/email sont
fermées par défaut. L'activation hébergée reste une opération de déploiement à vérifier.

**Impact** : création de comptes, bombardement d’emails, tentatives d’OTP sur une adresse connue (y compris un email d’admin).  
**Exploitabilité** : triviale. La clé publishable est dans le bundle. `[auth.captcha]` est commenté. `enable_signup = true`. `demanderCode` appelle `signInWithOtp` avec `shouldCreateUser: true`.

Le drapeau `VITE_INSCRIPTION_OUVERTE` est lu au **build** et ne masque que l’UI (`inscription-ouverte.ts` L14–18). `/inscription` reste une route. L’API `/auth/v1/otp` n’en dépend pas.

```114:122:app/lib/auth.ts
export async function demanderCode(prenom: string, email: string): Promise<void> {
  try {
    const { error } = await (await supabase()).auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        data: { prenom, consentement: true },
        emailRedirectTo: typeof window === 'undefined' ? undefined : `${window.location.origin}/inscription/code`,
      },
    });
```

Limites actuelles : `email_sent = 2` / heure et SMTP intégré (adresses hors équipe souvent refusées). **Dès Brevo**, sans Turnstile, le finding devient immédiatement opérable à l’échelle.

**Remediation** : activer Turnstile (`[auth.captcha]`) **avant** d’ouvrir le SMTP et le drapeau ; passer `captchaToken` dans `signInWithOtp` ; optionnellement `enable_signup = false` tant que le public n’est pas prêt ; hook `before_user_created` si besoin d’une allowlist.

#### H2 — Administration sans AAL2 (Haute, confirmé)

**Correction dépôt** : la migration `20261012100000_securite_auth.sql` exige `aal2` dans
`prive.est_admin()` et pour un admin affecté comme juge. L'API de supervision vérifie aussi le claim
du jeton après validation par Auth. Le parcours `/admin` prend en charge enrôlement QR/secret et
challenge TOTP ; aucune configuration ni migration n'a encore été poussée au projet hébergé.

**Impact** : lecture PII (messages, profils), écriture planning / palmarès, stats de charge, notes de tous les votants (policies `est_admin()`).  
**Exploitabilité** : si le compte admin existe, le même OTP email 6 chiffres que le public authentifie (`enable_signup`, pas de captcha, TOTP `enroll_enabled` mais `prive.est_admin()` ne teste pas `aal`).

```5:11:supabase/migrations/20261010120100_regles_vote.sql
create function prive.est_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profils where id = auth.uid() and role = 'admin'
  )
$$;
```

La page `/admin` utilise `signInWithPassword` (12 caractères min, **sans** `password_requirements`). Rien n’empêche `signInWithOtp` sur le même email. Le serveur de supervision revérifie `profils.role` (bien) mais pas le facteur.

**Remediation** : dans `est_admin()`, exiger `(auth.jwt() ->> 'aal') = 'aal2'` ; interdire l’OTP pour les profils admin (hook) ou n’autoriser que le mot de passe + TOTP ; documenter l’enrôlement TOTP **avant** le premier admin réel.

#### H3 — Formulaire de contact abusables (Haute, confirmé)

**Impact** : spam de PII, saturation du plafond → déni de service du formulaire pour tout le monde, charge base.  
**Exploitabilité** : `INSERT` anon avec `with check (true)`, grants colonnes `prenom, email, message` seulement (mass assignment de `traite` bloqué — correct). Plafond **global** 10 messages / 10 minutes, un verrou advisory. Piège honeypot **uniquement** dans React : un POST REST direct le contourne. L’API Supabase accepte typiquement n’importe quelle origine (modèle SPA) : un site tiers peut poster.

```63:66:supabase/migrations/20261011090000_vitrine.sql
-- L'anti-robot (Turnstile) est prévu avant la mise en production publique (suivi lot 0, point 9).
create policy messages_contact_depot on public.messages_contact for insert to anon, authenticated
  with check (true);
```

**Remediation** : révoquer l’INSERT anon ; RPC `security definer` derrière Turnstile **ou** Edge Function serveur ; plafond **par IP / empreinte** en plus du global ; ne pas ouvrir le site public tant que ce n’est pas fait (déjà noté dans le suivi interne).

#### M1 — Redirects Auth trop larges (Moyenne, confirmé)

**Correction dépôt** : l'allowlist ne conserve que l'URL exacte de production
`/inscription/code` ; localhost et `/auth/confirm` ont été retirés.

`additional_redirect_urls` contient `http://localhost:5173/...` et `.../auth/confirm`. **Aucune route** `/auth/confirm` dans `app/routes.ts` : le serveur sert le repli 404 SPA. `detectSessionInUrl: true` peut quand même consommer un `code` / `access_token` dans l’URL.

Le commentaire du `config.toml` dit de retirer localhost avant le premier email réel.

**Remediation** : allowlist = origine de production + `/inscription/code` uniquement ; retirer localhost et `/auth/confirm` ; vérifier le projet hébergé (`supabase config push` / dashboard).

#### M2 — OTP dans le sujet d’email (Moyenne, confirmé)

**Correction dépôt** : les deux sujets ne contiennent plus `{{ .Token }}`.

```
subject = "Votre code d'inscription : {{ .Token }}"
```

Le code fuit vers prévisualisations lock-screen, journaux MTA, filtres, notifications push.

**Remediation** : sujet sans jeton (« Votre code d’inscription ») ; garder `{{ .Token }}` dans le corps uniquement.

#### M3 — Politique mot de passe admin faible (Moyenne, confirmé)

**Correction dépôt** : `lower_upper_letters_digits_symbols` et `secure_password_change = true`.

`password_requirements = ""`, `secure_password_change = false`, longueur 12. Un admin déjà authentifié (ou une session volée) peut changer le mot de passe sans réauth.

**Remediation** : `lower_upper_letters_digits_symbols` ; `secure_password_change = true`.

#### M4 — JWT dans localStorage (Moyenne, confirmé)

Choix supabase-js standard + PKCE. Toute XSS future = vol de session (refresh inclus). Mitigé par une CSP stricte (empreintes SHA-256, pas de `unsafe-inline` script, `connect-src` borné).

**Remediation** : conserver la CSP (tests de non-régression) ; à moyen terme cookies `HttpOnly` + `Secure` + `SameSite` via un BFF si le risque XSS augmente ; ne jamais relâcher `script-src`.

#### M5 — Consentement non prouvé (Moyenne, confirmé, RGPD)

**Correction partielle** : `consentement_le` prend désormais la valeur `email_confirmed_at`, à la
confirmation ou à la création déjà confirmée. La case reste déclarée dans des métadonnées client ;
l'horodatage est corrigé, mais ces métadonnées ne constituent pas à elles seules une preuve externe.

Le déclencheur copie `raw_user_meta_data->>'consentement' = 'true'` à l’**INSERT** `auth.users`, pas à la confirmation d’email. L’API Auth accepte n’importe quelles métadonnées : un client peut omettre le consentement ou l’affirmer sans cocher la case. Le front envoie `consentement: true` après validation UI seulement.

**Remediation** : poser `consentement_le` uniquement quand `email_confirmed_at` passe à non null ; ignorer la métadonnée client comme source de vérité ; purge des comptes non confirmés (pg_cron 7 jours).

#### M6 — Droits RGPD non câblés (Moyenne, confirmé)

La page confidentialité promet suppression des spectateurs inactifs à 24 mois, retrait du consentement, exercice des droits. Dans le code : pas de `deleteUser`, pas de job de purge des `profils` / `auth.users`, pas de purge `messages_contact`, pas d’UPDATE de `consentement_le` (seule la colonne `prenom` est granted en UPDATE). L’admin authentifié n’a pas le GRANT DELETE sur les messages.

**Remediation** : Edge Function `service_role` pour l’effacement (prévu lot 2) ; pg_cron 24 mois + rétention contact documentée ; voie de retrait du consentement.

#### M7 — `graphql_public` exposé (Moyenne, confirmé)

**Correction dépôt** : seul le schéma `public` reste exposé dans `config.toml`.

`schemas = ["public", "graphql_public"]`. Surface GraphQL supplémentaire, RLS encore applicable, mais pas utilisée.

**Remediation** : retirer `graphql_public` tant que pg_graphql ne sert pas.

#### HYP-M1 — Prefetch du lien magique (Moyenne, hypothèse)

Un scanner qui GET `ConfirmationURL` peut consommer le one-time token. Le front utilise PKCE + page `/inscription/code`. À valider avec un vrai email + antivirus.

**Remediation si confirmé** : page intermédiaire, `verifyOtp` seulement au clic (`token_hash`).

#### HYP-M2 — Dérive de configuration hébergée (Moyenne, hypothèse)

`supabase config push` n’est pas simulable. Le dépôt n’est pas la preuve que le projet `khwlwpzydlrfocfpvywv` a les mêmes redirects / captcha / SMTP.

**Remediation** : diff dashboard vs `config.toml` à chaque release Auth.

#### B1 — HSTS

`Strict-Transport-Security: max-age=31536000` seulement si `x-forwarded-proto === 'https'`. Pas `includeSubDomains`. L’en-tête est spoofable si l’origine Node est joignable en HTTP hors edge (Railway termine généralement le TLS).

#### B2 — Surfaces mortes Supabase

Storage 50 MiB, protocole S3, Realtime on. Pas de buckets ni d’usage front. Réduire la surface dashboard.

#### B3 — `logo_url`

Texte libre, pas de `^https://`. Non rendu aujourd’hui. Quand un `<img src={logo_url}>` apparaîtra, risque d’URL non https.

#### B4 — Pas de CI

Les tests RLS existent (`pnpm test:db`) mais rien ne les force sur une PR.

#### B5 — Rate limit admin global

60 req / minute **toutes sessions confondues** + 4 simultanées. Un client peut gêner le cockpit, pas l’élever. Les métriques n’incluent pas d’IP (bon pour le RGPD).

#### B6–B8

Honeypot UI-only ; SSL local non forcé (le cloud Supabase est en TLS côté client) ; `noopener` sans `noreferrer` sur un lien **même origine** (`/confidentialite`) : impact négligeable.

### Non-findings (contrôles vérifiés, pas des failles)

| Sujet | Constat |
| --- | --- |
| Élévation de rôle | `grant update (prenom)` + trigger `figer_role_profil` ; rôle forcé `spectateur` à la création |
| IDOR notes / avis / file | `votant_id` / `juge_id` = `auth.uid()` ; clés figées à l’UPDATE ; jury lié à `soiree_juges` |
| Mass assignment contact | pas de grant sur `traite`, `id`, `cree_le` |
| Injection SQL | PostgREST / `searchParams` / RPC typés ; `search_path = ''` |
| XSS stockée | pas de `dangerouslySetInnerHTML` / `eval` ; React échappe `message_public`, palmarès, contact |
| CSRF votes | Authorization Bearer depuis JS, pas de cookie de session applicatif |
| Path traversal statique | index mémoire des fichiers du build, pas de lecture disque par requête |
| Open redirect 301 | segments vides filtrés (`application.mjs` L249–251) |
| Worker file notes | `FILE_NOTES_ACTIVE === 'true'` opt-in ; RPC `traiter_file_notes` refuse tout sauf `service_role` |
| Planning | clé publishable seulement, TTL 5 s, limite 1 Mo, pas de votes dans le cache |
| Supervision | JWT validé via `/auth/v1/user` puis `profils.role` ; pas d’IP / jeton dans les logs métier |
| Secrets git | `.env` / `.env.*` ignorés ; `.env.example` vide ; `pnpm audit` propre |
| Uploads | aucun |

## 5. Points positifs

1. **RLS dès la première migration**, revoke des défauts anon/authenticated, grants reconstruits explicitement.
2. Schéma `prive` sans USAGE pour anon/authenticated ; fonctions de règles testées (`catalogue.test.ts`).
3. Défense en profondeur rôle : grant de colonne **et** trigger.
4. File de notes : admission synchrone avec email vérifié + passage votable ; worker borné ; pas de jeton dans l’outbox IndexedDB.
5. CSP pages avec empreintes SHA-256 des scripts inline, `base-uri none`, `form-action self`, `frame-ancestors none`, `X-Frame-Options DENY`, `COOP`, `Permissions-Policy` restrictive, `nosniff`.
6. Serveur statique sans dépendance, allowlist de fichiers, 405 hors GET/HEAD.
7. `service_role` jamais préfixé `VITE_` ; worker et métriques côté Node.
8. Tests DB d’IDOR (votes, jury, planning, vitrine) — à garder comme filet.
9. Pages légales déjà structurées (bases légales, sous-traitants Railway/Supabase, pas de tracker pub).
10. PKCE, rotation des refresh tokens, confirmations email, signup anonyme désactivé, mot de passe min. 12.

## 6. Plan de remediation priorisé

### P0 — avant SMTP public / `VITE_INSCRIPTION_OUVERTE=true`

1. Turnstile Auth **et** contact (H1, H3).
2. Remplacer l’INSERT anon contact par une fonction serveur (H3).
3. Exiger AAL2 dans `prive.est_admin()` ; enrôler TOTP avant le premier admin (H2).
4. Purger l’allowlist redirects : plus de localhost ni `/auth/confirm` (M1).
5. Retirer `{{ .Token }}` des sujets d’email (M2).

Exemple `est_admin` :

```sql
create or replace function prive.est_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profils
    where id = auth.uid() and role = 'admin'
  )
  and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;
```

Exemple politique contact (après RPC) :

```sql
revoke insert on public.messages_contact from anon, authenticated;
-- grant execute on function public.deposer_message_contact(...) to anon;
drop policy if exists messages_contact_depot on public.messages_contact;
```

### P1 — durcissement admin et Auth

6. `password_requirements` + `secure_password_change = true` (M3).
7. Consentement à la confirmation email + cron comptes non confirmés (M5).
8. Retirer `graphql_public` (M7).
9. Vérifier le projet hébergé vs `config.toml` (HYP-M2).

### P2 — RGPD opérationnel (avec Rebecca)

10. Suppression de compte (Edge Function) + purge 24 mois + rétention messages (M6).
11. Remplir responsable de traitement / DPA (I3) — pas un fix code seul.

### P3 — hygiène

12. HSTS `includeSubDomains` au reverse proxy (B1).
13. Désactiver Storage/Realtime inutiles (B2).
14. Contrainte `https://` sur `logo_url` (B3).
15. CI : `pnpm test` + `pnpm audit` sur chaque PR (B4).
16. Grants explicites `service_role` sur les 10 tables socle (défense / changelog Supabase).

## 7. Conclusion

Le projet n’est **pas** une coquille vide sécuritaire : le modèle RLS est cohérent, testé, et le serveur de prod montre une vraie discipline (CSP, pas de `service_role` au client, file de votes bornée). Les trois findings hauts sont des **trous d’abus et d’administration**, pas des bypass de policies. Ils sont déjà largement identifiés dans `docs/superpowers/plans/suivi-apres-lot0.md` ; l’audit confirme qu’ils sont **toujours ouverts dans le code du 12 octobre 2026**.

Ne pas ouvrir inscriptions ni SMTP public tant que P0 n’est pas fait. Après P0+P1, un score 8,5/10 est réaliste sans sur-ingénierie (pas de WAF requis pour ce volume).

**Mémoire Casey** : MCP agent-memory indisponible (namespace en erreur) — rien n’a été stocké hors de ce fichier.
