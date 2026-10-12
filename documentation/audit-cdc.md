# Audit du cahier des charges et de la cohérence produit

**Projet** : olympiade_manade  
**Date** : 12 octobre 2026  
**Auteur** : Aurélien (Product Manager)  
**Statut du CDC de référence** : `docs/CDC-MASTER.md` v0.10 (brouillon, « à valider ») du 11 octobre 2026  
**Méthode** : lecture croisée de la documentation et du code (routes, schéma SQL, écrans, tests). Ce document est un audit ; il ne réécrit pas le produit.

Convention : **Constat** = fait observé dans un fichier. **Recommandation** = proposition produit.

---

## 1. Synthèse exécutive

Le projet a un **CDC maître riche et actionnable** (`docs/CDC-MASTER.md`), plus une recherche de cadrage, une charte, une maquette et un dossier PDF. **Il n’existe pas de user stories formalisées, ni de tickets produit, ni de PRD distinct.** Le CDC v0.10 reste un brouillon à valider, avec 13 questions ouvertes côté organisateur.

**Le produit livré aujourd’hui n’est pas l’app de notation en soirée.** C’est un **site vitrine** (accueil, classements éditoriaux, dates, contact, mentions) plus un **socle de vote en base** (schéma, RLS, file de notes) et une **supervision d’admin**. L’état soirée public est encore figé à « hors soirée ». L’inscription publique est volontairement fermée. Il n’y a ni cockpit organisateur, ni jury, ni écran géant, ni notifications, ni PWA, ni app Android, ni moteur de classement calculé.

Écarts majeurs, par gravité :

1. **Deux cadrages coexistent.** Le README et `docs/recherche-olympiades.md` promettent une notation **configurable par critères, points, places, favori, étoiles**. Le CDC v0.10 a **tranché** : public 1–10, jury 10 ou 20, trois modes de classement. Le schéma SQL suit le CDC, pas le README. Risque : un lecteur (client, dev, PDF) croit encore le modèle large.
2. **CDC §9.1 daté du 11/10 est faux.** Il dit « lots 1 à 6, 8, 9 non commencés » alors que `/noter`, la file durable, le cache planning et `/admin/statistiques` existent dans le code.
3. **Critère de succès global non atteignable.** Une soirée réelle bout en bout (import, votes, classement) n’a pas d’écrans d’orchestration. Les critères d’acceptation 6 à 11 et 14 ne peuvent pas être démontrés.
4. **Client inconnu.** Le nom « Olympiade des manades » n’est pas attesté. Accord d’usage, soirée pilote, jury, photos et emails restent ouverts (CDC §10). La vitrine agrège déjà des soirées de plusieurs communes comme si le produit était le portail de toutes les olympiades camarguaises.
5. **RGPD annoncé mais incomplet.** Politique écrite ; **pas de suppression de compte dans l’app** ; pas de purge 24 mois dans le SQL ; encadré organisateur vide ; Turnstile et SMTP production absents.
6. **Données de référence incohérentes entre CDC et annuaire** : manades Bon et Labourayre au palmarès, absentes de `manades`.

Verdict produit : **le CDC V1 est suffisamment précis pour coder**, à condition de (a) le valider comme unique source de vérité, (b) figer le hors-scope du modèle de notation « large », (c) mettre à jour l’état des lots, (d) trancher les 13 questions organisateur avant d’ouvrir le public.

---

## 2. Inventaire documentaire

Aucun ticket Asana/GitHub, aucune user story au format « En tant que… », aucun fichier dans `documentation/` avant cet audit. Mémoire agent indisponible (MCP en erreur).

### 2.1 Documents produit

