# Audit complet du CDC — fonctionnalité réelle

**Projet** : olympiade_manade  
**Date** : 17 octobre 2026  
**Référentiel** : `docs/CDC-MASTER.md` v0.11 (12 octobre 2026, à valider)  
**Code** : `main` `7ffebfdc46bc939101a372e2829db33daa09cf08` (14 octobre, PR #6). Aucun commit après.  
**Méthode** : CDC, code, smoke HTTP production sans compte admin, lecture anonyme de la base publique, tests locaux. Aucune ouverture d’inscription, aucune file de notes, aucun déploiement.

Ce texte remplace le constat du 13 octobre, écrit avant la PR #6. Ce constat disait que le cockpit et les classements calculés étaient absents du dépôt : c’est faux pour `main` au 17 octobre, et encore vrai pour le serveur Railway.

Convention : **Couvert** = parcours présent et vu. **Partiel** = une partie seulement, ou éteinte. **Absent** = pas livré.

---

## 1. Verdict

**La vitrine hors soirée est en ligne.** Accueil, palmarès, dates, contact, mentions. Le bouton de notation est grisé. Les inscriptions affichent « bientôt ouvertes ». La file de notes est éteinte (`fileActive: false`).

**La soirée pilote n’est pas en production.** Préparation, cockpit, jury, écran et classements calculés sont dans `main`. Les URL correspondantes répondent 404 sur Railway. Le critère de succès du CDC §1 (une soirée réelle de bout en bout) est **KO**.

**Ne pas ouvrir les inscriptions.** L’email organisateur n’est pas dans le build servi. Sur `main`, l’envoi existe et reste sur `SMTP_MODE=off`.

| Cible | Feu |
|---|---|
| Vitrine hors soirée | **Orange** — utilisable. Éditeur vide, pas d’email, pas de données `Event` |
| Admin statistiques | **Orange** — pages 200, API anonyme 401. Second facteur réel non fait |
| Soirée pilote | **Rouge** — code sur `main`, absent du serveur |
| Inscriptions et notes | **Rouge** — fermées, à laisser fermées |

---

## 2. Preuves (17 octobre 2026)

### Build servi

Hôte : `https://olympiademanade-production.up.railway.app`. Manifeste : `/assets/manifest-8e031fbf.js`.

Routes déclarées dans ce manifeste : accueil, classements, dates, contact, mentions, confidentialité, noter, inscription, code, admin, statistiques. Pas de soirées, participants, messages, juges, jury, ni écran.

| URL | Code |
|---|---|
| `/`, `/sante`, `/admin`, `/admin/statistiques`, `/noter`, `/inscription`, `/classements`, `/dates`, `/contact` | 200 (`/sante` = `ok`) |
| `/api/admin/supervision` sans jeton | 401 `authentication_required` |
| `/api/notation/planning` | 200, `fileActive: false`, aucune soirée |
| `/api/contact` en GET | 405 |
| `/admin/soirees`, `/admin/participants`, `/admin/messages`, `/admin/juges`, `/jury`, `/ecran/demo`, `/api/etat-soiree` | 404 |

Ce manifeste n’est pas celui du commit `2e9bf8c` (11 octobre, 01:20 : pas de route admin, pas de `planning-notation.mjs`). Il n’est pas non plus `7ffebfd` : ce commit ajoute le pilotage, et le HTML versionné sur `main` pointe vers `manifest-e170d748.js`. Le script servi contient Turnstile, ajouté le 12 octobre (`d31058b`). Le source de l’interface est le même de ce commit jusqu’à `476b4b7` (13 octobre), juste avant la PR #6.

**Le serveur est un build Railway d’un commit entre `d31058b` et `476b4b7`.** Le dernier déploiement GitHub « Deployed to Railway » reste celui du 11 octobre, SHA `2e9bf8c`, marqué inactive le 12 octobre à 18:48 UTC. Ce journal ne décrit pas les fichiers servis.

Base publique (clé déjà dans le JavaScript du site) : `etat_soiree` existe et ne renvoie aucune ligne ; aucune soirée hors brouillon ; calendrier 2027 ouvert par Arles, prévisionnelle, le 1er mai.

### Tests

Node local 22.14.0 (le dépôt demande 24.21.0). React Router avertit qu’il veut une version supérieure à 22.22.0.

| Suite | Résultat |
|---|---|
| `pnpm typecheck` | sortie 0, avec l’avertissement Node |
| `pnpm test:unit` | 22 fichiers, 208 tests, OK |
| `pnpm test:db` | 14 fichiers, 138 tests, OK (Postgres 16, toutes les migrations) |
| `pnpm test:e2e` | 168 OK, 48 KO, 4 ignorés sans clé publique (pré-rendu vide). Relance des fichiers touchés avec la clé publique du site : 77 OK, 1 ignoré |

Les 48 échecs ne sont pas une régression métier : la page disait « Informations momentanément indisponibles ». Avec un pré-rendu alimenté, la suite passe. Lighthouse, charge 5 000, compte admin réel et envoi d’email : non lancés.

---

## 3. Matrice CDC §4

| ID | Exigence | Main | Prod |
|---|---|---|---|
| F-01 | « Notez les Olympiades » sans défiler | Couvert (E2E) | Bloc présent. Lighthouse non mesuré |
| F-02 | Bouton grisé + prochaine date | Couvert | Couvert (Arles, 1er mai 2027, 15h30, prévisionnelle) |
| F-03 | Photos, 4 épreuves, dernier vainqueur | Couvert | Couvert |
| F-04 | Onglets 2025 / 2026 / 2027 | Partiel (calculé seulement si l’instantané est actif) | Palmarès éditorial seulement |
| F-05 | Palmarès, source, « à confirmer » | Couvert | Couvert |
| F-06 | Dates 2027 + archives | Couvert | Couvert. Arles est annoncée comme prochaine soirée de vote alors que le CDC la décrit comme une fête de gardians, pas une olympiade |
| F-07 | Contact + email + anti-robot | Partiel. SMTP écrit, `off` par défaut | Partiel. API présente, module d’email absent de ce build |
| F-08 | Mentions / confidentialité | Partiel | Partiel. « À compléter par l’organisateur » |
| F-09 | Contenus vitrine éditables | Absent | Absent |
| F-10 | CRUD soirées, duplication, statuts | Couvert (E2E sur listes vides simulées) | Absent (404) |
| F-11 | Annuaire manades | Couvert | Table lisible, pas d’écran |
| F-12 | Planning modèle / saisie / ordre | Partiel (boutons Monter / Descendre) | Absent |
| F-13 | Décaler la suite de +N min | Présent dans le cockpit, tests SQL OK | Absent |
| F-14 | Import IA | Absent | Absent |
| F-15 | Inscription OTP | Partiel, drapeau faux | Partiel, « bientôt ouvertes » |
| F-16 | Vote 1–10, deux modes, délai | Partiel. Pas de temps restant sur l’écran spectateur | Partiel. `/noter` en 200, file éteinte |
| F-17 | File hors-ligne | Partiel, inactive | `fileActive: false` |
| F-18 | Jury, lien, verrouillage | Partiel. Lien en texte, pas de QR ni SMS | 404 |
| F-19 | Classements, cas Alès | Couvert par les tests unitaires | Absent du serveur |
| F-20 | Masquer / révéler | Présent (résultats) | Absent |
| F-21 | Cockpit | Partiel (pas de glisser-déposer) | Absent |
| F-22 | QR de vote + affiche PDF | Absent (l’écran écrit `/noter`) | Absent |
| F-23 | Export CSV et PDF | Partiel. CSV oui, PDF non | CSV de supervision seulement |
| F-24 | Écran géant | Partiel. Inactif sans `ETAT_SOIREE_REEL` | 404 |
| F-25 | Avis 1–5 | Absent (écran). Table en base | Absent |
| F-26 | Notifications | Absent | Absent |
| F-27 | PWA | Absent | Absent |
| F-28 | Android | Absent | Absent |
| F-29 | Supervision | Partiel. E2E simulés. Charge non certifiée | 200 / 401. TOTP réel non fait |
| F-30 | Instantané `etat_soiree` | Écrit, inactif sans drapeau | Table vide. URL en 404 |

Absents des deux côtés : suppression de compte, purge 24 mois, JSON-LD `Event`.

---

## 4. Critères d’acceptation §8

| CA | Statut | Commentaire |
|---|---|---|
| 1 | KO | Inscription et soirée fermées |
| 2 | OK base | Tests SQL locaux |
| 3 | OK base | idem |
| 4 | OK base | idem |
| 5 | OK base | idem |
| 6 | KO | API d’instantané absente en production |
| 7 | KO | Import absent |
| 8 | OK tests | Moteur sur `main`, pas déployé |
| 9 | KO | Charge non lancée |
| 10 | KO | Pas de parcours e2e avec de vraies notes |
| 11 | KO | Notifications absentes |
| 12 | Partiel | Pages OK. Lighthouse non relancé. Pas de `Event` |
| 13 | KO | Email non parti |
| 14 | KO | Pas d’Android |
| 15 | Partiel | 401 anonyme vérifié en production |
| 16 | Tests SQL | Migration de pilotage. Pas démontré en production |
| 17 | Partiel | Boutons d’ordre sur `main`. Pas de mesure des 10 s |
| 18 | Tests SQL | Fenêtre automatique dans la migration. Pas en production |

---

## 5. Lots §9, relus le 17 octobre

| Lot | État sur `main` | Visible en production |
|---|---|---|
| 0 Socle | Présent | Oui (vitrine, Auth, contact en base) |
| 1 Préparation | Écrans livrés. Contenus vitrine toujours non éditables. Pas d’import | Non |
| 2 Vote | `/noter` et file écrits, éteints. Classements et instantané écrits | `/noter` seul, file éteinte. Instantané non servi |
| 3 Import IA | Absent | Absent |
| 4 Jury | Écran et lien texte. Pas de QR | Non |
| 5 Cockpit et écran | Livrés, écran inactif sans drapeau | Non |
| 6 PWA / charge / e2e soirée | E2E vitrine et admin simulé. Pas de PWA ni de charge | — |
| 7 Vitrine | Présente | Présente |
| 8 Notifications | Absent | Absent |
| 9 Android | Absent | Absent |

---

## 6. Suite, sans ouvrir le public

1. Reconstruire Railway sur `7ffebfd`. Contrôler `/admin/soirees` en 200 et `/api/etat-soiree` en JSON. Laisser l’API de supervision en 401 sans jeton.
2. Laisser `VITE_INSCRIPTION_OUVERTE` et `FILE_NOTES_ACTIVE` faux.
3. Brancher l’email avant toute inscription.
4. Remplir l’identité légale.
5. Répéter une soirée en brouillon (planning, juges, cockpit, classements, écran) avec `ETAT_SOIREE_REEL` seulement à ce moment-là.
6. QR, temps restant côté spectateur, notifications, PWA, charge, puis seulement l’ouverture.

*Fin de l’audit. Documentation seule. Aucun déploiement.*
