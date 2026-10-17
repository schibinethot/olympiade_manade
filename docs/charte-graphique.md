# Charte graphique de l'app

> Validée le 10/10/2026 avec la [maquette v1](maquette/README.md) ([lien privé](https://claude.ai/artifact/N9TfST1gNEnCfsnJPei2U7)).
> Toute interface livrée suit ce document. En cas d'écart entre ce texte et la maquette, la maquette fait foi pour le rendu, ce texte pour les règles.

## 1. Principe : l'arène au couchant

L'app mélange deux identités, pour que le public des Olympiades ne soit pas dépaysé :

- **L'affiche officielle des Olympiades** (arènes de Nîmes, 2026) : photos en duotone orange, dégradé de coucher de soleil, titre « Olympiades » au pinceau, noms des manades en capitales avec leurs fers
- **La charte d'Atch Élevage**, sponsor de l'Olympiade des Manades ([atch.ai/elevage](https://atch.ai/elevage/)) : fond sable, encre, or, Playfair Display et Inter

## 2. Trois ambiances, une par usage

| Ambiance | Écrans | Pourquoi |
|---|---|---|
| **Jour** : fond sable, encre, accents couchant | Site public, inscription, espace organisateur | Lisible en plein jour, proche de la charte Atch |
| **Nuit d'arène** : fond nuit, dégradé couchant, or clair | Notation et classement du spectateur pendant la soirée, écran géant | Utilisé de nuit dans les gradins : fond sombre, peu d'éblouissement |
| **Étang** : bleu-vert très sombre, or | Espace jury | Distingue tout de suite l'espace jury de l'espace public |

## 3. Couleurs

| Token | Valeur | Usage |
|---|---|---|
| `sable` | `#f7f4ed` | Fond clair principal (Atch) |
| `creme` | `#fcfbf7` | Cartes sur fond sable |
| `lin` | `#efe7d8` | Fonds de contrôles segmentés, puces |
| `trait` | `#e3dacb` | Bordures sur fond clair |
| `encre` | `#1c1912` | Texte principal, barre latérale organisateur (Atch) |
| `encre-2` / `encre-3` | `#5a5246` / `#857a68` | Texte secondaire, légendes |
| `or` / `or-ink` / `or-clair` | `#b78649` / `#88693c` / `#e2c08a` | Fers, surtitres, jury (Atch) |
| `nuit` / `nuit-2` / `nuit-3` | `#120e0a` / `#1b1510` / `#271f18` | Fond et cartes de l'ambiance nuit |
| `nuit-txt` / `nuit-mute` | `#f6efe4` / `#b5a690` | Texte sur fond nuit |
| `rouge` | `#c23b1d` | Pastille « En direct », liens, alertes de fermeture |
| `orange` / `ambre` / `peche` | `#ec7433` / `#f5b14d` / `#ffd6ad` | Étapes du dégradé couchant |
| `etang-nuit` / `etang-2` / `etang-3` | `#0d1417` / `#152027` / `#1f2e36` | Fond et cartes du jury |
| `etang-clair` | `#9cc0d0` | Texte secondaire du jury |
| `ok` / `ok-vif` | `#2f7a4f` / `#5cc68e` | Vote enregistré, juge à jour (clair / sombre) |
| `alerte` | `#d9822b` | Avertissements (import, retard) |

**Dégradé couchant** (bouton principal, podium, carte « Notez les Olympiades ») :
`linear-gradient(125deg, #b3321a 0%, #dd5527 36%, #ef8236 68%, #f5b14d 100%)`.
Pour un bouton avec texte blanc, s'arrêter à `#e86a2e` : l'ambre clair ne garde pas assez de contraste.

Les couleurs d'état (ok, alerte, rouge) ne servent qu'aux états, jamais à la décoration.

### Tokens Tailwind v4

```css
@theme {
  --color-sable: #f7f4ed;  --color-creme: #fcfbf7;  --color-lin: #efe7d8;  --color-trait: #e3dacb;
  --color-encre: #1c1912;  --color-encre-2: #5a5246;  --color-encre-3: #857a68;
  --color-or: #b78649;  --color-or-ink: #88693c;  --color-or-clair: #e2c08a;
  --color-nuit: #120e0a;  --color-nuit-2: #1b1510;  --color-nuit-3: #271f18;
  --color-nuit-txt: #f6efe4;  --color-nuit-mute: #b5a690;
  --color-rouge: #c23b1d;  --color-orange: #ec7433;  --color-ambre: #f5b14d;  --color-peche: #ffd6ad;
  --color-etang-nuit: #0d1417;  --color-etang-2: #152027;  --color-etang-3: #1f2e36;  --color-etang-clair: #9cc0d0;
  --color-ok: #2f7a4f;  --color-ok-vif: #5cc68e;  --color-alerte: #d9822b;
  --font-brush: "Kaushan Script", "Brush Script MT", cursive;
  --font-display: "Playfair Display", Georgia, "Times New Roman", serif;
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
```

## 4. Typographie

| Police | Rôle | Règle |
|---|---|---|
| **Kaushan Script** | Mot « Olympiade(s) » du logo, titres manuscrits courts (« Notez les Olympiades », « Scannez pour noter ») | Jamais pour une phrase ou un texte courant. Rappelle le pinceau de l'affiche |
| **Playfair Display** | Titres, noms de manades en grand, **toutes les notes et tous les classements en italique** | Police d'Atch. Les chiffres en italique sont la signature de l'app |
| **Inter** | Interface, textes, boutons, surtitres en capitales espacées (0,14 à 0,2 em) | Chiffres alignés (`tabular-nums`) dans les tableaux et compteurs |

Les trois polices sont sous licence SIL OFL (Google Fonts). En production, les héberger avec le site pour tenir la cible de 200 Ko de la page spectateur.

## 5. Éléments signature

- **Logo** : « Olympiade » en Kaushan Script, dégradé couchant, puis « DES MANADES » en Inter 700 capitales, interlettrage 0,32 em, couleur or. En attente du logo officiel de l'événement s'il existe (CDC, question 6)
- **Affiche** : grande photo en duotone, « ARÈNES DE NÎMES » en Playfair capitales, date en Playfair italique, titre au pinceau incliné de −5°, manades en capitales séparées par des filets. C'est le premier visuel de l'accueil sur ordinateur et le second sur téléphone
- **Fer de manade** : marque à feu répertoriée par le LGRB pour Vinuesa, Gillet, Robert Michel, Lafon et Arlatenco, sans cercle ajouté. Les sources et le statut des accords sont consignés dans [Marques à feu des manades](marques-manades.md). Pour les autres manades, le cercle fin et l’initiale au pinceau restent les repères de repli.
- **Pastille « En direct »** : point rouge qui pulse, capitales espacées. Seul élément animé en continu, avec le badge TPMGE
- **Grille de notes du public** : 10 boutons carrés de 52 px minimum, en 2 rangées de 5. Note choisie : dégradé couchant, chiffre en italique, léger agrandissement. Confirmation verte juste dessous
- **Note du jury** : grand chiffre or (« 16,5 »), boutons − et + de 72 px, règle de 0 à 20, notes rapides de 10 à 20 et bouton « + ½ »
- **Podium** : 1er en dégradé couchant, 2e en brun, 3e en terre cuite. Rang en Playfair italique

### Photos en duotone

Les photos sont stockées en niveaux de gris, puis colorées par le CSS :

```css
.duo {
  background-image: linear-gradient(#4a170a, #4a170a),
    linear-gradient(170deg, #ffe2bd 0%, #f5a25c 50%, #d2482a 100%), var(--photo);
  background-blend-mode: screen, multiply, normal;
  background-size: cover;
}
```

Pour l'ambiance nuit : `#1a0d06` en premier calque, puis `#ffb26a → #d4502a → #4a1408`.

## 6. Mise en page

Points de rupture sur la largeur du conteneur de l'app (container queries) :

| Largeur | Cible | Disposition |
|---|---|---|
| < 640 px | Téléphone | Une colonne, barre d'onglets en bas pour le spectateur et l'organisateur |
| 640 à 999 px | iPad portrait | Deux colonnes, plus de barre d'onglets |
| 1000 à 1299 px | iPad paysage | Barre latérale organisateur, liste des passages à gauche pour le jury |
| ≥ 1300 px | Ordinateur | Spectateur : planning, vote et classement en 3 colonnes. Jury : tableau manades × épreuves. Organisateur : planning, passages, classement |

Le desktop doit rester simple : une action principale par écran, visible sans défiler (« Débloquer », « Valider la note », « Je note les manades »).

## 7. Accessibilité

- Cibles tactiles de 48 px minimum, 52 px pour les notes du public, 72 px pour le − et le + du jury
- Contraste AA sur les trois ambiances ; pas de texte blanc sur la partie ambre du dégradé
- Focus clavier visible : contour ambre de 3 px
- `prefers-reduced-motion` coupe toutes les animations (pulsation, badge TPMGE, apparition des notifications)

## 8. Mentions obligatoires

- **Pied de page du site** : bloc « Partenaire officiel » avec le logotype Atch et « Élevage », puis « Conçue en collaboration avec Atch Élevage et TPMGE »
- **Écrans en direct, jury et organisateur** : ligne discrète « Avec Atch Élevage, partenaire des Olympiades »
- **Écran géant** : « Partenaire Atch Élevage » en bas à droite
- **Signature** : badge « Signé TPMGE » (spec agence), lien `https://tpmge.com/#olympiade-des-manades`
- Logotypes Atch : fichiers source dans `/public/marques/atch-elevage.svg`, `/public/marques/atch-taureaux.svg` et `/public/marques/atch-chevaux.svg` (versions sel sur fond sombre). Ne pas redessiner les logos

## 9. Photos en production

- Suivre [`photos-libres.md`](photos-libres.md) : crédit « Auteur, Licence, via Wikimedia Commons » avec liens, mention de la retouche pour les licences BY-SA
- **Remplacer la photo d'accueil de la maquette** (gardian de profil, visage reconnaissable) par une photo sans visage identifiable. Candidates : n° 13 (silhouette à contre-jour avec trident, idéale en duotone), n° 1 ou n° 4 de `photos-libres.md`
- Les photos des épreuves viendront de l'organisateur ou des manades, avec l'accord écrit du photographe

## 10. Ajouts proposés par la maquette, à valider au CDC

Ces éléments apparaissent dans la maquette mais pas encore dans le CDC :

1. **Rappel aux juges en retard** : bouton « Envoyer un rappel » dans le cockpit
2. **Suggestion de décalage** : le cockpit estime la fin de l'épreuve et propose « +5 min »
3. **Tableau jury sur ordinateur** : grille manades × épreuves et saisie au clavier (« 17,5 » puis Entrée)
4. **Bannière de notification dans la page** sur ordinateur, en plus de la notification système
5. **Écran « Classement masqué »** côté spectateur quand l'organisateur cache le classement
