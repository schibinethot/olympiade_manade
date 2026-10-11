# Maquette de l'app (v1, validée le 10/10/2026)

Maquette interactive des 11 écrans de l'app, chacun en mobile, iPad et desktop. Elle sert de référence visuelle aux lots front (1, 2, 4, 5, 7). Les règles de design qu'elle applique sont décrites dans [`../charte-graphique.md`](../charte-graphique.md).

- **En ligne (privé)** : https://claude.ai/artifact/N9TfST1gNEnCfsnJPei2U7
- **En local** : `python3 docs/maquette/build.py`, puis ouvrir `docs/maquette/dist/maquette.html` dans un navigateur

## Contenu

| Rôle | Écrans |
|---|---|
| Site public | Accueil, Classements (2025, 2026, 2027), Dates |
| Spectateur | Inscription (code email), Noter en direct, Classement en direct |
| Jury | Notation sur 20 |
| Organisateur | Cockpit en direct, Import du planning, Résultats |
| Écran géant | Écran des arènes (1920 × 1080) |

Les écrans partagent un état commun : un déblocage dans le cockpit apparaît chez le spectateur et sur l'écran géant, un vote met à jour les classements. Les données sont fictives (soirée simulée à Nîmes le 20/08/2027) ; les manades sont celles de l'affiche 2026.

## Fichiers

| Fichier | Rôle |
|---|---|
| `src.html` | Source : CSS, écrans et logique, avec des marqueurs `__IMG_*__` et `__ATCH_*__` |
| `img/*.webp` | 4 photos Wikimedia Commons en niveaux de gris, passées en duotone par le CSS |
| `img/atch-*.svg` | Logotype Atch (encre et écru), copie de `atchmesure/docs/brand/atch-logo/` |
| `build.py` | Remplace les marqueurs par des data URI et écrit `dist/` (ignoré par git) |

## Republier l'artifact

1. `python3 docs/maquette/build.py`
2. Publier `docs/maquette/dist/artifact.html` avec l'URL ci-dessus, pour garder le même lien

## Photos

| Fichier | Fiche Commons | Crédit |
|---|---|---|
| `hero.webp` | [Gardian galopant vers sa manade](https://commons.wikimedia.org/wiki/File:Gardian_galopant_vers_sa_manade.jpg) | afroboof, CC BY-SA 2.0 |
| `arenes.webp` | [Arenes de Nimes (1)](https://commons.wikimedia.org/wiki/File:Arenes_de_Nimes_(1).jpg) | Krzysztof Golik, CC BY-SA 4.0 |
| `manade.webp` | [Gardian and Camargue cattle, Saint-Gilles 11](https://commons.wikimedia.org/wiki/File:Gardian_and_Camargue_cattle,_Saint-Gilles_11.jpg) | Christian Ferrer, CC BY-SA 4.0 |
| `chevaux.webp` | [Saint-Laurent-d'Aigouze, Camargue horses 01](https://commons.wikimedia.org/wiki/File:Saint-Laurent-d'Aigouze_-_Camargue_horses_-_01.jpg) | Benjamin Smith / Wikimedia Commons, CC BY-SA 4.0 |

Toutes sont retouchées (niveaux de gris puis duotone), ce que le crédit mentionne. **`hero.webp` montre un visage reconnaissable** : il reste dans la maquette, mais il faut le remplacer en production (voir la charte, section Photos, et [`../photos-libres.md`](../photos-libres.md)).
