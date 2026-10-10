# Suivi après les lots 0A et 0B

Points relevés par les relectures des lots 0A et 0B. Chacun a une échéance : il doit être traité avant l'étape indiquée.

## Avant le premier `config push` du lot front

1. **Rendre la procédure de push Auth sûre et versionnée.**
   - `supabase config push` n'a pas de mode simulation.
   - Versionner deux scripts `expect` dans `scripts/` : l'un affiche le diff en répondant « n », l'autre pousse seulement la partie Auth.
2. **Mettre à jour la CLI Supabase** (v2.95.4 installée, v2.120.0 disponible). Relire ensuite le diff de `config.toml` avant tout push.

## Avant le 30 octobre 2026 et à chaque nouvelle table

3. **Droits explicites pour `service_role`.**
   - Écrire une nouvelle migration qui accorde explicitement `select, insert, update, delete` à `service_role` sur les 10 tables. Ne pas modifier les 5 migrations déjà poussées.
   - Faire de même dans chaque migration qui crée une table.
   - Passer le bouchon de test sur les nouveaux défauts de Supabase (aucun droit par défaut), pour que le test de catalogue échoue si un droit manque.
   - Source : [changelog Supabase 45329](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

## Avant de créer le premier compte admin

4. **Exiger un second facteur pour l'admin.**
   - Aujourd'hui, un compte admin reste joignable par le simple code à 6 chiffres envoyé par email.
   - Exiger `aal2`, donc un TOTP, dans `prive.est_admin()`.
5. **Traduire en français les gabarits restants** (`recovery`, `email_change`, `invite`, `reauthentication`).
6. Passer `secure_password_change` à `true`.

## Avant le premier email envoyé à un vrai spectateur

7. **URL de production.**
   - Mettre l'URL de production dans `site_url`.
   - Retirer `localhost` des redirections, en remplaçant `/**` par des chemins précis.
8. **Lien de secours des emails.**
   - Vérifier qu'un antivirus qui préouvre le lien n'invalide pas le code.
   - Si c'est le cas, remplacer le lien par une page du front qui appelle `verifyOtp` seulement sur un clic (`token_hash`).
9. **Brevo et Turnstile, dans le même lot.**
   - Brevo : SMTP dans `config.toml` via `env(...)`, avec la limite `email_sent` relevée.
   - Limites par IP relevées pour les arènes, où beaucoup de spectateurs partagent la même adresse.
   - Turnstile activé en même temps, pas après.

## Lot 2 (vote et classements)

10. **Ouverture des avis en mode déblocage.**
    - Aujourd'hui, `avis_ouvert` peut s'ouvrir alors qu'un passage est encore ouvert.
    - Exiger qu'aucun passage ne soit ouvert, ou s'appuyer sur le statut `terminee`.
11. **Figer les résultats** au passage de la soirée en `terminee`. Sinon, la purge RGPD des comptes modifierait les classements après coup.
12. **Recalculer les résultats après le verrouillage du jury.** Il existe une course théorique avec une note en cours d'envoi.

## Passe de tests (sans faille connue derrière)

- Gel du barème testé avec une seconde soirée.
- Bornes des notes, côté public et côté jury.
- Juge détaché ou rétrogradé après avoir noté.
- Lecture des notes du jury en spectateur et en anon.
- `security definer` vérifié par le test de catalogue sur les 7 fonctions de règles.
- Test du déclencheur `figer_role_profil` seul.

## Petits durcissements

- Imposer SSL sur la base : `supabase ssl-enforcement update --enable-db-ssl-enforcement --experimental`.
- Index manquants : `soiree_manades.manade_id`, `soiree_juges.juge_id`, `passages.manade_id`.
- Advisors de performance : 6 avertissements de politiques permissives multiples, à revoir au test de charge du lot 6.
- Retirer `graphql_public` des schémas exposés tant qu'il ne sert pas.
- Désactiver les clés API legacy quand les nouvelles clés seront en place.

## Avant d'ouvrir les inscriptions au public (drapeau `VITE_INSCRIPTION_OUVERTE`)

Relectures des lots Vitrine 5 et 6, le 10/10/2026. **Ordre obligatoire** :

1. **Turnstile d'abord.**
   - Supabase : `[auth.captcha] enabled = true`, `provider = "turnstile"`, secret via `env(...)`.
   - Front : `captchaToken` passé dans `signInWithOtp`.
   - CSP : `https://challenges.cloudflare.com` ajouté dans `script-src`, `frame-src` et `connect-src`.

   Sans Turnstile, l'API `/auth/v1/otp` est appelable par n'importe qui avec la clé publique, même drapeau fermé.
2. **Consentement prouvé.** Une migration pose `consentement_le` seulement à la confirmation de l'email (déclencheur sur `email_confirmed_at`). Une purge pg_cron supprime les comptes non confirmés depuis plus de 7 jours.
3. **SMTP Brevo.**
   - Le SMTP intégré de Supabase n'envoie qu'aux membres de l'équipe, 2 emails par heure.
   - Relever `email_sent` et les limites par IP pour les soirées.
   - Retirer les URL `localhost` et `/auth/confirm` des redirections.
   - Pousser la configuration Auth avec `scripts/supabase-config-push-auth.exp`, après le diff.
4. **Ouverture.** Poser la variable Railway `VITE_INSCRIPTION_OUVERTE=true`, puis redéployer.
5. **Vérification réelle.** Une inscription de bout en bout avec une vraie adresse, puis la suppression du compte de test.

## Juridique (relecture du lot Vitrine 5)

- **DPA (art. 28 RGPD).** Accepter le DPA de Railway et celui de Supabase. Confirmer que les clauses contractuelles types y figurent, quelle que soit l'entité signataire (Supabase Pte. Ltd., Singapour, ou Supabase, Inc.).
- **Avocat.** Faire valider les pages Mentions légales et Confidentialité : transferts, base légale et durée de conservation des messages de contact, mentions éditeur selon la nature de l'organisateur.
- **Purge des messages de contact.** Durée proposée : 12 mois après le dernier échange, à valider avec l'organisateur. À mettre en place par pg_cron ou par une procédure manuelle documentée.
- **Éditeur et responsable du traitement.** Remplir l'encadré « À compléter par l'organisateur ».

## Petits durcissements relevés

- En-tête `X-Robots-Tag: noindex` sur les routes monopage (`/inscription`, `/inscription/code`, `/noter`). Aujourd'hui, le `noindex` est posé seulement par JavaScript.
- Garde e2e `page.route('**/auth/v1/**', abort)` dans un `beforeEach`. Elle évite qu'un futur test envoie un vrai email.
- Commentaires du code qui citent SITE-AM : les neutraliser avant toute livraison du dépôt au client.
- `keepAliveTimeout` 65 s et `headersTimeout` 66 s pour le serveur Node, face à l'edge Railway.
- Railway « Config as Code » est déprécié au 2026-12-01. Vérifier que `railway.json` est bien appliqué, ou migrer.
