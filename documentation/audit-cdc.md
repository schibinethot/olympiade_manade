# Audit complet du CDC — fonctionnalité réelle

**Projet** : olympiade_manade  
**Date** : 13 octobre 2026  
**Référentiel** : `docs/CDC-MASTER.md` v0.11 (12/10/2026, à valider)  
**Méthode** : lecture croisée CDC / code / migrations, exécution des suites locales, smoke HTTP production. Aucune modification produit.

Convention : **Couvert** = exigence présente, vérifiée et alignée. **Partiel** = code ou base présents, parcours incomplet ou désactivé. **Absent** = non livré. **Hors V1** = CDC §7.

Les audits des 12/10 (`documentation/audit-cdc.md` v0.10, `audit-fonctionnel.md`, `audit-securite.md`) sont des constats antérieurs. Celui-ci les remplace pour l’état du dépôt au 13/10.

---

## 1. Verdict

**La vitrine hors soirée est fonctionnelle.** Accueil, palmarès, dates, contact (dépôt serveur + Turnstile), mentions, inscription fermée, `/noter` en lecture, supervision admin et règles SQL de vote tiennent en local.

**L’app de soirée n’est pas fonctionnelle.** Le critère de succès global du CDC §1 (soirée réelle de bout en bout sans intervention technique) est **KO**. Il n’y a ni préparation, ni cockpit, ni classements calculés, ni jury, ni écran géant, ni notifications, ni PWA, ni Android.

**Ne pas ouvrir les inscriptions publiques.** Turnstile et AAL2 existent dans le code ; SMTP Brevo, `enable_signup`, file de notes, état soirée réel et email organisateur ne sont pas en place comme capacités livrées.

| Cible | Feu |
|---|---|
| Consultation vitrine hors saison | **Orange** — utilisable, contact sans email, coordonnées légales vides, 4 E2E rouges (données Arles) |
| Soirée pilote / notation en direct | **Rouge** |
| Ouverture inscriptions | **Rouge** |

---

## 2. Preuves d’exécution (13/10/2026)

| Suite | Résultat |
|---|---|
| `pnpm test:unit` | **19 fichiers, 196 tests, OK** |
| `pnpm test:db` | **13 fichiers, 134 tests, OK** (Postgres local, toutes les migrations) |
| `pnpm test:e2e` | **216 tests : 210 OK, 4 KO, 2 skip** |
| Smoke production `olympiademanade-production.up.railway.app` | `/`, `/classements`, `/dates`, `/contact`, `/noter`, `/admin`, `/admin/statistiques`, `/sante`, mentions, confidentialité, `/inscription` → **HTTP 200**. JSON-LD `Event` **absent** (0 occurrence sur `/dates`) |

Node local : `v24.19.0` (engines : `24.21.0`). Les tests ont tourné malgré l’écart.

**Régression E2E (4 échecs, mobile + ordinateur)** :

1. Accueil : le test attend le texte Arles **sans** mention « date prévisionnelle ».
2. Dates : le test attend le libellé **« Confirmée »** pour Arles 1er mai 2027.

Le CDC §2.3 ter et la migration `20261011210432_sources_a_confirmer.sql` classent Arles **prévisionnelle** (programme en attente de validation). Les tests DB (`rls-vitrine.test.ts`) vérifient `previsionnelle`. **Le produit suit le CDC ; les E2E sont périmés.** Ce n’est pas un bug métier.

Les 2 E2E `/noter` connecté signalés le 12/10 **ne reproduisent plus** : `app/routes/noter.tsx` affiche `momentSoiree` avec ou sans session.

Production : `/admin` répond **200** (l’audit du 12/10 et le README parlaient encore d’un 404). Le README n’est plus à jour sur ce point.

---

## 3. Ce que le CDC promet vs ce qui tourne

### 3.1 Objectif §1

| Intention | Constat |
|---|---|
| Site vitrine + notation en direct + cockpit organisateur | Vitrine + socle SQL. Notation UI présente, **jamais ouverte** (`ETAT_SOIREE = 'hors-soiree'`). Pas de cockpit. |
| App Android interne, ouverture public par réglage | Absente (pas de Capacitor, pas de table `parametres`) |
| Critère de succès : soirée réelle bout en bout | Non atteignable |

Le CDC §1.1 et §9.1 décrivent déjà cet écart : livrable actuel = vitrine hors soirée. **Le CDC est honnête sur l’avancement.** L’audit vérifie que cette description est encore vraie, et pointe les trous restants **à l’intérieur** du livrable actuel (E2E Arles, email contact, JSON-LD, README prod).

