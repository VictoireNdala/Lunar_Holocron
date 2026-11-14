# STATUS — Lunar Holocron

> Fichier **vivant** : Claude Code le met à jour à la fin de chaque tâche. Rester court. Les anciennes entrées du journal sont regroupées par jour, pas supprimées.

**Dernière mise à jour** : 2026-11-12 (T-09 terminé ; T-02 accepté par CHAT, M-008)
**Phase** : J1 (pipeline) et J2 (interface) en parallèle
**Prochaine tâche** (M-024, priorité) : **T-20** (noyaux SPICE, ≈ 45,6 Mo, **accord de l'humain demandé**, M-026) → T-07 avec SPICE → comparaison Horizons → S-01/S-02 (niveau 1, fichiers 5 m à télécharger) → T-05/T-08 → A-01 à A-04 ; S-05 (liens profonds) après S-02, avant S-03 (M-025). Sans l'accord : A-01 et A-02.
**Fichier LDEM réel présent** : oui, `data/raw/LDEM_80S_80MPP_ADJ.tiff` (189 Mo, hors Git) ; **décodé : oui** (rasterio) ; unités (m), projection, convention de pixel et orientation **contrôlées** (2026-11-14, voir `SOURCES.md`).
**Aperçu du relief réel** : `py -m pipeline.tools.crop_real_dem --id shackleton --lat -89.67 --lon 129.5`, puis http://localhost:8000/preview.html (données locales non versionnées).
**Atlas** : non commencé. **Sites réels** : S-01 en attente des fichiers 5 m (4 × 39,1 Mo, à télécharger par l'humain). **Interface** : U-01 et U-02 terminés (coque : rail, barre flottante, scène plein écran, `view=`) ; U-03 à faire (avec T-12).
**Page affichable** : **oui** — `py -m http.server 8000 -d web`, puis ouvrir http://localhost:8000 (jeu d'exemple, aucun relief dessiné). Capture : `docs/captures/t09-page-fr.png`.

## Tableau d'avancement

| Tâche | Intitulé | État | Preuve (commande → résultat) |
|---|---|---|---|
| T-00 | Initialisation du dépôt | terminé | `pip install -r pipeline/requirements.txt` → code 0 ; `pytest pipeline/tests -q` → « no tests ran », code 5 ; `node --version` → v24.11.1 ; `git status` propre après commit |
| T-01 | Schéma de données et validateur | terminé (recalcul des KPI reporté à T-07) | `pytest pipeline/tests -q` → 30 passed ; site complet de 43 824 échantillons validé en 1,23 s |
| T-02 | Constantes, géodésie, projection | terminé — **revue CHAT demandée (M-006)** | `pytest pipeline/tests -q` → 68 passed ; 1e6 points : `destination` 0,16 s, `lonlat_to_xy` 0,05 s, `xy_to_lonlat` 0,09 s ; recalcul indépendant de TESTS-VALIDATION §§ 1-3 conforme |
| T-03 | Jeu d'exemple fait main + constantes JS | terminé | `py -m pipeline.validate web/data/sample` → OK ; `pytest pipeline/tests -q` → 85 passed ; `node --test "web/tests/**/*.test.js"` → 3 pass |
| T-04 | MNT synthétique et interface `Dem` | terminé (question Q-011 ouverte) | `pytest pipeline/tests -q` → 104 passed ; grille 20 m ±25 km : 13,2 s ; 120 m ±155 km : 13,8 s |
| T-05 | Masque d'horizon | à faire | |
| T-06 | Visibilité partagée et indicateurs | terminé — **revue CHAT demandée (M-022)** | `pytest` → 144 passed ; `node --test` → 51 pass ; mêmes valeurs d'or (`visible_fraction.json`, `horizon_at.json`) en Python et en JS ; `validate web/data/sample` → OK avec recalcul des KPI (§ 7.6) |
| T-07 | Éphémérides de démonstration et export | à faire | |
| T-08 | Génération de bout en bout + fichier d'or | à faire | |
| T-09 | Chargement, état, i18n, squelette | terminé | `node --test "web/tests/**/*.test.js"` → 33 pass ; Edge sans interface sur http://127.0.0.1:8000 → page rendue, valeurs = JSON, 0 message console, requêtes toutes locales |
| T-10 | Panorama 360° | terminé (jeu d'exemple) | `node --test` → 60 pass (9 de projection écran) ; captures `docs/captures/t10-panorama-1440-{fr,en}.png` cohérentes avec le tableau des lectures et la vue 3D |
| T-11 | Vue 3D du terrain | étape A terminée (jeu d'exemple) ; test d'ombre de `demo-a` après T-07/T-08 | `node --test` → 41 pass ; Edge (SwiftShader) : vue d'ensemble et vue au sol rendues ; 20 reconstructions → 3 géométries / 3 textures stables ; 20 vues libérées → 0 canvas restant |
| T-12 | Barre de temps et frise | à faire | |
| T-13 | Verdicts, lectures, indicateurs | à faire | |
| T-14 | Carte polaire, A/B, page méthode, README | à faire | |
| T-15 | Tests de fumée, performances, revue | à faire | |

États possibles : `à faire` · `en cours` · `terminé` · `bloqué`.

## Bloquants

- **Données NASA non reçues** : bloque J4 (T-20 à T-24). N'empêche pas J0 à J3.
- Vérifications non faites à l'écriture de ces fichiers : accès réseau vers NAIF, Horizons et PDS (**inaccessibles depuis l'environnement de rédaction**), noms exacts des fichiers SPICE et des produits MNT,
  convention de projection du MNT réel, coordonnées des sites réels. Tout est marqué « à vérifier » dans `docs/`.

## À arbitrer par l'humain

Voir `DECISIONS.md` § Questions ouvertes : `Q-001` (code avant événement) et `Q-002` (usage de l'IA) sont à lever dès la lecture du guide du 13 novembre.
`Q-010` (titulaire du copyright). `Q-011` tranchée par D-014 (site `demo-a` sur le rebord).
Suppression des scripts jetables de CHAT dans `data/raw/` (`_decode.py`, `_decode.log`, `ldem80_decoded.npy` partiel) : refusée à CODE par le contrôle des permissions, à faire par l'humain.

## Revue (écrite par l'agent vérificateur)

_Rien pour l'instant._ Format d'une entrée :
```
### Revue de T-xx — AAAA-MM-JJ
- Bloquant : …
- À corriger : …
- Remarque : …
- Vérifié : conventions angulaires ☐  unités ☐  accord Python/JS ☐  aucun réseau ☐  drapeau synthetic ☐  cas limites ☐
```

## Journal

Résumé par jour seulement. Le **journal détaillé et horodaté** (actions, commandes, résultats, commits) est dans `LIAISON.md` § 6.

### 2026-11-12
- Fichiers de pilotage créés : `CLAUDE.md`, `PLAN.md`, `DECISIONS.md`, `STATUS.md`, `SOURCES.md`, `docs/*`.
- Aucun code, aucune donnée. Les valeurs de référence de `docs/TESTS-VALIDATION.md` ont été calculées à la main : à recalculer indépendamment en T-02 et T-05.
- T-00 : dépôt Git (branche `main`), `.gitignore`, `LICENSE` (texte Apache 2.0 non modifié), arborescence, `pipeline/requirements.txt`, `README.md` provisoire, `.venv` créé.
  Remarque : les commandes sont lancées avec `.venv\Scripts\python.exe` (équivalent de `py` une fois l'environnement activé).
- T-01 : `pipeline/schema/{site,index,terrain}.schema.json` (JSON Schema 2020-12), `pipeline/validate.py`, `pipeline/tests/test_schema.py` (30 tests), `pipeline/tests/factories.py`.
  En attendant `cli.py` (T-07), la validation se lance par `py -m pipeline.validate [dossier]`. Le recalcul des indicateurs (CONTRAT § 7.6) sera branché en T-07.
  Interprétation : la latitude `-89.99` est **acceptée** (bornes incluses `[-89.99, 89.99]`), car `docs/` l'utilise comme latitude de test, alors que D-012 écrit `lat_deg > -89.99`.
  → confirmé par CHAT (M-005), D-012 précisé.
- T-02 : `pipeline/config.py`, `geodesy.py` (destination, base ENU, azimut/élévation, position du site, élévation d'un point du relief), `projection.py` (`PolarProjection`), 38 tests.
  Recalcul indépendant (méthodes différentes des formules documentées) : fraction visible par intégration numérique (écart ≤ 5e-7), élévations par géométrie vectorielle (≤ 4,4e-7°),
  trajets par rotation 3D et projection par construction géométrique (égalité aux décimales données). `point_elevation_deg` (formule d'élévation de T-05) est déjà dans `geodesy.py` et testée.
- T-03 : `web/js/constants.js` (miroir de `config.py`, égalité testée par `test_web_sample.py`), jeu d'exemple `web/data/sample/` (site `sample-a`, 168 échantillons du 2027-03-11 au 2027-03-17, grille 65²),
  écrit par `tests/reference/make_web_sample.py` (déterministe : deux exécutions → mêmes empreintes SHA-256) ; `tests/golden/visible_fraction.json` (11 cas) ; `web/tests/constants.test.js` ; `web/package.json` (`"type": "module"`, sans dépendance).
  **Commande JS** : sous Node 24, `node --test web/tests/` échoue (« Cannot find module …\web\tests ») : depuis Node 21, les arguments sont des fichiers ou des motifs, plus des dossiers.
  Commande qui fonctionne : `node --test "web/tests/**/*.test.js"`. CLAUDE.md § 3 n'est pas modifié (fichier de règles) : signalé à CHAT (M-007).
  → adopté par CHAT (M-008), CLAUDE.md corrigé par CHAT, Node ≥ 22.

### 2026-11-12 (session S2)
- Dépôt publié sur https://github.com/VictoireNdala/Lunar_Holocron (fusion de l'historique GitHub, README complet).
- T-09 : `web/index.html` (importmap, bandeau, conteneurs), `web/css/main.css`, `web/vendor/three/` (three.js 0.170.0), `web/js/{geometry,data,store,urlstate,i18n,main}.js`,
  tests `geometry`, `data`, `urlstate`, `i18n`, `store`, `nonetwork` (33 tests JS au total).
  Vérifié dans Edge sans interface (`--dump-dom`, `--screenshot`) : bandeau visible ; FR et EN ; à 2027-03-14T06:00Z, Soleil az 350,380° el 0,766°, Terre az 346,118° el −1,276°, identiques au JSON (échantillon 78) ;
  `?data=data/absent/` → « Fichier introuvable : data/absent/index.json (HTTP 404) » ; date hors période → avertissement et valeurs à la borne. Journal du serveur : seules des adresses locales demandées.
  **Non testé** : les clics (boutons ±1 h / ±1 jour, FR/EN, choix du site) dans un navigateur réel ; seul le chargement via le fragment d'URL l'a été. Le test de fumée Playwright est prévu en T-15.
  Choix : dossier de données par défaut `data/sample/` (à basculer sur `data/` en T-08) ; `?data=chemin/` permet d'en choisir un autre (chemin relatif validé).
- T-04 : `pipeline/dem.py` (`Dem`, `GridDem` : grille du plan stéréographique polaire avec interpolation bilinéaire, `MultiResDem`), `pipeline/dem_synthetic.py` (`crater`, `massif`, `flat`, bruit de valeur fractal déterministe),
  `geodesy.distance_azimuth` (problème inverse, testé par aller-retour avec `destination`). 21 tests nouveaux (`test_dem.py`, `test_dem_synthetic.py`, 2 dans `test_geodesy.py`).
  Aperçu visuel contrôlé : cratère centré avec dorsale au nord, massif à l'est, terrain plat bruité (±33 m). Optimisation du bruit par table de nœuds : 20 s → 13 s par grille, valeurs identiques (test).
  Question ouverte **Q-011** : position du site `demo-a` (au centre, l'horizon vaut ≈ 20,6° et rien n'est jamais visible).

### 2026-11-13 (session S3)
- M-014 lu ; MNT réel rangé dans `data/raw/` (hors Git) ; scripts jetables de CHAT supprimés avec l'accord de l'humain.
- T-11, étape A : `web/js/terrainmesh.js` (géométrie pure, testée : Nord vers −z, Ouest vers −x, site à l'origine, normales vers +y, directions des corps),
  `web/js/terrain3d.js` (three.js : maillage, teinte hypsométrique, exagération ×1 à ×5, lumière dans la direction du Soleil, éteinte si `el < 0`, ombres 2048 avec qualité adaptative 2048 → 1024 → aucune,
  sprites Soleil et Terre dessinés par canvas, atténués sous l'horizon, caméras vue d'ensemble et au sol, `renderNow`, `info`, `dispose`), `web/js/panel3d.js` (carte de la page, three chargé à la demande).
  Vérifié dans Edge sans interface (WebGL logiciel SwiftShader) : captures `docs/captures/t11-vue-ensemble-en.png` et `t11-au-sol-nord.png` ; page de contrôle hors dépôt : 3 géométries / 3 textures stables après 20 reconstructions, 0 canvas après 20 vues libérées.
  **Non testé** : clics réels (boutons de mode, curseur d'exagération, rotation au sol) ; déclenchement de la qualité adaptative ; message « Soleil sous l'horizon » (le Soleil du jeu d'exemple ne descend jamais sous 0,2°) ;
  l'ombre du rebord de `demo-a` (D-014), qui attend T-07/T-08.
