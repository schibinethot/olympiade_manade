# Audit fonctionnel — Olympiade Manade

- **Date** : 12 octobre 2026
- **Repo** : `/Users/tpmge/Dev/olympiade_manade`
- **Référentiel métier** : `docs/CDC-MASTER.md` (v0.10, à valider)
- **Auteur** : Elena (QA)
- **Code non modifié**, aucun commit

---

## 1. Synthèse exécutive

Le produit livré aujourd’hui est **un site vitrine solide**, avec un **socle de données et de règles de vote déjà testé en base**, plus des briques **inscription OTP**, **file de notes** et **supervision admin**. Il n’est **pas encore un outil de soirée bout-en-bout**.

**Ce qui tient** : accueil, palmarès, dates, contact (saisie + dépôt en base), mentions, confidentialité, repli hors-ligne, accessibilité axe, RLS des notes (déblocage, une note par votant, jury rattaché). Les tests unitaires et BDD passent à 100 %.

**Ce qui casse ou manque pour une soirée réelle** : pas d’écrans admin de préparation / cockpit, pas d’écran géant, pas de notation jury, pas de classements calculés en direct, pas de notifications, pas d’app Android, état « soirée ouverte » figé à `hors-soiree`, file de notes inactive par défaut. Le critère de succès CDC (« une soirée réelle de bout en bout ») est **KO**.

**Régression confirmée par les E2E** : un spectateur déjà inscrit sur `/noter` ne voit plus la date d’ouverture des votes (2 échecs Playwright, mobile + ordinateur).

**Production Railway** (`olympiademanade-production.up.railway.app`) : vitrine OK, inscriptions fermées, `/admin` en HTTP 404 (déploiement plus ancien que le code local).

---

## 2. Périmètre et méthode

### Exécuté

| Suite | Commande | Résultat |
|---|---|---|
| Unitaires | `pnpm test:unit` | **18 fichiers, 158 tests, OK** (0,7 s) |
| Base (schéma, RLS, file, supervision) | `pnpm test:db` | **11 fichiers, 124 tests, OK** (Postgres local) |
| E2E Playwright | `pnpm test:e2e` | **210 tests : 206 OK, 2 KO, 2 skip** (~47 s, build + serveur 4173) |
| Smoke HTTP prod | `curl` | Accueil / classements / dates / contact **200** ; `/noter` **200** + `noindex` ; `/admin` **404** ; page inconnue **404** ; pas de JSON-LD `Event` |
| Smoke navigateur prod | onglet Cursor | Accueil, classements (onglets 2026/2027), dates 2027, contact (validation vide), `/noter` visiteur |

Avertissement d’environnement : Node `v24.19.0` vs `engines.node` `24.21.0` — les tests ont quand même tourné.

### Lu (non exécuté en runtime réel)

- CDC, migrations SQL, routes React Router, libs métier, serveur Railway (`serveur/*.mjs`), specs E2E.
- **Pas de soirée réelle** (pas de comptes prod, pas d’OTP réel, pas de SMTP, pas de `FILE_NOTES_ACTIVE=true` en E2E).
- **Pas de Lighthouse** cette session (CDC cite 93–94 / 100 mesurés ailleurs).
- **Pas de test de charge hébergé** (scripts `scripts/charge/` non relancés).
- Mémoire agent Elena indisponible (MCP `plugin-bernard-agent-memory` en erreur).

### Convention de la matrice

- **OK** : comportement présent, vérifié (tests ou smoke) et aligné CDC pour l’état actuel.
- **Partiel** : code ou UI présents, règles incomplètes ou activation manquante.
- **KO** : bug confirmé, ou parcours CDC indispensable absent / inutilisable.
- **Non testable** : dépend d’un service (email, push, Play Store) ou d’un lot non branché.

Les **écarts CDC des lots non commencés** sont marqués KO (périmètre produit), pas inventés comme bugs d’implémentation.

---

## 3. Cartographie fonctionnelle

### 3.1 Routes réelles (`app/routes.ts`)

