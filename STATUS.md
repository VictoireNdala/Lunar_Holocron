# STATUS — Lunar Holocron

> Fichier **vivant** : Claude Code le met à jour à la fin de chaque tâche. Rester court. Les anciennes entrées du journal sont regroupées par jour, pas supprimées.

**Dernière mise à jour** : 2026-11-12 (T-03 terminé ; J0 terminé, sous réserve de la revue de T-02)
**Phase** : J0 — fondations terminées
**Prochaine tâche** : en attente de la revue de T-02 par CHAT (M-006). Ensuite T-04 (pipeline) et T-09 (interface, ne dépend que de T-03).

## Tableau d'avancement

| Tâche | Intitulé | État | Preuve (commande → résultat) |
|---|---|---|---|
| T-00 | Initialisation du dépôt | terminé | `pip install -r pipeline/requirements.txt` → code 0 ; `pytest pipeline/tests -q` → « no tests ran », code 5 ; `node --version` → v24.11.1 ; `git status` propre après commit |
| T-01 | Schéma de données et validateur | terminé (recalcul des KPI reporté à T-07) | `pytest pipeline/tests -q` → 30 passed ; site complet de 43 824 échantillons validé en 1,23 s |
| T-02 | Constantes, géodésie, projection | terminé — **revue CHAT demandée (M-006)** | `pytest pipeline/tests -q` → 68 passed ; 1e6 points : `destination` 0,16 s, `lonlat_to_xy` 0,05 s, `xy_to_lonlat` 0,09 s ; recalcul indépendant de TESTS-VALIDATION §§ 1-3 conforme |
| T-03 | Jeu d'exemple fait main + constantes JS | terminé | `py -m pipeline.validate web/data/sample` → OK ; `pytest pipeline/tests -q` → 85 passed ; `node --test "web/tests/**/*.test.js"` → 3 pass |
| T-04 | MNT synthétique et interface `Dem` | à faire | |
| T-05 | Masque d'horizon | à faire | |
| T-06 | Visibilité partagée et indicateurs | à faire | |
| T-07 | Éphémérides de démonstration et export | à faire | |
| T-08 | Génération de bout en bout + fichier d'or | à faire | |
| T-09 | Chargement, état, i18n, squelette | à faire | |
| T-10 | Panorama 360° | à faire | |
| T-11 | Vue 3D du terrain | à faire | |
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
