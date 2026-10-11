# Dossier fonctionnel illustré

Le PDF final se trouve dans `output/pdf/olympiade-des-manades-dossier-fonctionnel-illustre.pdf`.

## Sources

- `docs/CDC-MASTER.md` : périmètre V1 v0.8.
- `docs/recherche-olympiades.md` : recherche et options de notation conservées.
- `docs/charte-graphique.md` et `docs/maquette/src.html` : identité et écrans.

Les fonctions décrites sont des spécifications, pas un constat de livraison. Les règles propres aux organisateurs restent à valider. Les captures contiennent les données simulées de la maquette.

## Régénération

Les scripts utilisent Python avec `reportlab`, `pillow`, `pypdf` et `playwright`, ainsi que Chromium pour Playwright. Les polices Inter et Playfair Display sont lues depuis `/Users/tpmge/Library/Fonts` ; adapter ce chemin si nécessaire. La maquette charge aussi sa police manuscrite depuis Google Fonts lors de la capture.

Depuis la racine du dépôt :

```sh
python docs/pdf/capture_maquette.py
python docs/pdf/build_pdf.py
pdftoppm -scale-to 1100 -png output/pdf/olympiade-des-manades-dossier-fonctionnel-illustre.pdf tmp/pdfs/page
```

La capture ne modifie pas la maquette source. Les fichiers intermédiaires sont écrits dans `tmp/pdfs/` et peuvent être supprimés après vérification visuelle de toutes les pages. Le générateur contrôle les débordements verticaux du texte et conserve un relevé de mise en page temporaire.

Vérification de l’édition du 11 octobre 2026 : 27 pages A4, extraction du texte, sommaire et sources cliquables, revue visuelle de toutes les pages. Les crédits et licences des photographies sont inclus en dernière page.
