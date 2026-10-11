# Olympiade Manade

Projet d’application pour suivre plusieurs Olympiades de manades, saisir les notes du jury, calculer les classements et recueillir les notes et avis du public.

Le cadrage retient une notation configurable par événement et par épreuve : note globale, critères personnalisés, points, places et votes du public. Les critères et barèmes seront définis par les organisateurs ; les résultats du jury et du public resteront identifiables séparément.

La [recherche et le cadrage fonctionnel](docs/recherche-olympiades.md) recensent les épreuves documentées, les sources, les informations à collecter et les règles de notation restant à confirmer.

## Supervision et capacité

L'administration est accessible depuis le pied de page ou `/admin`, avec le mot de passe d'un compte existant dont le profil est `admin`. L'écran `/admin/statistiques` montre les comptes actifs, les notes enregistrées, la base, les erreurs, les transferts et les ressources du serveur, avec historique et export CSV. Les accès sont contrôlés dans l'API et dans PostgreSQL.

La cible de **5 000 personnes simultanées n'est pas certifiée**. Voir l'[audit de capacité](docs/audit-charge-5000.md), les mesures locales et les scénarios de préproduction à 5 000 puis 7 500 votants.

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

Le [dossier fonctionnel illustré en PDF](output/pdf/olympiade-des-manades-dossier-fonctionnel-illustre.pdf) présente les fonctions et les parcours en 27 pages, avec les maquettes, les options de notation, les exemples de calcul et les critères de recette. Version du 11 octobre 2026 ; les écrans montrent des données de démonstration.
