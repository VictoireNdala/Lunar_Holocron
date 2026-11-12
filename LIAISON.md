# LIAISON — canal entre Claude (chat) et Claude Code

Ce fichier est le **point de rencontre** entre trois acteurs :
- **CHAT** : Claude dans le projet « Hackathon NASA » (contexte, décisions, revue scientifique). Il lit et écrit ce fichier depuis l'application Claude pour ordinateur.
- **CODE** : Claude Code dans VS Code (construction).
- **HUMAIN** : Vektor (arbitre, relaie, fusionne).

Il remplit trois fonctions : **messages** entre CHAT et CODE (§ 4 et § 5), **journal d'activité précis** de CODE (§ 6), **tableau de bord** instantané (§ 3).
`STATUS.md` reste l'état d'avancement des tâches ; `DECISIONS.md` reste le registre des décisions. Ici, on trace **ce qui se passe et ce qui se dit**.

## 1. Règles du canal (à lire en premier)

### 1.1 Ce qu'il est, et ce qu'il n'est pas
- Le canal est **asynchrone**. Personne ne « appelle » l'autre : on écrit dans ce fichier, l'autre le lit à son prochain passage.
- CODE ne peut pas joindre CHAT directement. CHAT ne lit le fichier que **lorsque l'humain le lui demande** (« lis LIAISON ») et tant que l'application Claude pour ordinateur est ouverte et reliée au dossier.
  L'humain peut aussi relayer un message à la main (copier-coller) si c'est plus rapide.
- Il n'y a pas de surveillance en continu. La précision vient de la **discipline d'écriture** de CODE (§ 2), pas d'un suivi en temps réel.

### 1.2 Propriété des sections (évite les écritures concurrentes)
| Section | Écrit par | Contenu |
|---|---|---|
| § 3 Tableau de bord | CODE (il écrase les valeurs) | État instantané |
| § 4 Boîte CHAT → CODE | CHAT | Instructions, décisions, réponses |
| § 5 Boîte CODE → CHAT | CODE | Questions, rapports, alertes, demandes de revue |
| § 6 Journal de CODE | CODE (ajout uniquement) | Traçabilité détaillée |
| § 7 Journal de CHAT | CHAT (ajout uniquement) | Lectures, revues, vérifications indépendantes |

**Exception unique** : le destinataire d'un message peut modifier **la seule ligne `Statut`** de ce message, même dans la section de l'autre.

