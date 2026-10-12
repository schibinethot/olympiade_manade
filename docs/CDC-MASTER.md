# Cahier des charges : app de notation de l'Olympiade des manades

> Version 0.11 (brouillon consolidé) · 2026-10-12 · Statut : **à valider** · Design validé : [charte graphique](charte-graphique.md) et [maquette v1](maquette/README.md)
> Document de référence du projet. Toute fonctionnalité livrée doit s'y rattacher.

---

## 1. Objectif

Créer **le site web et l'app Android de l'Olympiade des manades**, avec deux usages :

1. **Un site vitrine** simple et soigné : photos des Olympiades, classements 2025, 2026 et 2027, dates, contact
2. **La notation en direct** : le public et les juges notent les manades pendant la soirée depuis leur téléphone. Le spectateur s'inscrit avec son prénom et son email, valide un code reçu par email, puis reçoit une notification chaque fois qu'il peut noter. L'organisateur pilote la soirée depuis son téléphone : il importe le planning, débloque les épreuves et affiche les classements.

**Canaux** : le public passe par le **site web**. L'**app Android** sert d'abord à l'interne (admins et juges), et peut être ouverte au public par un simple réglage (section 3.1).

**Critère de succès global** : une soirée réelle se déroule de bout en bout dans l'app (import du planning, votes, classement final) sans intervention technique pendant l'événement.

### 1.1 Livrable actuel et cible

**Livrable actuel : vitrine hors soirée.** Les pages publiques et les règles SQL sont présentes ; le parcours de soirée complet est une cible de développement, pas une capacité livrée. L’inscription publique et la file de notes restent fermées par défaut. L’état d’avancement vérifiable figure au §9.1.

**Référentiel de notation unique pour le code actuel :** public de 1 à 10 (entier), jury sur 10 ou 20 (demi-points), trois modes de classement et deux méthodes d’agrégation décrits au §4.6. Les options par critères, coefficients par épreuve, favoris ou étoiles pour noter un passage restent des pistes historiques hors de cette implémentation. Les étoiles de l’avis global de soirée (§4.9) sont un usage distinct. Le poids jury de 70 % est un défaut logiciel, pas un règlement sportif officiel ; le mode séparé reste le défaut.

**Conditions avant une soirée pilote :** identifier la soirée et l’organisateur (§10), réaliser préparation/cockpit, calculs de classement et jury, vérifier la sécurité Auth/contact, configurer l’email et assurer l’exercice des droits sur les données. Le calendrier éditorial multi-villes ne signifie pas que toutes ces dates utilisent l’app de notation.


---

## 2. L'événement (recherche du 2026-10-10)

> **Le nom exact « Olympiade des manades » n'apparaît dans aucune source publique accessible.** La recherche a couvert le web, la presse locale et les sites des communes. Facebook et Instagram n'ont pas pu être consultés sans connexion. Le **format**, en revanche, est bien documenté : des soirées « Olympiades camarguaises » ou « des gardians » dans les arènes du Gard, de l'Hérault et des Bouches-du-Rhône. Les éléments ci-dessous servent de **modèle par défaut** de l'app. Ils seront remplacés par les données réelles du client (section 10). Recherche complémentaire, avec d'autres sources : [`docs/recherche-olympiades.md`](recherche-olympiades.md).

### 2.0 Présence en ligne et nom

- **Aucun site ni compte de réseau social propre aux Olympiades** n'existe. Les seules pages officielles sont les actualités des [arènes de Nîmes](https://www.arenesdenimes.com/actu/2026/les-grandes-olympiades-des-gardians-auront-lieu-le-vendredi-21-août.html) (organisateur Casas & Co / SCP), avec leur [billetterie](https://billetterie.arenesdenimes.com) et leurs réseaux ([Facebook](https://www.facebook.com/arenesdenimesscpfrance), [Instagram](https://www.instagram.com/arenesnimesscpfrance/))
- **Le nom « Olympiade des manades » est libre** : aucun usage trouvé, domaines `olympiadedesmanades.fr` et `.com` non déposés au 10/10/2026
- **À éviter** : « Olympiades Camarguaises » est le nom commercial d'une offre de team building de [Mana Événements](https://www.mana-evenements.fr/post/la-nouvelle-production-mana-evenements-le-team-building-olympiades-camarguaises)

### 2.1 Format d'une soirée