| Route | Rôle | Pré-rendu |
|---|---|---|
| `/` | Accueil vitrine + carte « Notez » | oui |
| `/classements` | Palmarès 2025–2027 (onglets) | oui |
| `/dates` | Calendrier saison / archives | oui |
| `/contact` | Formulaire + légal | oui |
| `/mentions-legales` | Éditeur à compléter | oui |
| `/confidentialite` | Politique RGPD | oui |
| `/noter` | Notation public (session) | non (SPA) |
| `/inscription`, `/inscription/code` | OTP prénom + email | non |
| `/admin`, `/admin/statistiques` | Connexion admin + métriques | non |
| `*` | 404 | repli SPA |

Absentes du routeur (CDC) : `/ecran/<soiree>`, cockpit soirées, import planning, jury, avis soirée, suppression de compte, PWA / Capacitor.

### 3.2 Rôles

| Rôle CDC | Dans le schéma | Dans l’UI |
|---|---|---|
| Visiteur | lectures anon calendrier / palmarès / planning | vitrine |
| Spectateur | `profils.role` défaut, OTP | inscription + `/noter` |
| Juge | enum + `soiree_juges` + RLS `notes_jury` | **aucun écran** |
| Admin | `role = admin`, mot de passe | **stats seulement** (`app/routes/admin.tsx`) |
| Écran géant | — | **absent** |

### 3.3 Données

**Présent (migrations `supabase/migrations/`)** : `profils`, `manades`, `soirees`, `soiree_manades`, `soiree_juges`, `epreuves`, `passages`, `notes_public`, `notes_jury`, `avis_soiree`, `calendrier`, `palmares`, `messages_contact`, plafonds contact, supervision, file de notes.

**CDC 5.2 non créé** : `etat_soiree`, `imports_planning`, `abonnements_push`, `parametres`, `photos`, `contenus`. Pas d’Edge Functions (`extraire-planning`, `notifier`).

### 3.4 Parcours utilisateur (état actuel)

1. **Vitrine** : accueil → classements / dates / contact. Bouton « Je note » **grisé** (`ETAT_SOIREE = 'hors-soiree'` dans `app/lib/etat-soiree.ts`). Lien d’inscription remplacé par « Inscriptions bientôt ouvertes » (`VITE_INSCRIPTION_OUVERTE` faux par défaut).
2. **Inscription (équipe, URL directe)** : `/inscription` → code 6 chiffres → session locale → `/noter`. Drapeau fermé : pas de lien public, page encore atteignable (`noindex`).
3. **Noter** : spectateur connecté voit `NotationPublic` + file IndexedDB. Sans `FILE_NOTES_ACTIVE`, message « L’enregistrement des notes n’est pas encore activé » et boutons désactivés (`app/composants/NotationPublic.tsx`).
4. **Admin** : email + mot de passe → `/admin/statistiques` (API `/api/admin/supervision`). Pas de création de soirée, pas de déblocage.

---

## 4. Matrice de vérification

