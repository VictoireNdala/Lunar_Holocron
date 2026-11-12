# Lunar Holocron — règles permanentes pour Claude Code

> Ce fichier est lu à chaque session. Il contient les règles stables.
> L'état courant est dans `STATUS.md`, le plan dans `PLAN.md`, les décisions dans `DECISIONS.md`.

## 0. Ordre de lecture au démarrage de chaque session

1. `STATUS.md` : où on en est, ce qui bloque, la prochaine tâche.
2. **`LIAISON.md`** : le § 3 (tableau de bord) et **tous les messages `OUVERT` du § 4** (instructions de Claude « CHAT »). Passe leur `Statut` à `LU`.
   Ce fichier est le canal avec Claude (chat) et ton journal d'activité horodaté : suis le cycle de son § 2.
3. `PLAN.md` : la tâche en cours (identifiant `T-xx`) et ses critères d'acceptation.
4. `DECISIONS.md` : décisions prises (`D-xxx`) et questions ouvertes (`Q-xxx`).
5. Le document de `docs/` qui concerne la tâche :
   - `docs/ARCHITECTURE.md` : glossaire, conventions, arborescence.
   - `docs/CONTRAT-DONNEES.md` : format exact des JSON entre pipeline et interface.
   - `docs/PIPELINE.md` : calculs (SPICE, MNT, horizon, indicateurs).
   - `docs/INTERFACE.md` : application web.
   - `docs/TESTS-VALIDATION.md` : tests, valeurs de référence, validation.
   - `docs/BRANCHEMENT-DONNEES-REELLES.md` : passage des données de démonstration aux données NASA.

Ne commence jamais à coder avant d'avoir lu la tâche et le document correspondant.

## 1. Mission

**Lunar Holocron** (nom de travail) est un navigateur des sites d'alunissage du pôle Sud lunaire.
Pour un site et une date, il montre où se trouvent le Soleil et la Terre par rapport à **l'horizon réel du terrain**
(masque d'horizon calculé à partir des MNT LOLA), pour juger l'énergie solaire et la liaison directe avec la Terre.
Il permet de comparer deux sites (A/B) et deux dates. Il est destiné aux planificateurs de mission, aux enseignants et au grand public.
Contexte : hackathon NASA Space Apps 2026, défi « Lunar Landing Site Navigator » (CLPS Lunar Mission Browser).

## 2. Principes non négociables

1. **Honnêteté des données.** Tant que les données NASA ne sont pas branchées, tout ce qui est généré est **synthétique**.
   - Chaque fichier de données synthétiques porte `"synthetic": true`.
   - L'interface affiche alors une bannière permanente « DONNÉES DE DÉMONSTRATION — valeurs fictives ».
   - N'invente jamais une valeur « réelle » (altitude, coordonnée, pourcentage) et ne la présente jamais comme réelle.
   - Les coordonnées de sites réels écrites de mémoire sont marquées `"verified": false`.
2. **Aucune dépendance réseau à l'exécution de l'application.** Pas de CDN, pas de police distante, pas d'API appelée par le navigateur.
   Tout est servi en fichiers statiques locaux. `three.js` est copié dans `web/vendor/` à une version précise.
3. **Le calcul fait foi, le rendu illustre.** Les verdicts et indicateurs viennent des masques d'horizon et des éphémérides,
   jamais d'un test visuel dans le rendu 3D.
4. **Une seule définition de chaque formule**, implémentée en Python (`pipeline/visibility.py`) et en JavaScript (`web/js/visibility.js`),
   vérifiée par les **mêmes valeurs de référence** (`tests/golden/`). Si les deux divergent, c'est un bug bloquant.
5. **Reproductibilité.** Un même jeu d'entrées donne les mêmes sorties octet pour octet (graines fixes, pas d'horodatage dans les calculs).
   Les métadonnées de provenance (produit MNT, noyaux SPICE, version du pipeline) sont écrites dans chaque JSON.
