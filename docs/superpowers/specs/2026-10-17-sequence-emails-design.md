# Séquence d'e-mails et modèles éditables : design

Date : 17/10/2026. Statut : validé le 17/10/2026. Branche : `feat/sequence-emails`.

## 1. Intention

Les personnes qui s'inscrivent reçoivent des e-mails utiles autour de **leur** date : un mot de bienvenue, des rappels avant, un remerciement et les résultats après, puis l'annonce des autres dates. L'organisateur écrit et ajuste lui-même tous les textes dans l'admin. Les dates, heures et lieux se remplissent seuls grâce à des variables.

Pourquoi : le CDC (§311) demande d'encourager l'inscription **avant** la soirée, parce que la 4G sature dans les arènes. Les e-mails servent aussi à faire revenir le public aux autres dates de la saison.

## 2. Décisions

### Prises par l'utilisateur

- **Destinataires** : les spectateurs inscrits à la notation **et** les abonnés actualités de l'accueil.
- **Date suivie** : à l'inscription, la personne est rattachée automatiquement à la **prochaine date confirmée** du calendrier. Le formulaire ne gagne aucun champ pour ça.
- **Bienvenue** : si l'inscription a lieu le jour même ou dans les 7 jours avant la date, l'e-mail ajoute la date et les infos déjà connues. Les infos suivantes arrivent au fur et à mesure avec les étapes de la séquence.
- **Double confirmation des abonnés actualités** : leur premier e-mail est « Confirmez votre adresse », avec un bouton.
  - Tant que la personne n'a pas cliqué, rien d'autre ne part.
  - Au clic : rattachement à la prochaine date, puis bienvenue.
  - Les abonnés déjà inscrits reçoivent une seule demande de confirmation, envoyée au premier passage en `SMTP_MODE=smtp`.
  - Les spectateurs ont déjà vérifié leur adresse par le code à 6 chiffres : pour eux, la bienvenue part directement.

### Mes choix (modifiables)

- **Annonces des autres dates** : envoyées seulement avec un consentement explicite. Raison : CDC §548, « pas de newsletter sans case dédiée, décochée par défaut ».
  - Spectateurs : nouvelle case **décochée** sur le formulaire d'inscription.
  - Abonnés actualités : déjà couverts par le texte qu'ils ont accepté (« actualités, informations pratiques, résultats et notations »).
- **Séquence par défaut** (section 4) : les étapes, heures et textes sont des valeurs de départ. L'admin peut tout modifier.
- **Lien « Je viens »** dans les annonces : un clic rattache la personne à la date annoncée, qui reçoit alors ses rappels. Sans ce lien, après sa première date, une personne ne recevrait plus que des annonces.
- **Pas de statistiques d'ouverture ni de clic.** Un pixel de suivi est un traceur, donc il exigerait un consentement de plus.
- **Plusieurs dates à la fois** : une personne peut être rattachée à plusieurs dates (table de liaison).
  - « Je viens » **ajoute** un rattachement sans retirer le précédent.
  - Une date confirmée après coup ne re-rattache personne, sauf ceux qui n'avaient aucune date.
  - Le plafond d'un e-mail automatique par jour vaut toutes dates confondues. Priorité : étapes de la date la plus proche, puis lendemain, puis annonces, puis prochaines dates. Une étape bloquée est sautée, sauf les annonces (point suivant).
- **Annonces jamais perdues** : quand le plafond (1 annonce par 7 jours) bloque, l'annonce est reportée et fusionnée avec la suivante. Chaque annonce liste toutes les dates confirmées pas encore annoncées à la personne, dont le J-10 est passé et la date pas encore.
- **Dates sans app de notation** (`soiree_id` vide, cas fréquent, CDC §25) : mêmes modèles. La règle « au fur et à mesure » retire d'elle-même les lignes `{{lien_noter}}`, `{{lien_classement}}`, `{{manades}}`, `{{vainqueur}}`. Le jour J devient « c'est ce soir, heure, arènes », le lendemain un simple merci.
- **Date annulée** : `calendrier.statut` fait foi.
  - Étapes 2 à 5 arrêtées ; le n° 6 (prochaines dates) reste envoyé aux consentants.
  - Personne n'est re-rattaché d'office. L'admin se voit proposer le message n° 8, qui peut contenir `{{prochaines_dates}}` avec les liens « Je viens ».
  - Garde-fou : si la soirée liée est `annulee` ou `reportee` alors que le calendrier dit `confirmee`, les étapes 2 à 4 sont suspendues et l'admin voit une alerte.