| Fonctionnalité | Résultat | Sévérité | Preuve |
|---|---|---|---|
| Accueil (affiche, épreuves, vainqueur, saison, carte Notez) | **OK** | — | E2E `accueil.spec.ts` ; smoke prod 12/10/2026 |
| Bouton noter visible sans scroll mobile, grisé hors soirée | **OK** (hors soirée) | — | E2E accueil ; `BlocNoter.tsx` |
| État soirée « ouvert » / pastille En direct | **KO** | majeure | `ETAT_SOIREE` constant `hors-soiree` (`etat-soiree.ts`) |
| Classements palmarès 2025/2026 + onglets | **OK** | — | E2E + smoke prod (Arlatenco, onglet 2027 placeholder) |
| Classements live 2027 (jury / public / combiné) | **KO** | critique | `app/lib/classements.ts` = parsing de texte palmarès, aucun calcul de notes |
| Dates 2027 + archives + billetterie | **OK** | — | E2E + smoke prod (18 soirées, Arles confirmée) |
| JSON-LD `Event` (CDC NFR) | **KO** | mineure | HTML dates prod sans `application/ld+json` |
| Contact : validation + dépôt + honeypot + plafond | **OK** (UI/base) | — | E2E contact/accueil ; `FormulaireContact.tsx`, `plafonds.sql` |
| Contact : email organisateur (critère CDC 13) | **KO** | majeure | `envoyerMessageContact` = insert seul (`donnees.ts`) |
| Contact : Turnstile | **KO** | majeure (prod publique) | commenté dans `vitrine.sql` ; honeypot seulement |
| Mentions légales | **Partiel** | mineure | éditeur « à fournir » (`mentions-legales.tsx`) — attendu CDC |
| Confidentialité (textes) | **Partiel** | majeure (RGPD) | textes OK E2E ; pas de bouton suppression compte ; pas de job 24 mois |
| Inscription OTP (parcours UI mocké) | **OK** | — | E2E `inscription.spec.ts` (sauf cas connecté `/noter`) |
| Inscription publique (drapeau + SMTP + Turnstile) | **Partiel** | critique avant ouverture | drapeau faux ; CDC 4.4 prérequis non tenus |
| `/noter` visiteur (date Nîmes, inscriptions fermées) | **OK** | — | E2E + smoke prod |
| `/noter` spectateur inscrit (bonjour + date) | **KO** | moyenne | E2E 2 échecs ; `noter.tsx` n’affiche la date que si `!session` |
| File de notes (IndexedDB, reprise, vote fermé) | **Partiel** | majeure | unit + E2E mockés OK ; activation `FILE_NOTES_ACTIVE` + worker |
| Règles vote public (libre / déblocage, 1 note, email vérifié) | **OK** (base) | — | `regles_vote.sql`, `rls-votes-public.test.ts` |
| Notation jury (UI) | **KO** | critique | RLS OK, aucun écran |
| Avis soirée (UI) | **KO** | moyenne | table + RLS ; pas d’UI ; `avis_ouvert` incomplet (voir §5) |
| Admin préparation (soirées, manades, planning, QR, IA) | **KO** | critique | lots 1 et 3 absents |
| Cockpit déblocage / écran géant | **KO** | critique | lots 5 ; pas de route `/ecran` |
| Notifications | **KO** | majeure | lot 8 absent |
| App Android / PWA | **KO** | majeure | pas de `vite-plugin-pwa` ni Capacitor |
| Supervision admin (code local) | **Partiel** | moyenne | E2E mockés OK ; prod `/admin` **404** |
| Contenus vitrine éditables admin | **KO** | moyenne | CDC lot 1 ; tables `photos`/`contenus` absentes |
| Charge 5 000 votants | **Non testable** | critique (avant soirée) | CDC + `docs/audit-charge-5000.md` : non certifié |
| Accessibilité axe pages listées | **OK** | — | `accessibilite.spec.ts` |
| 404 | **OK** | — | `introuvable.tsx` ; prod 404 |

---

## 5. Bugs et écarts

Légende sévérité : **critique** (soirée / sécurité ouverture public) · **majeure** (parcours métier cassé) · **moyenne** · **mineure**.

### 5.1 Bugs confirmés (code ou tests)

| # | Sévérité | Description | Fichier | Reproduction | Impact |
|---|---|---|---|---|---|
| B1 | Moyenne | Spectateur connecté : `/noter` n’affiche plus la date/lieu d’ouverture des votes. Le test E2E attend encore cette phrase. | `app/routes/noter.tsx` (l.34–38) ; `tests/e2e/inscription.spec.ts` l.399–406 | Session mock Léa → `/noter` | Confusion (quand noter ?) ; **suite E2E rouge** |
| B2 | Majeure | Formulaire contact : succès UI = insert `messages_contact` uniquement. Aucun envoi email. | `app/lib/donnees.ts` `envoyerMessageContact` | Envoi valide | Organisateur ne voit le message que s’il lit la table ; critère CDC 13 KO |
| B3 | Moyenne | `prive.avis_ouvert` : avis seulement si `statut = terminee` **ou** (`en_cours` **et** `now >= vote_fin`). Une soirée restée `publiee` après `vote_fin` n’ouvre jamais les avis. | `supabase/migrations/20261010120100_regles_vote.sql` l.64–73 ; test `regles-vote.test.ts` (graine `en_cours`) | Soirée `publiee` + fenêtre close | Avis CDC 4.9 inapplicables sans bascule de statut |
| B4 | Majeure (prod) | Production : `/admin` HTTP **404** (même HTML de repli que les inconnues). Pied de page prod **sans** lien Administration (code local l’a dans `PiedDePage.tsx`). | Déploiement vs `serveur/application.mjs` `ROUTES_MONOPAGE` | `curl -I …/admin` → 404 | Supervision non joignable en prod ; **écart repo / prod** |

