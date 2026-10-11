# Audit de capacité — 5 000 votants simultanés

Configuration distante vérifiée le **11 octobre 2026 à 07:36 CEST**. Cet audit est en lecture seule sur les services hébergés : aucune charge n'a été envoyée en production, aucun compte de production n'a été créé et aucune configuration distante n'a été modifiée. Les benchmarks décrits plus bas utilisent uniquement des bases locales jetables.

## Verdict

La plateforme **n'est pas certifiée pour 5 000 votants simultanés** à ce stade. Le schéma et ses politiques RLS ont un bon comportement sur un benchmark PostgreSQL local, mais ce résultat ne couvre ni l'API HTTP Supabase, ni Auth, ni le réseau, ni le compute hébergé. Il manque surtout un environnement de staging représentatif et un essai complet à 7 500 utilisateurs, soit la marge de 1,5 demandée pour 5 000 personnes.

L'inscription publique est actuellement bloquante en production : le projet utilise le SMTP intégré Supabase, limité à 2 emails par heure et aux adresses de l'équipe. La configuration Auth distante garde aussi `site_url = http://localhost:5173` et un redirect `http://localhost:5173/**`. Le compute Supabase et le quota Realtime réellement attaché au projet n'ont pas pu être lus par la CLI ; ils restent inconnus et ne doivent pas être déduits du plan Railway.

## Configuration constatée

### Railway

Commande en lecture seule :

```sh
railway status \
  --project 5b32eb56-c3f7-4590-a510-2b1beb39f666 \
  --environment 592428ae-92ca-46d9-84e7-1d8f6ddd507c \
  --json
```

Résultat : plan Pro, service `olympiade_manade` (`f3df98c1-2705-4def-86e6-4869f8a4c2ab`), une réplique en `europe-west4-drams3a`, plafond volontaire de **1 vCPU et 1 000 000 000 octets de mémoire**, domaine `olympiademanade-production.up.railway.app`. Le déploiement actif est `2e9bf8c234c9f3cabef65bd5a3eabc021603d8e4`, branche `feat/lot-vitrine`, statut `SUCCESS` avec une instance `RUNNING`.