| Document | Chemin | Rôle | Statut observé |
|---|---|---|---|
| CDC maître | `docs/CDC-MASTER.md` | Exigences V1, rôles, règles, lots, critères, questions ouvertes | v0.10 brouillon à valider, 11/10/2026 |
| Recherche / cadrage | `docs/recherche-olympiades.md` | Sources terrain, options de notation, décisions du 10/10 | Toujours porteur du **modèle large** + addendum CDC |
| README | `README.md` | Accueil dépôt, supervision, PDF | **Décrit le modèle large**, pas le CDC tranché |
| Charte graphique | `docs/charte-graphique.md` | Design validé 10/10 | Référence visuelle, hors audit fonctionnel détaillé |
| Maquette v1 | `docs/maquette/README.md` + `src.html` | 11 écrans (public, spectateur, jury, orga, écran géant) | Validée 10/10 ; données fictives Nîmes 20/08/2027 |
| Dossier PDF 27 p. | `docs/pdf/` + `output/pdf/…` | Parcours illustrés | Spécification, **pas un constat de livraison** (dit le README PDF) |
| Photos libres | `docs/photos-libres.md` | Licences Wikimedia | Alimente la vitrine |
| File de notes | `docs/file-notes.md` | Règles file IndexedDB + Postgres | Aligné CDC §5.4.1 |
| Audit charge | `docs/audit-charge-5000.md` | Capacité 5 000 | **Non certifié** |
| Suivi post-lot 0 | `docs/superpowers/plans/suivi-apres-lot0.md` | Dettes techniques et portes d’ouverture public | Actionnable, mélange tech et produit |
| Plan lot 0A | `docs/superpowers/plans/2026-10-10-lot0a-schema-regles-rls.md` | Schéma + RLS | Référence CDC v0.4 |
| Plan lot 0B | `docs/superpowers/plans/2026-10-10-lot0b-supabase.md` | Projet Auth | Référence CDC v0.5 |
| Plan lot vitrine | `docs/superpowers/plans/2026-10-10-lot-vitrine.md` | Site public + inscription | Référence CDC v0.5 ; hors-plan déjà dépassé par `/noter` |

### 2.2 Ce qui n’existe pas (trou documentaire)

- PRD séparé, backlog user stories, personas nommés au-delà des rôles du CDC.
- Matrice d’exigences versionnée, changelog produit.
- Recette organisateur, règlement sportif officiel, DPA / validation juridique.
- Tickets (issues GitHub non inventoriées ici ; aucun fichier `ISSUE` / `stories` dans le dépôt).
- Tables `photos` et `contenus` prévues au CDC §5.2, explicitement « lot 1, pas encore créée ».

### 2.3 Code comme source implicite

| Zone | Fichiers clés |
|---|---|
| Routes / écrans | `app/routes.ts` (12 routes) |
| Schéma métier | `supabase/migrations/20261010120000_schema.sql` et suivantes |
| Règles de vote | `supabase/migrations/20261010120100_regles_vote.sql`, RLS votes/jury/planning |
| Vitrine données | `20261011090000_vitrine.sql`, `…90100_donnees_vitrine.sql`, `…90200_palmares_2026_dates_2027.sql` |
| Notation public | `app/routes/noter.tsx`, `app/lib/notation.ts`, `app/lib/file-notes.ts`, `app/lib/etat-soiree.ts` |
| Inscription | `app/lib/auth.ts`, `app/lib/inscription-ouverte.ts` |
| Admin charge | `app/routes/admin.tsx`, `app/routes/admin-statistiques.tsx` |
| Épreuves vitrine | `app/donnees/epreuves.ts` (4 épreuves figées, pas le catalogue admin) |

---

## 3. CDC reconstitué (objectifs, acteurs, parcours, règles, états)

Ce chapitre fusionne **l’intention CDC v0.10** et **ce que le code implémente vraiment**. Les deux sont distingués.

### 3.1 Objectif

**Intention (CDC §1)** : site vitrine + notation en direct (public et juges), organisateur qui pilote la soirée, éventuellement app Android interne. Critère de succès : une soirée réelle de bout en bout sans intervention technique.

**Constat code** : vitrine + inscription (fermée) + saisie public branchée à une file, **sans pilotage de soirée ni classements live**. Objectif de succès **non tenu**.

**Pourquoi maintenant (business)** : créer le canal numérique manquant (aucun site propre aux « Olympiades des manades »), différencier l’événement par un **prix du public** (absent des éditions documentées), et outiller l’organisateur le soir dans les arènes (réseau saturé).

### 3.2 Acteurs et rôles