- **Compte spectateur supprimé** : sa ligne de destinataire est supprimée, sauf s'il est aussi abonné aux actualités (seul ce volet reste).
- **Texte du formulaire spectateur** : il dira que l'e-mail sert aussi aux rappels de sa date, avec désinscription dans chaque e-mail (nouvelle version du consentement). Formulation et base légale relues par la juriste.

### Changement de périmètre à acter

Le CDC §7 range « newsletter et emailing marketing » hors périmètre V1. Cette demande les fait entrer. Il faut donc mettre à jour :

- le CDC : §7, plus la ligne RGPD du §548 ;
- la page Confidentialité.

## 3. Contraintes

- **Existant à réutiliser** :
  - `serveur/courriel.mjs` : client SMTP maison, modes `off` / `log` / `smtp`, aujourd'hui limité à un seul destinataire (l'organisateur).
  - les minuteurs serveur selon le modèle de `serveur/supervision.mjs` ;
  - la table `calendrier` (dates de la vitrine, `soiree_id` facultatif vers `soirees`) ;
  - `profils`, dont le consentement est horodaté à la confirmation de l'e-mail par un déclencheur sur `auth.users` ;
  - `abonnements_actualites`, dont le consentement est horodaté au dépôt, après Turnstile seulement : **l'adresse n'est pas vérifiée** ;
  - l'admin AAL2 et les politiques `prive.est_admin()` ;
  - l'import de modules `serveur/*.mjs` depuis l'app (déjà fait pour `classements.mjs`).
- **Calendrier dense** : l'été 2027 compte 8 dates, parfois à un jour d'écart (30 et 31 juillet). D'autres dates n'utilisent pas l'app de notation (CDC §25).
- **Volume** : jusqu'à environ 5 000 destinataires pour une même date (`docs/audit-charge-5000.md`). L'offre gratuite de Brevo plafonne à 300 e-mails par jour. Il faudra une offre payante avant l'ouverture au public, et l'authentification du domaine (SPF, DKIM, DMARC).
- **Fuseau** : toutes les heures sont celles de Paris (Europe/Paris).
- **Aucun envoi réel** tant que `SMTP_MODE` ≠ `smtp`. En mode `log`, l'envoi est journalisé et l'adresse e-mail est masquée.
- **CSP stricte** : l'aperçu dans l'admin ne doit pas ajouter de script ni de style en ligne non hachés.
- Ni l'inscription spectateur publique (`VITE_INSCRIPTION_OUVERTE`) ni le SMTP de Supabase Auth ne changent.

## 4. La séquence

