# Branchement des données réelles (quand la NASA les fournit)

But : remplacer les données de démonstration par les données réelles **sans toucher au contrat ni à l'application**.
Rien dans ce document n'a pu être testé avec les vrais fichiers au moment de la rédaction (le réseau vers NAIF, Horizons et PDS n'était pas accessible
depuis l'environnement de rédaction). Chaque étape contient donc une **vérification à faire**.

## 0. Avant de commencer

- Lire le guide officiel du 13 novembre et la liste des « Ressources » du défi : y noter les jeux de données fournis, les formats, les liens, les licences.
  Les consigner dans `SOURCES.md`. Si les données fournies diffèrent de ce document, **le guide prime** : écrire la divergence dans `DECISIONS.md`.
- Vérifier `Q-001` (règle sur le code écrit avant l'événement) et `Q-002` (règle sur l'usage de l'IA).

## 1. Noyaux SPICE (éphémérides)

Source : NAIF (JPL), répertoire `generic_kernels`. Fichiers voulus : voir tableau de `PIPELINE.md` § `ephemeris_spice.py`.
1. `py -m pipeline.cli fetch --spice` : liste le répertoire, choisit les fichiers les plus récents par motif, les range dans `data/raw/spice/`, écrit les noms dans `data/raw/spice/KERNELS.txt`.
2. Vérifier les sommes de contrôle ou, à défaut, les tailles annoncées. Vérifier que `de440s.bsp` couvre 2026-2030 : `spiceypy.spkcov`.
3. Lancer `py -m pytest pipeline/tests -m spice -q` : les contrôles de plausibilité (`TESTS-VALIDATION.md` § 4) doivent passer. **S'ils échouent, ne pas ajuster les bornes** : chercher la cause (repère, noyau manquant, unité).
4. Vérifier que le repère `MOON_ME` est bien défini par le noyau `moon_de440_*.tf` (sinon `spkpos` lève une erreur de repère inconnu).

## 2. MNT LOLA

Produits visés (d'après l'étude préalable ; **noms et liens exacts à confirmer sur les pages officielles**) :
- Référence pôle Sud : `LDEM_80S_20MPP_ADJ` (20 m/pixel, au sud de 80°S), environ 2 Go.
- Variantes plus grossières pour le champ lointain : 40 ou 80 m/pixel, ou `LDEM_83S_10MPP_ADJ` pour le très proche.
- Sites avec MNT à 5 m (PGDA, produit 78) : un seul site vitrine, si disponible.
Hébergement : PDS Geosciences Node (imbrium.mit.edu) et PGDA (Goddard). Licence et citation : à relever sur la page de chaque produit.

Étapes :
1. Télécharger dans `data/raw/dem/` (jamais versionné). Garder le fichier d'étiquette `.LBL` **avec** l'image `.IMG`.
2. Lire l'étiquette et **noter dans `DECISIONS.md`** : type de projection, latitude et longitude de centre, rayon de la sphère, taille et résolution en pixels, coordonnées du coin supérieur gauche,
   `SCALING_FACTOR`, `OFFSET`, type de donnée (entier 16 bits signé, ordre des octets), valeur « manquante ».
   Attendu d'après les produits LOLA : hauteurs en entiers 16 bits, facteur 0,5 m, au-dessus de la sphère de 1 737,4 km. **À confirmer dans l'étiquette, ne rien écrire en dur.**
3. **Contrôle de convention de projection** (étape obligatoire, voir `ARCHITECTURE.md` § 3) :
   a. Choisir un cratère reconnaissable (ex. le plus profond près du pôle) ;
   b. calculer sa position `(x, y)` avec `projection.py` et les paramètres de l'étiquette ;
   c. lire la hauteur à cet endroit ; vérifier que c'est bien un creux de la bonne profondeur (et non un point quelconque) ;
   d. vérifier aussi qu'un point à `lon = 0` et un point à `lon = 90 E` tombent du bon côté de la grille.
   Si le cratère est décalé ou en miroir, la convention est fausse : **ne pas continuer**, corriger `PolarProjection` et refaire le test.
4. Test d'aller-retour sur la grille réelle : `xy → lonlat → xy` < 1e-3 m.
5. `RasterDem` : lecture par fenêtres, interpolation bilinéaire, `NaN` pour la valeur manquante. Vérifier la mémoire (< 2 Go de pic) sur un site.
6. Construire `MultiResDem([near, far])` : proche = résolution la plus fine disponible autour du site, lointain = grossier jusqu'à `far_max_km`.
7. Vérifier visuellement le terrain exporté d'un site (image du `.bin` + courbes de niveau) : relief plausible, orientation correcte (nord en haut dans la grille).

## 3. Sites réels

1. Ouvrir `config/sites.json` et ajouter les sites réels **avec** `synthetic: false`, `verified: false` et un champ `source` (nom du document et date).
2. Récupérer les coordonnées dans une source officielle (Gazetteer USGS, liste Artemis) ; une fois confrontées à la source, passer `verified: true` et citer la source dans `SOURCES.md`.
3. Hauteur du sol : prise dans le MNT (champ `ground_height_m` calculé, pas saisi).
4. Hauteur de l'œil : `observer_height_m = 2.0` par défaut. **C'est une décision** (`DECISIONS.md`) : un atterrisseur ou une antenne n'est pas à 2 m.

## 4. Construire et vérifier

```powershell
py -m pipeline.cli build --all --engine spice
py -m pipeline.cli validate
py -m pytest pipeline/tests -q
node --test "web/tests/**/*.test.js"
```
Puis contrôles de `TESTS-VALIDATION.md` § 6 (Horizons, PGDA, outil officiel). Les écarts et leurs explications vont dans `docs/VALIDATION-RESULTATS.md`.

## 5. Bascule de l'interface

Rien à modifier : `index.json` a `synthetic: false` à la racine quand tous les sites sont réels, la bannière disparaît d'elle-même.
Si des sites de démonstration restent dans l'index à côté de sites réels, **la bannière doit rester** et chaque site synthétique doit être étiqueté « fictif » dans la carte polaire et dans le panneau.
Avant la soumission : retirer les sites de démonstration de l'index (ou les garder derrière une option « mode démonstration » clairement identifiée).

## 6. Si les données arrivent différemment de ce qui est prévu

- **MNT en GeoTIFF déjà reprojeté** : `RasterDem` lit directement la grille ; contrôler le système de coordonnées via `rasterio` (`dataset.crs`, `dataset.transform`).
- **MNT à grille longitude/latitude** (et non polaire) : ajouter une classe de projection `EquirectangularProjection` ; c'est localisé dans `projection.py` et `dem.py`.
- **Éphémérides déjà calculées par la NASA** (tableaux Soleil/Terre par site) : écrire un `ephemeris_table.py` qui lit ce format et produit les mêmes séries ; ne pas changer le contrat.
- **Autre période** : changer `config/pipeline.json` ; l'application lit `time` dans chaque JSON.