6. **Sources et licences.** Chaque source de données ou d'idée est listée dans `SOURCES.md` au moment où elle est utilisée.
   Licence du code : Apache 2.0. Aucun contenu soumis à ITAR/EAR.
7. **Transparence sur l'IA.** Tiens `SOURCES.md` § « Usage de l'IA » à jour (outils, rôles, ce qui a été vérifié par un humain).
8. **Les incertitudes sont affichées, pas cachées.** Chaque indicateur a sa définition dans la page « Sources et méthode ».

## 3. Environnement et commandes

La machine de travail est sous **Windows** (PowerShell). Évite tout ce qui ne fonctionne qu'avec bash ou make.

| Besoin | Commande |
|---|---|
| Créer l'environnement Python (≥ 3.10) | `py -m venv .venv` puis `.venv\Scripts\Activate.ps1` puis `pip install -r pipeline/requirements.txt` |
| Générer les données de démonstration | `py -m pipeline.cli demo` |
| Valider les JSON contre le schéma | `py -m pipeline.cli validate` |
| Tests Python | `py -m pytest pipeline/tests -q` |
| Tests JavaScript (Node ≥ 20, aucune dépendance) | `node --test web/tests/` |
| Servir l'application | `py -m http.server 8000 -d web` puis ouvrir http://localhost:8000 |
| Test de fumée navigateur (optionnel) | `npx playwright test` (dossier `tests/e2e/`) |

Dépendances Python autorisées : `numpy`, `spiceypy`, `rasterio` (lecture des MNT), `pillow` (uniquement pour des aperçus), `jsonschema`, `pytest`.
N'en ajoute pas d'autres sans l'inscrire dans `DECISIONS.md`.
Côté web : aucune étape de compilation, pas de bundler, pas de framework. Modules ES natifs et `importmap`.

## 4. Conventions de code

- Identifiants (variables, fonctions, fichiers, champs JSON) en **anglais**. Commentaires et documentation en **français**.
- Python : type hints partout, docstring d'une ligne minimum, `numpy` vectorisé (pas de boucle Python sur les pixels ou les pas de temps quand on peut l'éviter).
- JavaScript : modules ES, `const` par défaut, pas de variable globale, pas de dépendance autre que `three`.
- Chaque grandeur physique porte son unité dans le nom : `_deg`, `_mdeg` (millidegrés), `_m`, `_km`, `_s`, `_h`, `_pct`. Pas d'exception.
- Conventions angulaires et géométriques : voir `docs/ARCHITECTURE.md` § 2. Elles sont **identiques** dans tout le projet.
- Aucune « valeur magique » : les constantes (rayon de référence, rayons du Soleil et de la Terre, pas de temps) sont dans `pipeline/config.py` et
  `web/js/constants.js`, avec leur source en commentaire.
- Un fichier = une responsabilité. Un module ne dépasse pas ~300 lignes ; au-delà, on le découpe.

## 5. Boucle de travail

Pour chaque tâche `T-xx` de `PLAN.md` :

1. Relis les critères d'acceptation. S'ils sont ambigus, applique la section 6.
2. Écris d'abord les tests (ou les valeurs de référence), puis le code.
3. Lance les tests concernés **et** l'ensemble de la suite. Rien de rouge.
4. Mets à jour `STATUS.md` (tâche terminée, preuve : commande lancée et résultat résumé, points ouverts).
5. Un commit par tâche, message : `T-xx: résumé court` (français), corps = ce qui change et comment le vérifier.
6. **Écris dans `LIAISON.md`** : le `RAPPORT` de la tâche (§ 5, modèle au § 1.6), l'entrée de journal horodatée (§ 6) et la mise à jour du tableau de bord (§ 3).
   Une `DEMANDE-REVUE` est obligatoire après les tâches de physique, de formules ou de format de données (T-02, T-05, T-06, T-07, T-08).
7. Passe à la tâche suivante seulement si la précédente est vérifiée (et, pour une demande de revue bloquante, après la réponse de CHAT).

Règle d'honnêteté : **aucune affirmation sans preuve**. Un résultat de test est celui d'une commande que tu as réellement lancée, citée dans le rapport. Ce qui n'a pas été testé est écrit comme tel.