| # | E-mail | Quand (par défaut) | Pour qui | Contenu de départ |
|---|---|---|---|---|
| 0 | Confirmez votre adresse | Moins de 5 min après le dépôt du formulaire actualités | Abonnés non confirmés | Un bouton « Confirmer mon adresse » (lien signé valable 7 jours). Pas de rappel. Hors plafond journalier |
| 1 | Bienvenue | Moins de 5 min après l'inscription (confirmation de l'e-mail pour un spectateur, clic de confirmation pour un abonné) | Tous les confirmés | Merci, à quoi servira l'app, prochaine date. **Encart « date proche »** si la date rattachée tombe dans 0 à 7 jours : date, heure, arènes, billetterie, lien pour noter, infos pratiques connues, et « vous recevrez la suite au fur et à mesure » |
| 2 | Une semaine avant | J-7, 10 h | Rattachés à la date | Annonce, manades engagées (si une soirée de notation est liée), billetterie, conseil : s'inscrire avant le soir |
| 3 | Veille | J-1, 18 h | Rattachés | Infos pratiques (heure, arènes, accès), installer l'app, activer les notifications |
| 4 | Jour J | J, 10 h | Rattachés | « C'est ce soir », heure, bouton direct vers `/noter` |
| 5 | Lendemain | J+1, 10 h | Rattachés | Merci, vainqueur et classement s'ils sont publiés, invitation à laisser un avis (`/noter`) |
| 6 | Prochaines dates | J+7, 10 h | Rattachés qui ont consenti aux annonces | Les 3 prochaines dates confirmées, chacune avec un lien « Je viens » |
| 7 | Annonce d'une date | J-10, 10 h, pour chaque autre date confirmée | Consentants non rattachés à cette date | Annonce et lien « Je viens ». Les dates d'une même semaine sont regroupées dans un seul e-mail. Au plus 1 annonce par personne tous les 7 jours |
| 8 | Message aux inscrits d'une date | Bouton dans l'admin | Rattachés à une date | Changement d'horaire, report, annulation, info de dernière minute. Aperçu, puis confirmation qui affiche le nombre de destinataires |

### Règles de calendrier

- **Pas de rattrapage** : une étape dont l'heure est déjà passée à l'inscription est sautée.
  - Inscription la veille à 20 h : bienvenue avec l'encart, puis jour J, puis lendemain.
- **Au plus 1 e-mail automatique par personne et par jour.** Une étape qui tombe le même jour que la bienvenue est sautée, puisque l'encart la remplace. Le message manuel (n° 8) échappe à ce plafond.
- **Date annulée** (`calendrier.statut = 'annulee'`) : les étapes 2 à 5 s'arrêtent d'elles-mêmes. L'admin se voit proposer le message n° 8 (détail en section 2).
- **Date déplacée** : les étapes se recalculent sur la nouvelle date. Une étape déjà envoyée ne repart pas.
- **Après J+7**, le rattachement à cette date est terminé. La personne reçoit les annonces si elle y a consenti. « Je viens » la rattache à une autre date.
- **Pas de prochaine date confirmée** au moment de l'inscription : bienvenue sans encart. La personne est rattachée à la première date qui passe au statut `confirmee`.

## 5. Variables et mise en forme

L'admin clique sur une variable pour l'insérer. Aucune syntaxe à retenir. Le moteur reconnaît les variables suivantes.

**Personne** :
- `{{prenom}}` : s'il est absent (abonné sans prénom), « Bonjour {{prenom}}, » devient « Bonjour, ».

**Date** :

| Variable | Exemple |
|---|---|
| `{{date}}` | samedi 31 juillet 2027 |
| `{{date_courte}}` | sam. 31/07 |
| `{{jour}}` | samedi |
| `{{heure}}` | 21 h 30 |
| `{{compte_a_rebours}}` | dans 7 jours, demain, ce soir |
| `{{jours_restants}}` | 7 |
| `{{annee}}` | 2027 |

**Lieu** :
- `{{nom_evenement}}`, `{{ville}}`, `{{arenes}}`

**Infos** :
- `{{infos_pratiques}}` : nouveau champ texte par date, rempli « au fur et à mesure » ;
- `{{manades}}` : manades engagées, si une soirée est liée ;
- `{{vainqueur}}` : publié après la soirée ;
- `{{prochaines_dates}}` : liste mise en forme.

**Liens** :
- `{{lien_billetterie}}`, `{{lien_noter}}`, `{{lien_classement}}`, `{{lien_dates}}`, `{{lien_je_viens}}`
- Le lien de désinscription est ajouté d'office dans le pied de chaque e-mail.

### Règle « au fur et à mesure »