Railway précise qu'un plan augmente les plafonds disponibles sans garantir les performances. Les répliques supplémentaires sont configurées manuellement, et la répartition de charge se fait entre les répliques d'une région. Sources : [plans Railway](https://docs.railway.com/pricing/plans), [optimisation et répliques](https://docs.railway.com/deployments/optimize-performance), [dimensionnement depuis les métriques](https://docs.railway.com/guides/right-size-cpu-memory).

Conséquence : le service statique a aujourd'hui un point de panne unique et son plafond CPU est très inférieur au plafond Pro. Cela ne prouve pas qu'il échouera à servir la page, mais impose une mesure du démarrage de soirée et des assets avec les métriques CPU, mémoire, connexions et latence. Les lectures d'état, les votes et les signaux de présence vont directement vers Supabase ; leur débit ne doit pas être attribué au serveur Railway.

### Supabase

`supabase projects list --output json` confirme le projet `khwlwpzydlrfocfpvywv`, région `eu-west-3`, état `ACTIVE_HEALTHY`, PostgreSQL **17.11.0.003**. `supabase postgres-config get --experimental --project-ref …` ne retourne aucun override PostgreSQL.

Le script de diff en lecture seule `expect scripts/supabase-config-diff.exp` répond `n` à chaque proposition. Il indique que l'API, la base et le stockage distants correspondent au fichier local ; dans Auth, les seuls écarts affichés sont :

- distant : `site_url = http://localhost:5173` et `additional_redirect_urls = ["http://localhost:5173/**"]` ;
- dépôt : URL Railway et redirects précis de connexion.

Comme le SMTP et les limites Auth ne figurent pas dans le diff, la configuration distante correspond au fichier local sur ces points : pas de SMTP personnalisé, 2 emails par heure, 30 inscriptions/connexions par 5 minutes et par IP, 30 vérifications par 5 minutes et par IP, 150 refreshs de jeton par 5 minutes et par IP, délai de 60 secondes avant un nouvel envoi au même utilisateur.

Les documents Supabase confirment que le SMTP intégré est réservé aux essais, n'envoie qu'aux adresses autorisées de l'équipe et est actuellement limité à 2 emails par heure. Avec un SMTP personnalisé, la limite initiale est 30 emails par heure et doit être relevée explicitement. Sources : [SMTP personnalisé](https://supabase.com/docs/guides/auth/auth-smtp), [limites Auth](https://supabase.com/docs/guides/auth/rate-limits).

Le **plan Supabase, la taille de compute et le statut du spend cap restent non vérifiés**. La CLI authentifiée ne les expose pas. L'API Management documentée permet de les lire, mais le credential chiffré utilisé par la CLI n'est pas directement réutilisable comme PAT ; une requête directe a répondu 401. Il faudra lire `infra_compute_size` depuis l'API Management avec un PAT en lecture seule ou depuis le Dashboard avant le test de staging.

À titre de bornes, Supabase annonce 60 connexions PostgreSQL directes et 200 clients du pooler pour Micro, 90/400 pour Small. Ces chiffres sont des connexions de base et de pooler ; **5 000 requêtes de navigateurs ne sont pas 5 000 connexions PostgreSQL directes**. PostgREST et le pool multiplexent les requêtes, et leur capacité réelle dépend du compute, de la taille du pool et des autres services Supabase. Sources : [compute et disque](https://supabase.com/docs/guides/platform/compute-and-disk), [gestion des connexions](https://supabase.com/docs/guides/database/connection-management).

Realtime n'est pas un substitut au polling public sans réglage préalable. Les limites publiées sont 500 connexions et 500 messages/s sur Pro standard, contre 10 000 connexions et 2 500 messages/s sur Pro sans spend cap. Le CDC réserve donc correctement Realtime aux admins, juges et écran géant. Source : [limites Realtime](https://supabase.com/docs/guides/realtime/limits).

## Budget de trafic

Les débits ci-dessous sont des calculs de dimensionnement, pas des mesures de production.

| Flux | 5 000 utilisateurs | 7 500 utilisateurs |
|---|---:|---:|
| Lecture de `etat_soiree` toutes les 10 s | 500 req/s | 750 req/s |
| Signaux de présence, jitter uniforme 60–75 s | 74,1 req/s en moyenne | 111,1 req/s en moyenne |
| Signaux au bord bas de 60 s | 83,3 req/s | 125 req/s |
| Un vote réparti sur 60 s | 83,3 écritures/s | 125 écritures/s |
| Un vote réparti sur 30 s | 166,7 écritures/s | 250 écritures/s |
| Tous votent ensemble | burst de 5 000 | burst de 7 500 |

Le nominal 5 000 additionne donc environ **657 requêtes/s** vers Supabase pendant une minute de vote : 500 lectures, 83 votes et 74 signaux. La cible de sécurité à 7 500 approche **986 requêtes/s**. Un retour collectif sur l'application, une reconnexion réseau ou un timer remis en phase peut produire un burst supérieur à la moyenne du heartbeat.

La ligne `etat_soiree` et son recalcul n'existent pas encore dans les migrations auditées. Le poll toutes les 10 secondes décrit dans le CDC n'est donc pas testable de bout en bout. La page `/noter` reste un écran d'annonce : le chemin client qui envoie réellement une note n'est pas encore présent. Ces absences interdisent de conclure sur les 500 lectures/s ou sur les erreurs perçues par l'utilisateur.

## Mesure locale RLS

Le 11 octobre 2026 à 07:35 CEST, `node scripts/charge/benchmark-local.mjs` a créé la base locale jetable `olympiade_charge_test`, appliqué les migrations jusqu'à `20261011120000_plafonds.sql`, créé 5 000 comptes vérifiés, puis exécuté chaque upsert dans une transaction avec `request.jwt.claims` et `SET LOCAL ROLE authenticated`. La base a été supprimée après contrôle de l'intégrité.

Machine : PostgreSQL 18.3 Homebrew sur Apple Silicon, 18 CPU logiques, Node 24.19.0. Pool local de 32 connexions.

| Phase | Opérations | Durée | Débit | p50 | p95 | p99 | max |
|---|---:|---:|---:|---:|---:|---:|---:|
| Première note, insert RLS | 5 000 | 3,096 s | 1 615/s | 9,5 ms | 77,8 ms | 157,1 ms | 335 ms |
| Changement de note, update RLS | 5 000 | 1,914 s | 2 613/s | 6,9 ms | 35,0 ms | 70,3 ms | 226 ms |

Contrôle final : exactement 5 000 notes, toutes mises à jour à la valeur attendue ; aucune perte locale.

Un second passage à 7 500 utilisateurs a aussi validé l'assertion d'intégrité : 7 500 notes exactes après insert puis modification. Il s'est déroulé pendant une contention WAL sur le PostgreSQL local partagé et n'est donc pas une référence isolée : 208,8 insertions/s (p95 483,4 ms) puis 284,7 modifications/s (p95 330,6 ms). Cette mesure contaminée reste supérieure aux débits étalés calculés de 125 à 250 écritures/s, mais elle ne qualifie toujours pas un burst HTTP ni la production.

Cette mesure montre que les fonctions RLS et l'upsert ne constituent pas, sur cette machine, un verrou évident aux débits calculés de 83 à 250 écritures/s. Elle **ne prédit pas** le débit du compute Supabase : version PostgreSQL, CPU, mémoire, I/O, PostgREST, TLS, latence, Auth et réseau diffèrent. Elle ne certifie pas non plus un burst de 5 000 requêtes HTTP simultanées.

Le script refuse tout hôte non local et tout nom ne finissant pas par `_charge_test`. Paramètres reproductibles :

```sh
CHARGE_USERS=5000 CHARGE_CONCURRENCY=32 \
  CHARGE_DB_NAME=olympiade_charge_test \
  node scripts/charge/benchmark-local.mjs
```

## Harnais k6 de staging

`scripts/charge/k6-votes.js` envoie les requêtes par le protocole public réel : clé publishable, JWT individuel `authenticated`, RLS active et upsert REST. Chaque vote accepté est relu immédiatement avec la même session et doit correspondre exactement à l'utilisateur et à la note. Le harnais exerce en parallèle les lectures de `etat_soiree` à `VOTERS / 10` requêtes par seconde et l'appel de présence à raison d'un signal par utilisateur toutes les 67,5 secondes.

Garde-fous :

- `TARGET_ENV=staging` et la phrase d'opt-in exacte sont obligatoires ;
- l'URL doit être le domaine Supabase exact de `EXPECTED_PROJECT_REF` ;
- la référence de production connue `khwlwpzydlrfocfpvywv` est refusée ;
- une clé `service_role` est refusée ;
- le fichier doit fournir exactement 5 000 ou 7 500 couples `{ "userId", "accessToken" }` uniques ;
- chaque JWT doit avoir le rôle `authenticated`, le bon `sub`, le bon issuer et au moins cinq minutes de validité ;
- le harnais ne crée aucun compte, n'envoie aucun OTP et ne supprime aucune donnée.

Les fixtures sont à préparer dans **un projet de staging** avec un passage ouvert et un instantané existant. Exemple pour 5 000 votes étalés sur 60 secondes :

```sh
k6 run \
  -e ALLOW_STAGING_LOAD=YES_I_OWN_THIS_STAGING \
  -e TARGET_ENV=staging \
  -e EXPECTED_PROJECT_REF=xxxxxxxxxxxxxxxxxxxx \
  -e SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co \
  -e SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx \
  -e SESSIONS_FILE=./sessions.staging.json \
  -e PASSAGE_ID=00000000-0000-4000-8000-000000000000 \
  -e SOIREE_ID=00000000-0000-4000-8000-000000000000 \
  -e VOTERS=5000 \
  -e PROFILE=spread60 \
  scripts/charge/k6-votes.js
```

Profils disponibles : `spread60`, `spread30` et `burst`. Pour la certification, relancer les scénarios utiles avec `VOTERS=7500`. Les votes et leur relecture ont une tolérance d'erreur nulle ; les flux d'état et de présence doivent rester sous 0,1 % d'erreur, le p95 du vote sous 1 seconde, aucune itération ne doit être abandonnée et tous les contrôles d'intégrité doivent réussir.

Les profils utilisent un VU par votant pour garantir une session indépendante. Une machine génératrice peut devenir le goulot d'étranglement à 7 500 VU ; surveiller son CPU, sa mémoire, ses sockets et son réseau, ou répartir la charge entre plusieurs générateurs. Un échec du générateur ne doit pas être attribué à Supabase.

Ce harnais couvre un événement court d'environ une minute. Il est **préliminaire** : la certification doit aussi inclure une montée progressive, un palier d'endurance représentatif de toute la soirée et une descente gracieuse. L'absence de `etat_soiree` ou de la RPC `enregistrer_presence` fait volontairement échouer les seuils ; le test ne masque pas une brique manquante.

Vérifications locales effectuées : analyse syntaxique Node, refus d'un `PGHOST` distant et d'un nom de base non jetable, refus k6 sans opt-in et refus explicite de la référence Supabase de production. `k6 inspect` atteint ensuite la validation stricte du fichier de sessions ; l'exécution réseau n'a pas eu lieu faute de staging et de 5 000 JWT de test.

## Conditions avant certification

1. Corriger les URL Auth de production, configurer Brevo et relever les limites d'email, OTP, vérification et refresh selon le scénario d'inscription ; valider aussi le comportement derrière une adresse IP partagée d'arène.
2. Relever et archiver le plan, le spend cap, la taille compute, les connexions/pools, les limites Realtime et les métriques de la base Supabase.
3. Mettre en place `etat_soiree`, son recalcul borné et le vrai parcours de vote ; vérifier qu'un poll retourne une seule petite ligne et qu'aucune lecture de notes brutes n'est possible.
4. Créer un staging de même taille que la production, avec 7 500 sessions de test précréées sans email réel.
5. Exécuter `spread60`, `spread30`, puis `burst` en observant simultanément k6, Supabase (CPU, mémoire, I/O, pool, PostgREST, verrous, erreurs Auth/429) et Railway (CPU, mémoire, connexions, latence, 5xx).
6. Vérifier après chaque essai le nombre exact de notes uniques, les valeurs attendues, l'absence d'écriture au nom d'un autre utilisateur et la latence visible du déblocage sous 10 secondes.
7. Refaire un essai avec réseau dégradé et reconnexion groupée ; documenter la file locale et l'idempotence de l'upsert.

La certification ne peut être prononcée qu'après ces mesures hébergées et un contrôle d'intégrité complet. Le benchmark local constitue une base de comparaison, pas une preuve de capacité de production.
