# Séquence d'e-mails : plan d'implémentation

> **Pour les agents qui exécutent ce plan :** sous-skill requis : superpowers:subagent-driven-development. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** les inscrits (spectateurs + abonnés confirmés) reçoivent une séquence d'e-mails liée à leur date. L'admin en édite les textes, avec des variables de date et un aperçu en direct.

**Architecture :**

| Couche | Ce qu'elle fait |
|---|---|
| Postgres (une migration) | Stocke modèles, destinataires, rattachements et envois. Des déclencheurs alimentent les destinataires. Une RPC réservée à `service_role` renvoie les données utiles à l'instant T. |
| Fonction pure `calculerEnvois` | Décide quoi envoyer. |
| Rendu partagé, isomorphe | Produit l'e-mail et l'aperçu de l'admin. |
| Planificateur dans le serveur Node | Réserve les envois en base (unicité), envoie en SMTP avec un débit plafonné. |

L'admin lit et écrit par supabase-js sous RLS. Il appelle 4 endpoints serveur (test, message, état, liens).

**Stack :** React Router 8 (SPA, prérendu partiel), Tailwind v4, Node ESM `.mjs` `// @ts-check`, Supabase (PostgREST, RLS `prive.est_admin()`), Vitest (projets `unit` et `db`), Playwright + axe.

**Spec :** `docs/superpowers/specs/2026-10-17-sequence-emails-design.md` (à lire avant toute tâche).

## Contraintes globales

### Fichiers et conventions

- **Isomorphisme** : aucun nouveau paquet npm. `serveur/gabarits-emails.mjs` et `serveur/echeances-emails.mjs` n'importent rien de `node:*`, car l'admin les importe.
- **Migration unique** : `supabase/migrations/20261017160000_sequence_emails.sql`.
- **Fuseau** : toutes les heures et tous les « jours » sont calculés en Europe/Paris, avec `Intl.DateTimeFormat` et `timeZone: 'Europe/Paris'`. Les changements d'heure doivent être corrects.
- **Clés d'étape exactes** : `confirmation`, `bienvenue`, `j_moins_7`, `veille`, `jour_j`, `lendemain`, `prochaines_dates`, `annonce`, `message`.

### Valeurs par défaut des étapes

| Étape | Jours | Heure |
|---|---|---|
| `confirmation` | immédiat | — |
| `bienvenue` | immédiat | — |
| `j_moins_7` | -7 | 10:00 |
| `veille` | -1 | 18:00 |
| `jour_j` | 0 | 10:00 |
| `lendemain` | +1 | 10:00 |
| `prochaines_dates` | +7 | 10:00 |
| `annonce` | -10 | 10:00 |

Bornes éditables par l'admin : jours de -30 à 30, heure de 07:00 à 21:00.

### Règles d'envoi

- **Fenêtre d'envoi** : une étape due part dans les 12 h qui suivent son échéance. Au-delà, elle est enregistrée `saute` avec la raison `fenetre_depassee`.
- **Plafond journalier** : 1 e-mail automatique par personne et par jour, heure de Paris. `confirmation` et `message` en sont exclus ; `bienvenue` compte.
- **Plafond des annonces** : 1 e-mail `annonce` par personne tous les 7 jours glissants. Une annonce bloquée est reportée, jamais enregistrée `saute`.
- **Liens signés** :
  - `confirmation` : valable 7 jours ;
  - `je_viens` : valable jusqu'à 23:59 (Paris) le jour de la date ;
  - `desinscription` : sans expiration.
- **Purges** :
  - envois de plus de 12 mois ;
  - abonnés non confirmés 30 jours après l'envoi **réel** (`reel = true`, `envoye`) de leur confirmation. Jamais avant que la confirmation soit vraiment partie.

### Variables d'environnement

| Variable | Usage |
|---|---|
| `EMAILS_FROM` | Expéditeur, par exemple `Olympiade des Manades <bonjour@olympiadedesmanades.fr>` |
| `EMAILS_CLE_LIENS` | 64 caractères hexadécimaux. Absente : planificateur et liens désactivés, 503 |
| `EMAILS_DEBIT_PAR_SECONDE` | Défaut 5, bornes 1 à 20 |
| `SMTP_MODE`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Réutilisées telles quelles |
| `CONTACT_ORIGIN` | Origine publique des liens |

### Textes figés