| Persona | Intention CDC | Constat code |
|---|---|---|
| **Visiteur** | Consulte vitrine sans compte | **Couvert** : accueil, classements, dates, contact, légal |
| **Spectateur** | Prénom + email + code 6 chiffres, note 1–10, notifs, classement | **Partiel** : parcours inscription et `/noter` existent ; drapeau fermé ; votes jamais « ouverts » (`ETAT_SOIREE = 'hors-soiree'`) ; pas de notifs ni classement live ni avis UI |
| **Juge** | Lien magique / QR, note sur 10 ou 20 | **Schéma + RLS seulement**, aucun écran, aucun lien de connexion |
| **Admin / organisateur** | Préparation, import IA, cockpit, résultats, contenus vitrine | **Partiel** : login mot de passe + statistiques de charge. Pas de soirées, planning, juges, QR, export résultats |
| **Écran géant** | `/ecran/<soiree>` lecture seule | **Absent** (pas de route) |

Droits : le CDC exige RLS. **Constat** : RLS activée sur les tables métier ; tests `tests/db/rls-*.test.ts`. Un spectateur ne peut pas écrire une note jury (couvert en base, critère 5).

Canaux : site web toujours ; Android Capacitor + `app_ouverte_au_public` en V1. **Constat** : pas de Capacitor, pas de table `parametres`, pas de `vite-plugin-pwa` dans `package.json`. iOS hors V1 (CDC §7) — cohérent.

### 3.3 Parcours utilisateur (étapes + écrans)

#### Visiteur — vitrine

1. Accueil : bloc « Notez les Olympiades » en premier sur mobile (`BlocNoter`, `order-first`) — **couvert**. Bouton grisé hors soirée avec prochaine date — **couvert**. Affiche Nîmes, 4 épreuves, dernier vainqueur, saison, contact — **couvert**.
2. Classements : onglets années, palmarès éditorial, mention « à confirmer » — **couvert** (pas de live 2027).
3. Dates : saison à venir + archives — **couvert**. Données structurées `Event` — **non couvert** (CDC critère 12 partiel / §6 SEO).
4. Contact : formulaire prénom / email / message — **couvert en base** ; email organisateur — **non couvert** (critère 13). Anti-robot : honeypot, **pas Turnstile**.
5. Mentions + confidentialité — **couvert en pages**, contenu juridique à valider (encadré organisateur vide).

#### Spectateur — inscription et vote

1. Accueil → inscription si drapeau ouvert, sinon « Inscriptions bientôt ouvertes » — **couvert**.
2. Prénom, email, consentement confidentialité — **couvert**.
3. Code 6 chiffres + lien de secours — **couvert côté front et gabarits** ; envoi réel public **bloqué** (SMTP intégré, 2 emails/h, équipe seulement — audit charge).
4. Session persistante saison — intention Auth ; **non vérifié en production publique**.
5. Notifications — **non couvert**.
6. Noter 1–10, correction tant que ouvert, file hors-ligne — **code présent** ; activation `FILE_NOTES_ACTIVE` + migration file ; planning relu 10–12 s ; **état soirée jamais ouvert**.
7. Classement live — **non couvert** (table `etat_soiree` absente).
8. Avis 1–5 étoiles après fermeture — **table `avis_soiree`**, **aucun écran**.

#### Juge

Parcours maquette / CDC : QR → notation barème → correction jusqu’à verrouillage. **Aucun écran.**

#### Organisateur

Parcours CDC : mes soirées → préparation (manades, épreuves, import IA, juges, QR) → cockpit (débloquer / fermer) → résultats (révéler, CSV/PDF). **Non couvert**, sauf supervision charge.

### 3.4 Règles de gestion (métier)

Sources : CDC §4 et schéma `soirees` / `passages` / notes.