### 3.2 Rôles §3

| Rôle | CDC | UI | Base |
|---|---|---|---|
| Visiteur | Vitrine | **Couvert** | Lectures anon calendrier / palmarès |
| Spectateur | OTP, notes 1–10, notifs, classement | **Partiel** (OTP + `/noter`, inscriptions fermées, pas de notifs ni live) | RLS notes |
| Juge | Lien magique, barème 10/20 | **Absent** | Schéma + RLS |
| Admin | Préparation + cockpit + résultats | **Partiel** (login TOTP + stats charge) | Rôle + AAL2 |
| Écran géant | `/ecran/<soiree>` | **Absent** | — |

### 3.3 Canaux §3.1

Site web : oui. PWA (`vite-plugin-pwa`) : **absent**. Android Capacitor : **absent**. `app_ouverte_au_public` : table `parametres` **absente**.

---

## 4. Matrice CDC §4 (fonctionnel)

| ID | Exigence | Statut | Preuve |
|---|---|---|---|
| F-01 | Accueil mobile « Notez les Olympiades » sans scroll | **Partiel** | E2E accueil OK hors soirée. Lighthouse ≥ 90 **non relancé** cette session |
| F-02 | Bouton grisé hors soirée + prochaine date | **Couvert** | `BlocNoter`, `ETAT_SOIREE`, E2E |
| F-03 | Photos, 4 épreuves, dernier vainqueur | **Couvert** | Accueil + photos libres |
| F-04 | Classements onglets 2025 / 2026 / 2027 | **Partiel** | Palmarès éditorial. 2027 = placeholder, pas de votes live |
| F-05 | Palmarès + source + « à confirmer » | **Couvert** | Table `palmares`, E2E |
| F-06 | Dates 2027 + archives | **Couvert** (données) | `calendrier`. Arles **prévisionnelle** alignée CDC ; E2E encore sur « Confirmée » |
| F-07 | Contact + email orga + anti-robot | **Partiel** | Turnstile + insert serveur `messages_contact`. **Pas d’email SMTP** (CA-13 KO) |
| F-08 | Mentions / confidentialité | **Partiel** | Pages présentes ; éditeur et responsable du traitement vides |
| F-09 | Contenus vitrine éditables admin | **Absent** | Pas de tables `photos` / `contenus`, pas d’écran |
| F-10 | CRUD soirées, duplication, statuts, message report | **Absent** | Schéma seulement |
| F-11 | Annuaire manades | **Partiel** | Table + seed ; Bon, Labourayre, Du Juge présents après migrations. Pas d’UI |
| F-12 | Planning modèle 4 épreuves / saisie / ordre | **Absent** (UI) | Tables + cache `GET /api/notation/planning` |
| F-13 | Décalage +N min | **Absent** | — |
| F-14 | Import IA PDF/photo/Word/Excel | **Absent** | Pas d’Edge Function, pas de `imports_planning`, pas de SDK Anthropic |
| F-15 | Inscription OTP + consentement | **Partiel** | Front + Auth + Turnstile. Drapeau faux. SMTP public non branché. Consentement horodaté à la confirmation email |
| F-16 | Vote public 1–10, 2 modes, RLS | **Partiel** | SQL + `/noter`. Soirée jamais ouverte côté UI. Colonnes `mode_fenetre` / `delai_vote_minutes` **absentes** |
| F-17 | File hors-ligne / idempotence | **Partiel** | Code + tests. `FILE_NOTES_ACTIVE=false` par défaut |
| F-18 | Jury, liens, verrouillage | **Absent** (UI) | RLS OK |
| F-19 | Classements live 3 modes × 2 méthodes, cas Alès | **Absent** | `app/lib/classements.ts` parse le palmarès texte. Pas de moteur, pas de tests CA-8 |
| F-20 | Masquer / révéler classement | **Absent** | Colonne `classement_visible` inutilisée en front |
| F-21 | Cockpit admin mobile | **Absent** | — |
| F-22 | QR + affiche PDF | **Absent** | — |
| F-23 | Export CSV/PDF résultats soirée | **Absent** | CSV supervision seulement |
| F-24 | Écran géant | **Absent** | Pas de route `/ecran` |
| F-25 | Avis 1–5 privé admin | **Absent** (UI) | Table + `prive.avis_ouvert` corrigé le 12/10 (`publiee` / déblocage) |
| F-26 | Notifications web / FCM / guide iPhone | **Absent** | Pas de `abonnements_push`, pas de `notifier` |
| F-27 | PWA un manifeste | **Absent** | `package.json` |
| F-28 | App Android + flag public | **Absent** | — |
| F-29 | Supervision charge | **Partiel** | `/admin` + `/admin/statistiques` + AAL2. Prod 200. 5 000 non certifiés |
| F-30 | Instantané `etat_soiree` | **Absent** | Table absente ; accueil figé `hors-soiree` |

