# Olympiade Manade

Le livrable actuel est une **vitrine hors soirée** : accueil, programme, palmarès éditorial et contact. Le dépôt contient aussi le socle SQL/RLS, une saisie de notes avec file durable désactivée par défaut et une administration de supervision. Il ne permet pas encore de piloter une soirée complète.

Le [CDC de référence](docs/CDC-MASTER.md) distingue ce livrable de la cible « app de soirée ». Le modèle implémenté en base est celui du CDC : **note publique entière de 1 à 10**, jury sur **10 ou 20** par demi-point, résultats séparés ou combinés et agrégation par moyenne ou points de place. Le moteur de classement et ses écrans restent à construire. Les critères personnalisés, étoiles/favoris pour les passages et coefficients par épreuve décrits dans la recherche ne font pas partie de cette implémentation.

La [recherche historique](docs/recherche-olympiades.md) conserve les sources et les pistes explorées ; elle ne constitue pas une seconde spécification. Le nom officiel, la soirée pilote et les coordonnées de l’organisateur restent à confirmer dans le CDC §10.

Les inscriptions publiques et le traitement des notes restent fermés. Le captcha, la configuration Auth hébergée, le SMTP et la recette de la soirée doivent être validés avant leur ouverture. Les fichiers du dépôt ne prouvent pas que la configuration Supabase ou le déploiement Railway sont à jour.

## Accès réservé prélancement

Avant le lancement public, tout le site peut être fermé aux visiteurs qui n’ont pas reçu un lien secret. Définir `ACCES_TOKEN` (minimum 32 caractères, par exemple `openssl rand -hex 24`) ferme tout le site : pages, assets et `/api/*` répondent **401 « Accès réservé »** sauf lorsque l’ordinateur présente le cookie `olympiade_acces`.

Le lien à transmettre est `https://<site>/?acces=<ACCES_TOKEN>`. Lors de la première ouverture, le serveur pose un cookie durable (un an, `HttpOnly`, `SameSite=Lax`, `Secure` derrière HTTPS) dont la valeur est un HMAC-SHA256 du token — le token lui-même n’apparaît jamais dans le cookie — puis redirige en 303 vers la même URL sans le paramètre `acces`. Les navigations suivantes passent librement.

La route `/sante` reste toujours ouverte (healthcheck Railway, désormais `healthcheckPath = /sante`). Pour lever la barrière, retirer la variable `ACCES_TOKEN` du service et redéployer. En local, la variable est absente de `.env.example` par défaut, et aucun test (unit, e2e) ne la pose : le comportement non protégé reste inchangé.

## Configuration des corrections de sécurité

Copier `.env.example` vers `.env.local` pour les essais ; les secrets restent hors de Git et hors des variables `VITE_`.

- `VITE_TURNSTILE_SITE_KEY` : clé publique au build pour les formulaires OTP, connexion admin et contact.
- `TURNSTILE_SECRET_KEY` : secret côté serveur pour le contact et côté Supabase Auth via `[auth.captcha]`. La configuration Auth exige ce secret ; son absence ne doit jamais conduire à désactiver le captcha.
- `SUPABASE_SERVICE_ROLE_KEY` : clé serveur pour le contact et les traitements internes. Sans configuration complète, le contact refuse les dépôts.
- `CONTACT_ORIGIN` : origine exacte du site (schéma et domaine), contrôlée avec l’origine de la requête et le domaine renvoyé par Turnstile. `CONTACT_TRUST_PROXY` reste faux sauf si l’ingress garantit un en-tête d’adresse fiable.
- `VITE_INSCRIPTION_OUVERTE=false` et `FILE_NOTES_ACTIVE=false` : conserver ces valeurs pour la vitrine. `enable_signup=false` ferme aussi les créations de compte dans Auth ; le drapeau Vite seul ne protège pas son API.

Appliquer les nouvelles migrations après recette SQL : AAL2 admin et consentement à la confirmation email, fermeture des insertions directes du contact, annuaire et règle d’ouverture des avis. Les admins doivent configurer leur application TOTP sur `/admin`, puis vérifier le code avant d’accéder à la supervision. Un rôle admin avec une session AAL1 ne suffit plus, y compris en appel direct à la base.

Avant déploiement, vérifier le diff Auth avec `scripts/supabase-config-diff.exp` dans un environnement disposant du secret Turnstile, puis appliquer la configuration cible. Le contact requiert aussi la configuration du domaine autorisé dans Turnstile. Le serveur Vite de développement ne fournit pas `/api/contact` : utiliser le build avec `pnpm start` pour ce parcours.