| Règle | CDC | Base | Front |
|---|---|---|---|
| Soirée : nom, date, lieu, fenêtre vote, manades ordonnées, épreuves, réglages, message public | Oui | Tables + enums | Non (pas d’admin) |
| Statuts soirée : `brouillon`, `publiee`, `en_cours`, `terminee`, `reportee`, `annulee` | Oui | Enum | Public ne lit pas le statut réel (`ETAT_SOIREE` constant) |
| Fenêtre vote défaut 19h–22h, bornes serveur, fin **exclue** | Oui | Oui (tests lot 0A) | Mode libre dans `passageOuvert()` |
| Mode `libre` vs `deblocage` ; déblocage épreuve ou manade | Oui | RLS | Planning + statuts passages |
| Une note public 1–10 par (spectateur, passage) ; remplacement | Oui | UNIQUE + RLS | File + UI |
| Email vérifié obligatoire pour voter | Oui | RLS | Session |
| Jury : demi-point, barème 10 ou 20 figé dès une note | Oui | Triggers | Non |
| Jury lié au public par défaut, dissociable | Oui | `jury_lie_au_public` | Non |
| Classement : moyenne par épreuve ; général moyenne **ou** points par place ; modes séparé / combiné / jury ; poids défaut 70 % | Oui | Colonnes `soirees` | **Aucun calcul** (`app/lib/classements.ts` = onglets palmarès) |
| Note manquante ≠ 0 ; classement provisoire si passage ouvert | Oui | Non calculé | Non |
| Ex æquo : même rang | Oui | Non calculé | Palmarès texte libre |
| Épreuve `notee` ou démonstration | Oui | `epreuves.notee` | Vitrine : 4 épreuves toutes présentées comme le format, sans flag démo |
| Import IA + revue humaine | Oui | Table `imports_planning` **absente** | Non |
| Annuaire manades réutilisable | Oui | Table + seed incomplet | Vitrine hardcodée `ManadesEdition` possible (à vérifier visuellement : édition Nîmes) |
| Gardians / composition d’équipe | Recherche oui ; CDC V1 **non** | Pas de table | Non |
| Contenu vitrine éditable sans redéploiement | CDC §4.0 | `calendrier` / `palmares` en SQL ; textes/photos fichiers | Relecture client palmarès/calendrier ; **pas d’écran admin contenus** |
| RGPD : consentement, 24 mois, suppression app, pas de newsletter | Oui | `consentement_le` à l’inscription (métadonnées) ; **pas de job 24 mois ni UI suppression** | Case consentement ; texte politique |

### 3.5 États

**Soirée (CDC / SQL)** : brouillon → publiée → en cours → terminée ; ou reportée / annulée (message public).

**Passage public** : `a_venir` | `ouvert` | `clos`.  
**Passage jury** : + `verrouille`.

**Note file** : reçue ≠ enregistrée (`pending` / `sending` / `queued` / `confirmed` / `rejected`).

**Inscription produit** : fermée (`VITE_INSCRIPTION_OUVERTE` ≠ `true`) vs ouverte.

**État vitrine public (code)** : seulement `hors-soiree` | `ouvert`, et **toujours** `hors-soiree` (`app/lib/etat-soiree.ts`).

**Calendrier** : `previsionnelle` | `confirmee` | `annulee`.  
**Palmarès** : `confirme` | `a_confirmer`.

---

## 4. Matrice couverture exigence vs implémentation

Légende : **C** couvert · **P** partiel · **N** non couvert · **H** hors-scope V1 assumé.

### 4.1 Fonctionnel CDC §4

