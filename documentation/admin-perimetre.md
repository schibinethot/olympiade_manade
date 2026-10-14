# Périmètre administration — état réel (13 octobre 2026)

**Projet** : olympiade_manade  
**Référentiel** : `docs/CDC-MASTER.md` (lot 0 socle + supervision)  
**Vérification prod** : voir aussi le rapport utilisateur `docs/admin-verification-prod.md` (store projet) et les smoke `pnpm smoke:prod-admin`.

---

## 1. Résumé

L’administration reste protégée par captcha, mot de passe et TOTP / AAL2. Elle ajoute la préparation et le pilotage d’une soirée, en plus de la supervision des statistiques. Le public reste hors soirée tant que `ETAT_SOIREE_REEL` n’est pas `true`. Les inscriptions et la file de notes restent fermées.

| Zone | Statut |
|---|---|
| Connexion `/admin` (Turnstile + mot de passe + TOTP) | **Livré** (code + E2E mockés) |
| Écran `/admin/statistiques` | **Livré** |
| API `GET /api/admin/supervision` | **Livré** (Bearer JWT admin AAL2) |
| Participants, soirées, juges, messages | **Livré** (consultation et actions CDC, RLS AAL2) |
| Cockpit, classements calculés, écran `/ecran/:slug` | **Livré**, public figé sans `ETAT_SOIREE_REEL` |
| Contenus vitrine éditables | **Absent** (F-09) |

---

## 2. Routes et fichiers

| URL | Fichier | Rôle |
|---|---|---|
| `/admin` | `app/routes/admin.tsx` | Formulaire de connexion, enrôlement TOTP, saisie du second facteur |
| `/admin/statistiques` | `app/routes/admin-statistiques.tsx` | Tableaux de bord, graphiques, export CSV des mesures serveur |
| `/admin/soirees` | `app/routes/admin-soirees.tsx` | Liste, création, annuaire des manades |
| `/admin/soirees/:id` | `app/routes/admin-soiree.tsx` | Préparation : réglages, planning, juges, duplication |
| `/admin/soirees/:id/direct` | `app/routes/admin-direct.tsx` | Cockpit |
| `/admin/soirees/:id/resultats` | `app/routes/admin-resultats.tsx` | Classements calculés, CSV, révélation |
| `/admin/participants` | `app/routes/admin-participants.tsx` | Comptes via `lire_participants()` |
| `/admin/juges` | `app/routes/admin-juges.tsx` | Création et lien magique |
| `/admin/messages` | `app/routes/admin-messages.tsx` | Messages de contact |
| `/ecran/:slug` | `app/routes/ecran.tsx` | Écran géant |
| `/jury` | `app/routes/jury.tsx` | Notation jury |

**Contrôle d’accès côté client** : `app/lib/useAccesAdmin.ts` — rôle `admin` dans `profils`, puis `aal2` via Supabase MFA (facteur TOTP vérifié).

**Contrôle côté serveur** : `serveur/supervision.mjs` — refus sans Bearer (401), sans AAL2 (403 `mfa_required`), sans rôle `admin` (403 `forbidden`).

---

## 3. Ce que couvrent les statistiques

Données affichées sur `/admin/statistiques` (agrégats, pas de données personnelles dans le journal) :

- Comptes actifs (heartbeat 2 min), comptes inscrits totaux
- Notes public / jury (totaux et fenêtres 5 min / 1 h)
- File d’attente des notes (`file_notes`) si migration et RPC disponibles
- Charge serveur : requêtes, erreurs 5xx, p95, mémoire, CPU, connexions HTTP
- Base : taille, connexions PostgreSQL
- Historique par minute (1 h ou 24 h), export CSV

Sources : RPC `lire_supervision`, `lire_statistiques_file_notes`, mesures locales Node + persistance optionnelle via `SUPABASE_SERVICE_ROLE_KEY`.

---

## 4. État production (HTTP / API)

**Hôte** : `https://olympiademanade-production.up.railway.app`  
**Contrôle automatisé** : `pnpm smoke:prod-admin` (sans secret utilisateur).

| Vérification | Résultat attendu | Statut au 13/10/2026 |
|---|---|---|
| `GET /admin` | 200, HTML SPA | **OK** |
| `GET /admin/statistiques` | 200, HTML SPA | **OK** |
| `GET /api/admin/supervision` (anonyme) | 401 `authentication_required` | **OK** |
| `GET /api/admin/supervision?heures=24` (anonyme) | 401 | **OK** |

Les pages admin sont pré-rendues et servies comme les autres routes monopage (`serveur/application.mjs`, ensemble `ROUTES_MONOPAGE`). L’API de supervision n’est disponible que lorsque l’application tourne avec le serveur Node (`pnpm start`), pas via le preview statique seul.

---

## 5. Critères pour déclarer l’admin « opérationnel » en prod

Automatisables sans OTP :

- [x] Pages admin accessibles (200)
- [x] API supervision refuse les visiteurs non authentifiés (401)

**Reste à valider manuellement** (nécessite compte admin réel + TOTP) :

1. **MFA** : connexion sur `/admin` avec email/mot de passe organisateur, captcha Turnstile, puis code TOTP (ou enrôlement au premier passage). Vérifier que `/admin/statistiques` charge les mesures et non le message « Connectez-vous » / « deux facteurs ».
2. **Données** : après connexion AAL2, indicateurs cohérents avec la base (ex. `profilesTotal` ≥ nombre de comptes connus, pas de bannière « migration de supervision » / `databaseStatus: error`). Comparer au besoin avec le tableau Supabase `profils` et les RPC.
3. **Refus AAL1** : avec un jeton admin volontairement sans second facteur (si test technique), l’API doit répondre 403 `mfa_required` — couvert en unitaire local, à reproduire en prod si un outil de test JWT est disponible.

Procédure détaillée pour Paul-L : section « Recette manuelle » du rapport `docs/admin-verification-prod.md` (store projet).

---

## 6. Tests dans le dépôt

| Suite | Périmètre admin |
|---|---|
| `tests/e2e/supervision.spec.ts` | Parcours login mocké, TOTP, AAL1 bloqué, chargement stats mockées |
| `tests/unit/supervision-backend.test.ts` | 401/403/429 sur `/api/admin/supervision` |
| `tests/db/securite-auth.test.ts` | `prive.est_admin()` exige AAL2 |
| `tests/e2e/serveur.spec.ts` | `/admin` et `/admin/statistiques` en 200 sur le **serveur local** de test (comportement aligné prod) |
| `scripts/smoke-prod-admin.mjs` | Smoke HTTP **production** (pages 200, API 401) |

Les E2E **ne** valident pas Supabase Auth ni Turnstile en production ; ils mockent Auth et l’API de supervision.

---

## 7. Écart CDC

- **F-29** (supervision charge) : **partiel** — UI stats + API + AAL2 en code ; capacité 5 000 non certifiée ; recette prod MFA + données en attente.
- **F-10 à F-12, F-18, F-21, F-23, F-25** : préparation / jury / cockpit / exports soirée / avis : **absents** côté UI admin.

Priorité produit inchangée : lot 1 préparation admin avant d’ouvrir une soirée pilote (voir `documentation/audit-cdc.md` §10).
