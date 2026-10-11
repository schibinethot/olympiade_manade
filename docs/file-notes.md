# File d'attente des notes

Le parcours `/noter` enregistre d'abord l'action sur l'appareil (IndexedDB), puis appelle `mettre_note_en_file` avec l'identifiant stable de l'action. La base contrôle le compte, l'email et l'ouverture du vote. Le serveur Railway appelle ensuite `traiter_file_notes` par petits lots. L'interface ne confirme l'enregistrement qu'après le reçu `confirmee`, écrit dans la même transaction que `notes_public`.

## Activation et exploitation

1. Appliquer les migrations, dont `20261011140000_file_notes.sql`, sur la préproduction choisie.
2. Fournir au serveur `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_SERVICE_ROLE_KEY`. La dernière variable n'a jamais le préfixe `VITE_` et ne doit pas être exposée au navigateur.
3. Régler `FILE_NOTES_ACTIVE=true`. Le serveur refuse de démarrer si la file est activée sans sa configuration. Le planning public affiche la saisie désactivée tant que cette option est absente. Valeurs par défaut : `FILE_NOTES_BATCH_SIZE=100`, `FILE_NOTES_INTERVAL_MS=250`, `FILE_NOTES_TIMEOUT_MS=5000`.
4. Construire et démarrer avec `pnpm build && pnpm start`. Le serveur Vite seul ne porte ni le cache public `/api/notation/planning`, ni le traitement de file.
5. Vérifier `/admin/statistiques` : traitement actif depuis moins de 30 s, backlog qui diminue, pas de montée persistante de l'âge de la plus ancienne action. L'absence de mesures est explicitement distinguée de zéro action.

Ne pas activer les traitements de développement contre la base de production. Les tests navigateur imposent `FILE_NOTES_ACTIVE=false` et interceptent les API ; les tests SQL et le benchmark détruisent exclusivement des bases locales de test. L'ajout de ce code n'applique aucune migration distante, ne redimensionne aucun service et ne vaut pas validation de capacité.

Chaque instance lance au plus une transaction de traitement à la fois, puis attend au moins l'intervalle configuré. Deux instances peuvent fonctionner : `FOR UPDATE SKIP LOCKED` répartit les actions ; une seule correction du même compte et passage est éligible à la fois. La cadence maximale théorique est inférieure à 400 actions/s par instance avec ces réglages, puisque le temps SQL et le réseau s'ajoutent aux 250 ms. Augmenter le nombre d'instances augmente aussi la pression sur PostgreSQL : il faut mesurer.

## Pannes et garanties

- Un clic est indiqué comme gardé sur l'appareil seulement après une écriture IndexedDB réussie. Le stockage bloqué ou plein produit une erreur. Le navigateur peut supprimer ses données ; cette conservation ne remplace pas un reçu serveur.
- Une action déjà essayée garde toujours son UUID et sa note. Réessayer une requête dont la réponse a été perdue ne crée pas de doublon. Une correction suivante possède un autre identifiant et attend son tour.
- Une page fermée n'exécute plus de code : les actions non envoyées reprennent au retour sur le site, dans le même navigateur et avec le même compte. Le site n'est pas une PWA intégralement disponible hors ligne.
- Une action reçue avant fermeture est admise et peut être traitée ensuite. Une action restée sur le téléphone après fermeture est refusée. L'horloge du téléphone ne permet pas de contourner cette règle.
- Le worker peut être arrêté/redémarré. Note et confirmation sont commitées ensemble ; un arrêt ambigu se résout par la relecture du même reçu. Les notes en attente restent en base même si Railway est indisponible.
- Les anciennes écritures directes restent compatibles seulement s'il n'existe pas d'action en attente pour la cible ; le verrou transactionnel empêche une ancienne action d'écraser une nouvelle écriture directe. Le parcours navigateur passe exclusivement par la file.
- Les actions métier refusées restent visibles et n'empêchent pas les autres passages. Une panne temporaire ne devient jamais une fausse confirmation ni une suppression silencieuse.

La file serveur conserve les reçus pour éviter le rejeu d'un vieil identifiant, avec un plafond de 100 actions par compte et passage et suppression lors de la suppression du compte. Les états locaux sont bornés à 200 actions par compte ; les confirmations ont une rétention de 7 jours et les refus de 30 jours, nettoyés à l'utilisation. Une action non confirmée n'est pas purgée pour faire de la place.

## Vérification de charge

```sh
pnpm test
pnpm typecheck
pnpm exec playwright test tests/e2e/file-notes.spec.ts tests/e2e/supervision.spec.ts
# Poste local uniquement, DB jetable *_charge_test :
CHARGE_QUEUE=true CHARGE_USERS=5000 node scripts/charge/benchmark-local.mjs
CHARGE_QUEUE=true CHARGE_USERS=7500 node scripts/charge/benchmark-local.mjs
```

Le mode `CHARGE_QUEUE=true` met tous les comptes en file, ferme le vote, puis traite les actions admises avec deux workers de 100 actions espacés de 250 ms. Il corrige ensuite toutes les notes et rejoue une ancienne action. Il exige le nombre exact de confirmations, zéro attente restante, une seule note par votant et la valeur finale correcte. Il ne simule ni le réseau mobile, ni PostgREST, ni Auth.

Le harnais `scripts/charge/k6-votes.js` teste la voie HTTP en préproduction avec 5 000 ou 7 500 JWT distincts, l'admission, les relectures de statuts, un rejeu idempotent sur 10 % des actions et la relecture finale des notes. Il utilise `RAILWAY_STAGING_URL` pour le planning public mis en cache et `SUPABASE_URL` pour les notes. Il refuse la production connue et demande l'opt-in explicite de l'opérateur. L'objectif de latence reste mesuré et peut échouer : la file ne doit jamais masquer un temps de confirmation trop long.

Références de conception : [transactions IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [verrouillage PostgreSQL et SKIP LOCKED](https://www.postgresql.org/docs/current/sql-select.html). Aucun nouveau service payant ni dépendance de queue externe.