| ID | Exigence | Statut | Preuve |
|---|---|---|---|
| F-01 | Accueil mobile « Notez les Olympiades » sans scroll | **P** | `BlocNoter` + tests e2e accueil ; Lighthouse cité CDC, non revérifié ici |
| F-02 | Bouton grisé hors soirée + prochaine date | **C** | `BlocNoter` + `ETAT_SOIREE` |
| F-03 | Photos, 4 épreuves, dernier vainqueur | **C** | `Epreuves`, `DernierVainqueur`, photos libres |
| F-04 | Classements 2025 / 2026 / 2027 | **P** | Onglets dynamiques 3 années ; 2027 = calendrier sans votes live |
| F-05 | Palmarès éditorial + source + « à confirmer » | **C** | `palmares` + `lireClassement` |
| F-06 | Dates 2027 + archives | **C** | `calendrier` + `/dates` |
| F-07 | Contact enregistré + email orga + Turnstile | **P** | Insert SQL + honeypot ; **pas d’email, pas Turnstile** |
| F-08 | Mentions / confidentialité | **P** | Pages présentes ; éditeur vide ; avocat non validé |
| F-09 | Contenus / photos / dates / palmarès gérés par admin | **N** | Migrations + fichiers dépôt |
| F-10 | CRUD soirées, duplication, statuts, message report/annul | **N** | Schéma seulement |
| F-11 | Annuaire manades (logo, ville) | **P** | Table + seed ; pas d’UI ; Bon / Labourayre manquants |
| F-12 | Planning : modèle 4 épreuves, saisie, passages | **N** | Épreuves vitrine statiques |
| F-13 | Décalage +N min | **N** | — |
| F-14 | Import IA PDF/photo/Word/Excel + revue | **N** | Pas d’Edge Function, pas `imports_planning` |
| F-15 | Inscription OTP + consentement | **P** | Front + Auth ; fermée ; Turnstile/Brevo absents |
| F-16 | Vote public 1–10, 2 modes, RLS | **P** | SQL + `/noter` + file ; soirée jamais ouverte côté UI globale |
| F-17 | File hors-ligne / idempotence | **P** | Code + tests ; activation serveur explicite |
| F-18 | Notation jury + liens + verrouillage | **N** | SQL seulement |
| F-19 | Classements live 3×2 + barèmes + cas Alès | **N** | Pas de moteur ; tests classements = parsing palmarès |
| F-20 | Masquer / révéler classement | **N** | Colonne `classement_visible` inutilisée en front |
| F-21 | Cockpit admin mobile | **N** | — |
| F-22 | QR + affiche PDF | **N** | — |
| F-23 | Export CSV/PDF résultats | **N** | CSV supervision charge seulement |
| F-24 | Écran géant `/ecran/<soiree>` | **N** | Pas de route |
| F-25 | Avis soirée 1–5 privé admin | **N** | Table sans UI |
| F-26 | Notifications web / FCM / guide iPhone | **N** | Pas `abonnements_push` |
| F-27 | PWA un manifeste | **N** | `package.json` sans plugin PWA |
| F-28 | App Android + flag public | **N** | — |
| F-29 | Supervision charge admin | **P** | `/admin`, `/admin/statistiques` ; migration + clés à déployer ; 5 000 non certifiés |
| F-30 | Instantané `etat_soiree` | **N** | Explicitement restant lot 2 (CDC + audit charge) |

### 4.2 Non fonctionnel CDC §6 et critères §8

| ID | Exigence | Statut |
|---|---|---|
| CA-1 | Inscription + 1re note < 2 min | **N** (inscription fermée ; soirée fermée) |
| CA-2 | Note refusée si non débloqué (y compris API) | **C** en tests DB |
| CA-3 | Mode libre borné à la fenêtre | **C** en tests DB |
| CA-4 | Une note / remplacement | **C** en tests DB |
| CA-5 | Spectateur ≠ jury ; juge rattaché | **C** en tests DB |
| CA-6 | Déblocage visible < 10 s | **N** (pas d’instantané) |
| CA-7 | Import 4 fichiers réels | **N** |
| CA-8 | 3 modes × 2 méthodes, cas Vinuesa Alès | **N** |
| CA-9 | Charge 5 000 puis 7 500 | **N** (audit : non certifié) |
| CA-10 | E2E parcours complet soirée | **N** (e2e vitrine / inscription / file / supervision) |
| CA-11 | Notif < 15 s | **N** |
| CA-12 | Lighthouse ≥ 90 accueil / classements / dates / contact | **P** (mesuré localement selon CDC §9.1 ; `Event` JSON-LD absent) |
| CA-13 | Contact → boîte email | **N** |
| CA-14 | Android Play test interne | **N** |
| CA-15 | Supervision sans impacter le vote | **P** (code + tests ; déploiement incomplet) |
| NF-RGPD | Suppression compte + purge 24 mois | **N** (texte seulement) |
| NF-FR | Français V1 | **C** UI |
| NF-Access | AA, 48 px | **P** (tests contrastes / a11e e2e) |
| NF-Sécu | Secrets serveur, RLS testée | **P** (RLS oui ; clés Anthropic n/a tant que lot 3 absent) |

### 4.3 Exigences de la recherche **non reprises** dans le CDC V1

À traiter comme **hors-scope V1 recommandé** (voir §6), pas comme bugs, **si** le CDC est confirmé unique source :

- Critères personnalisés, notes par critère, coefficients d’épreuves.
- Vote public étoiles / favori / préférences (le CDC a fixé 1–10).
- Gardians nominatifs, tentatives multiples, pénalités, disqualifications.
- Barème par épreuve distinct du barème soirée.
- Championnat saison (déjà hors V1 CDC §7).

---

## 5. Écarts, contradictions, ambiguïtés

### 5.1 Contradictions (à trancher)