B1 est une **régression d’affichage** par rapport au contrat E2E, pas un échec d’auth.

### 5.2 Écarts CDC (lots non livrés) — pas des bugs d’implémentation

Absence volontaire ou inachevée, citée pour le backlog QA :

- Lots **1, 3, 4, 5, 6, 8, 9** : préparation, import IA, jury UI, cockpit, écran géant, PWA/charge E2E soirée, notifications, Android (`docs/CDC-MASTER.md` §9.1).
- Instantané `etat_soiree` et diffusion classements (CDC 5.3) : **à implémenter**.
- Calculs classement (moyenne, points par place, combiné, égalités, provisoire) : **aucun module** hors parseur de palmarès.
- RGPD : suppression compte dans l’app + purge 24 mois : **annoncées** dans `confidentialite.tsx`, **non implémentées**.
- Turnstile inscription/contact, SMTP Brevo, liens juges, 2FA admin.

### 5.3 Non reproduit / non inventé

- Premier clic sur l’onglet 2027 en smoke prod n’a changé l’URL qu’au second clic. Les E2E `classements-dates.spec.ts` passent. **Risque d’ergonomie**, pas un bug confirmé.
- Aucune faille RLS des notes publics n’a été observée dans les 124 tests DB (contourner l’UI pour voter un passage fermé est refusé, `42501`).

---

## 6. Couverture de tests et gaps

### 6.1 Pyramide constatée

| Couche | Volume | Qualité | Commentaire |
|---|---|---|---|
| Unitaire | 158 | Forte sur vitrine, auth texte, file, planning cache, supervision | **Aucun test des formules de classement live** (critère CDC 8) |
| Intégration DB | 124 | Forte sur schéma, RLS planning/votes/jury/vitrine, file SQL, plafonds | Harnais local uniquement (`tests/db/aide.ts`) |
| E2E | 206 verts / 2 rouges | Forte vitrine, contact mocké, inscription mockée, file mockée, axe, hors-ligne | **Pas de parcours soirée réel** (critère CDC 10) ; Auth/Supabase **bouchonnés** |

### 6.2 Ce qui est bien couvert

- Navigation, pré-rendu, CSP, cache serveur.
- Palmarès / calendrier / repli réseau.
- Validation contact = contraintes SQL.
- OTP : coller le code, erreurs FR, cooldown, drapeau inscriptions.
- RLS : passage non débloqué, mode libre/fenêtre, démonstration, email non vérifié, juge non rattaché, verrouillage jury.
- File : distinction reçue / confirmée, hors-ligne, isolation de compte (mocks HTTP).

### 6.3 Gaps prioritaires

1. **Classements** : jeu « Vinuesa Alès 2026 » (2e partout, 1er aux points) — exigence CDC 8, **zéro test**.
2. **E2E bout-en-bout** : créer soirée → débloquer → voter → classement (CDC 10).
3. **OTP réel** (SMTP) et Turnstile.
4. **File + RLS ensemble** en préprod (`FILE_NOTES_ACTIVE=true`).
5. **Jury UI**, avis, notifications, écran géant.
6. **Admin stats** contre API réelle (E2E actuelle mocke `/api/admin/supervision`).
7. **Charge k6** 5 000 / 7 500 sur préprod RLS réelle.
8. Réparer / réécrire le test B1 après alignement produit.

Playwright impose `VITE_INSCRIPTION_OUVERTE=false` et `FILE_NOTES_ACTIVE=false` (`playwright.config.ts`) : les E2E **ne certifient pas** l’ouverture publique ni l’enregistrement réel des notes.

---

## 7. Risques / edge cases