Le contrôle de santé Railway utilise `/admin` pour refuser un build qui ne sert pas cette route. La mise à jour du dépôt n’entraîne pas à elle seule un déploiement ; vérifier après publication les réponses HTTP de `/admin` et `/admin/statistiques` ainsi que le refus des API administratives sans session AAL2.

Le contact conserve les messages en base. L’envoi d’un email à l’organisateur, l’effacement des comptes et la purge de rétention restent à mettre en place avant de les annoncer comme disponibles. L’adresse destinataire et la configuration SMTP ne sont pas renseignées dans le dépôt.

Recette locale du 12 octobre 2026 : `pnpm test` **306/306**, TypeScript sans erreur, Playwright **214 réussis et 2 ignorés**, build réussi. Les tests navigateur simulent Supabase Auth et Turnstile ; ils ne valident pas le SMTP ni les clés du projet hébergé. Les modifications et les quatre nouvelles migrations ne sont pas déployées : les routes `/admin` et `/admin/statistiques` de la production répondent encore 404. La publication attend la configuration des services ; aucune inscription ni file de notes n’a été ouverte.

## Supervision et capacité

L'administration est accessible depuis le pied de page ou `/admin`, avec le mot de passe et un second facteur TOTP d'un compte existant dont le profil est `admin`. L'écran `/admin/statistiques` montre les comptes actifs, les notes enregistrées, la base, les erreurs, les transferts et les ressources du serveur, avec historique et export CSV. Les accès sont contrôlés dans l'API et dans PostgreSQL.

La cible de **5 000 personnes simultanées n'est pas certifiée**. Voir l'[audit de capacité](docs/audit-charge-5000.md), les mesures locales et les scénarios de préproduction à 5 000 puis 7 500 votants.

La [file durable des notes](docs/file-notes.md) relie maintenant `/noter` au stockage local IndexedDB puis à une file PostgreSQL traitée par petits lots. La supervision montre son attente et les traitements actifs. Il faut appliquer ses migrations et l'activer explicitement avec `FILE_NOTES_ACTIVE=true` ; une note « reçue » reste distincte d'une note « enregistrée ».

Pour lancer la version avec supervision :

```sh
pnpm install --frozen-lockfile
# Renseigner .env.local à partir de .env.example, puis :
pnpm build
pnpm start
```

`pnpm start` charge `.env.local` si présent ; les variables déjà définies sur Railway restent prioritaires. Le serveur utilise `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` à l'exécution pour vérifier les sessions. Le serveur de développement Vite ne porte pas l'API de supervision.

La migration `supabase/migrations/20261011130000_supervision.sql` doit être appliquée au projet cible. Pour conserver les agrégats après un redémarrage, renseigner **uniquement côté serveur** `SUPABASE_SERVICE_ROLE_KEY` (jamais avec le préfixe `VITE_`). Sans cette clé, les mesures locales restent disponibles mais l'historique serveur est perdu au redémarrage. Le code ne crée aucun compte administrateur et ne change pas les forfaits d'hébergement.

La présence est estimée avec un signal espacé de 60 à 75 secondes, seulement pour les comptes connectés dont l'application est visible. Les mesures sont regroupées par minute et les données de plus de 30 jours sont purgées au prochain nettoyage horaire tant que le service de persistance tourne. Si le service est arrêté ou la clé manque, cette purge doit être reprise lors de sa remise en service. Aucun email, IP, jeton ou contenu des notes n'est stocké dans les agrégats.

Le p95 est estimé avec des compartiments d'histogramme ; dans l'export, la valeur `3001` signifie **plus de 3 000 ms**, sans borne supérieure connue. Les octets représentent les tailles de corps annoncées par le serveur, hors en-têtes, et peuvent surestimer une réponse interrompue par le client. Les erreurs 5xx n'incluent pas toutes les coupures réseau.

```sh
pnpm test
pnpm typecheck
pnpm exec playwright test tests/e2e/supervision.spec.ts
# Benchmark PostgreSQL local jetable uniquement, pas un test du service hébergé :
node scripts/charge/benchmark-local.mjs
```

Le [dossier illustré du 11 octobre 2026](docs/pdf/olympiade-des-manades-dossier-fonctionnel-illustre.pdf) est une archive de conception : ses maquettes et options de notation ne décrivent pas l’état livré. Pour le périmètre et l’avancement actuels, consulter le CDC §1.1 et §9.1.