| # | Sujet | Document A | Document B / code | Impact |
|---|---|---|---|---|
| C1 | Modèle de notation | README + recherche : critères, points, places, favori, étoiles | CDC + SQL : 1–10 public, 10/20 jury, moyenne ou points de place | **P0** — double promesse |
| C2 | Poids jury défaut | Recherche : « aucune valeur officielle, combiné désactivé tant que non configuré » | CDC : défaut 70 %, mode `separe` par défaut | Ambiguïté « officiel » vs réglage |
| C3 | État des lots | CDC §9.1 : lots 1–6, 8, 9 non commencés | Code : file notes, `/noter`, supervision | Pilotage et estimation faux |
| C4 | Admin Auth | CDC : email + mot de passe | Suivi lot 0 : admin joignable aussi par OTP 6 chiffres ; 2FA exigé avant 1er admin | Trou sécu produit |
| C5 | `/noter` dans le plan vitrine | Plan vitrine : page d’attente seulement | Code : saisie + file | Doc de lot obsolète |
| C6 | Annuaire vs palmarès | CDC 2.3 liste Bon, Labourayre | Seed `manades` sans Bon ni Labourayre ; palmarès les cite | Intégrité données |
| C7 | Stack UI | CDC : Tailwind + shadcn/ui | `package.json` : pas de shadcn ; un composant OTP « enveloppe shadcn » | Mineur |
| C8 | Nom du produit | Site « Olympiade des Manades » | Aucune source publique de ce nom ; événements = « Olympiades des gardians / camarguaises » | Risque marque / client |
| C9 | Périmètre géographique | CDC = app **d’un** événement client, données de recherche comme **modèle** | Vitrine = calendrier **national** de dizaines de soirées | Produit « média des olympiades » vs outil d’une soirée |
| C10 | Beaucaire 2027 | CDC tableau : mar. 20/07/2027 | Première graine 19/07 puis update 20/07 — **aligné après migration 90200** | Résolu en base ; rester vigilant à la double saisie |

### 5.2 Ambiguïtés (CDC pas assez testable)

- **Quelle soirée pilote ?** Sans réponse §10.1, on ne sait pas si le calendrier multi-villes est du contenu éditorial temporaire ou le produit.
- **« Classements 2027 »** : live de **toutes** les soirées du calendrier, ou seulement celle outillée par l’app ?
- **Visiteur vs spectateur sur l’accueil** : le bouton reste grisé hors soirée même pour un inscrit ; l’inscrit peut quand même ouvrir `/noter` (planning vide / fermé). Parcours OK, mais le CDC dit « directement à la notation si déjà inscrit » — vrai seulement si `etat === ouvert`.
- **Fenêtre 19h–22h** vs soirées réelles 21h–23h30 : le défaut SQL n’est pas visible (pas d’UI), mais le CDC lui-même signale l’écart.
- **Avis `avis_ouvert`** : suivi lot 0 point 10 — peut s’ouvrir alors qu’un passage est encore ouvert. Règle produit floue.
- **Figer les résultats** à `terminee` vs purge RGPD qui recalculerait les moyennes (suivi lot 0 point 11) : **dette métier critique** non dans le CDC §4.6.
- **Arles 01/05/2027** : « Fête des Gardians, jeux de gardians » — est-ce une olympiade notée ou un autre format ? Affichée comme date du produit.
- Critères d’acceptation **1, 6, 9, 11, 12** : mesurables, mais **non branchés à un protocole de recette** (qui mesure, quel build, quel téléphone).
- CA-1 « sans rien installer » vs notifs iPhone qui **exigent** l’écran d’accueil : compatible si la 1re note n’a pas besoin des notifs — à expliciter.

### 5.3 Dettes produit

- CDC non validé (statut brouillon) alors que du code et un site Railway existent.
- Questions §10 ouvertes alors que palmarès et calendrier sont déjà publics.
- Encadré responsable de traitement vide en production juridique.
- Inscription construite mais **dangereuse à ouvrir** sans Turnstile (API OTP appelable avec la clé publique — suivi lot 0).
- File et supervision **présentées dans le README** comme capacités, alors qu’elles demandent migrations + flags : risque de sur-promesse interne.
- Maquette 11 écrans vs 12 routes web, dont 2 admin charge et 0 cockpit : **écart design / backlog** non réconcilié dans le CDC §9.
- Commentaires « SITE-AM » à neutraliser avant livraison client (suivi lot 0) — dette comm, pas métier.