Une ligne dont la variable n'a pas encore de valeur disparaît de l'e-mail. Exemples : heure inconnue, billetterie pas encore ouverte, vainqueur pas encore publié. Le même modèle s'enrichit donc tout seul quand l'admin complète la date.

### Mise en forme permise

- paragraphes et gras ;
- liens ;
- listes à puces ;
- **bouton** : texte et lien, insérés depuis la barre d'outils.

Rien d'autre. Le texte de l'admin et les valeurs sont toujours échappés : pas de HTML libre.

### Rendu

Un seul module partagé (`serveur/gabarits-emails.mjs`), importé par l'aperçu de l'admin et par l'envoi. Il produit :

- un HTML compatible avec les clients mail : tableaux, styles en ligne, à la charte (fond sable, texte encre, bouton encre, filet or, logo en image hébergée sur le site) ;
- une version texte.

## 6. Admin `/admin/emails`

Lien « E-mails » dans `CadreAdmin`, onglets ARIA comme `/admin/cookies`.

1. **Séquence** : une frise des 8 e-mails. Pour chacun :
   - quand, pour qui, interrupteur actif / inactif ;
   - dernier envoi, et nombre d'envois prévus dans les 7 prochains jours.

   Un clic ouvre l'éditeur. Un court encart d'aide sert de mode d'emploi.
2. **Éditeur d'un modèle** :
   - objet, texte d'aperçu (pré-en-tête), corps ;
   - barre de variables cliquable ;
   - encart « date proche » (bienvenue seulement) ;
   - réglage « quand » : jours et heure, bornés ;
   - **aperçu en direct** mobile / ordinateur, avec une date choisie dans le calendrier et un prénom d'exemple ;
   - « M'envoyer un test » à l'adresse de l'admin connecté ;
   - « Revenir au texte d'origine ».
3. **Dates** : nombre de rattachés par date, champ « Infos pratiques », et bouton « Écrire aux inscrits de cette date » (message n° 8).
4. **Envois** :
   - journal par étape et par date : envoyés, échecs, sautés ;
   - mode SMTP courant (`off` / `log` / `smtp`) ;
   - désinscriptions.

## 7. Données et serveur (forme attendue, détails laissés au builder)

### Tables (RLS admin AAL2, droits repartis de zéro comme pour les cookies)

- **`modeles_emails`** : une ligne par étape. Colonnes : clé, nom, actif, objet, pré-en-tête, corps, encart, décalage en jours, heure, `modifie_le`, `modifie_par`. Les textes de départ y sont insérés.
- **`destinataires_emails`** :
  - e-mail normalisé unique, prénom facultatif ;
  - lien facultatif vers le profil spectateur (compte supprimé : ligne supprimée, sauf si abonné) ;
  - indicateur « abonné » ;
  - consentement aux annonces : booléen, horodatage, texte et version ;
  - `inscrit_le`, `desinscrit_le`.

  Elle est alimentée par des déclencheurs : sur l'abonnement aux actualités, et sur la confirmation de l'e-mail spectateur. Une même adresse spectateur et abonnée ne fait qu'une ligne.
- **`rattachements_emails`** : destinataire × date du calendrier, origine (`inscription`, `je_viens`, `premiere_confirmation`), `cree_le` ; unique (destinataire, date).
- **`envois_emails`** : destinataire, étape, date, statut (`envoye`, `simule`, `echec`, `saute`), tentatives, erreur courte, `prevu_le`, `envoye_le`.
  - **unique (destinataire, étape, date)** : la ligne est réservée avant l'envoi. Un redémarrage ou deux instances ne produisent donc jamais de doublon.
  - purge au-delà de 12 mois.
- **`calendrier.infos_pratiques`** : texte borné (1 000 caractères).
- **Message n° 8** : historique de ce qui a été envoyé, à qui et quand.

### Serveur

- **SMTP** : `courriel.mjs` est généralisé à n'importe quel destinataire :
  - multipart texte + HTML, objet encodé en UTF-8 ;
  - `List-Unsubscribe` et `List-Unsubscribe-Post` (RFC 8058) ;
  - expéditeur `EMAILS_FROM` ;
  - débit plafonné et configurable.