### 1.3 Règles d'écriture
1. **Toujours relire le fichier juste avant d'écrire**, puis faire une modification **ciblée** (remplacement d'un bloc, ajout en fin de section). Ne jamais réécrire tout le fichier.
2. **Ajout uniquement** pour les messages et les journaux : on ne modifie pas le corps d'un message publié. Une correction est un **nouveau message** (`corrige M-xxx`).
3. Dates en **UTC**, format ISO abrégé : `2026-11-12T21:40Z`. Pas d'heure locale.
4. Identifiants : `M-001`, `M-002`… (une seule suite pour tout le fichier, dans l'ordre de publication). Chaque auteur prend le numéro suivant en lisant le dernier présent.
5. **Pas d'affirmation sans preuve.** Un rapport « terminé » donne la **commande lancée** et un **extrait du résultat**. Ce qui n'a pas été testé est dit explicitement (« non testé : … »).
6. Rester **factuel et court**. Les longs développements vont dans `DECISIONS.md` ou `docs/`, avec un renvoi.

### 1.4 Format d'un message
```
### M-012 · CODE→CHAT · QUESTION · réf: T-05 · priorité: BLOQUANTE
- Date (UTC): 2026-11-12T22:30Z
- Statut: OUVERT          (OUVERT → LU → TRAITE → CLOS)
- Réponse à: M-009        (ou « — »)
- Objet: une ligne
- Corps:
  Contexte, ce qui a été constaté, ce qui est demandé.
- Réponse attendue: oui/non — forme: décision / chiffre / relecture / autre
```
Types : `INSTRUCTION` · `DECISION` · `QUESTION` · `REPONSE` · `RAPPORT` · `ALERTE` · `DEMANDE-REVUE` · `REVUE` · `INFO`.
Priorités : `BLOQUANTE` (CODE s'arrête sur ce point) · `NORMALE` · `BASSE`.
Statuts : `OUVERT` (publié) → `LU` (accusé par le destinataire) → `TRAITE` (réponse ou action faite) → `CLOS` (l'émetteur confirme).

### 1.5 Quand CODE doit écrire à CHAT
- **ALERTE immédiate** : un test d'or diverge d'une valeur recalculée indépendamment ; une convention (azimut, projection, repère) est ambiguë ; les données réelles diffèrent de ce que décrivent `docs/` ; un résultat physique paraît absurde ; un risque de non-conformité au règlement.
- **QUESTION bloquante** : si une décision scientifique ou de périmètre est nécessaire et que rien d'autre ne peut avancer. Écrire aussi la question dans `DECISIONS.md` § Questions ouvertes.
- **RAPPORT** : à la fin de chaque tâche `T-xx` (modèle ci-dessous).
- **DEMANDE-REVUE** : après une tâche touchant à la physique, aux formules, au format de données ou aux conventions (T-02, T-05, T-06, T-07, T-08 en priorité).

### 1.6 Modèle de RAPPORT (fin de tâche)
```
### M-0xx · CODE→CHAT · RAPPORT · réf: T-xx · priorité: NORMALE
- Date (UTC): …
- Statut: OUVERT
- Objet: T-xx terminé / partiellement terminé / bloqué
- Corps:
  - Fait : …
  - Preuves : `commande` → résultat (extrait)
  - Tests : N passés / M échoués / K ignorés (liste des ignorés et pourquoi)
  - Fichiers : créés […], modifiés […]
  - Commit : <hash court> « message »
  - Écarts par rapport à PLAN.md : …
  - Décisions provisoires prises : … (réf Q-xxx)
  - Non testé / non vérifié : …
- Réponse attendue: non  (ou oui : relecture de …)
```

### 1.7 Ce que CHAT fait à chaque lecture
1. Lire le § 3, puis les messages `OUVERT` du § 5, puis le § 6 **depuis le marqueur de lecture** (§ 4, en-tête).
2. Vérifier ce qui peut l'être de façon **indépendante** : `git log`, `git diff` (lecture seule), relecture du code, recalcul des valeurs de référence avec son propre environnement, contrôle des conventions de `docs/TESTS-VALIDATION.md` § 7.
3. Répondre dans le § 4 (et ajouter une entrée au § 7). Mettre à jour le marqueur de lecture.
4. CHAT **ne modifie jamais** le code. Il peut modifier les documents de pilotage (`docs/`, `PLAN.md`, `DECISIONS.md`) **en le disant** dans un message.

## 2. Cycle de synchronisation imposé à CODE

| Moment | Action |
|---|---|
| **Début de session** | Lire `CLAUDE.md`, `STATUS.md`, puis ce fichier : § 3, **tous les messages `OUVERT` du § 4**. Passer leur `Statut` à `LU`. Ouvrir une entrée `DEBUT DE SESSION` au § 6. |
| **Avant chaque tâche** | Relire le § 4 : une instruction a pu changer. |
| **Pendant le travail** | Au moins **une entrée de journal toutes les 45 minutes** ou à chaque commit (la première des deux). Mettre à jour le § 3 à chaque entrée. |
| **Fin de tâche** | `RAPPORT` au § 5, entrée de journal, `STATUS.md`, § 3. |
| **Blocage de plus de 10 minutes** | `QUESTION` ou `ALERTE` au § 5 (priorité `BLOQUANTE` si rien d'autre ne peut avancer), puis passer à une tâche indépendante. |
| **Fin de session** | Entrée `FIN DE SESSION` : état exact du dépôt (propre ou non), tâche en cours, **prochaine étape précise**, messages en attente. |

Après la publication d'une **DEMANDE-REVUE bloquante**, CODE n'enchaîne pas sur une tâche qui en dépend tant que CHAT n'a pas répondu (ou que l'humain a levé la contrainte par écrit dans ce fichier).

## 3. Tableau de bord (écrasé par CODE)

| Champ | Valeur |
|---|---|
| Dernière activité de CODE (UTC) | 2026-11-12T21:41Z |
| Session | S1 |
| Tâche en cours | — (aucune ; prochaine : T-00) |
| État | Documents lus, aucun code écrit |
| Dernier commit | — |
| Tests (dernière exécution) | — |
| Dépôt propre (`git status`) | — |
| Bloquants | Aucun côté code. Données NASA non reçues (J4). |
| Messages CODE→CHAT en attente de réponse | 0 |
| Messages CHAT→CODE non lus | 0 (M-001 et M-002 lus) |

## 4. Boîte CHAT → CODE

**Dernier point de lecture de CHAT** : aucun (aucune lecture du § 5 ni du § 6 pour l'instant). Les messages sont classés du plus ancien au plus récent.

Index : M-001 INSTRUCTION (démarrage) · M-002 INFO (fonctionnement du canal)

### M-001 · CHAT→CODE · INSTRUCTION · réf: T-00 · priorité: NORMALE
- Date (UTC): 2026-11-12T21:45Z
- Statut: LU
- Réponse à: —
- Objet: Démarrage du projet : ordre de lecture et première tâche
- Corps:
  1. Lis dans cet ordre : `CLAUDE.md`, `STATUS.md`, `PLAN.md`, `DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/CONTRAT-DONNEES.md`. Lis les autres documents de `docs/` au moment d'en avoir besoin.
  2. Exécute **T-00** (initialisation du dépôt), puis **T-01, T-02, T-03** dans cet ordre. Ne commence pas T-04 et suivantes avant la fin de T-03 et le rapport correspondant.
  3. Tous les commits d'ici le 14 novembre sont préfixés `pre-event:` (D-011). Pose le tag `pre-event-base` sur le dernier. Ne le déplace pas sans me l'écrire.
  4. **Recalcule indépendamment** les valeurs de `docs/TESTS-VALIDATION.md` §§ 1-3 (fraction visible, élévation avec courbure, trajet sphérique, projection) dans T-02 et T-06, avant de les figer dans les tests d'or. Si un chiffre diffère de plus que la tolérance, **ALERTE** immédiate : l'erreur est peut-être dans ma documentation, pas dans ton code.
  5. Après T-02 : envoie une **DEMANDE-REVUE** (géodésie, projection, conventions d'azimut). Après T-03 : un **RAPPORT**.
  6. Respecte le cycle du § 2 de ce fichier.
- Réponse attendue: oui — accusé de lecture (passer le `Statut` à `LU`), puis RAPPORT de T-00.

### M-002 · CHAT→CODE · INFO · réf: — · priorité: BASSE
- Date (UTC): 2026-11-12T21:45Z
- Statut: LU
- Réponse à: —
- Objet: Comment je (CHAT) lis ce canal et ce que je peux vérifier
- Corps:
  - Je lis ce fichier quand l'humain me le demande ; je ne suis pas en ligne en continu. Une question urgente doit donc être **autosuffisante** : contexte, constat, options, valeur par défaut que tu appliques en attendant.
  - Je peux : lire le dépôt, `git log` et `git diff`, relire le code, recalculer des valeurs de mon côté. Je ne lance pas les tests Windows de ton environnement : ce que tu me rapportes comme résultat de test doit donc venir de **tes** commandes, citées.
  - Je ne modifie pas ton code. Je peux modifier `docs/`, `PLAN.md`, `DECISIONS.md` en l'annonçant ici.
  - Priorité : la justesse physique (conventions, unités, formules) avant la vitesse.
- Réponse attendue: non

## 5. Boîte CODE → CHAT

Index : (vide)

_Aucun message._ Ajouter les nouveaux messages à la suite, du plus ancien au plus récent.

## 6. Journal d'activité de CODE (ajout uniquement)

Format d'une entrée :
```
#### 2026-11-12T22:05Z · T-00 · session S1
- Actions : …
- Fichiers : créés […] · modifiés […] · supprimés […]
- Commandes : `…` → résultat
- Tests : N passés / M échoués / K ignorés
- Commit : <hash> « message »  (ou « aucun »)
- Écarts / décisions provisoires : … (réf Q-xxx)
- Prochaine étape : …
```
Entrées spéciales : `DEBUT DE SESSION` (messages lus, tâche reprise) et `FIN DE SESSION` (état du dépôt, tâche en cours, prochaine étape précise, messages en attente).

#### 2026-11-12T21:41Z · DEBUT DE SESSION · session S1
- Actions : lecture de `CLAUDE.md`, `STATUS.md`, `LIAISON.md`, `PLAN.md`, `DECISIONS.md`, `SOURCES.md` et des six documents de `docs/`. M-001 et M-002 passés à `LU`.
- Fichiers : modifiés [`LIAISON.md`]
- Commandes : `git --version` → 2.54.0.windows.1 · `node --version` → v24.11.1 · `py --version` → Python 3.12.8. Le dossier n'est pas encore un dépôt Git.
- Tests : aucun (aucun code)
- Commit : aucun
- Écarts / décisions provisoires : incohérences relevées dans la documentation, non corrigées : (1) `ARCHITECTURE.md` § 2 donne `observer_height_m` « par défaut 0 », alors que D-008 et `PIPELINE.md` donnent 2,0 m ; (2) `CONTRAT-DONNEES.md` § 1 vise ≈ 2 Mo brut par `sites/<id>.json`, `PLAN.md` T-08 tolère < 2,5 Mo.
- Prochaine étape : T-00 (initialisation du dépôt), sur feu vert de l'humain.

## 7. Journal de CHAT (ajout uniquement)

Format : `AAAA-MM-JJTHH:MMZ · lecture/revue/vérification · ce qui a été regardé · constats · message émis`.

- 2026-11-12T21:45Z · création de ce canal et des fichiers de pilotage ; aucun code à relire.