### 5.4 Clarté des critères d’acceptation

**Bons** (observables, déjà prouvés en DB) : CA-2 à CA-5.

**Bons mais non exécutables aujourd’hui** : CA-6, 7, 8, 9, 10, 11, 13, 14.

**À préciser** :

- CA-1 : définir réseau, appareil, soirée de test, clock.
- CA-8 : figer le **jeu de données Alès 2026** (notes exactes, pas seulement le récit presse).
- CA-9 : environnement = préprod équivalente, pas le SQL local (déjà dit dans l’audit charge ; à remonter en critère produit).
- CA-12 : pages exactes, profil Lighthouse, machine ; JSON-LD comme sous-critère séparé.
- CA-15 : « sans effet sur l’enregistrement d’une note » — OK, déjà testé unitairement ; manque recette déploiement.

**Manquants** (à ajouter au CDC) :

- Suppression de compte (parcours + délai).
- Comportement report / annulation côté public (message, votes gelés) — testé en DB, pas en CA listés.
- Règle d’ouverture des avis.
- Figage des classements à la clôture (anti-dérive RGPD).
- Soirée pilote et nom officiel comme **critères d’entrée** de recette, pas seulement questions.

---

## 6. Hors-scope recommandé

Conserver le hors-scope CDC §7, et **ajouter** explicitement (recommandation) :

**Déjà hors V1 (CDC, à garder)**  
Billetterie / paiement / dons ; iOS App Store ; vote SMS / billet ; commentaires publics ; i18n ; pubs hors mention Atch ; championnat annuel / stats multi-soirées ; newsletter.

**À déclarer hors V1 pour tuer C1**  
Notation par critères, étoiles, favori, ranking de préférences, pénalités, tentatives, gardians nominatifs, barème distinct par épreuve, combiné auto-désactivé « tant que non configuré » (remplacé par les 3 modes du CDC).

**À sortir du V1 « soirée réelle » si le calendrier n’est pas le produit**  
Tenir à jour toutes les olympiades de la région comme média. Alternative : vitrine = **une** soirée pilote + archives de cette série.

**Hors recette première soirée (reste interne)**  
Certification 7 500 votants, Play Store public, import IA (peut se faire en saisie manuelle pour la 1re soirée), app Android (PWA écran d’accueil suffit pour orga — à confirmer avec l’orga).

**Hors produit**  
Règlement sportif officiel des manades ; modération bien-être animal ; reprise de photos de presse.

---

## 7. Backlog gaps (MoSCoW)

Priorité **Must** = bloquant pour une soirée pilote ou pour un CDC unique. Effort S/M/L/XL indicatif produit, pas d’archi.

### Must — P0

| ID | Gap | Pourquoi | Taille |
|---|---|---|---|
| M1 | Valider le CDC v0.10 comme **seule** source ; aligner README, recherche (bandeau « options abandonnées V1 »), PDF | Évite de coder le mauvais modèle | S |
| M2 | Trancher les 13 questions §10 (soirée, nom, orga, photos, emails, domaine) | Sans client, la vitrine est un prototype orphelin | S (atelier) |
| M3 | Admin préparation soirée : manades, épreuves, passages, réglages, statuts, message report | Sinon aucun événement à noter | L |
| M4 | Cockpit débloquer / fermer + confirmation actions irréversibles | Cœur du mode déblocage | M |
| M5 | Brancher `ETAT_SOIREE` et l’instantané public (ou équivalent planning déjà caché) | Aujourd’hui le public ne peut pas voter « pour de vrai » | M |
| M6 | Moteur classements + tests Alès + visibilité masquer/révéler | Critère succès + CA-8 | M |
| M7 | Portes d’ouverture inscription : Turnstile, Brevo, consentement horodaté, URLs prod, flag | Sinon OTP abus / emails morts | M |
| M8 | Email contact organisateur | CA-13 ; formulaire aujourd’hui « trou noir » | S |
| M9 | Figage résultats à `terminee` + règle avis | Cohérence classement / RGPD | S |
| M10 | Compléter annuaire (Bon, Labourayre, etc.) et source unique calendrier/palmarès | Données affichées contradictoires | S |
| M11 | Mettre à jour CDC §9.1 (lots réellement commencés) | Pilotage | S |

### Should — P1