**Totaux §4** : 5 couverts · 9 partiels · 16 absents (sur 30).

---

## 5. Critères d’acceptation §8

| CA | Intitulé | Statut | Commentaire |
|---|---|---|---|
| 1 | Inscription + 1re note < 2 min | **KO** | Inscription fermée ; soirée fermée |
| 2 | Note refusée si passage non débloqué (API) | **OK base** | Tests `rls-votes-public` |
| 3 | Mode libre borné à la fenêtre | **OK base** | idem |
| 4 | Une note / remplacement | **OK base** | UNIQUE + RLS |
| 5 | Spectateur ≠ jury ; juge rattaché | **OK base** | `rls-jury` |
| 6 | Déblocage visible < 10 s | **KO** | Pas d’instantané, pas de Realtime public |
| 7 | Import 4 fichiers réels | **KO** | Lot 3 absent |
| 8 | 3×2 classements, cas Vinuesa Alès | **KO** | Aucun moteur, aucun test |
| 9 | Charge 5 000 puis 7 500 | **KO** | Non certifié (`docs/audit-charge-5000.md`) |
| 10 | E2E parcours soirée complet | **KO** | E2E = vitrine / OTP mock / file mock / supervision mock |
| 11 | Notif < 15 s | **KO** | Lot 8 absent |
| 12 | Lighthouse ≥ 90 + pages vitrine | **Partiel** | Pages OK E2E/axe. JSON-LD `Event` absent. Lighthouse non relancé |
| 13 | Contact → boîte email | **KO** | Insert seulement (`serveur/contact.mjs`) |
| 14 | Android Play | **KO** | — |
| 15 | Supervision sans impacter le vote | **Partiel** | Code + tests unitaires ; recette déploiement limitée |
| 16 | Délai N min, refus API | **KO** | Colonnes `fin_passage_le` / `ferme_le` absentes |
| 17 | Changement d’ordre < 10 s | **KO** | Pas de cockpit |
| 18 | Fenêtre automatique + décalage | **KO** | Pas de `mode_fenetre` |

**CA démontrables aujourd’hui** : 2, 3, 4, 5 (base locale). **Aucun** des critères de soirée (1, 6–11, 13, 14, 16–18).

---

## 6. Schéma §5.2 et lots §9

### Tables CDC

**Présentes** : `profils`, `manades`, `soirees`, `soiree_manades`, `soiree_juges`, `epreuves`, `passages`, `notes_public`, `notes_jury`, `avis_soiree`, `file_notes`, `presences_authentifiees`, `supervision_serveur_minutes`, `calendrier`, `palmares`, `messages_contact`.

**Absentes** : `abonnements_push`, `parametres`, `photos`, `contenus`, `imports_planning`, `etat_soiree`.

**Colonnes « à ajouter » toujours absentes** : `mode_fenetre`, `delai_vote_minutes`, `fin_passage_le`, `ferme_le`.

Défaut `methode_general` : `'moyenne'` dans le schéma initial, corrigé en `'points'` par `20261011210432_sources_a_confirmer.sql` (aligné CDC). Tests DB le vérifient.

Edge Functions `extraire-planning` et `notifier` : **absentes** (`supabase/functions/` inexistant).

### Lots §9.1 — le CDC du 12/10 reste exact

| Lot | CDC | Vérification 13/10 |
|---|---|---|
| 0 Socle | Présent | Confirmé + AAL2, Turnstile, contact serveur, consentement confirmation |
| 1 Préparation admin | Non commencé UI | Confirmé |
| 2 Vote public | Partiel | Confirmé ; file inactive ; pas d’instantané ni classements |
| 3 Import IA | Non commencé | Confirmé |
| 4 Jury UI | Non commencé | Confirmé (SQL seulement) |
| 5 Cockpit + écran | Non commencé | Confirmé |
| 6 PWA / charge / e2e soirée | Partiel | Tests vitrine forts ; 4 E2E données ; pas de PWA ni k6 hébergé |
| 7 Vitrine | Présente | Confirmé ; prod `/admin` désormais 200 |
| 8 Notifications | Non commencé | Confirmé |
| 9 Android | Non commencé | Confirmé |