- **Consentement aux annonces** (version `2026-10-17`, constante `CONSENTEMENT_ANNONCES_TEXTE` dans `serveur/gabarits-emails.mjs`, copiée à l'identique dans la migration) :
  « J’accepte de recevoir par email l’annonce des prochaines dates de l’Olympiade des Manades. »
- **Case du formulaire spectateur** (décochée) :
  « Recevoir aussi l’annonce des prochaines dates (facultatif) »
- **Texte d'usage du formulaire spectateur** :
  « Votre prénom et votre email servent à l’inscription, au vote du public et aux rappels de votre date. Chaque email contient un lien de désinscription. »
  La juriste le relit en tâche 8.

### Copie et charte

- **Copie** : apostrophes typographiques `’`, guillemets « », espace insécable avant `; : ! ?`, comme dans le reste du site.
- **Couleurs** (hex de `app/app.css`) :

| Rôle | Couleur |
|---|---|
| Fond | sable `#f7f4ed` |
| Carte | crème `#fcfbf7` |
| Filets | trait `#e3dacb` |
| Texte | encre `#1c1912` |
| Texte secondaire | encre-2 `#5a5246` |
| Filet d'accent | or `#b78649` |
| Liens | or-ink `#88693c` |
| Bouton | fond encre `#1c1912`, texte crème |

### Git

- `build/` et `test-results/` sont suivis par git. Après chaque build : `git checkout -- build test-results`.
- Ajouter les fichiers nommément, jamais `git add -A`.
- Pas de `Co-Authored-By`.
- Commits en français, préfixes `feat(emails)` / `fix(emails)` / `test(emails)`.

### Commandes de vérification

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:db` (Postgres local, socket `/tmp`, comme les tests existants)
- `pnpm test:e2e <fichiers>` (variables Supabase publiques exportées, comme `tests/outils/test-e2e.ts`)

## Points d'attention de la revue

1. **Réinscription après désinscription** : une adresse désinscrite qui revient par le formulaire actualités redevient abonnée non confirmée. Elle reçoit une **nouvelle** confirmation ; l'ancienne ligne d'envoi `confirmation` ne doit pas la bloquer. Test en tâche 1.
2. **Même adresse spectateur et abonnée** : une seule ligne de destinataire.
   - Si l'adresse est déjà vérifiée par le code spectateur, l'abonnement ne demande pas de confirmation et active les annonces.
   - L'inverse se combine aussi.

   Test en tâche 1.
3. **Scanners de liens** : Outlook et les antivirus ouvrent les liens en GET. Aucun GET ne change d'état : seuls les POST le font. Test en tâche 5.
4. **Date déplacée après l'envoi du J-7** : le J-7 ne repart pas, la veille se cale sur la nouvelle date. Même chose pour le passage à l'heure d'hiver : une veille à 18:00 reste à 18:00 heure de Paris. Test en tâche 3.
5. **Texte d'admin piégé** :
   - `<script>` ou prénom `<img onerror>` : échappés ;
   - variable inconnue `{{truc}}` : rendue vide, et l'éditeur l'affiche en alerte ;
   - lien `javascript:` : rendu en texte simple.

   Test en tâche 2.

---

## Ordre d'exécution

| Phase | Tâches | Mode |
|---|---|---|
| A | 1 et 2 à 4 | En parallèle, 2 worktrees |
| B | 5 et 6–7 | En parallèle, après fusion de A |
| C | 8 | Revues croisées, captures, corrections, rebase |

L'orchestrateur fusionne chaque worktree dans `feat/sequence-emails`.

---

### Tâche 1 : schéma, déclencheurs, RPC (bernard:sebastien)

**Fichiers :**
- Créer : `supabase/migrations/20261017160000_sequence_emails.sql`
- Créer : `tests/db/sequence-emails.test.ts`
- Modifier : `tests/db/catalogue.test.ts` (nouvelles tables et colonnes au catalogue)

**Interfaces produites :**

**Tables.** Pour chacune : `revoke all` d'abord, puis les droits listés.

- **`public.modeles_emails`**
  - Colonnes :
    - `cle text pk`, limité aux 9 clés ;
    - `nom text` ;
    - `actif bool default true` ;
    - `sujet text`, 1 à 200 caractères ;
    - `preheader text`, 0 à 200 ;
    - `corps text`, 1 à 8000 ;
    - `encart text null`, 0 à 4000, non nul seulement pour `bienvenue` ;
    - `jours_decalage smallint null`, de -30 à 30 ;
    - `heure_envoi time null`, de 07:00 à 21:00 ;
    - `modifie_le`, `modifie_par`.
  - Déclencheur : comme `prive.marquer_parametres_cookies`, il force `modifie_le` et `modifie_par`.
  - Droits :
    - admin : `select`, et `update` sur `actif, sujet, preheader, corps, encart, jours_decalage, heure_envoi` ;
    - `service_role` : `select`.
  - La migration n'insère **aucune** ligne. Le serveur sème les lignes manquantes au démarrage depuis `MODELES_DEFAUT` (tâche 5). `service_role` reçoit donc `insert` sur toutes les colonnes, sauf `modifie_le` et `modifie_par`.
- **`public.destinataires_emails`**
  - Colonnes :
    - `id uuid pk` ;
    - `email`, unique, normalisé, avec la même contrainte que `abonnements_actualites` ;
    - `prenom text null` (60 caractères au plus) ;
    - `profil_id uuid null unique`, avec `references profils on delete set null` ;
    - `abonne bool` ;
    - `annonces bool` ;
    - `annonces_le`, `annonces_texte`, `annonces_version` ;
    - `confirme_le timestamptz null` ;
    - `inscrit_le` ;
    - `desinscrit_le null` ;
    - `modifie_le`.
  - Droits :
    - admin : `select` ;
    - `service_role` : `select`, `delete`, et `update (confirme_le, annonces, annonces_le, annonces_texte, annonces_version, desinscrit_le)`.
- **`public.rattachements_emails`**
  - Colonnes :
    - `destinataire_id`, avec cascade ;
    - `calendrier_id`, avec cascade ;
    - `origine`, parmi `inscription`, `je_viens`, `premiere_confirmation` ;
    - `cree_le`.
  - Clé primaire : `(destinataire_id, calendrier_id)`.
  - Droits : admin `select` ; `service_role` `select` et `insert`.
- **`public.messages_inscrits`**
  - Colonnes :
    - `id` ;
    - `calendrier_id`, avec `on delete set null` ;
    - `sujet`, `corps` ;
    - `cree_par` ;
    - `cree_le` ;
    - `destinataires int`.
  - Droits : admin `select` ; `service_role` `select` et `insert`.
- **`public.envois_emails`**
  - Colonnes :
    - `id` ;
    - `destinataire_id`, avec cascade ;
    - `etape` ;
    - `calendrier_id null`, avec cascade ;
    - `message_id null`, avec cascade ;
    - `reel bool` ;
    - `statut`, parmi `en_attente`, `envoye`, `simule`, `echec`, `saute` ;
    - `raison text null` (200 caractères au plus) ;
    - `tentatives smallint default 0` ;
    - `prevu_le` ;
    - `envoye_le null` ;
    - `cree_le`.
  - Contrainte : **`unique nulls not distinct (destinataire_id, etape, calendrier_id, message_id, reel)`**.
  - Droits :
    - admin : `select` ;
    - `service_role` : `select`, `insert`, `delete`, et `update (statut, raison, tentatives, prevu_le, envoye_le)`.

**Autres objets.**

- **Vue `public.bilan_envois_emails`** (`security_invoker = on`)
  - Colonnes : `etape`, `calendrier_id`, `reel`, `statut`, `nombre`, `dernier_envoi`.
  - Droits : admin `select`.
- **`public.calendrier.infos_pratiques`** : `text null`, 1000 caractères au plus. L'admin l'édite avec les droits existants.
- **`abonnements_actualites`** : ajout de `grant delete to service_role`.

**Déclencheurs** (fonctions `prive.*`, `security definer`, `search_path = ''`) :

- **Après insertion dans `abonnements_actualites`** : *upsert* du destinataire par e-mail.
  - `abonne = true`, `annonces = true`, avec le texte et la version de l'abonnement.
  - S'il était désinscrit : `desinscrit_le = null`, puis suppression de ses envois `confirmation` et `bienvenue`.
  - Si `profil_id` est nul (personne non vérifiée) : `confirme_le = null`.
- **Après suppression dans `abonnements_actualites`** : `abonne = false`.
  - Sans profil et sans `desinscrit_le` : la ligne est supprimée (effacement demandé par l'admin).
  - Avec `desinscrit_le` : la ligne est gardée comme liste d'opposition, avec `annonces = false`.
- **Sur `auth.users`** (après insertion, et après mise à jour de `email_confirmed_at`), quand l'e-mail est confirmé et que `raw_user_meta_data->>'consentement' = 'true'` : *upsert* par e-mail.
  - `profil_id` et `prenom` ;
  - `confirme_le` = `coalesce` de l'existant et de `email_confirmed_at` ;
  - si `raw_user_meta_data->>'annonces' = 'true'` : `annonces = true` avec `CONSENTEMENT_ANNONCES_TEXTE`.
  - Un juge créé par l'admin (sans `consentement`) n'entre jamais.
- **Avant suppression dans `profils`** : la ligne de destinataire est supprimée si elle n'est pas abonnée. Sinon `profil_id = null`.
- **Rattachement** : `prive.rattacher_prochaine_date(destinataire uuid, origine text)` insère la prochaine date `confirmee` dont `date_soiree` ≥ aujourd'hui (Paris), `on conflict do nothing`. Elle est appelée :
  - après l'insertion d'un destinataire déjà confirmé ;
  - quand `confirme_le` passe de nul à non nul.
- **Date qui passe à `confirmee`** (insertion ou mise à jour de `calendrier`) : si c'est la prochaine date confirmée, on y rattache, avec l'origine `premiere_confirmation`, chaque destinataire confirmé, non désinscrit et sans rattachement à une date ≥ aujourd'hui - 7.

**RPC `public.emails_a_traiter(p_maintenant timestamptz) returns jsonb`**
- `security definer`, `execute` pour `service_role` seulement (`revoke` de `public`, `anon`, `authenticated`).
- Renvoie `{ modeles, dates, prochaines, destinataires, rattachements, envois }` :

| Clé | Contenu |
|---|---|
| `modeles` | Les 9 lignes |
| `dates` | Lignes `calendrier` de J-8 à J+17 (Paris), tous statuts. Chaque date est enrichie : `soiree` (`{ slug, statut }` ou `null`), `manades` (noms dans l'ordre de `soiree_manades.ordre`), `vainqueur` (`palmares` `confirme` de même date et même ville, sinon `null`) |
| `prochaines` | Les 6 prochaines dates `confirmee` après aujourd'hui, même forme que `dates` |
| `destinataires` | Non désinscrits, avec `email`, et dans l'un de ces cas : rattachés à une date de `dates` ; abonnés non confirmés inscrits depuis moins de 30 jours ; confirmés depuis moins de 24 h ; consentants aux annonces quand une date confirmée de `dates` est à venir |
| `rattachements` | Ceux de ces destinataires vers une date de `dates` |
| `envois` | Ceux de ces destinataires créés depuis moins de 10 jours, ou portant sur une date de `dates` |

- [ ] **Étape 1 : écrire les tests db (échec attendu).** Fichier `tests/db/sequence-emails.test.ts`, avec ces cas :
  - `anon` et `authenticated` non admin : 42501 ou aucune ligne, sur les 5 tables et la vue ; la RPC refuse `anon` et `authenticated` ;
  - un admin AAL2 met à jour `sujet` ; il ne peut ni insérer, ni supprimer, ni modifier `cle` ;
  - insertion d'un abonnement : destinataire non confirmé, `annonces = true`, aucun rattachement ;
  - confirmation (`confirme_le`) : rattaché à la prochaine date `confirmee` ; une date `previsionnelle` plus proche est ignorée ;
  - spectateur confirmé avec `annonces = 'true'` : `confirme_le = email_confirmed_at`, `annonces = true`, rattaché. Juge sans `consentement` : aucune ligne ;
  - même adresse spectateur puis abonné (point de revue 2) : une seule ligne, toujours confirmée ;
  - désinscription, suppression de l'abonnement, puis nouvel abonnement (point de revue 1) : non confirmé, envois `confirmation` supprimés ;
  - suppression d'un profil non abonné : ligne supprimée. Abonné : ligne gardée, `profil_id` nul ;
  - aucune date confirmée, puis une date passe à `confirmee` : rattachement `premiere_confirmation` ;
  - deux insertions identiques dans `envois_emails` avec `calendrier_id` et `message_id` nuls : la seconde est rejetée en 23505 ;
  - la RPC à une date fixe renvoie les seuls destinataires attendus, et `dates` couvre J-8 à J+17 ;
- [ ] **Étape 2 :** `pnpm test:db -- sequence-emails` : ÉCHEC, tables absentes.
- [ ] **Étape 3 :** écrire la migration.
- [ ] **Étape 4 :** `pnpm test:db` : tout passe, catalogue compris.
- [ ] **Étape 5 :** commit `feat(emails): schéma, déclencheurs et RPC de la séquence`.

Cette tâche ne dépend d'aucune autre : les tests insèrent eux-mêmes les modèles dont ils ont besoin.

---

### Tâche 2 : rendu partagé et textes par défaut (bernard:sebastien, agent B)

**Fichiers :**
- Créer : `serveur/gabarits-emails.mjs`
- Créer : `public/email/logo.png`, 2×, 240 px de large au plus, tiré du logo existant
- Créer : `app/composants/admin/emails/apercu-email.css`, généré une fois depuis `cssApercu()`
- Test : `tests/unit/gabarits-emails.test.ts`

**Interfaces produites :**

```js
export const ETAPES; // les 9 clés, dans l'ordre de la frise
export const CONSENTEMENT_ANNONCES_TEXTE, CONSENTEMENT_ANNONCES_VERSION; // texte figé, '2026-10-17'
export const MODELES_DEFAUT; // Record<Etape, { nom, sujet, preheader, corps, encart: string|null, jours_decalage: number|null, heure_envoi: string|null }>
export const VARIABLES; // { cle, libelle, groupe: 'Personne'|'Date'|'Lieu'|'Infos'|'Liens', exemple }[], les variables de la spec + `lien_confirmation` + `dates_annoncees`
export function formaterDate(dateIso, heure) // => { date, date_courte, jour, heure: string|null, annee }
export function compteARebours(dateIso, heure, maintenant) // => { texte: string|null, jours: number }
export function variablesInconnues(texte) // => string[]
export function rendreEmail(modele, contexte, { cible }) // => { sujet, html, texte }
export function cssApercu() // => string
```

- `modele` reçoit `{ sujet, preheader, corps, encart }`.
- `cible` vaut `'email'` (styles en ligne) ou `'apercu'` (classes `ee-*`, sans aucun attribut `style`).
- `cssApercu()` renvoie la feuille de l'aperçu, dont chaque règle est préfixée par `.apercu-email`.

**Type `ContexteEmail`** (JSDoc `@typedef`, exporté pour `echeances-emails.mjs` et l'admin) :

```
{ prenom: string|null, maintenant: Date, origine: string, date: DateEnrichie|null,
  prochaines: (DateEnrichie & { lienJeViens: string|null })[], annoncees: (même forme)[],
  encartDateProche: boolean, liens: { desinscription: string, confirmation: string|null, jeViens: string|null } }
```

`DateEnrichie` correspond à une ligne de `dates` de la RPC (tâche 1) :
`{ id, nom, ville, arenes, date_soiree, heure, statut, lien_billetterie, infos_pratiques, soiree, manades, vainqueur }`

**Syntaxe du corps** (l'éditeur de la tâche 7 l'insère par ses boutons) :

| Syntaxe | Rendu |
|---|---|
| Ligne vide | Sépare deux paragraphes |
| `**gras**` | Gras |
| `[texte](url)` | Lien |
| Ligne `- élément` | Élément de liste |
| `[[Texte du bouton\|url]]`, seul sur sa ligne | Bouton |

Une `url` vaut `https://…` ou `{{lien_*}}`. Tout autre schéma est rendu comme du texte.

**Règle des lignes vides** : une ligne, un élément de liste ou un bouton qui contient une variable sans valeur (`null` ou `''`) disparaît.
- Exception `{{prenom}}` : la variable et l'espace qui la précède sont retirés, et la ligne reste.
- Une variable inconnue est rendue vide, sans retirer la ligne.

**Valeurs des liens** (absolues, sur `contexte.origine`) :

| Variable | Valeur |
|---|---|
| `lien_noter` | `/noter`, seulement si `date.soiree` existe et que son statut est `publiee` ou `en_cours` |
| `lien_classement` | `/classements`, seulement si `date.soiree` existe |
| `lien_dates` | `/dates` |
| `lien_billetterie` | `date.lien_billetterie` |

**Variables de liste :**
- `{{prochaines_dates}}` et `{{dates_annoncees}}` sont seules sur leur ligne.
- Chacune devient une liste « sam. 31/07 · Sommières, Arènes Gilles Arnaud · 21 h 30 », avec un lien « Je viens » quand `lienJeViens` est présent.

**Gabarit `'email'`** :
- table de 600 px ;
- fond sable, carte crème, filet or en tête, logo `${origine}/email/logo.png` ;
- pré-en-tête masqué ;
- pied : « Vous recevez cet email car vous êtes inscrit·e à l’Olympiade des Manades. » + lien « Se désinscrire » (`liens.desinscription`) + `olympiadedesmanades.fr`.
- L'encart de `bienvenue` est rendu seulement si `encartDateProche`, dans un bloc lin bordé d'or.

**Version texte** : un lien s'écrit « texte : url », un bouton « Texte : url ».

**Textes par défaut** (`MODELES_DEFAUT`) :
- Courts, chaleureux, à la voix du site ; pour le ton, relire `app/routes/accueil.tsx`.
- Chaque modèle utilise au moins `{{date}}` ou `{{compte_a_rebours}}`, sauf `confirmation`.
- `confirmation` contient `[[Confirmer mon adresse|{{lien_confirmation}}]]`.
- `annonce` contient `{{dates_annoncees}}`.
- L'encart de `bienvenue` contient date, heure, arènes, billetterie, `{{infos_pratiques}}`, le bouton noter, et « Vous recevrez la suite au fur et à mesure. ».

- [ ] **Étape 1 : écrire les tests unitaires (échec attendu).** Fichier `tests/unit/gabarits-emails.test.ts` :
  - `formaterDate('2027-07-31', '21:30:00')` → `{ date: 'samedi 31 juillet 2027', date_courte: 'sam. 31/07', jour: 'samedi', heure: '21 h 30', annee: '2027' }`. Avec `heure` nulle, `heure` vaut `null`.
  - `compteARebours`, pour une date le 31/07 à 21:30 :

| `maintenant` (Paris) | Attendu |
|---|---|
| 24/07 10:00 | `'dans 7 jours'`, 7 |
| 30/07 18:00 | `'demain'` |
| 31/07 10:00 | `'ce soir'` |
| 01/08 | `'hier'` |

  - `compteARebours` pour Arles le 01/05 à 15:30, le jour même : `'aujourd’hui'`.
  - Lignes vides : « Billetterie : {{lien_billetterie}} » disparaît si le lien est nul ; « Bonjour {{prenom}}, » donne « Bonjour, ».
  - Point de revue 5 : prénom `<img src=x onerror=alert(1)>` échappé ; `[x](javascript:alert(1))` rendu en texte ; `{{truc}}` rendu vide et `variablesInconnues('a {{truc}} {{date}}')` → `['truc']`.
  - Bouton : la cible `'email'` produit un `<a>` aux styles en ligne ; la cible `'apercu'` ne contient aucun `style=`.
  - Encart : absent si `encartDateProche` est faux, présent sinon.
  - Le pied contient toujours `liens.desinscription`.
  - `texte` ne contient aucune balise.
  - Le contenu de `apercu-email.css` est égal à `cssApercu()`.
  - Chaque clé de `ETAPES` a son modèle, et aucun modèle par défaut n'a de variable inconnue.
- [ ] **Étape 2 :** `pnpm test:unit -- gabarits-emails` : ÉCHEC, module absent.
- [ ] **Étape 3 :** implémenter le module, les textes, la feuille CSS et le logo.
- [ ] **Étape 4 :** `pnpm test:unit -- gabarits-emails` : SUCCÈS. `pnpm typecheck` : OK.
- [ ] **Étape 5 :** commit `feat(emails): rendu partagé des modèles et textes par défaut`.

---

### Tâche 3 : calcul des échéances (bernard:sebastien, agent B, après la tâche 2)

**Fichiers :**
- Créer : `serveur/echeances-emails.mjs`
- Test : `tests/unit/echeances-emails.test.ts`

**Interfaces :**
- Consomme : la forme de la RPC (tâche 1) et `ETAPES` (tâche 2).
- Produit :

```js
export function echeance(modele, date) // => Date | null : date_soiree + jours_decalage à heure_envoi, heure de Paris
export function calculerEnvois(donnees, maintenant) // => { aEnvoyer: EnvoiPrevu[], sautes: EnvoiPrevu[] }
export function envoisAVenir(modeles, dates, rattachesParDate, maintenant, jours = 7) // => { etape, calendrierId, prevuLe, destinataires }[]
```

- `echeance` renvoie `null` pour `confirmation`, `bienvenue` et `message`.
- `envoisAVenir` sert à l'estimation de l'admin, sans plafonds. `rattachesParDate` est un `Record<calendrierId, number>`.
- Un modèle absent de `donnees.modeles` est traité comme inactif.
- `EnvoiPrevu` vaut `{ destinataireId, etape, calendrierIds: string[], prevuLe: string, encartDateProche?: boolean, raison?: string }`.

**Règles**, dans l'ordre (un modèle `actif = false` ne produit rien) :

1. **`confirmation`** : abonné, `confirme_le` nul, pas d'envoi `confirmation`. Hors plafond.
2. **`bienvenue`** : `confirme_le` non nul, pas d'envoi `bienvenue`, moins de 12 h après `confirme_le`.
   - `encartDateProche` est vrai si la date rattachée par l'origine `inscription` est 0 à 7 jours de Paris après `confirme_le`.
3. **Étapes de date** (`j_moins_7`, `veille`, `jour_j`, `lendemain`, `prochaines_dates`), pour chaque rattachement, dès que `echeance ≤ maintenant` et qu'il n'y a pas encore d'envoi :

| Condition | Résultat (raison) |
|---|---|
| `echeance` < `rattachement.cree_le` | `saute` (`deja_passe_a_l_inscription`) |
| Même jour de Paris que l'envoi `bienvenue` | `saute` (`meme_jour_que_bienvenue`) |
| Date `annulee`, étapes 2 à 5 | `saute` (`date_annulee`) |
| Soirée liée `annulee` ou `reportee` alors que la date est `confirmee`, étapes 2 à 4 | **Rien** (suspendu) |
| `prochaines_dates` sans consentement aux annonces | Rien |
| `prochaines_dates` avec `prochaines` vide | `saute` (`aucune_date`) |
| `maintenant` > `echeance` + 12 h | `saute` (`fenetre_depassee`) |

4. **`annonce`**, pour chaque consentant confirmé :
   - Candidats : les dates `confirmee` de `dates` non rattachées à la personne, sans envoi `annonce` pour cette date, avec J-10 à 10:00 ≤ `maintenant` < `date_soiree` à 00:00 (Paris).
   - Si au moins un candidat, aucune annonce depuis 7 jours et le plafond journalier libre : **un seul** `EnvoiPrevu` dont `calendrierIds` regroupe tous les candidats, triés par date.
   - Sinon, rien.
5. **Plafond journalier** :
   - Comptent les envois `envoye`, `simule` et `en_attente` du même jour de Paris, sauf `confirmation` et `message`.
   - Priorité : étapes de la date la plus proche > `lendemain` > `annonce` > `prochaines_dates`.
   - Ce qui dépasse le plafond : `saute` (`plafond_jour`), sauf `annonce`, reportée.

- [ ] **Étape 1 : écrire les tests (échec attendu).** Calendrier 2027 réel en entrée : 30/07 Marsillargues, 31/07 Sommières, 05/08 Bezouce.
  - Inscription à J-8 (22/07) : le J-7 part le 23/07 à 10:00, la veille le 30/07 à 18:00, le jour J le 31/07 à 10:00, le lendemain le 01/08.
  - Inscription la veille à 20:00 : bienvenue avec encart. La veille est `deja_passe_a_l_inscription`, le jour J part.
  - Inscription le 31/07 à 09:00 (jour J) : bienvenue avec encart. Le jour J est `meme_jour_que_bienvenue`.
  - Inscription à J-3 à 20:00 : bienvenue avec encart. Le J-7 est `deja_passe_a_l_inscription`, la veille part.
  - Point de revue 4 : `date_soiree` déplacée au 07/08 après l'envoi du J-7 : aucun nouveau J-7 ; la veille est due le 06/08 à 18:00.
  - Heure d'hiver : une date le 31/10/2027 avec une veille à 18:00 donne `echeance` = `2027-10-30T16:00:00Z`. Une date le 01/11 donne `2027-10-31T17:00:00Z`.
  - Date `annulee` : le J-7 et le lendemain sont `saute` (`date_annulee`) ; `prochaines_dates` part.
  - Soirée liée `reportee` : aucun J-7 ni jour J dans les résultats.
  - Annonces : le 20/07 à 10:00, un consentant non rattaché reçoit **un** envoi avec `[30/07, 31/07]`. Le 26/07 (J-10 de Bezouce), rien, car moins de 7 jours. Le 27/07, un envoi avec `[05/08]`.
  - Plafond : le jour J du 30/07 et une annonce le même jour → le jour J part, l'annonce n'apparaît ni dans `aEnvoyer` ni dans `sautes`.
  - `confirmation` puis `bienvenue` : la bienvenue n'existe pas tant que `confirme_le` est nul.
  - Un modèle inactif ne produit rien.
  - `maintenant` = échéance + 13 h : `fenetre_depassee`.
- [ ] **Étape 2 :** `pnpm test:unit -- echeances-emails` : ÉCHEC.
- [ ] **Étape 3 :** implémenter.
- [ ] **Étape 4 :** `pnpm test:unit -- echeances-emails` : SUCCÈS. `pnpm typecheck` : OK.
- [ ] **Étape 5 :** commit `feat(emails): calcul des échéances de la séquence`.

---

### Tâche 4 : SMTP généralisé et liens signés (bernard:sebastien, agent B, après la tâche 3)

**Fichiers :**
- Modifier : `serveur/courriel.mjs`. L'API `courrielDepuisEnvironnement` du contact ne change pas.
- Créer : `serveur/liens-emails.mjs`
- Test : `tests/unit/courriel.test.ts` (ajouts) et `tests/unit/liens-emails.test.ts`

**Interfaces produites :**

```js
// courriel.mjs
export function construireMessage({ from, to, subject, text, html, replyTo, headers }) // => string (RFC 5322)
export function masquerEmail(email) // 'camille@exemple.fr' => 'c***@exemple.fr'
export function emailsDepuisEnvironnement(env, deps) // => { mode, pret, envoyer(message) }
// liens-emails.mjs
export function signerLien(cle, charge) // charge : { t: 'confirmation'|'desinscription'|'je_viens', d: string, c?: string, e?: number }
export function verifierLien(cle, jeton, maintenant = Date.now()) // => charge | null
export function liensPour({ origine, cle, destinataireId, maintenant }) // => { desinscription, desinscriptionUnClic, confirmation, jeViens(calendrierId, dateSoiree) }
```

**`construireMessage`**
- Encodage :
  - `multipart/alternative` si `html` est présent ;
  - corps en base64, découpé à 76 caractères ;
  - objet et nom d'expéditeur en RFC 2047 (UTF-8 B).
- En-têtes ajoutés : `Date`, `Message-ID@domaine-de-from`, `MIME-Version`.
- Les en-têtes reçus dans `headers` sont validés : aucun CR ni LF dans une valeur.
- `envoyerSmtp` l'utilise ; le comportement actuel du contact ne change pas.

**`emailsDepuisEnvironnement`**
- Lit `SMTP_*` et `EMAILS_FROM`. `pret` est vrai en `smtp` seulement si toutes les valeurs sont présentes.
- `envoyer(message)` reçoit `{ to, subject, text, html, headers }` et renvoie `Promise<{ mode, envoye, echec }>`.
  - En `log` : journalise `{ level: 'info', message: 'email journalisé', to: masquerEmail(to), subject }`, sans le corps.
  - En `off` : aucune action.

**`signerLien`**
- Jeton : `base64url(JSON).base64url(HMAC-SHA256)`.
- `verifierLien` compare en `timingSafeEqual`, et refuse une clé absente, un jeton mal formé ou une charge expirée.

**`liensPour`**

| Lien | URL | Expiration |
|---|---|---|
| `desinscription` | `${origine}/emails/desinscription?j=…` | aucune |
| `desinscriptionUnClic` | `${origine}/api/emails/desinscription?j=…` | aucune |
| `confirmation` | `${origine}/emails/confirmation?j=…` | `maintenant` + 7 jours |
| `jeViens` | `${origine}/emails/je-viens?j=…` | 23:59 (Paris) le jour de la date |

- [ ] **Étape 1 : écrire les tests (échec attendu).**
  - **Message** : objet « Demain : l’Olympiade à Sommières ! » encodé en `=?UTF-8?B?`. Les deux parties sont présentes. Un en-tête avec `\r\n` est rejeté.
  - **Mode log** : la ligne de journal ne contient pas l'adresse en clair.
  - **Liens** :
    - aller-retour signer puis vérifier ;
    - jeton altéré → `null` ;
    - expiré → `null` ;
    - clé différente → `null` ;
    - `je_viens` valide le 31/07 à 23:00, invalide le 01/08 à 00:01 (heure de Paris).
  - **Contact** : les tests existants de `courriel.test.ts` passent sans modification.
- [ ] **Étape 2 :** lancer les deux fichiers de test : ÉCHEC.
- [ ] **Étape 3 :** implémenter.
- [ ] **Étape 4 :** `pnpm test:unit` (complet) : SUCCÈS. `pnpm typecheck` : OK.
- [ ] **Étape 5 :** commit `feat(emails): SMTP multipart et liens signés`.

---

### Tâche 5 : planificateur et endpoints (bernard:sebastien, phase B)

**Fichiers :**
- Créer : `serveur/emails.mjs`
- Créer : `serveur/admin-serveur.mjs` (`verifierAdmin`, extrait du schéma de `juges.mjs` ; `juges.mjs` n'y touche pas)
- Créer : `scripts/simuler-emails.mjs`
- Modifier :
  - `serveur/application.mjs` : option `emails`, branchée comme `actualites` ;
  - `serveur/statique.mjs` : création et `demarrer()` ;
  - `serveur/actualites.mjs` : la réponse devient `{ ok: true, confirmation: boolean }`, via l'option `confirmationActive` ;
  - `.env.example`.
- Test : `tests/unit/emails-serveur.test.ts`, `tests/unit/actualites-serveur.test.ts` (ajout)

**Interfaces :**
- Consomme : les tâches 1 à 4.
- Produit :

```js
export function verifierAdmin(req, { supabaseUrl, publishableKey, demander })
// => Promise<{ ok: true, id, email } | { ok: false, statut, error }>
export function creerEmails(options) // => { configure, mode, estRoute(url), repondre(req, res), demarrer(), arreter(), passer() }
export function emailsDepuisEnvironnement(env)
```

- Options de `creerEmails` : `{ supabaseUrl, publishableKey, serviceRoleKey, origine, cleLiens, courriel, debitParSeconde, fetchFn, maintenant, timers }`.
- `passer()` renvoie `Promise<{ reserves, envoyes, simules, echecs, sautes }>`.

**Endpoints**

| Requête | Accès | Comportement |
|---|---|---|
| `POST /api/emails/lien` `{ jeton, action }` | `Origin` = `CONTACT_ORIGIN` ; 30 requêtes par IP et par 10 min | Voir les actions ci-dessous |
| `POST /api/emails/desinscription?j=` | Pas de contrôle d'`Origin` (appelé par les messageries) ; corps `List-Unsubscribe=One-Click` | RFC 8058. Désinscrit, répond 200 |
| `GET` sur l'un de ces deux chemins | — | 405 (point de revue 3) |
| `POST /api/admin/emails/test` `{ cle, brouillon: { sujet, preheader, corps, encart }, calendrierId }` | Admin AAL2 ; 10 envois par heure et par admin | Rend le brouillon avec la date choisie et l'envoie à l'e-mail de l'admin. Répond `{ ok, mode }` |
| `POST /api/admin/emails/message` `{ calendrierId, sujet, corps }` | Admin AAL2 | Insère `messages_inscrits` et les envois `en_attente` (étape `message`) des rattachés confirmés non désinscrits. Répond `{ ok, destinataires }` |
| `GET /api/admin/emails/etat` | Admin AAL2 | Répond `{ mode, pret, cleLiens: boolean, dernierPassage: string\|null, dernierBilan }` |

**Actions de `/api/emails/lien`**
- `decrire` : ne modifie rien. Répond `{ type, date?: { nom, ville, date }, abonne, annonces }`.
- `confirmer` : met `confirme_le` à maintenant si la valeur est nulle.
- `desinscrire` : met `desinscrit_le` à maintenant et `annonces = false`, puis supprime l'abonnement actualités.
- `arreter_annonces` : met `annonces = false`.
- `je_viens` : insère un rattachement avec l'origine `je_viens`.
- Réponses d'erreur : `{ ok: true, etat }`, 400 pour un jeton invalide, 410 pour un jeton expiré.

**`passer()`** : rien si `mode === 'off'`, si la configuration est incomplète, ou si un passage est déjà en cours.
1. `rpc/emails_a_traiter` puis `calculerEnvois`.
2. Insertion des `aEnvoyer` en `en_attente` et des `sautes` en `saute`, via `POST /rest/v1/envois_emails?on_conflict=destinataire_id,etape,calendrier_id,message_id,reel` avec `Prefer: resolution=ignore-duplicates,return=representation`. Une annonce donne une ligne par date de `calendrierIds`. `reel` vaut `mode === 'smtp'`.
3. Lecture des envois `en_attente`, du `reel` courant, avec `prevu_le` ≤ maintenant, 500 au plus. Le destinataire est embarqué.
4. Rendu avec `rendreEmail` et la cible `'email'`. En-têtes :
   - `List-Unsubscribe: <desinscriptionUnClic>, <mailto:…>` (le `mailto` seulement si `EMAILS_FROM` contient une adresse) ;
   - `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
5. Envoi à `debitParSeconde` au plus.
6. Statut final :
   - succès en `smtp` : `envoye` ;
   - en `log` : `simule` ;
   - échec : `tentatives + 1`, `prevu_le` + 5 min × tentatives, `echec` définitif à 3.
7. Au premier passage après 03:00 (Paris) chaque jour, purges : envois de plus de 12 mois, et abonnés non confirmés selon les contraintes globales.

Le minuteur tourne toutes les 60 s et démarre seulement si `timers !== false`.

`demarrer()` sème d'abord les modèles manquants : `POST /rest/v1/modeles_emails?on_conflict=cle`, `Prefer: resolution=ignore-duplicates`, avec `MODELES_DEFAUT`. Un échec est journalisé et l'opération est retentée au passage suivant.

**`scripts/simuler-emails.mjs`**
- Lit `calendrier` en anon (REST publique) avec `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Crée 4 destinataires fictifs : inscrit à J-8, à J-3 à 20:00, la veille à 20:00, et consentant aux annonces.
- Affiche le tableau des envois prévus sur 30 jours (`calculerEnvois` jour par jour), sans rien écrire.

- [ ] **Étape 1 : écrire les tests (échec attendu).** `fetchFn` est simulé.
  - **Mode log** : `passer()` réserve, journalise, puis passe à `simule`. Un 2e `passer()` ne renvoie rien de nouveau.
  - **Mode off** : `passer()` ne fait aucun appel réseau.
  - **SMTP en échec 3 fois** : statut `echec` et `tentatives = 3`.
  - **GET** `/api/emails/lien` : 405, et aucune requête PATCH n'est émise.
  - **One-click** : un POST sans `Origin` désinscrit.
  - **`decrire`** : aucune écriture.
  - **Jeton expiré** : 410.
  - **`/api/admin/emails/test`** : sans jeton 401 ; AAL1 403 ; non-admin 403 ; 11e envoi dans l'heure 429. L'adresse visée est celle de `/auth/v1/user`.
  - **`/api/admin/emails/message`** : renvoie le nombre de destinataires et insère `messages_inscrits` avant les envois.
  - **Actualités** : `confirmation: true` seulement si l'option est vraie.
  - **Semis** : `demarrer()` sème les 9 modèles sans écraser une ligne existante.
  - **Consentement** : le fichier de migration contient `CONSENTEMENT_ANNONCES_TEXTE` à l'identique (lecture du fichier).
- [ ] **Étape 2 :** `pnpm test:unit -- emails-serveur actualites-serveur` : ÉCHEC.
- [ ] **Étape 3 :** implémenter et câbler. `node scripts/simuler-emails.mjs` affiche un tableau.
- [ ] **Étape 4 :** `pnpm test:unit` et `pnpm typecheck` : SUCCÈS. `pnpm test:e2e serveur.spec.ts` : SUCCÈS. Le serveur démarre en `SMTP_MODE=log` sans erreur dans les journaux.
- [ ] **Étape 5 :** commit `feat(emails): planificateur, liens publics et endpoints admin`.

---

### Tâche 6 : parcours publics (bernard:remi, phase B)

**Fichiers :**
- Modifier :
  - `app/composants/FormulaireInscription.tsx` : case `annonces` et texte d'usage ;
  - `app/lib/auth.ts` : `data: { prenom, consentement: true, annonces }` ;
  - `app/composants/InscriptionActualites.tsx` : message de succès ;
  - `app/routes/confidentialite.tsx` ;
  - `app/routes.ts`.
- Créer : `app/composants/LienEmail.tsx` et `app/routes/emails-confirmation.tsx`, `emails-desinscription.tsx`, `emails-je-viens.tsx`.
- Test : `tests/e2e/emails-liens.spec.ts`, `tests/e2e/inscription.spec.ts` (ajout), `tests/unit/auth.test.ts` (ajout)

**Interfaces :**
- Consomme : `POST /api/emails/lien` (tâche 5) et la réponse actualités `{ ok, confirmation }`.

**Formulaire spectateur**
- Case `annonces` **décochée**, libellé figé, facultative.
- `signInWithOtp` envoie `annonces: true|false`. Supabase ne pose ces métadonnées qu'à la création du compte, ce qui est acceptable.

**Actualités**
- Succès avec `confirmation === true` : « Merci ! Un email de confirmation vient de partir : cliquez sur le bouton qu’il contient pour valider votre inscription. »
- Sinon : le texte actuel.

**Pages `/emails/*`**
- Monopage, hors prérendu, `noindex` (comme `/inscription`).
- Elles lisent `?j=` et appellent `decrire`, puis affichent selon le type :
  - « Confirmer mon adresse » ;
  - « Arrêter seulement les annonces » et « Ne plus rien recevoir » ;
  - « Je viens le {date} à {ville} ».
- Le POST n'a lieu qu'au clic. États affichés : succès, expiré (410) et invalide (400).
- Mise en page de `CadreInscription` ou équivalent, à la charte.

**Confidentialité** : une finalité « Emails liés à votre date et annonces des prochaines dates » qui couvre :
- base légale (consentement pour les annonces, exécution du service pour les rappels de la date suivie) ;
- durée (envois : 12 mois ; non confirmés : 30 jours) ;
- désinscription en un clic.

La juriste relit en tâche 8.

- [ ] **Étape 1 : écrire les tests (échec attendu).**
  - **Case annonces** : visible, non cochée ; l'appel OTP simulé reçoit `annonces: false`, puis `true` une fois cochée.
  - **Lien de confirmation** : la page n'émet aucun POST d'action avant le clic. Après le clic, elle affiche le succès.
  - **Désinscription** : les deux boutons envoient leur action respective.
  - **Jeton expiré** : message « Ce lien a expiré ».
  - **Accessibilité** : axe ne remonte aucune violation grave sur les 3 pages.
- [ ] **Étape 2 :** lancer les e2e ciblés : ÉCHEC.
- [ ] **Étape 3 :** implémenter.
- [ ] **Étape 4 :** e2e ciblés, `pnpm test:unit` et `pnpm typecheck` : SUCCÈS. Captures mobile et ordinateur des 3 pages, regardées.
- [ ] **Étape 5 :** commit `feat(emails): case annonces, confirmation et pages de lien`.

---

### Tâche 7 : admin `/admin/emails` (bernard:remi, phase B, après la tâche 6 dans le même worktree)

**Fichiers :**
- Créer :
  - `app/routes/admin-emails.tsx` ;
  - `app/composants/admin/emails/Sequence.tsx`, `Editeur.tsx`, `Dates.tsx`, `Envois.tsx`, `ApercuEmail.tsx`.
- Modifier : `app/routes.ts`, `app/composants/admin/CadreAdmin.tsx` (lien « E-mails » après « Abonnés »).
- Test : `tests/e2e/admin-emails.spec.ts`

**Interfaces :**
- Consomme : `rendreEmail`, `cssApercu`, `VARIABLES`, `MODELES_DEFAUT` et `variablesInconnues` (tâche 2) ; `envoisAVenir` (tâche 3) ; les endpoints admin (tâche 5) ; les tables et la vue (tâche 1) par `useClientAdmin`.

**Onglets** : ARIA, `?onglet=sequence|dates|envois`, éditeur en `?modele=<cle>`. Même schéma que `admin-cookies.tsx`, `aria-controls` seulement sur l'onglet actif.

1. **Séquence** : la frise des 9 étapes, avec pour chacune :
   - nom, « quand » en clair (« 7 jours avant, à 10 h ») et « pour qui » ;
   - interrupteur `actif`, enregistré tout de suite ;
   - prochain envoi estimé, via `envoisAVenir` : « environ 132 destinataires, sam. 24/07 à 10 h ».

   En tête, une alerte si `etat.mode !== 'smtp'` (« Aucun email ne part réellement »). Une autre si une soirée liée est `annulee` ou `reportee` alors que sa date est `confirmee`.
2. **Éditeur** :
   - champs objet, pré-en-tête, corps, encart (`bienvenue` seulement) ;
   - jours et heure, bornés comme en base ;
   - barre de variables groupée par `groupe` : un clic insère `{{cle}}` au curseur ;
   - boutons Gras, Lien, Liste, Bouton, qui insèrent la syntaxe de la tâche 2 ;
   - alerte « Variable inconnue » via `variablesInconnues` ;
   - **aperçu en direct** : `ApercuEmail` rend `rendreEmail(…, { cible: 'apercu' }).html` dans un `div.apercu-email`, avec `apercu-email.css` importé. Pas d'iframe ni de style en ligne : la CSP reste intacte.
   - bascule Mobile (375 px) / Ordinateur (600 px) ;
   - choix de la date d'exemple (calendrier) et prénom d'exemple « Camille » ;
   - Enregistrer, « M'envoyer un test », « Revenir au texte d'origine » (`MODELES_DEFAUT`, confirmation avant d'écraser).
3. **Dates** : liste des dates à venir, avec pour chacune :
   - nombre de rattachés et `infos_pratiques`, éditable et limité à 1000 caractères ;
   - bouton « Écrire aux inscrits » : formulaire objet + corps, aperçu, puis confirmation « Envoyer à N personnes ? », puis `POST /api/admin/emails/message`.
4. **Envois** :
   - `bilan_envois_emails` par étape et par date (envoyés, simulés, échecs, sautés) ;
   - mode SMTP et dernier passage (`/api/admin/emails/etat`) ;
   - nombre de désinscrits.

- [ ] **Étape 1 : écrire les tests e2e (échec attendu).** Session admin et routes REST simulées, comme dans `tests/e2e/admin-cookies-aide.spec.ts`.
  - Les 3 onglets existent, la frise montre 9 étapes, `?onglet=dates` ouvre Dates.
  - Taper dans le corps met l'aperçu à jour : le texte apparaît. Un clic sur `{{date}}` insère la variable, et l'aperçu montre « samedi 31 juillet 2027 » pour la date d'exemple.
  - `{{truc}}` affiche l'alerte « Variable inconnue ».
  - Enregistrer envoie un PATCH sur `modeles_emails` avec les seuls champs éditables.
  - « M'envoyer un test » envoie un POST à `/api/admin/emails/test` et affiche le mode retourné.
  - « Écrire aux inscrits » : la confirmation affiche « 3 personnes », puis le POST part.
  - Axe sur la liste d'onglets et le panneau : aucune violation grave.
- [ ] **Étape 2 :** lancer les e2e ciblés : ÉCHEC.
- [ ] **Étape 3 :** implémenter.
- [ ] **Étape 4 :** e2e ciblés, `pnpm typecheck` et `pnpm test:unit` : SUCCÈS. Captures mobile et ordinateur des 4 vues, regardées.
- [ ] **Étape 5 :** commit `feat(emails): admin des modèles, dates et envois`.

---

### Tâche 8 : revues, preuves, documentation (orchestrateur, puis bernard:casey, bernard:elena, bernard:onyx, bernard:rebecca)

**Fichiers :**
- Créer : `scripts/apercus-emails.mjs`. Il rend les 9 modèles par défaut avec un contexte d'exemple, en HTML, puis en captures 375 et 600 px, vers un dossier passé en argument (jamais commité).
- Modifier :
  - `docs/CDC-MASTER.md` : §7, ligne RGPD du §548, et une section « Emails » qui renvoie au design ;
  - `.env.example`, si la tâche 5 ne l'a pas complété.

**Étapes :**
- [ ] **Étape 1 :** l'orchestrateur fusionne toutes les branches, puis lance `pnpm typecheck`, `pnpm test:unit`, `pnpm test:db` et `pnpm test:e2e`. Seuls les 4 échecs connus de `chargement.spec.ts` sont admis.
- [ ] **Étape 2 :** revues en parallèle, chacune sur toute la branche :
  - **casey** : sécurité (liens signés, RLS, RPC, injection d'en-têtes, journaux, endpoints admin, débit) ;
  - **elena** : couverture et e2e, avec les points de revue 1 à 5 ;
  - **onyx** : captures des e-mails et de l'admin (charte, mobile) ;
  - **rebecca** : textes de consentement, Confidentialité, base légale des rappels, CDC.
- [ ] **Étape 3 :** corrections, par l'agent du domaine concerné, puis nouvelle vérification complète.
- [ ] **Étape 4 :** `node scripts/simuler-emails.mjs` sur le calendrier réel. Lecture du tableau : pas de doublon, aucun e-mail pour une date annulée.
- [ ] **Étape 5 :** `git fetch origin && git rebase origin/main`, vérification complète rejouée. Rapport à l'utilisateur, avec l'état de chaque élément (local / commité / poussé / déployé). Mise en prod (migration Supabase + push `main`) **seulement sur GO**.