| Élément | Constat | Source |
|---|---|---|
| Fréquence | Une soirée par an et par lieu, en juillet ou août, souvent pendant une fête votive ou une feria | Toutes les éditions trouvées |
| Équipes | 3 à 7 manades, le plus souvent 4 ou 5, avec 3 à 6 gardians chacune | Voir 2.3 |
| Déroulé | Les manades se relaient : chacune passe à tour de rôle dans chaque épreuve | [Objectif Sud, Alès 2026](https://www.objectifsud.fr/actualites/ales-en-feria-les-gardians-rendent-hommage-a-leur-tradition-dans-une-soiree-de-concours-164007.php) |
| Durée | 1h30 (3 manades) à 2h (4 ou 5 manades) | Alès 2026, Nîmes 2024 |
| Horaires constatés | Début entre 21h et 22h, fin vers 23h-23h30. **Le créneau 19h-22h n'apparaît dans aucune source** | [gard30.fr](https://www.gard30.fr/agenda/grandes-olympiades-des-gardians-aux-arenes-de-nimes/), [thegoodarles.com](https://www.thegoodarles.com/good-time-agenda-sorties-et-evenements-pays-d-arles/olympiades-camarguaises-saint-louis-mouries/) |
| Ambiance | Ouverture par une capelado (présentation des manades et des Arlésiennes), peña ou bandas, remise des prix en piste | Beaucaire 2026, Saint-Rémy |
| Jury | Environ 5 membres issus de différentes manades, **notes sur 20** (ex. 17/20 pour Devaux à Alès 2026). Barème détaillé jamais publié | Alès 2026 |
| Résultat | Un vainqueur par épreuve, puis un trophée général au **cumul**. À Alès 2026, Vinuesa gagne « pour sa régularité » en finissant 2e de toutes les épreuves | Alès 2026 |
| Vote du public | **N'existe dans aucune édition trouvée.** Le « Prix du public » serait une nouveauté | n/a |
| Affluence | **3 000 spectateurs** à Nîmes en 2024. Pas de chiffre pour les autres soirées | [arenesdenimes.com](https://arenesdenimes.com/actu/2024/iie-grandes-olympiades-des-gardians-un-nouveau-sacre-pour-la-manade-vinuesa.html) |
| Tarifs | 5 à 20 € | Billetteries |
| Aléas | Soirées maintenues « sous réserve de conditions météo favorables » | Mouriès 2026 |

### 2.2 Épreuves de référence

Les 4 épreuves ci-dessous reviennent partout (Nîmes, Mouriès, Saint-Rémy, Mauguio, Alès). Elles forment le **modèle d'épreuves par défaut** de l'app et servent de référence à l'IA pour décrire un planning.

| # | Épreuve | Description |
|---|---|---|
| 1 | **Ferrade en piste** | Le cavalier renverse un anouble (taurillon d'environ un an) avec le fer depuis son cheval, met pied à terre, le maîtrise à mains nues et le couche pour simuler le marquage |
| 2 | **Saut de cheval à cheval** | Deux cavaliers encadrent un troisième cheval, non monté. L'un règle la vitesse et la direction, l'autre saute sur le cheval libre en plein galop |
| 3 | **Saut de cheval à taureau** | Le cavalier saute de son cheval sur un taureau lancé et doit le tenir jusqu'à le mettre au sol. La durée de tenue compte |
| 4 | **Attente au fer** (collective) | Les manadiers dirigent un taureau vers un angle de la piste pour qu'il charge de face deux gardians armés de tridents. Les deux doivent piquer en même temps, chacun d'un côté |

Variantes constatées :

- certaines soirées n'ont que 3 épreuves, par exemple sans le saut de cheval à cheval (Beaucaire, Pérols)
- un tri en piste féminin a eu lieu à Beaucaire en 2023
- Beauvoisin 2025 comptait 5 épreuves, dont un rodéo à taureau et une capture de la vache
- Eyguières 2008 décernait aussi un prix de présentation et proposait une bandido en piste, non notée
- jeux de gardians anciens (jeu du bouquet, jeu des oranges) : mentionnés par [Wikipédia](https://fr.wikipedia.org/wiki/Jeux_de_gardian), pas vus dans les olympiades récentes

### 2.3 Manades rencontrées (annuaire pré-rempli)

Agu, Arlatenco, Aubanel, Bon, Clément, Colombet, Conti, Des Chanoines, Devaux, Du Soleil, Gillet, Grand Salan, La Comtesse, La Galère, La Lauze, Labourayre, Lafon, Lescot, Robert Michel, Roumanille, Saint Léonard (Vitou), Vellas, Vinuesa.

### 2.3 bis Palmarès connu (base des pages Classements 2025 et 2026)

| Soirée | Vainqueur | Détail | Statut |
|---|---|---|---|
| Nîmes 2023 | Vinuesa | Face à Lescot, Clément, Robert Michel. Plus de 3 500 spectateurs | Confirmé ([source](https://www.arenesdenimes.com/actu/2023/temporada-grand-succès-populaire-des-spectacles-camarguais-aux-arènes.html)) |
| Nîmes 2024 | Vinuesa | Ferrade et attente au fer : Vinuesa. Saut de cheval à cheval : Baptiste Benabent (Grand Salan) | Confirmé ([source](https://www.arenesdenimes.com/actu/2024/iie-grandes-olympiades-des-gardians-un-nouveau-sacre-pour-la-manade-vinuesa.html)) |
| Nîmes 2025 | Vinuesa | Troisième victoire consécutive, face à Lescot, Vellas, Robert Michel, Lafon | Confirmé ([source](https://www.instagram.com/p/DcLfqqljBED/)) |
| **Nîmes 2026** | **Arlatenco** | 1. Arlatenco, 2. Vinuesa (à quelques points), 3. Robert Michel, 4. Gillet, 5. Lafon. Saut de cheval à taureau : Yannis Helly (Arlatenco) | Confirmé ([Midi Libre](https://www.midilibre.fr/2026/08/22/bravoure-technique-et-tradition-la-manade-arlatenco-remporte-les-olympiades-des-gardians-dans-les-arenes-de-nimes-13518449.php)) |
| Alès 2026 | Vinuesa | Trophée « pour sa régularité » (2e de toutes les épreuves) | Confirmé |
| Beauvoisin 2026 | Devaux | Face à Clément et La Lauze. Meilleurs : Simon Lestevin (saut cheval à cheval), Anthony Da Silva (rodéo), Bastien Fernandez (saut cheval à taureau), Dylan Guyon et Yoan Visin (attente au fer), manade Clément (capture de la vache) | Confirmé ([source](https://voir-plus.com/2026/08/19/la-fete-votive-de-beauvoisin-incontournable-et-festive/)) |
| Eyguières 2026 | Clément | Souvenir Sébastien Roux | Confirmé |
| Aimargues 2026 | Clément | Ferrade : Aubanel. Saut de cheval à cheval : ex aequo Sarah Clément et Anna Vinuesa. Attente au fer : Vinuesa | Confirmé |
| Beaucaire 2026 | Vinuesa | 5e édition | Confirmé |
| Bezouce 2026 | Labourayre | Labourayre et Clément très récompensées | **À confirmer** |
| Saint-Rémy 2026 | Bon | Face à Colombet, Gillet, Saint Léonard, Arlatenco | Confirmé |
| Béziers 2026 | Grand Salan | Ferrade : Vinuesa | Confirmé |
| Mouriès 2026 | Clément | 9e édition, face à Vellas, Gillet, La Comtesse | Confirmé |

Sources complètes (Midi Libre, publications publiques des manades et des organisateurs) dans la migration `20261011090200_palmares_2026_dates_2027.sql`. Seule Nîmes 2026 a un classement complet publié (rangs, sans les notes). Les résultats « à confirmer » s'affichent comme tels sur le site tant que l'organisateur ne les a pas validés.

### 2.3 ter Dates 2027 prévisionnelles

**Une seule date 2027 est annoncée** au 11/10/2026 : la Fête des Gardians d'Arles (jeux de gardians), sam. 01/05/2027 à 15h30. Les autres sont projetées (même jour de semaine, même place dans la fête locale) et affichées sur la page Dates avec la mention « date prévisionnelle » jusqu'à confirmation :

| Soirée | 2026 | 2027 prévisionnel |
|---|---|---|
| Arles, Fête des Gardians | n/a | **sam. 01/05/2027, 15h30 (confirmée)** |
| Alès, soirée des gardians | ven. 15/05, 21h30 | ven. 07/05/2027 |
| Eyguières | lun. 13/07, 21h30 | mar. 13/07/2027 |
| Aimargues | jeu. 16/07, 21h | jeu. 15/07/2027 |
| Beaucaire | lun. 20/07 | mar. 20/07/2027 (veille de l'ouverture de la Madeleine, comme en 2026) |
| Marsillargues | ven. 31/07, 21h30 | ven. 30/07/2027 |
| Sommières, Rencontre des manades | sam. 01/08, 21h30 | sam. 31/07/2027 |
| Pérols, Nuit des gardians | lun. 03/08, 21h30 | lun. 02/08/2027 |
| Fontvieille | mer. 05/08, 21h30 | mer. 04/08/2027 |
| Bezouce | jeu. 06/08, 21h | jeu. 05/08/2027 |
| Mauguio | mer. 12/08, 22h30 | mer. 11/08/2027 |
| Saint-Rémy-de-Provence | ven. 14/08, 22h | ven. 13/08/2027 |
| Béziers, Feria | sam. 15/08 | sam. 14/08/2027 |
| Beauvoisin | lun. 17/08, 21h30 | lun. 16/08/2027 |
| Le Crès | lun. 17/08, 21h | lun. 16/08/2027 |
| Mouriès | jeu. 20/08, 21h30 | jeu. 19/08/2027 |
| **Nîmes** | **ven. 21/08, 21h** | **ven. 20/08/2027** (toujours un vendredi entre le 18 et le 23 août depuis 2023) |
| Raphèle-lès-Arles | ven. 28/08, 21h30 | ven. 27/08/2027 |

### 2.4 Éditions de référence

| Soirée | Lieu | Organisateur | Dates connues |
|---|---|---|---|
| **Les Grandes Olympiades des Gardians** (le plus gros événement) | Arènes de Nîmes | Casas & Co / SCP Arènes de Nîmes | 18/08/2023, 23/08/2024, 22/08/2025, 21/08/2026 ([source](https://arenesdenimes.com/actu/2026/vibrez-au-rythme-des-traditions-camarguaises-avec-les-olympiades-des-gardians.html)) |
| Olympiades camarguaises | Mouriès, arènes André Blanc | Comité des fêtes | 21/08/2025, 20/08/2026 |
| Olympiades camarguaises | Saint-Rémy-de-Provence, arènes Chomel-Coinon | Comité des fêtes | 15/08/2025, 14/08/2026 ([source](https://www.mairie-saintremydeprovence.com/events/olympiades-camarguaises-2/)) |
| Olympiades beaucairoises | Beaucaire, arènes Paul-Laurent | Club taurin beaucairois et Ville | 5e édition le 20/07/2026 ([source](https://www.beaucaire.fr/les-olympiades-beaucairoises-celebrent-les-traditions-pour-une-5%E1%B5%89-edition-reussie/)) |
| Olympiades melgoriennes | Mauguio | CT Le Melgueil | 22e édition le 14/08/2024 |
| La Nuit des Gardians | Pérols | n/a | 05/08/2024, avec une dotation de 10 000 € |

### 2.5 Conséquences pour l'app

1. **Fenêtre de vote réglable** : défaut 19h00-22h00 comme demandé, mais les soirées réelles se tiennent plutôt de 21h à 23h30
2. **Barème du jury réglable** : sur 10 ou sur 20, car le jury réel note sur 20
3. **Méthode du classement général réglable** : moyenne des notes, ou cumul de points par place, comme dans le format réel
4. **Déblocage possible manade par manade** : chaque manade passe à tour de rôle dans une épreuve, donc le public peut noter un passage dès qu'il se termine
5. **Soirée reportée ou annulée** (météo) avec un message affiché au public
6. **Pas de commentaires publics en V1** : le bien-être animal est un sujet sensible et la modération serait lourde
7. **Dimensionnement** : 3 000 spectateurs, donc test de charge à 4 500 votants simulés

---

## 3. Utilisateurs et rôles

| Rôle | Qui | Accès | Ce qu'il fait |
|---|---|---|---|
| **Visiteur** | Tout internaute | Aucun compte | Consulte le site vitrine : photos, classements, dates, contact |
| **Spectateur** | Le public, dans les arènes ou chez lui | Inscription avec prénom + email, validée par un code à 6 chiffres reçu par email | Consulte le planning, note les manades, reçoit les notifications, voit le classement |
| **Juge** | Jury interne désigné par l'organisateur | Lien de connexion personnel (QR ou lien envoyé par l'admin) | Note les manades sur les passages ouverts au jury |
| **Admin** | Organisateur | Email + mot de passe, app installée sur l'écran d'accueil | Prépare la soirée, importe le planning, débloque les passages, gère les juges, publie les résultats |
| **Écran géant** | Écran ou vidéoprojecteur dans les arènes | URL dédiée, lecture seule | Affiche le QR code, l'épreuve en cours et le classement |

**Une seule base de code** sert les cinq usages. L'écran affiché dépend du rôle de la personne connectée. Les droits sont appliqués **par la base de données** (Row Level Security), pas seulement par l'interface. Ainsi, un spectateur ne peut techniquement pas écrire une note de juge.

### 3.1 Canaux d'accès

| Canal | Pour qui | Contenu |
|---|---|---|
| **Site web** (navigateur, installable sur l'écran d'accueil) | Le public, et tous les rôles | Vitrine, inscription, notation, classements, notifications web |
| **App Android** (Google Play) | **Interne par défaut** : admins et juges | Cockpit admin, import du planning, notation jury, notifications natives |

- **Réglage `app_ouverte_au_public`** (désactivé par défaut) : une fois activé, les spectateurs peuvent aussi utiliser l'app Android pour s'inscrire, noter et recevoir les notifications natives. Le site web reste toujours disponible pour le public
- **Même code** pour les deux canaux : l'app Android est une coque native (Capacitor) autour de l'application web. Toute évolution sort sur les deux canaux en même temps
- **iPhone** : le même code permet une app iOS plus tard (compte Apple Developer requis). En V1, les admins et juges sur iPhone utilisent le site web installé sur l'écran d'accueil

---

## 4. Fonctionnalités

### 4.0 Site vitrine

Objectif : un site **simple, intuitif et soigné**, pensé d'abord pour le téléphone, dans l'esprit camarguais (sable, noir, rouge, grandes photos).

**Design** : toutes les interfaces (vitrine, spectateur, jury, organisateur, écran géant) suivent la [charte graphique](charte-graphique.md), validée le 10/10/2026 avec la [maquette v1](maquette/README.md). Elle reprend l'affiche officielle des Olympiades (duotone couchant, titre au pinceau, manades et fers) et la charte d'Atch Élevage, sponsor de l'Olympiade des Manades.

| Page | Contenu |
|---|---|
| **Accueil** | Sur mobile, **le premier bloc affiché est « Notez les Olympiades »**, avec un gros bouton qui mène à l'inscription, ou directement à la notation si le spectateur est déjà inscrit. **Hors soirée**, ce bouton reste visible mais grisé, avec la raison juste dessous (date, heure et arènes de la prochaine soirée). En dessous : prochaine soirée (date, lieu, compte à rebours), photos des éditions passées, présentation courte des 4 épreuves, dernier vainqueur |
| **Classements** | Onglets **2025**, **2026** et **2027**. 2025 et 2026 : palmarès des éditions passées (vainqueur général, vainqueurs par épreuve, source). 2027 : classements en direct de l'app (public et jury, selon les réglages de la section 4.6) |
| **Dates** | Calendrier des soirées 2027 (date, heure, arènes, ville, lien billetterie), puis archives 2025 et 2026 |
| **Contact** | Formulaire (prénom, email, message) avec anti-robot. Le message est enregistré et transmis par email à l'organisateur. Coordonnées de l'organisateur |
| **Mentions légales et confidentialité** | Obligatoires, accessibles depuis le pied de page |

**Photos** :

- 20 photos libres de droits déjà repérées et vérifiées sur Wikimedia Commons (gardians, abrivado, ferrade, arènes de Nîmes) : liste, auteurs et licences dans [`docs/photos-libres.md`](photos-libres.md). Aucune photo libre des Olympiades elles-mêmes n'existe : les photos d'épreuves viendront de l'organisateur ou des manades
- uniquement des photos dont on a le droit d'usage : photos fournies par l'organisateur ou les manades avec l'accord écrit du photographe, ou photos sous licence libre (Wikimedia Commons), toujours créditées
- les photos de presse (ICI, Objectif Gard, Midi Libre, arènes de Nîmes) ne sont **pas** reprises sans l'accord du photographe ou du média
- images optimisées (AVIF ou WebP, tailles adaptées au téléphone) pour rester rapides sur le réseau des arènes

**Palmarès 2025 et 2026** : ces éditions ont eu lieu avant l'app. L'admin saisit leurs résultats dans un écran dédié (soirée, rang, manade, vainqueurs par épreuve, lien vers la source). À partir de 2027, les classements viennent directement des votes de l'app.

**Contenu géré par l'admin** : textes d'accueil, photos, dates et palmarès se modifient depuis l'app admin, sans redéploiement.

### 4.1 Soirées

Une **soirée** est une édition de l'Olympiade. Champs :

- nom, date, lieu (arènes, ville)
- fenêtre de vote : début et fin (par défaut 19h00-22h00)
- manades participantes, avec leur ordre de passage
- épreuves (voir 4.2)
- réglages : mode de vote (4.4), barème du jury (4.5), mode et méthode de classement (4.6), visibilité du classement
- statut : `brouillon`, `publiée`, `en cours`, `terminée`, `reportée`, `annulée`. Un statut reporté ou annulé affiche au public un message rédigé par l'admin

Les manades sont gérées dans un **annuaire réutilisable** d'une soirée à l'autre (nom, ville, logo optionnel), pré-rempli avec la liste de la section 2.3.

### 4.2 Planning, épreuves et passages

Chaque **épreuve** possède : un ordre, un nom, une description courte, une heure de début et une heure de fin prévues, et un type : **notée** ou **démonstration** (affichée au planning, sans vote ni classement, ex. bandido).

Chaque épreuve contient un **passage** par manade participante, dans l'ordre de passage. Le passage est l'unité notée et débloquée : « la manade Vinuesa sur la ferrade ».

Le planning se remplit de trois façons :

1. **Import automatique** (4.3), le cas normal
2. **Modèle par défaut** : les 4 épreuves de référence (section 2.2), avec leurs descriptions
3. **Saisie manuelle** : ajouter, modifier, réordonner ou supprimer une épreuve, changer l'ordre de passage des manades

**Décalage en direct** : un bouton « Décaler la suite de +N min » repousse toutes les épreuves suivantes quand la soirée prend du retard.

### 4.3 Import du planning par IA

L'admin envoie le planning dans le format qu'il a sous la main :

| Format | Traitement |
|---|---|
| PDF | Envoyé tel quel à Claude (lecture native du PDF) |
| Photo JPG / PNG / WebP | Envoyée telle quelle à Claude (lecture native de l'image) |
| Photo HEIC (iPhone) | Convertie en JPEG dans le navigateur avant l'envoi |
| Word `.docx` | Texte et tableaux extraits côté serveur (bibliothèque `mammoth`), puis envoyés à Claude |
| Excel `.xlsx` / `.xls` / `.csv` | Chaque feuille est convertie en tableau texte côté serveur (bibliothèque SheetJS), puis envoyée à Claude |

**Ce que l'IA renvoie**, en JSON validé par un schéma (sortie structurée, aucun texte libre à analyser) :

- infos de la soirée trouvées dans le document : nom, date, lieu, horaires
- liste des manades. Chaque nom est rapproché de l'annuaire, et toute nouvelle manade est signalée
- liste des épreuves : ordre, nom, heure de début et de fin, **description courte**. Si le document ne décrit pas l'épreuve, l'IA rédige une description d'une ou deux phrases à partir des descriptions de référence (section 2.2), marquée « générée par l'IA »
- avertissements : horaires manquants, ligne illisible, manade en double, etc.

**Revue humaine obligatoire** : le résultat s'affiche dans un tableau modifiable. L'admin corrige, puis clique sur « Appliquer au planning ». Rien n'est jamais écrit dans le planning sans cette validation. Un nouvel import remplace le brouillon précédent, jamais un planning déjà publié sans confirmation explicite.

**Paramètres techniques** :

- modèle `claude-opus-5-5`, sortie structurée (`output_config.format` + schéma Zod), repli serveur en cas de refus activé (`fallbacks: "default"`)
- appel depuis une Supabase Edge Function. La clé API reste un secret serveur et n'est jamais envoyée au navigateur
- taille maximale du fichier : 20 Mo
- coût estimé : **0,02 à 0,10 € par import** (un planning d'une page ≈ 2 000 à 5 000 jetons en entrée, 1 000 à 3 000 en sortie, au tarif Opus 5.5 de 4 $ / 20 $ par million de jetons)
- chaque import est historisé : fichier d'origine, JSON obtenu, auteur, date, erreur éventuelle

### 4.4 Vote du public

**Inscription** (une seule fois, possible avant la soirée) :

1. Il ouvre le site, depuis le QR code des arènes ou un lien partagé. Sur mobile, « Notez les Olympiades » est le premier bloc affiché
2. Il saisit son **prénom** et son **email**, et accepte la politique de confidentialité
3. Il reçoit par email un **code à 6 chiffres**, valable 1 heure, et le saisit dans l'app. L'email contient aussi un lien de connexion, en secours
4. Son accès est validé. Il reste connecté sur ce téléphone pour toute la saison, sans ressaisir de code
5. L'app lui propose d'**activer les notifications** (section 4.10)

**Ouverture de l'inscription au public** : réglée par le drapeau de build `VITE_INSCRIPTION_OUVERTE`, faux par défaut. Tant qu'il est faux, les liens vers l'inscription sont remplacés par « Inscriptions bientôt ouvertes ». Il passe à vrai seulement quand ces prérequis sont en place, dans cet ordre : anti-robot Turnstile, consentement horodaté à la confirmation de l'email et purge des comptes non confirmés, SMTP Brevo branché sur Supabase Auth. Raison : l'envoi intégré de Supabase n'écrit qu'aux membres de l'équipe.

**Pendant la soirée** :

1. Il reçoit une notification « C'est le moment de noter ! Ferrade en piste : manade Vinuesa » dès qu'un passage est débloqué
2. La notification ouvre directement l'écran de notation du passage
3. Il note chaque manade de **1 à 10** (gros boutons faciles à toucher, utilisables d'une main)
4. Un message confirme l'enregistrement. Il peut changer sa note tant que le passage est ouvert

**Deux modes de vote**, choisis par l'admin pour chaque soirée :

| Mode | Règle |
|---|---|
| **Libre** | Pendant la fenêtre de la soirée (ex. 19h00-22h00), le spectateur note n'importe quelle manade sur n'importe quelle épreuve, dans l'ordre qu'il veut. L'admin peut ouvrir ou fermer la fenêtre en avance, ou la prolonger. |
| **Par déblocage** | Un passage n'est notable qu'une fois **débloqué** par l'admin, et jusqu'à ce qu'il le **ferme**. L'admin débloque soit **toute l'épreuve d'un coup** (tous les passages), soit **manade par manade**, à la fin de chaque passage. Plusieurs passages peuvent être ouverts en même temps. |

**Règles communes** :

- une seule note par spectateur inscrit (email vérifié) et par passage. Un nouveau vote remplace l'ancien
- **l'heure du serveur fait foi**. Une action arrivée après la fermeture est refusée par la base. Une action admise dans la file serveur avant la fermeture peut terminer son enregistrement ensuite ; « reçue » et « enregistrée » sont deux états distincts
- sans réseau, la note est gardée sur le téléphone et envoyée dès le retour de la connexion, si le passage est encore ouvert. Sinon, le spectateur voit « Vote fermé, note non prise en compte »

**Limiter la triche** : chaque vote demande un email vérifié, donc voter deux fois demande deux adresses email. Mesures complémentaires :

- vérification anti-robot invisible (Cloudflare Turnstile) à l'inscription
- limites d'envoi de codes **relevées** pour les soirées. Dans les arènes, beaucoup de téléphones partagent la même adresse IP (réseau 4G mutualisé ou Wi-Fi), et les limites par défaut de Supabase bloqueraient des spectateurs légitimes
- l'admin voit le nombre de votants par passage et les inscriptions par minute, ce qui rend une anomalie visible
- inscription encouragée **avant** la soirée (site, réseaux sociaux, billetterie), pour ne pas dépendre de la réception d'un email dans des arènes saturées

### 4.5 Notation du jury

- L'admin crée les juges (nom) et les rattache à une soirée. L'app génère pour chaque juge un **lien de connexion personnel**, affiché en QR code ou envoyé par SMS ou WhatsApp. Le juge le scanne et se retrouve connecté, sans mot de passe à retenir
- **barème réglable par soirée** : sur 10 ou sur 20 (défaut 20, comme le jury réel), au demi-point près, avec un commentaire privé optionnel. Pour les classements combinés, la note jury est ramenée sur 10
- le vote jury a son **propre statut** par passage. Par défaut il s'ouvre et se ferme en même temps que le vote public. L'admin peut le dissocier, par exemple pour laisser le jury finaliser après la fermeture du public
- le juge corrige ses notes tant que le vote jury du passage est ouvert. L'admin **verrouille** ensuite les notes du jury
- l'admin voit en direct quel juge n'a pas encore noté quel passage

### 4.6 Classements

**Calculs** (tous calculés en permanence, quel que soit le réglage d'affichage) :

| Classement | Calcul |
|---|---|
| Public, par épreuve | Moyenne des notes reçues par la manade sur son passage, avec le nombre de votes |
| Jury, par épreuve | Moyenne des notes des juges sur le passage |
| Combiné, par épreuve | `poids_jury × jury + (1 − poids_jury) × public`, notes ramenées sur 10, poids réglable de 0 à 100 % (défaut 70 %) |
| Général (public, jury, combiné) | Selon la **méthode** choisie, voir ci-dessous |

**Méthode du classement général**, choisie par l'admin :

- **Moyenne des notes** (défaut) : moyenne des notes de la manade sur toutes les épreuves
- **Cumul de points par place** : à chaque épreuve, le 1er reçoit N points (N = nombre de manades), le 2e N−1, etc. Le général additionne ces points. C'est ce qui récompense la régularité, comme Vinuesa à Alès en 2026

**Mode de classement officiel**, choisi par l'admin pour chaque soirée :

1. **Deux classements séparés** : « Jury » et « Prix du public », côte à côte
2. **Combiné pondéré** : un classement final unique, avec le détail jury et public consultable
3. **Jury seul officiel** : le classement public est affiché comme indicatif

**Vainqueur par épreuve** : affiché pour chaque épreuve, dans chaque classement.

**Visibilité** : le classement est visible en direct par défaut. L'admin peut le **masquer** et le **révéler** quand il veut, pour garder le suspense jusqu'à la remise des prix.

**Égalité** : les manades ex æquo partagent le même rang.

**Notes manquantes** : une note manquante ne vaut jamais zéro. Une manade sans note sur une épreuve est exclue du calcul de cette épreuve, et le classement est marqué **provisoire** tant qu'un passage reste ouvert ou sans note du jury.

### 4.7 App admin (mobile)

L'app admin est la même application, installée sur l'écran d'accueil du téléphone et connectée avec un compte admin. Elle se lance en plein écran, comme une app native.

**Écrans** :

1. **Mes soirées** : liste, création, duplication d'une soirée passée
2. **Préparation** : infos, manades, planning (import IA, modèle par défaut ou saisie manuelle), juges, réglages, QR code (plein écran et affiche PDF à imprimer)
3. **En direct (cockpit)** :
   - épreuve en cours, en grand, avec la liste de ses passages
   - boutons **Débloquer** et **Fermer** larges, pour l'épreuve entière ou pour chaque manade, utilisables d'une main en extérieur
   - compteur de votes en temps réel par passage
   - passage à l'épreuve suivante, décalage horaire
   - juges en retard de notation
4. **Résultats** : classements détaillés, vainqueurs par épreuve, révélation du classement, verrouillage final, export CSV et PDF

Les actions irréversibles (fermer définitivement une épreuve, verrouiller le jury, terminer ou annuler la soirée) demandent une confirmation.

### 4.8 Écran géant

URL `/ecran/<soiree>` en lecture seule, prévue pour être lisible à 20 m :

- QR code de vote en permanence
- épreuve en cours et manade en piste, avec l'indication « Votez maintenant ! » quand le vote est ouvert
- classement (selon le réglage de visibilité)
- rafraîchissement automatique et mode plein écran

### 4.9 Avis sur la soirée

Après la fermeture des votes, le spectateur peut laisser une **note globale de la soirée** (1 à 5 étoiles) et un **commentaire facultatif** (500 caractères maximum). Ces avis :

- ne modifient jamais les notes des manades
- sont visibles uniquement par les admins (note moyenne, nombre d'avis, liste des commentaires), donc sans modération publique
- sont limités à un avis par spectateur et par soirée

La base ouvre les avis d’une soirée `publiee` ou `en_cours` après `vote_fin` en mode libre. En mode déblocage, elle attend la clôture de tous les passages notés (au moins un), car l’heure de fin seule ne ferme pas les votes. Le statut `terminee` ouvre aussi les avis ; `brouillon`, `reportee` et `annulee` les ferment.

### 4.10 Notifications sur le téléphone

- **Quand** : à chaque déblocage d'un passage ou d'une épreuve (mode déblocage), à l'ouverture de la fenêtre de vote (mode libre) et à la révélation du classement
- **Contenu** : « C'est le moment de noter ! Ferrade en piste : manade Vinuesa ». Un appui ouvre directement l'écran de notation
- **Technologie** : sur le site web, notifications Web Push standard. Dans l'app Android, notifications natives via Firebase Cloud Messaging (FCM), plus fiables. Dans les deux cas, l'envoi part du serveur dès que l'admin débloque
- **Android** : fonctionnent depuis le navigateur dès que le spectateur les accepte
- **iPhone** : Apple n'autorise les notifications web **que si le site est ajouté à l'écran d'accueil** ([Pushpad](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications), [WebKit](https://webkit.org/?p=16535)). L'app détecte l'iPhone et affiche un guide en 2 étapes (« Partager », puis « Sur l'écran d'accueil ») avant de proposer les notifications
- **Secours pour tous** : quand l'app est ouverte, un déblocage déclenche une bannière et une vibration, même sans notification
- **Désactivation** : un interrupteur dans l'app coupe les notifications. Aucune notification en dehors des soirées
- **Volume** : une notification par déblocage, regroupée si l'admin débloque plusieurs passages en moins de 30 s

---

## 5. Architecture technique

### 5.1 Choix

| Brique | Choix | Raison |
|---|---|---|
| Front | React Router 8 (mode framework, sur Vite) + TypeScript + Tailwind + shadcn/ui | Pages vitrine pré-rendues pour le référencement, notation et admin en application monopage |
| App installable | PWA (`vite-plugin-pwa`), **un seul manifeste** | Plusieurs PWA sur un même domaine se disputent les liens ([web.dev](https://web.dev/articles/building-multiple-pwas-on-the-same-domain)). Une seule app avec des rôles évite le problème |
| Base de données | Supabase Postgres + Row Level Security | Les règles de vote (fenêtre, déblocage, une note par personne) sont appliquées par la base |
| Authentification | Supabase Auth : code à 6 chiffres par email pour les spectateurs ([doc](https://supabase.com/docs/guides/auth/auth-email-passwordless)), email + mot de passe pour les admins, lien de connexion généré par l'admin pour les juges | Un email vérifié par votant, sans mot de passe à retenir |
| Emails | SMTP Brevo (entreprise française, données dans l'UE), branché sur Supabase Auth et sur le formulaire de contact | L'envoi intégré de Supabase est limité à 2 emails par heure et réservé aux tests |
| Notifications | Web Push (clés VAPID) pour le site, Firebase Cloud Messaging pour l'app Android. Abonnements enregistrés en base, envoi par une Supabase Edge Function `notifier` déclenchée par un webhook de base de données au déblocage | Gratuit, un seul point d'envoi pour les deux canaux |
| App Android | Capacitor : coque native Android autour du build web (mode application monopage de React Router), publiée sur Google Play | Une seule base de code, iOS possible plus tard |
| Temps réel | Supabase Realtime pour admins, juges et écran géant. Relecture périodique pour les spectateurs (voir 5.3) | Respect des quotas Realtime |
| Fichiers | Supabase Storage (bucket privé `plannings`) | Historique des imports |
| IA | Supabase Edge Function `extraire-planning` + SDK `@anthropic-ai/sdk`, modèle `claude-opus-5-5` | La clé API reste côté serveur |
| Hébergement du front | Railway, compte TPMGE, un seul service `olympiade_manade` : petit serveur Node (`serveur/statique.mjs`) qui sert le build pré-rendu avec les en-têtes de sécurité (CSP par hachages, HSTS) | Le front est un site statique ; un seul bloc à suivre, choisi par le client |

### 5.2 Modèle de données

```
profils            (id = auth.users.id, prenom, role: admin | juge | spectateur,
                    consentement_le)
manades            (id, nom, ville, logo_url)
soirees            (id, slug, nom, date, lieu, vote_debut, vote_fin,
                    mode_vote: libre | deblocage,
                    bareme_jury: 10 | 20,
                    mode_classement: separe | combine | jury,
                    methode_general: moyenne | points,
                    poids_jury 0-100, classement_visible,
                    statut, message_public)
soiree_manades     (soiree_id, manade_id, ordre)
soiree_juges       (soiree_id, juge_id)
epreuves           (id, soiree_id, ordre, nom, description, description_ia,
                    notee, heure_debut, heure_fin)
passages           (id, epreuve_id, manade_id, ordre,
                    statut_public: a_venir | ouvert | clos,
                    statut_jury:   a_venir | ouvert | clos | verrouille,
                    jury_lie_au_public)
                    UNIQUE (epreuve_id, manade_id)
notes_public       (passage_id, votant_id, note 1-10, maj_le)
                    UNIQUE (passage_id, votant_id)
notes_jury         (passage_id, juge_id, note pas 0.5 dans le barème,
                    commentaire, maj_le)
                    UNIQUE (passage_id, juge_id)
avis_soiree        (soiree_id, votant_id, etoiles 1-5, commentaire, cree_le)
                    UNIQUE (soiree_id, votant_id)
abonnements_push   (id, profil_id, canal: web | android, cible UNIQUE,
                    p256dh, auth, cree_le)   -- cible = endpoint web ou jeton FCM
parametres         (cle, valeur jsonb)  -- ex. app_ouverte_au_public
calendrier         (id, annee, nom, ville, arenes, date_soiree, heure,
                    statut: previsionnelle | confirmee | annulee,
                    lien_billetterie, soiree_id)   -- page Dates
palmares           (id, annee, evenement, ville, date_soiree, vainqueur, detail,
                    statut: confirme | a_confirmer, source_url)
photos             (id, url, legende, credit, licence, ordre)   -- lot 1, pas encore créée
contenus           (cle, titre, texte, maj_le)   -- lot 1, pas encore créée ; textes de la vitrine
messages_contact   (id, prenom, email, message, cree_le, traite)
imports_planning   (id, soiree_id, fichier, type, statut, resultat jsonb,
                    erreur, auteur, cree_le)
etat_soiree        (soiree_id, instantane jsonb, calcule_le)
                    -- instantané public : statuts + classements
```

**Règles RLS principales** :

- `notes_public` : insertion et modification seulement si `votant_id = auth.uid()`, si l'email du votant est vérifié et si le passage est votable **à l'heure du serveur**, selon le mode (fenêtre de la soirée en mode libre, statut `ouvert` en mode déblocage). Lecture limitée à ses propres notes
- `notes_jury` : seulement un juge rattaché à la soirée, passage au statut jury `ouvert`, note conforme au barème. L'admin lit tout
- un spectateur ne peut écrire que ses propres notes, son avis et ses abonnements aux notifications
- `messages_contact` : insertion ouverte à tous (avec anti-robot vérifié côté serveur), lecture réservée aux admins
- les spectateurs ne lisent jamais les notes brutes des autres, seulement l'instantané agrégé
- `presences_authentifiees` : aucun accès direct du navigateur ; RPC de présence liée à `auth.uid()`, au plus une écriture par compte toutes les 60 secondes
- `supervision_serveur_minutes` : écriture par le serveur uniquement ; lecture des agrégats par RPC réservée aux admins, rôle revérifié en base

### 5.3 Temps réel et charge

**Cible demandée : 5 000 personnes simultanées. Capacité non encore validée.** L'[audit du 11/10/2026](audit-charge-5000.md) distingue la configuration réellement vérifiée, les calculs théoriques et les mesures locales. Le parcours public de saisie et sa file sont implémentés dans le code, à activer après migration. L'instantané des classements et sa diffusion restent à implémenter (lot 2).

Quotas Supabase Realtime en connexions simultanées ([source](https://supabase.com/docs/guides/realtime/quotas)) : 200 sur le plan Free, 500 sur Pro, 10 000 sur Pro sans plafond de dépense. Ces connexions WebSocket sont distinctes des sessions de spectateurs et des connexions PostgreSQL. Le plan et le compute du projet Supabase restent à confirmer ; le plan Railway Pro ne les renseigne pas.

Pour ne pas dépendre de ces quotas :

- **admins, juges, écran géant** (quelques dizaines de connexions) : Realtime, mise à jour immédiate
- **spectateurs** : l'app relit l'**instantané** `etat_soiree` toutes les 10 s, avec phases décalées entre utilisateurs et reprise répartie au retour au premier plan. Cet instantané tient en une ligne JSON recalculée côté serveur au plus une fois toutes les 5 s. À 5 000 personnes, cela représente **500 lectures/s** ; une ligne JSON ne garantit pas à elle seule que cette charge sera tenue
- objectif : **un déblocage est visible chez tous les spectateurs en moins de 10 s**
- **test de charge obligatoire** (k6) avant la première soirée : palier de **5 000 votants simulés**, puis **7 500** (marge 1,5 × 5 000), ou 1,5 × l'affluence annoncée si elle est supérieure. Préproduction équivalente, JWT utilisateurs distincts et règles RLS réelles ; montée progressive, votes répartis puis rafale, relecture des notes et fermeture de vote. Le test SQL local n'est pas une certification du service hébergé
- plan Supabase **Pro** pendant la saison des soirées
- **inscription préalable** : SMTP de production, quotas Auth et capacité d'envoi vérifiés avant ouverture. L'envoi intégré à 2 emails/h et les redirections localhost observés le 11/10 ne conviennent pas au public

### 5.3.1 Écran de supervision administrateur

Routes `/admin` (connexion par mot de passe d'un compte admin existant) et `/admin/statistiques`. Toutes les lectures sont protégées côté serveur et en base ; les métadonnées modifiables du compte ne donnent aucun droit.

- comptes actifs : comptes authentifiés ayant envoyé un signal depuis moins de 2 minutes, sans compter les visiteurs anonymes ni assimiler plusieurs onglets à plusieurs personnes ; émission toutes les 60 à 75 secondes lorsque l'app est visible, démarrage réparti sur 30 secondes
- notes du public et du jury : lignes enregistrées, notes créées ou modifiées depuis 5 minutes et 1 heure ; il ne s'agit pas du nombre de tentatives d'écriture
- serveur : requêtes, erreurs 5xx, octets de réponse, p95 estimé par histogramme, temps CPU, mémoire du processus, retard de la boucle et connexions HTTP ; ne mesure pas le temps réseau du téléphone ni les requêtes directes à Supabase
- base : taille et connexions PostgreSQL ; volumes de transfert Supabase affichés comme non mesurés tant qu'une source fiable n'est pas connectée
- historique par minute, périodes 1 h / 24 h, courbes et export CSV ; actualisation visible toutes les 30 s, erreurs et données périmées signalées
- persistance : un agrégat par instance et par minute, clé serveur `SUPABASE_SERVICE_ROLE_KEY` uniquement ; historique et derniers signaux conservés 30 jours, purge périodique. Sans clé serveur, historique local depuis le dernier démarrage, explicitement signalé
- aucun email, IP, jeton ou contenu des notes dans le journal de supervision ; un UUID de compte et son dernier signal sont gardés dans la table privée de présence. L'échec d'un signal ne bloque jamais le vote

Le déploiement de cette supervision nécessite la migration `20261011130000_supervision.sql` et la configuration des variables du serveur. L'ajout du code ne vaut ni déploiement ni validation des 5 000 utilisateurs.

### 5.4 Contraintes réseau

Le réseau 4G est souvent saturé dans les arènes. En conséquence :

- page spectateur légère (objectif < 200 Ko au premier chargement, hors logos)
- votes mis en file d'attente localement et renvoyés automatiquement
- interface admin utilisable même avec une connexion lente (états « envoi… » / « enregistré » explicites)

### 5.4.1 File durable des notes du public

- `/noter` : saisie de 1 à 10 pour les comptes connectés, planning publié relu toutes les 10 à 12 secondes à l'écran. Le planning public passe par un cache Railway de 5 secondes, avec une seule lecture Supabase simultanée par instance, y compris en cas de panne. Les notes personnelles ne sont jamais dans ce cache
- téléphone : IndexedDB, au plus 200 actions conservées par compte, envoi séquentiel et bail entre onglets. Une correction jamais envoyée peut remplacer la précédente ; dès le premier essai, l'identifiant et son contenu deviennent immuables. Un rechargement ou une réponse perdue ne crée pas de nouvelle action
- reprise : timeout, temporisation progressive et aléatoire, respect de `Retry-After`, arrêt des envois à la déconnexion et isolation des comptes. Aucun jeton dans la file. Un stockage indisponible produit une erreur visible avant toute promesse de conservation
- serveur : RPC d'admission contrôlant identité, email confirmé et règles à l'heure serveur ; 100 actions maximum par compte et passage. UUID conservés pour l'idempotence, suppression en cascade avec le compte. Le passage ne peut plus être réattribué dès la première action admise
- traitement : lots de 100 maximum avec pause de 250 ms par défaut, une transaction à la fois par instance. Les instances se partagent les actions sans traiter simultanément deux corrections d'une même note. Écriture de la note et confirmation dans la même transaction ; un crash provoque soit un rollback, soit une confirmation complète
- fermeture : une note encore sur le téléphone doit atteindre le serveur avant fermeture. Une note reçue à temps est traitée même si le vote ferme ensuite. Le statut « enregistrée » n'apparaît qu'après confirmation serveur
- supervision : file restante, âge du plus ancien envoi, confirmations, refus et dernier signal des traitements. Les notes encore sur les téléphones ne sont pas comptées dans le backlog serveur
- activation : migration `20261011140000_file_notes.sql`, clé exclusivement serveur et `FILE_NOTES_ACTIVE=true`. Le code ne modifie ni les forfaits ni l'infrastructure. Voir le [guide de la file](file-notes.md)

Une file absorbe les pics et permet les reprises ; elle ajoute des écritures et des lectures de suivi. Elle ne rend pas une base lente plus rapide et ne garantit pas « zéro lag ». Le test hébergé doit mesurer séparément réception, attente et confirmation, avec refus explicites et contrôle d'intégrité.

---

## 6. Exigences non fonctionnelles

| Domaine | Exigence |
|---|---|
| Performance | Enregistrement d'un vote < 1 s sur 4G correcte |
| Disponibilité | Aucune mise en production pendant une soirée |
| Accessibilité | Contrastes AA, boutons de 48 px minimum, lisible de nuit sous l'éclairage des arènes |
| Langue | Français uniquement en V1 |
| RGPD | Données du public : prénom et email, utilisés uniquement pour l'accès au vote et les notifications. Consentement à l'inscription, politique de confidentialité, suppression du compte depuis l'app, suppression automatique des comptes spectateurs inactifs depuis 24 mois. Aucun traceur tiers. Pas de newsletter sans case dédiée, décochée par défaut. Sous-traitants : Supabase, Brevo, Railway |
| Référencement | Pages vitrine pré-rendues, titre et description par page, données structurées `Event` pour les dates |
| Sécurité | Clé API Anthropic et clé `service_role` Supabase uniquement côté serveur. Règles RLS couvertes par des tests automatisés |
| Signature | Pied de page « Signé TPMGE » selon la spec de l'agence, et mention « Conçue en collaboration avec Atch Élevage et TPMGE » avec le bloc « Partenaire officiel : Atch Élevage » (charte graphique, section 8) |

---

## 7. Hors périmètre V1

- billetterie, paiement, dons
- application iOS publiée sur l'App Store (le code le permet, la publication n'est pas en V1)
- vote par SMS ou code sur le billet
- commentaires publics (les avis de la section 4.9 restent privés)
- autres langues que le français
- espaces sponsors et publicité (seule exception : la mention du partenaire Atch Élevage décrite dans la charte graphique)
- statistiques multi-soirées, championnat sur l'année, historique par manade
- newsletter et emailing marketing

---

## 8. Critères d'acceptation

1. Sur l'accueil mobile, « Notez les Olympiades » est visible sans faire défiler. Un spectateur s'inscrit, reçoit son code, et enregistre sa première note en **moins de 2 minutes**, sans rien installer
2. En mode **déblocage**, une note sur un passage non débloqué est **refusée par la base**, y compris par un appel direct à l'API qui contourne l'interface
3. En mode **libre**, tous les passages sont notables entre `vote_debut` et `vote_fin`, et aucun en dehors
4. Un même spectateur ne peut avoir qu'**une note** par passage. Un second vote remplace le premier
5. Un spectateur ne peut pas écrire de note jury, et un juge ne peut pas noter une soirée à laquelle il n'est pas rattaché
6. Un déblocage par l'admin est visible chez les spectateurs en **moins de 10 s**
7. L'import d'un planning en PDF, en photo, en Word et en Excel produit un brouillon d'épreuves correct sur **4 fichiers de test réels**, après au plus 2 corrections manuelles par fichier
8. Les classements (3 modes × 2 méthodes, barèmes 10 et 20) donnent les résultats attendus sur un jeu de données de référence, dont le cas « Vinuesa à Alès 2026 » : une manade 2e partout et vainqueur au cumul de points (tests unitaires)
9. Le test de charge de préproduction tient **5 000 votants simultanés**, puis **7 500** pour la marge, avec p95 d'enregistrement < 1 s, taux d'erreur < 0,1 %, aucune note acquittée perdue et aucune duplication. Toute erreur explicite doit être traitée par la file de reprise ; la fermeture interdit une écriture tardive. Les ressources et la file d'attente restent bornées
10. Un parcours complet (création de soirée, import, votes, résultats) passe en test e2e Playwright sur mobile
11. Un déblocage déclenche une notification reçue en **moins de 15 s** sur Android (navigateur) et sur iPhone (site ajouté à l'écran d'accueil)
12. Les pages Accueil, Classements (2025, 2026, 2027), Dates et Contact s'affichent correctement sur mobile et ordinateur, avec un score Lighthouse mobile d'au moins 90 en performance et en accessibilité
13. Un message envoyé par le formulaire de contact arrive dans la boîte email de l'organisateur
14. L'app Android s'installe depuis Google Play (piste de test interne) : un admin y débloque une épreuve, un juge y note et reçoit la notification native. Avec `app_ouverte_au_public` désactivé, un spectateur ne peut pas s'y connecter ; activé, il le peut
15. L'admin consulte et exporte les mesures de connexion et de charge ; visiteurs et spectateurs sont refusés par l'API et la base. La supervision reste sans effet sur l'enregistrement d'une note en cas de panne de collecte

---

## 9. Découpage en lots

| Lot | Contenu | Estimation |
|---|---|---|
| 0 | Socle : dépôt, projet Supabase, schéma, RLS + tests, authentification (code email, admins, juges), SMTP | 2 j |
| 1 | Admin préparation : soirées, annuaire des manades, épreuves (modèle par défaut et saisie manuelle), passages, réglages, QR code. Gestion de la vitrine (dates, palmarès, textes, photos), reprise du lot 7 | 2,5 j |
| 2 | Vote public : deux modes, déblocage par épreuve ou par manade, file d'attente hors-ligne, instantané, classements, avis sur la soirée | 3 j |
| 3 | Import IA du planning : Edge Function, conversions, écran de revue | 1,5 j |
| 4 | Jury : liens de connexion, notation, barème, verrouillage | 1 j |
| 5 | Cockpit en direct et écran géant | 1,5 j |
| 6 | PWA, test de charge, tests e2e, recette sur téléphones réels | 1,5 j |
| 7 | Site vitrine : accueil, classements 2025-2027, dates, contact, mentions légales. **En ligne depuis le 11/10/2026** ; la gestion des contenus depuis l'admin passe au lot 1 | 2 j |
| 8 | Notifications : abonnement, guide iPhone, envoi au déblocage, bannière de secours | 1,5 j |
| 9 | App Android : coque Capacitor, notifications FCM, réglage d'ouverture au public, publication Google Play (test interne) | 2,5 j |
| | **Total** | **≈ 19 jours** |

### 9.1 État du dépôt au 12/10/2026

| Lot | État |
|---|---|
| 0 | **Socle présent.** Schéma, règles et RLS testés, Auth email et connexion admin. Correctifs captcha et AAL2 à appliquer avec la configuration hébergée. Consentement horodaté à la confirmation email dans la nouvelle migration. SMTP, purge des comptes non confirmés et liens juges restent à terminer avant ouverture. |
| 1 | **Non commencé côté interface.** Pas de préparation des soirées, d’annuaire administrable, de gestion du planning ou des contenus. |
| 2 | **Partiel.** `/noter`, file IndexedDB/PostgreSQL, reçus et reprise présents ; traitement serveur désactivé par défaut. Reste : état réel sur l’accueil, instantané des résultats, calculs de classement, avis et suppression de compte. |
| 3, 4, 5 | **Non commencés côté interface.** Import IA, saisie jury, cockpit et écran géant absents. Les règles SQL du jury existent. |
| 6 | **Partiel.** Tests unitaires, SQL et E2E de la vitrine/file/supervision présents. PWA, parcours complet de soirée, recette terrain et charge hébergée 5 000/7 500 restent à faire. |
| 7 | **Vitrine présente.** Accueil, palmarès éditorial, dates et pages légales. Contact enregistré en base via une API protégée, sans email organisateur. Configuration Turnstile requise ; les coordonnées légales et les données structurées `Event` restent à compléter. |
| 8, 9 | **Non commencés.** Notifications et application Android absentes. |
| Supervision | **Code présent.** `/admin` et `/admin/statistiques`, présence et historique. AAL2 exigé pour les accès administratifs. L’état du déploiement est à vérifier séparément du dépôt. |

Les audits du 12/10/2026 dans `documentation/` sont des constats antérieurs aux corrections ; leurs résultats de tests ne remplacent pas une recette du nouveau build. La production Railway observée dans l’audit servait encore un ancien build sans `/admin` ; les onze migrations antérieures aux correctifs du 12/10 sont présentes dans le projet Supabase lié, vérifié par `supabase migration list --linked`.

### 9.2 Travaux restant nécessaires pour la cible soirée

1. Préparation admin, cockpit et état public reliés à une soirée réelle.
2. Calculs de classement, visibilité et figage à la clôture ; jeu de recette Alès et traitement des égalités.
3. Parcours jury, avis et écran géant.
4. Suppression de compte et purge, avec conservation de résultats agrégés figés.
5. Email contact organisateur, SMTP Auth et coordonnées légales effectives.
6. Notifications, PWA et validation de charge avant une soirée publique.

Ces travaux ne sont pas réputés livrés par le durcissement de la vitrine.

---

## 10. Questions ouvertes (à trancher avec l'organisateur)

1. **Quelle soirée exactement ?** Nom officiel, lieu, date, et lien vers l'affiche ou la page Facebook. Le nom « Olympiade des manades » est introuvable en ligne
2. **Horaire** : 19h-22h comme indiqué, ou plutôt 21h-23h30 comme les soirées existantes ?
3. **Manades engagées** et ordre de passage
4. **Épreuves retenues** : le socle des 4 épreuves, une variante à 3, ou d'autres (tri en piste, jeux anciens) ?
5. **Jury** : nombre de juges, barème réel (sur 20 ?), méthode de départage actuelle (points par place ou notes ?)
6. **Accord de l'organisateur** pour utiliser le nom et le logo de l'événement dans l'app, et pour afficher le QR code dans les arènes et sur l'écran
7. **Affluence attendue** et **réseau sur place** : Wi-Fi public disponible ou 4G uniquement ?
8. **Prix du public** : y a-t-il un trophée remis en piste au vainqueur du vote du public ?
9. **Photos** : l'organisateur ou les manades peuvent-ils fournir des photos des éditions passées, avec l'accord des photographes ?
10. **Emails** : quelle adresse reçoit les messages du formulaire de contact ? Quel nom et quelle adresse d'expéditeur pour les emails de code ?
11. **Nom de domaine** du site : `olympiadedesmanades.fr` est libre au 10/10/2026
12. **Google Play** : compte développeur (25 $ une seule fois) au nom de qui ? Nom et icône de l'app
13. **Palmarès** : l'organisateur peut-il confirmer les vainqueurs 2025 et 2026 trouvés dans la presse et sur les réseaux (section 2.3 bis), dont Bezouce 2026, encore « à confirmer » ?