- **Planificateur en processus**, chaque minute :
  1. calcule les échéances ;
  2. réserve les envois en base ;
  3. envoie par lots ;
  4. 3 tentatives au maximum.
- **Double confirmation** : `confirme_le` sur le destinataire (ou l'abonnement). Le formulaire de l'accueil affiche « Vérifiez votre boîte mail pour confirmer ». Page publique `/emails/confirmation`. Mon choix : un abonnement non confirmé au bout de 30 jours est supprimé.
- **Liens signés** (HMAC, clé dédiée `EMAILS_CLE_LIENS`) pour la confirmation, la désinscription et « Je viens ».
  - Page publique `/emails/desinscription` : « arrêter les annonces » ou « tout arrêter ». Pour un abonné, l'abonnement aux actualités est supprimé.
  - POST en un clic pour les messageries.
  - Page de confirmation « Je viens ».
- **Inscription spectateur** : nouvelle case « Recevoir l'annonce des prochaines dates », décochée.
  - Elle est transmise dans `raw_user_meta_data`.
  - Elle est horodatée à la confirmation, comme le consentement actuel.
- **Confidentialité** : nouvelle finalité (e-mails liés à votre date, annonces), base légale, durée de conservation, désinscription.

## 8. Hors périmètre

- éditeur visuel par blocs ;
- tests A/B ;
- statistiques d'ouverture ou de clic ;
- segmentation avancée ;
- SMS ;
- autres langues ;
- import de listes externes ;
- newsletter libre envoyée à toute la base (seul le message aux inscrits d'une date existe).

## 9. Ce qui serait un échec, même si « ça marche »

- Un e-mail reçu deux fois.
- Un rappel envoyé pour une date annulée.
- Une annonce envoyée à quelqu'un qui n'y a pas consenti.
- Une adresse e-mail en clair dans les journaux.
- Un texte d'admin qui casse la mise en page ou injecte du HTML.
- Un envoi réel parti alors que `SMTP_MODE` ≠ `smtp`.
- Un e-mail illisible sur mobile, ou qui sort de la charte.

## 10. Preuves attendues

- **Tests unitaires** :
  - rendu : variables, lignes vides, échappement, heure de Paris, compte à rebours ;
  - calcul des échéances : inscription à J-8, J-3 à 20 h, la veille, le jour même, date annulée, date déplacée ;
  - plafond par jour, regroupement des annonces ;
  - liens signés.
- **Tests base** : RLS, déclencheurs, unicité des envois, consentement.
- **e2e** :
  - éditer un modèle : l'aperçu se met à jour ;
  - test d'envoi en mode `log` ;
  - double confirmation : rien ne part avant le clic, la bienvenue part après ;
  - désinscription et « Je viens » ;
  - case d'annonces décochée par défaut ;
  - axe sans violation grave.
- **Simulation** : un script liste les e-mails prévus sur les 30 prochains jours à partir du calendrier réel.
- **Rendu vérifié à l'œil** : captures de chaque e-mail en mobile et ordinateur.

## 11. Laissé au builder

- syntaxe interne du bouton et des listes ;
- noms exacts des colonnes ;
- découpage en lots ;
- débit SMTP par défaut ;
- emplacement du champ « Infos pratiques » (onglet Dates des e-mails ou admin Vitrine, du moment qu'il est éditable par l'admin) ;
- formulation des textes de départ, à la voix du site.

## 12. Prérequis hors code (côté organisateur)

1. Offre Brevo adaptée au volume, et domaine authentifié (SPF, DKIM, DMARC) pour l'expéditeur.
2. Variables Railway : `SMTP_MODE=smtp`, `SMTP_*`, `EMAILS_FROM`, `EMAILS_CLE_LIENS` (générée par `openssl rand -hex 32`).
3. Relecture juridique de la nouvelle finalité et des textes de consentement.