| ID | Gap | Pourquoi | Taille |
|---|---|---|---|
| S1 | Jury : création, lien/QR, saisie, retardataires, verrouillage | Prix jury réel | M |
| S2 | Écran géant | Usage arènes | M |
| S3 | Avis soirée UI (spectateur + lecture admin) | Demandé, table déjà là | S |
| S4 | Notifications + bannière secours | CA-11 ; file d’attente humaine le soir | L |
| S5 | PWA / écran d’accueil | Admin et iPhone sans store | M |
| S6 | Suppression de compte + purge 24 mois (job) | Promesse confidentialité | M |
| S7 | JSON-LD `Event` page Dates | SEO CDC | S |
| S8 | Admin contenus vitrine (textes, photos, palmarès) | Évite redéploiement | M |
| S9 | 2FA admin | Suivi lot 0 | S |
| S10 | Recette charge préprod 5k/7,5k | CA-9 | XL |
| S11 | User stories + CA par lot dans le CDC (format §output) | Recette Elena / implémentation | M |

### Could — P2

| ID | Gap | Taille |
|---|---|---|
| C-a | Import IA planning | L |
| C-b | App Android + FCM + `app_ouverte_au_public` | XL |
| C-c | Export CSV/PDF résultats grand public | S |
| C-d | Décalage horaire +N min | S |
| C-e | Duplication de soirée | S |
| C-f | Guide iPhone notifications | S |

### Won’t — P3 / V1

Tout le §6 (critères custom, iOS store, billetterie, championnat, i18n, commentaires publics, gardians nominatifs).

---

## 8. Conclusion et prochaines actions produit

### CDC consolidé — version actionnable (proposition)

**Nom de feature** : Olympiade des manades V1 — **P0** — **XL** (ensemble des lots 0–9 ≈ 19 j estimés, **réellement** : vitrine + socle DB + file + supervision déjà entamés).

**Objectif** : Permettre au public d’une soirée identifiée de noter chaque passage (1–10) et à l’organisateur de piloter déblocages et classements (jury et/ou public) sans équipe tech sur place.

**Portée IN** : vitrine FR mobile-first ; inscription email+code ; deux modes de vote ; jury 10/20 ; classements configurables (3 modes, 2 méthodes) ; file de notes ; RLS ; supervision interne ; PWA. Android si temps, sinon Won’t de la première soirée.

**Portée OUT** : voir §6.

**Personas** : visiteur, spectateur, juge, admin, écran (lecture).

**Règle d’or** : l’heure serveur et la base refusent tout vote illégal ; l’UI ne fait pas foi.

**Entrée de recette** : questions §10 1–6 et 10 tranchées ; SMTP + captcha ; une soirée brouillon en préprod.

**Sortie de recette** : CA-1 à CA-6, CA-8, CA-10, CA-13, CA-15 verts ; CA-9 avant **première** soirée réelle (peut être après une générale à blanc).

### Prochaines actions (ordre)

1. **Atelier validation CDC** (orga + produit) : unique source de vérité, tuer C1, répondre §10, confirmer si la vitrine multi-villes reste.
2. **Patch documentaire** (sans changer le code métier) : README, bandeau recherche, CDC §9.1, liste Must.
3. **Lot « soirée pilote »** : M3 + M4 + M5 + M6 (préparation, cockpit, état public, classements) — c’est le chemin critique vers le critère de succès global.
4. **Lot « ouverture publique »** : M7 + M8 + S6 partiel (légal).
5. **Lot « soirée en arènes »** : S1, S2, S4, S5, puis S10.
6. Formaliser les user stories Must avec critères Gherkin pour Morgan / Sébastien / Elena.

### Pour Morgan (archi) et Onyx (design)

- Ne pas élargir le modèle de notation.
- Réconcilier la maquette (11 écrans) avec les écrans réellement Must (cockpit, jury, écran géant) vs déjà livrés (vitrine, admin stats).
- `etat_soiree` vs cache planning `/api/notation/planning` : un seul contrat public à figer.

### Pour Elena (recette)

- Base déjà solide sur CA-2–5.
- Trous : CA-8 (jeu Alès), CA-1/10 (parcours E2E soirée), CA-9 (préprod), CA-13 (mail réel).

---

*Fin de l’audit. Aucun commit. Aucune modification produit.*
