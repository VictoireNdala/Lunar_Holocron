# SOURCES — Lunar Holocron

Règle du hackathon : **citer toutes les sources** et documenter les licences. Ce fichier est mis à jour **au moment où** une source est utilisée, pas à la fin.
Statuts : `cité` (mentionné dans l'étude préalable, pas encore utilisé dans le code) · `utilisé` (données ou idées intégrées) · `vérifié` (lien, licence et conditions relevés sur la page officielle).
Les liens ci-dessous sont les adresses connues des services ; **les vérifier avant publication**. Les licences marquées « à relever » ne doivent pas être supposées.

## 1. Données

| Source | Usage prévu | Licence / conditions | Statut |
|---|---|---|---|
| LRO / LOLA — modèles numériques de terrain `LDEM_*` (PDS Geosciences Node, imbrium.mit.edu) | MNT pour masques d'horizon et terrain 3D | à relever sur la page du produit (données NASA) | cité |
| PGDA (Planetary Geodesy Data Archive, Goddard) — produit 69 (illumination moyenne et visibilité Terre) | Comparaison de validation | à relever | cité |
| PGDA — produit 78 (MNT à 5 m de sites du pôle Sud) | Site vitrine éventuel (`Q-008`) | à relever | cité |
| NAIF / SPICE — noyaux génériques (`naif0012.tls`, `de440s.bsp`, orientation lunaire `moon_pa_de440_*`, `moon_de440_*.tf`) | Éphémérides Soleil et Terre | à relever (règles NAIF ; reconnaissance demandée) | cité |
| JPL Horizons (ssd.jpl.nasa.gov/horizons) | Valeurs de contrôle (validation) | à relever | cité |
| Données fournies par le défi Space Apps 2026 | À déterminer (`Q-004`) | à relever | à recevoir |
| Constantes de `pipeline/config.py` : rayon nominal du Soleil 695 700 km (résolution B3 de l'UAI, 2015) ; rayon moyen de la Terre 6 371,0 km ; sphère LOLA 1 737,4 km | Rayons angulaires, géométrie | — | utilisé ; **valeurs écrites de mémoire** (reprises de `docs/PIPELINE.md`), à vérifier dans les sources primaires |

## 2. Outils et idées étudiés (étude comparative)

| Source | Ce qui en inspire le projet | Statut |
|---|---|---|
| Lunar QuickMap (LROC / ASU) — TerrainShadows, Compute Visibility, boussole, panoramas | Vue des ombres selon la date, visibilité depuis un point, panorama au sol | cité |
| NASA Moon Trek — outil de ligne de vue, angle solaire | Verdict de ligne de vue, lecture de l'angle du Soleil | cité |
| NASA SVS 4930 (vidéos d'éclairement du pôle Sud, 2023-2030) | Lecture animée de la frise | cité |
| NASA Ames Celestial Mapping System | Idée de trace du Soleil et de la Terre dans le ciel | cité |
| Documents Artemis sur les critères de sélection de sites | Pastilles de conformité (pente, distance au pôle, visibilité Terre) | cité |
| Étude préalable du projet (document Claude du projet Hackathon NASA) | Base de toutes les décisions ; liste complète des sources consultées | https://claude.ai/artifact/TCNQdQscckhiwyZNUBC67E |

On reprend des **idées de fonctionnalité**, pas du code ni des textes. Tout élément repris littéralement devrait être cité ici avec sa licence.

## 3. Logiciels

| Composant | Rôle | Licence | Version retenue |
|---|---|---|---|
| three.js | Vue 3D | MIT | à noter à l'installation (T-09) |
| NumPy | Calcul numérique | BSD | 2.5.4 (installée le 2026-11-12, `requirements.txt` : ≥ 1.26) |
| SpiceyPy (CSPICE) | Éphémérides | MIT (SpiceyPy) ; CSPICE : conditions NAIF à relever | 8.4.0 (≥ 6.0) |
| rasterio / GDAL | Lecture des MNT | BSD / MIT (X11) | rasterio 1.5.2 (≥ 1.3) |
| Pillow | Aperçus d'images uniquement | MIT-CMU (HPND) — à relever | 13.0.0 (≥ 10.0) |
| jsonschema, pytest | Validation, tests | MIT | jsonschema 4.26.0 (≥ 4.20), pytest 9.2.0 (≥ 8.0) |
| Playwright | Test de fumée | Apache-2.0 | à noter (T-15) |

Environnement de construction : Python 3.12.8, Node v24.11.1, Git 2.54.0 (Windows 11), relevés le 2026-11-12.

Licence du projet : **Apache 2.0** (`LICENSE`). Le texte de `LICENSE` est la copie **intégrale et non modifiée** des conditions Apache 2.0
(« TERMS AND CONDITIONS … END OF TERMS AND CONDITIONS », sans l'annexe facultative), reprise du fichier `pip/_vendor/packaging/LICENSE.APACHE`
livré avec pip (SHA-256 `0D542E0C8804E39AA7F37EB00DA5A762149DC682D7829451287E11B938E94594`). Texte de référence : http://www.apache.org/licenses/LICENSE-2.0
(à comparer avant publication). Aucune ligne de copyright n'a été ajoutée : le titulaire est à fixer par l'équipe.

## 4. Usage de l'IA (transparence)

Règle du hackathon sur l'IA : non confirmée à ce jour (`Q-002`). Ce paragraphe est tenu à jour dans tous les cas.

- **Claude (Anthropic), conversation de projet** : étude préalable, comparaison des outils, choix d'architecture, rédaction des fichiers de pilotage de ce dépôt (2026-11-12), revue critique des résultats.
- **Claude Code** : construction du code, des tests et de la documentation technique selon `PLAN.md`.
- **Vérifié par un humain** : _à compléter_ (valeurs d'or relues, coordonnées des sites, résultats de validation, choix scientifiques de `DECISIONS.md`).
- **Non vérifié** : _à compléter_ au fur et à mesure.

Format d'une ligne à ajouter : `AAAA-MM-JJ — outil — tâche — ce qui a été relu et par qui`.