---

## 7. Non-fonctionnel §6

| Domaine | Statut |
|---|---|
| Français V1 | **Couvert** |
| Contrastes / 48 px / axe | **Partiel** — E2E accessibilité OK ; Lighthouse non relancé |
| RLS testée | **Couvert** en local (134 tests DB) |
| Secrets Anthropic / service_role | **Partiel** — service_role côté serveur contact/file/supervision ; pas d’IA |
| RGPD suppression compte + purge 24 mois | **Absent** (promesse dans `confidentialite.tsx` seulement) |
| JSON-LD `Event` | **Absent** |
| Email contact | **Absent** |
| Signature TPMGE / Atch | Présente dans la charte et le pied de page vitrine (hors recette soirée) |
| shadcn/ui | **Écart mineur** — CDC le cite, `package.json` n’a pas shadcn/Radix |

---

## 8. Contradictions encore ouvertes

| # | Sujet | Impact |
|---|---|---|
| C1 | README / recherche vs CDC sur le **modèle de notation** | **Atténué** : le README du 12/10 aligne le modèle 1–10. La recherche historique reste large ; le CDC est la source. |
| C8 | Nom « Olympiade des manades » introuvable | Risque marque / client (CDC §10) |
| C9 | Vitrine multi-villes vs app d’**une** soirée | Produit média vs outil. Accueil : carte vote = prochaine date **toutes villes** (Arles), affiche = Nîmes |
| Tests E2E Arles | CDC + SQL = prévisionnelle ; E2E = confirmée | Suite rouge, fausse alerte produit |
| README prod `/admin` 404 | Prod 200 le 13/10 | Doc interne périmée |
| Arles dans le calendrier noté | CDC : Fête des Gardians, **pas une olympiade** | Affichée comme prochaine soirée de vote |

Questions CDC §10 (soirée pilote, orga, photos, emails, domaine, Play) : **toujours ouvertes**. Sans les trancher, la vitrine reste un prototype éditorial.

---

## 9. Ce qui est vraiment utilisable aujourd’hui

Parcours visiteur **OK** (sous réserve E2E Arles / prévisionnelle) :

1. Accueil, classements, dates, contact, légal.
2. Bouton « Notez » grisé avec prochaine date.
3. Contact : validation, honeypot, Turnstile, dépôt en base via `/api/contact`.
4. `/inscription` joignable mais **fermée** (« Inscriptions bientôt ouvertes ») si le drapeau est faux.
5. `/noter` : date d’ouverture + saisie si session, boutons off si file inactive.
6. `/admin` : mot de passe + TOTP, statistiques.

Parcours soirée **inutilisable** : créer une soirée, importer un planning, débloquer, voter « pour de vrai », calculer un classement, afficher l’écran, notifier.

---

## 10. Priorité pour rendre le CDC « fonctionnel » au sens soirée

Ordre critique (inchangé, confirmé par le code actuel) :

1. Corriger les E2E Arles (prévisionnelle) et le README prod — **qualité du livrable actuel**.
2. Préparation admin (soirées, manades, épreuves, passages, réglages, statuts).
3. Brancher `ETAT_SOIREE` / planning réel + file activable en préprod.
4. Cockpit débloquer / fermer.
5. Moteur de classements + tests Alès (CA-8).
6. Email contact + SMTP Auth + Turnstile configuré en hébergé **avant** toute ouverture d’inscription.
7. Jury, écran géant, avis, suppression de compte.
8. Notifications, PWA, charge 5k/7,5k, Android.

Hors recette première soirée si besoin : import IA, Play Store public, 7 500 votants.

---

## 11. Conclusion

Le CDC v0.11 est **assez précis pour coder** et **aligné avec l’état du dépôt** sur les lots. Il n’est **pas** un contrat de recette d’une app de soirée livrée.

- **Fonctionnel maintenant** : vitrine + règles de vote en base + supervision + file (éteinte) + durcissements Auth/contact du 12/10.
- **Non fonctionnel** : tout le parcours organisateur / juge / spectateur votant / écran / notifs / Android.
- **Défauts du livrable actuel** : 4 E2E périmés (Arles), pas d’email de contact, pas de JSON-LD, mentions orga vides, README qui sous-estime la prod `/admin`.

*Fin de l’audit. Aucun commit. Aucune modification produit.*