| Risque | Pourquoi | Fichier |
|---|---|---|
| OTP appelable avec la clé publique même drapeau fermé | `/inscription` reste joignable ; pas de Turnstile | `docs/superpowers/plans/suivi-apres-lot0.md` ; `inscription.tsx` |
| Spam contact / saturation du plafond 10/10 min | Honeypot + plafond global, pas d’anti-robot serveur | `plafonds.sql` |
| Consentement horodaté à la **création** du user, pas à la confirmation email | Trigger `creer_profil_spectateur` lit `raw_user_meta_data` | `20261010120000_schema.sql` |
| Compte non confirmé jamais purgé | CDC l’exige avant ouverture inscription | — |
| `ETAT_SOIREE` et planning `/api/notation/planning` **décrochés** | Accueil grisé même si une soirée `en_cours` existe en base | `etat-soiree.ts`, `planning-notation.mjs` |
| Mode déblocage : `vote_fin` n’arrête pas le vote (seul le statut passage compte) | Aligné CDC 4.4 ; oubli admin = votes ouverts indéfiniment | `passage_votable_public` |
| Note jury `>= 0` (zéro autorisé) | CDC parle de barème 10/20, pas de zéro | `schema.sql` `notes_jury` |
| Session `/noter` : timeout 3 s → affichage « non connecté » transitoire | `useSession.ts` `DELAI_PROFIL_MS` | E2E chargement couvre une partie |
| Soirée de référence = **Nîmes** alors que la prochaine date calendrier est **Arles 1er mai 2027** | `soireeDeReference` | Accueil prod : carte Nîmes 20 août vs saison Arles |
| File inactive : UI de notation visible mais boutons off | `fileActive: false` | `NotationPublic.tsx` |
| Capacité 5 000 | Non certifiée | `docs/audit-charge-5000.md` |
| Mentions / responsable traitement placeholder | Site déjà en ligne | `mentions-legales.tsx`, `confidentialite.tsx` |
| Engine Node local ≠ `package.json` | 24.19 vs 24.21 | `package.json` |

---

## 8. Plan de tests recommandé

### Immédiat (qualité du code actuel)

1. **Corriger B1** : décider si `/noter` connecté doit encore afficher `momentSoiree` ; aligner UI et E2E.
2. Garder **unit + db + e2e** au vert avant merge (gate).
3. Test unitaire **`avis_ouvert`** pour `statut = publiee` après `vote_fin`.
4. Jeu de **classements** (moyenne vs points, égalités, notes manquantes, barème 10/20) **dès le premier module de calcul**.

### Avant ouverture des inscriptions

1. Turnstile + SMTP Brevo + test OTP **adresse réelle**.
2. E2E drapeau `VITE_INSCRIPTION_OUVERTE=true` (projet Playwright dédié).
3. Politique : `/inscription` fermée aussi côté Auth (`signup_disabled`) pas seulement UI.
4. Suppression de compte + preuve de purge.

### Avant une soirée pilote

1. Admin : créer soirée, manades, épreuves, passages, déblocage (E2E mobile, critère 10).
2. Vote public file **activée**, hors-ligne, fermeture, idempotence, RLS.
3. Jury : lien magique, barème, verrouillage.
4. Classements visibles / masqués, combiné, export.
5. Écran géant + notif < 15 s (critères 6 et 11).
6. k6 5 000 puis 7 500 en préprod (critère 9).
7. Recette terrain : 4G saturée, PWA / Android interne.

Hors V1 (ne pas tester comme exigence) : iOS store, billetterie, commentaires publics, i18n (`docs/CDC-MASTER.md` §7).

---

## 9. Conclusion

**Verdict QA** : le **lot vitrine est recevable** pour une consultation publique « hors saison », sous réserve de ne pas communiquer le contact comme un canal email fiable et de ne pas ouvrir les inscriptions.

**Verdict soirée** : **non recevable**. Socle SQL/RLS de qualité, mais **aucun parcours organisateur / juge / spectateur votant n’est fermé**. Les KO majeurs sont fonctionnels (lots manquants) plus **une régression E2E sur `/noter` connecté** et un **contact sans email**.

**Tests lancés le 12/10/2026** : unit 158/158 OK · db 124/124 OK · e2e 206/210 OK (2 KO inscription `/noter`, 2 skip).

**Feu Leo (déploiement soirée)** : rouge. **Feu vitrine** : orange (prod sans admin, contact silencieux, inscriptions à garder fermées).
