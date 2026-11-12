# STATUS — Lunar Holocron

> Fichier **vivant** : Claude Code le met à jour à la fin de chaque tâche. Rester court. Les anciennes entrées du journal sont regroupées par jour, pas supprimées.

**Dernière mise à jour** : 2026-11-12 (T-01 terminé)
**Phase** : J0 — fondations
**Prochaine tâche** : T-02 (constantes, géodésie, projection) — voir `PLAN.md`

## Tableau d'avancement

| Tâche | Intitulé | État | Preuve (commande → résultat) |
|---|---|---|---|
| T-00 | Initialisation du dépôt | terminé | `pip install -r pipeline/requirements.txt` → code 0 ; `pytest pipeline/tests -q` → « no tests ran », code 5 ; `node --version` → v24.11.1 ; `git status` propre après commit |
| T-01 | Schéma de données et validateur | terminé (recalcul des KPI reporté à T-07) | `pytest pipeline/tests -q` → 30 passed ; site complet de 43 824 échantillons validé en 1,23 s |
| T-02 | Constantes, géodésie, projection | à faire | |
| T-03 | Jeu d'exemple fait main + constantes JS | à faire | |
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