Règle de provenance du code : tant que la règle du hackathon sur le code écrit avant l'événement n'est pas confirmée (`Q-001`),
les commits d'avant le 14 novembre 2026 sont préfixés `pre-event:` et on pose le tag Git `pre-event-base` sur le dernier.
Ainsi l'équipe peut repartir proprement d'un dépôt vide si le règlement l'exige.

## 6. Quand c'est ambigu ou bloqué

Tu ne peux pas poser de question en direct à l'humain décideur. Procède ainsi :

1. Écris la question dans `DECISIONS.md` § « Questions ouvertes » (`Q-xxx`), avec le contexte et les options, **et** publie un message `QUESTION` (ou `ALERTE`) dans `LIAISON.md` § 5, autosuffisant
   (contexte, constat, options, valeur par défaut que tu appliques en attendant). Priorité `BLOQUANTE` seulement si rien d'autre ne peut avancer.
2. Choisis l'option **la plus prudente et la plus réversible**, marque-la dans le code par un commentaire `# DECISION-PROVISOIRE Q-xxx`.
3. Continue sur ce qui n'en dépend pas, et signale-le dans `STATUS.md` § « À arbitrer par l'humain ».

Ne tranche jamais seul : un choix scientifique (seuil, convention, définition d'un indicateur), un choix de périmètre, une règle du hackathon.

## 7. Ce qu'il ne faut pas faire

- Ne pas télécharger de données depuis l'application web, ni depuis les tests unitaires.
- Ne pas committer de gros fichiers : `data/raw/`, `data/cache/`, `*.IMG`, `*.bsp`, `*.bpc`, `*.tif` sont dans `.gitignore`.
  Seuls `web/data/` (sorties compactes) et les petits jeux de test sont versionnés.
- Ne pas modifier le contrat de données sans mettre à jour `docs/CONTRAT-DONNEES.md`, le schéma, les deux implémentations et les tests, dans le même commit.
- Ne pas contourner un test qui échoue : on corrige le code, ou on explique pourquoi la valeur de référence est fausse dans `DECISIONS.md`.
- Ne pas copier du code ou des textes d'autres projets sans l'indiquer dans `SOURCES.md` avec la licence.
- Ne pas écrire de texte d'interface en dur : tout passe par `web/js/i18n.js`.

## 8. Rôles quand on utilise plusieurs agents

- **Constructeur** : implémente une tâche dans son propre dossier (`pipeline/` ou `web/` ou `tests/`). Ne modifie pas les dossiers des autres.
- **Vérificateur** (lecture seule + exécution des tests) : relit le code et les chiffres d'une tâche terminée.
  Il contrôle les conventions angulaires, les unités, l'accord Python/JavaScript, les cas limites (azimut 0/360, pôle, sauts de minuit UTC),
  et écrit ses constats dans `STATUS.md` § « Revue ». Il ne corrige pas lui-même.
- L'humain fusionne. Un seul point de fusion, jamais de fusion automatique.
- **CHAT** (Claude dans le projet « Hackathon NASA ») ne modifie pas le code. Il lit le dépôt, relit, recalcule des valeurs de façon indépendante et répond dans `LIAISON.md` § 4.
  Il ne tourne pas en continu : il lit le canal quand l'humain le lui demande. Les messages à son attention doivent donc être autosuffisants.

## 9. Définition de « terminé » (pour toute tâche)

- Les critères d'acceptation de `PLAN.md` sont satisfaits, avec la commande et le résultat dans `STATUS.md`.
- Tests ajoutés et verts, y compris la suite complète.
- Aucune donnée synthétique présentée comme réelle ; bannière présente si `synthetic: true`.
- Aucune dépendance réseau ajoutée à l'application.
- Documentation mise à jour si un format, une commande ou une convention a changé.
- `SOURCES.md` à jour.
- `RAPPORT` publié dans `LIAISON.md` avec les preuves, entrée de journal et tableau de bord à jour.
