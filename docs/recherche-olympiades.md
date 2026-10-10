# Olympiades des manades — recherche et cadrage

Recherche effectuée le 10 octobre 2026. Ce document prépare l’application ; il ne constitue pas un règlement sportif officiel.

## Périmètre confirmé

L’application doit couvrir plusieurs manades et événements, permettre la saisie des scores et le calcul des classements, et recueillir les notes et avis des participants ou spectateurs. Ces orientations ont été confirmées par l’utilisateur.

L’utilisateur a également retenu le principe de garder ouvertes les possibilités de notation à partir des informations disponibles. Le cadrage prévoit donc une configuration par événement et par épreuve, sans imposer un barème unique.

Les possibilités fonctionnelles ci-dessous sont retenues pour la conception de l’application. Elles ne prouvent pas que les organisateurs les utilisent déjà. Les barèmes, critères, coefficients et procédures propres à chaque organisateur restent à recueillir ou à définir avec lui.

## Ce que les sources établissent

### Les épreuves varient selon l’événement

Le programme de Cabannes publié en 2023 présente quatre épreuves : saut de cheval à cheval, saut de cheval à taureau, attente au fer et ferrade en piste. Quatre manades y sont annoncées : Des Chanoines, Colombet, Clément et Gillet. [Source : Office de tourisme, via Provence-Alpes-Côte d’Azur Tourisme](https://provence-alpes-cotedazur.com/que-faire/sortir/toutes-les-sorties/olympiades-camarguaises-cabannes-fr-4283975/).

L’annonce du Club Taurin Beaucairois pour le 20 juillet 2026 prévoit trois épreuves — attente aux fers, ferrade en piste et saut de cheval à taureau — pour six binômes, avec un jury de gardians professionnels et cavaliers. [Source : annonce de l’organisateur](https://www.helloasso.com/associations/club-taurin-beaucairois/evenements/olympiades-beaucairoises-2026).

À Beauvoisin en 2025, le compte rendu rapporte cinq épreuves : les deux types de saut, l’attente au fer, le rodéo à taureau et la capture de la vache. Les manades passent à tour de rôle. [Source : Voir Plus, 23 août 2025](https://voir-plus.com/2025/08/23/au-rythme-de-la-fete-votive-beauvoisin/).

**Conséquence proposée :** proposer un catalogue d’épreuves et laisser chaque organisateur choisir son programme, son ordre de passage et les épreuves qui comptent au classement. Prévoir des démonstrations sans notation.

### Plusieurs équipes, binômes et personnes doivent pouvoir être identifiés

Les Grandes Olympiades des Gardians de Nîmes annoncent en 2026 les manades Renaud Vinuesa, Gillet, Robert Michel, Lafon et Arlatenco. Cette liste illustre un événement précis ; ce n’est pas un annuaire exhaustif des manades. [Source : Arènes de Nîmes](https://app.arenesdenimes.com/actus/i/2995/les-grandes-olympiades-des-gardians-auront-lieu-le-vendredi-21-aout).

**Conséquence proposée :** distinguer la fiche permanente de la manade, son équipe inscrite à une édition et les gardians engagés dans chaque passage. Conserver la composition de l’équipe pour chaque édition afin de préserver l’historique.

### Le résultat général ne se déduit pas du seul nombre de victoires

Le compte rendu de la soirée des gardians d’Alès, mis à jour le 16 mai 2026, rapporte une note de 17/20 à l’attente au fer et la présence de cinq jurés. Il indique aussi que Vinuesa remporte le classement général en terminant deuxième de chacune des quatre épreuves, tandis que Devaux et Arlatenco en remportent deux chacune. L’article ne donne pas la formule complète d’agrégation. [Source : Objectif Sud](https://www.objectifsud.fr/actualites/ales-en-feria-les-gardians-rendent-hommage-a-leur-tradition-dans-une-soiree-de-concours-164007.php).

Un compte rendu historique des Olympiades d’Eyguières de 2008 mentionne des récompenses par épreuve, un prix de présentation, une bandido en piste et une victoire générale avec 50 points d’avance. Il ne fournit pas la grille de calcul. [Source : Salluvii, 16 juillet 2008](https://www.salluvii.fr/Olympiades-Camarguaises-2008).

**Conséquence proposée :** conserver les notes détaillées, les résultats par épreuve et le classement général. Ne pas déduire un barème universel de ces exemples.

### Les annonces peuvent différer des comptes rendus

Pour Beaucaire 2026, la billetterie de l’organisateur annonce Gillet parmi les six manades, tandis que le compte rendu municipal cite Devaux à sa place. Les deux sources ne permettent pas d’établir la cause de cet écart. [Annonce du Club Taurin Beaucairois](https://www.helloasso.com/associations/club-taurin-beaucairois/evenements/olympiades-beaucairoises-2026), [compte rendu de la Ville de Beaucaire](https://www.beaucaire.fr/les-olympiades-beaucairoises-celebrent-les-traditions-pour-une-5%E1%B5%89-edition-reussie/).

**Conséquence proposée :** enregistrer la source et la date de vérification des informations, puis faire confirmer les équipes effectivement présentes par l’organisateur. Une affiche seule ne suffit pas à certifier une participation.

## Informations à collecter

| Élément | Données utiles à l’application |
| --- | --- |
| Événement et édition | Nom, année, date et heure, commune, arènes, organisateur, affiche, état de l’événement, source du programme |
| Manade | Identifiant stable, nom affiché, variantes du nom, commune, présentation, visuel fourni ou autorisé |
| Équipe engagée | Édition, manade représentée, nom d’équipe, gardians, composition confirmée |
| Épreuve | Nom, description validée, ordre, participation individuelle ou collective, caractère noté ou démonstratif |
| Passage | Épreuve, équipe, gardians concernés, ordre, numéro de tentative si applicable, état du passage |
| Règlement de l’édition | Échelle des notes, critères, coefficients, méthode de totalisation, pénalités et départage |
| Jury | Membres, épreuves attribuées, droits de saisie et de validation |
| Note du jury | Passage, juré, critère éventuel, valeur, commentaire, date de saisie, validation et corrections |
| Vote du public | Passage ou prestation concernée, votant, note, date, état de validation |
| Avis sur l’événement | Édition, auteur, note globale, commentaire facultatif |
| Résultat | Classement par épreuve, total général, prix attribués, état provisoire ou validé |

Les fiches de manades pourront être réutilisées d’une édition à l’autre. Une équipe et ses notes resteront rattachées à l’édition concernée.

## Proposition de première version

### Parcours public

1. Accéder à l’événement par lien ou QR code.
2. Voir le programme, les manades, les gardians annoncés et le passage en cours.
3. Donner une note à une prestation pendant sa fenêtre de vote.
4. Consulter le classement du jury et le résultat du public dans deux vues clairement identifiées.
5. Après l’événement, laisser une note globale et un commentaire facultatif sur la soirée.

Le mode de vote public sera configurable : note numérique, étoiles, choix d’un favori ou classement de préférences. Une note de 1 à 5 peut servir d’exemple de démonstration, sans devenir le format imposé. Les avis sur l’organisation de la soirée ne doivent pas modifier les scores des gardians.

### Parcours jury

1. Se connecter avec un accès attribué par l’organisateur.
2. Retrouver le bon événement, l’épreuve et le passage à noter.
3. Saisir la note ou les critères selon le règlement choisi.
4. Vérifier les notes manquantes et transmettre sa saisie.
5. Faire valider les résultats avant publication définitive.

Prévoir une sauvegarde des saisies sur l’appareil et un indicateur explicite de synchronisation pour l’usage sur place. La gestion des conflits entre corrections devra être définie lors de l’implémentation.

### Parcours organisateur

Créer une édition, inscrire les équipes, composer le programme, configurer et figer le barème au démarrage, attribuer les accès du jury, ouvrir et fermer les votes publics, valider les résultats et exporter le classement. Conserver la trace des corrections après saisie.

## Possibilités de notation retenues

La configuration appartient à une édition. Chaque épreuve peut reprendre ses réglages généraux ou avoir son propre barème. Le système doit conserver les valeurs saisies et la version des règles ayant produit un résultat.

| Mode | Configuration à prévoir | Ce que l’on sait |
| --- | --- | --- |
| Note globale | Minimum, maximum, pas de saisie et décimales ; par exemple sur 5, 10, 20 ou une autre échelle | Un exemple sur 20 est documenté à Alès ; les autres échelles sont des options produit |
| Notes par critères | Critères ajoutés par l’organisateur, chacun avec description, échelle, poids et caractère obligatoire | Aucune grille officielle détaillée retrouvée |
| Points | Saisie d’un total ou attribution de points à des éléments définis dans le barème | Des totaux en points sont documentés, mais leur décomposition reste inconnue |
| Places et classement | Saisie des places, éventuelle conversion en points selon une table explicite, gestion des ex æquo | Des classements sont documentés ; aucune table de conversion commune confirmée |
| Réussite et mesures | Réussi/échoué, nombre de réussites ou durée ; unité, sens du classement et éventuelle conversion en points | Extensions possibles, sans usage confirmé comme barème des Olympiades étudiées |
| Vote du public | Note numérique, étoiles, favori ou préférences ; période de vote et règle de totalisation | Fonction demandée pour l’application ; aucun barème public officiel trouvé |
| Avis sur la soirée | Note globale, dimensions facultatives et commentaire | Fonction demandée ; résultat indépendant des performances en piste |
| Appréciation et prix | Commentaire sans score, distinction par épreuve, prix spécial ou démonstration non classée | Des récompenses par épreuve et un prix de présentation sont documentés |

Un critère personnalisé doit pouvoir définir ce qui est attendu, ce qui correspond à chaque niveau de note et comment il contribue au résultat. Des intitulés comme « maîtrise », « précision » ou « coordination » peuvent être proposés comme exemples à discuter ; ils ne seront pas préchargés comme critères officiels d’une épreuve.

Le catalogue d’épreuves reste indépendant des barèmes : choisir « attente au fer » ou « saut de cheval à cheval » ne doit pas ajouter automatiquement des critères ou des pénalités non confirmés. L’organisateur pourra enregistrer et réutiliser ses modèles avec leur provenance : modèle de démonstration, proposition ou règlement validé pour une édition.

### Jury, public et résultat combiné

Les notes du jury, les votes sur les prestations et les avis sur la soirée constituent trois ensembles distincts. Le classement du jury et le résultat du public restent consultables séparément.

Pour garder cette possibilité ouverte, l’organisateur pourra aussi définir un résultat combinant jury et public. Ce mode sera désactivé tant que sa règle n’est pas configurée : mise sur une échelle comparable, poids de chaque composante totalisant 100 %, minimum de votes et traitement d’une composante manquante. Ce résultat sera identifié comme combiné ; il ne remplace pas les deux résultats d’origine. Les avis sur la soirée n’y participent pas.

Les poids éventuels relèvent de l’organisateur. Aucun rapport jury/public n’est établi par les sources et aucune valeur ne doit être présentée comme officielle par défaut.

## Règles de calcul à prévoir

La recherche n’a pas permis de confirmer un règlement commun ni une grille universelle applicable à toutes les Olympiades des manades. L’application peut être conçue avec les options ci-dessus ; un organisateur devra fournir ou valider les règles retenues avant de publier un classement présenté comme officiel.

Le moteur de notation devra permettre de configurer :

- L’échelle des notes et les décimales autorisées.
- Une note globale ou plusieurs critères par passage.
- La somme, la moyenne ou la moyenne pondérée des notes du jury, et le nombre de notes attendu.
- Les coefficients éventuels des épreuves.
- Le traitement de plusieurs tentatives : meilleure note, somme ou moyenne, selon le règlement.
- Les bonus et pénalités : motif, valeur, unité, étape d’application et éventuelles limites du score.
- Le traitement des abandons, absences, annulations et disqualifications.
- Les égalités et règles de départage.
- L’arrondi et l’étape à laquelle il s’applique.
- La conversion des mesures ou des places en points lorsque l’organisateur choisit ce mode.
- La comparaison d’épreuves sur des échelles différentes : normalisation explicite ou table de points, sans addition implicite de notes incompatibles.

L’ordre des opérations doit être défini : critères, jurés, tentatives, bonus/pénalités et total des épreuves. Les règles choisies doivent indiquer si le meilleur score est le plus élevé ou le plus faible. Un réglage incomplet ou contradictoire doit être signalé avant l’ouverture de la notation. Une modification des règles après le début de l’événement doit être tracée, et les résultats affectés recalculés et revalidés.

Une note manquante ne vaut pas zéro. Un classement incomplet doit être indiqué comme provisoire. Les scores du jury et du public doivent être stockés séparément ; aucune pondération entre eux n’est établie par les sources consultées.

Pour le vote public, prévoir une seule réponse active par votant et objet de vote : une note par prestation, un favori par scrutin ou un classement de préférences par scrutin. Prévoir une période d’ouverture et l’affichage du nombre de votes. Pour les étoiles ou les notes, définir la moyenne ou autre méthode retenue ; pour le favori, compter les votes valides ; pour les préférences, exiger une table de points explicite et un traitement des listes incomplètes. L’identité retenue pour limiter les doublons reste un choix produit : compte, accès individuel ou autre dispositif. Un QR code partagé ne prouve pas à lui seul qu’une personne ne vote qu’une fois.

Le classement entre plusieurs éditions ou sur une saison demandera une règle supplémentaire : additionner des points issus de barèmes différents ne permet pas une comparaison fiable.

## Informations encore nécessaires auprès d’un organisateur pilote

- Une feuille de notation réellement utilisée, avec critères et échelles.
- La formule du total général et les règles d’égalité.
- Les pénalités, le nombre d’essais et le traitement des passages non réalisés.
- La personne qui valide le classement et la procédure de correction.
- La liste confirmée des manades, des équipes et des gardians pour une édition.
- La place souhaitée pour le public : notes des prestations, prix du public et avis sur la soirée.

Ces informations permettront de configurer une édition réelle. Le périmètre confirmé permet de préparer les écrans, les fiches et les modes de notation configurables, avec des exemples clairement identifiés comme démonstration.

## Évolutions demandées le 10 octobre 2026

Demandes de l’utilisateur, détaillées dans le cahier des charges [`CDC-MASTER.md`](CDC-MASTER.md) (sections 4.0, 4.4 et 4.10).

### Décisions prises avec l’utilisateur

- Note du public : de 1 à 10 par manade et par passage.
- Deux modes de vote, choisis par soirée : vote libre pendant la fenêtre de la soirée, ou vote par déblocage de l’admin (épreuve entière ou manade par manade).
- Jury : barème sur 10 ou sur 20. Classements séparés, combiné pondéré ou jury seul, au choix de l’admin.
- Une seule application pour le public, les juges, les admins et l’écran géant.
- Import du planning en Word, Excel, PDF ou photo, lu par l’IA puis validé par l’admin.

### Site vitrine

- Petit site simple, intuitif et soigné, pensé d’abord pour le téléphone, avec des photos des Olympiades existantes. Seules les photos fournies avec l’accord du photographe ou sous licence libre sont utilisées, toujours créditées.
- Pages : Accueil, Classements (2025, 2026 et 2027), Dates, Contact, Mentions légales.
- Sur mobile, le premier bloc de l’accueil est « Notez les Olympiades ».
- Recherche du site officiel des Olympiades et des palmarès 2025-2026 en cours.

### Accès au vote

- Inscription avec prénom et email.
- Validation par un code à 6 chiffres reçu par email, avec un lien de connexion en secours.
- Le spectateur accède ensuite aux votes au fur et à mesure des déblocages.

### Notifications

- Une notification sur le téléphone chaque fois qu’il est possible de noter, au déblocage d’une épreuve ou d’un passage.
- Android : depuis le navigateur. iPhone : seulement si le site est ajouté à l’écran d’accueil, une contrainte d’Apple. L’app guide l’utilisateur pour le faire.
