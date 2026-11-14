# Textures de la Lune (Atlas, A-01)

**Statut : utilisées en local, NON versionnées** (les fichiers `*.jpg` de ce dossier sont ignorés par Git) tant que la question **Q-013**
(licence des données issues d'ASU) n'est pas tranchée. Sans ces fichiers, le globe affiche une sphère grise avec graticule et le dit.

| Fichier | Source | Taille | SHA-256 |
|---|---|---|---|
| `lroc_color_2k.jpg` (2048 × 1024) | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg | 457 942 octets (page : 447,2 Ko) | voir `SOURCES.md` |
| `lroc_color_poles_1k.jpg` (1024 × 512) | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg | 139 068 octets (page : 135,8 Ko) | voir `SOURCES.md` |

- **Origine** : NASA SVS, « CGI Moon Kit » (https://svs.gsfc.nasa.gov/4720), page lue le 2026-11-14 (mise à jour de la page : 9 janvier 2026) ; téléchargé le 2026-11-14.
  Visualiseur : Ernie Wright (STC) ; scientifique : Noah Petro (NASA/GSFC) ; données : LROC WAC (collecte : Arizona State University) et LOLA.
- **Crédit demandé par la page** : « Please give credit for this item to: **NASA's Scientific Visualization Studio** ». Il est repris dans l'interface (page « Sources et méthode » et pied de l'Atlas).
- **Avertissement de la page, à reprendre tel quel** : « These image is optimized for aesthetics, not science. » La texture est **illustrative**, jamais une mesure.
- **Licence** : la page de l'objet n'en indique **aucune**. Les directives de la NASA (https://www.nasa.gov/nasa-brand-center/images-and-media/, lues le 2026-11-14, mises à jour le 27 octobre 2026) disent que le contenu de la NASA « n'est généralement pas soumis à droit d'auteur aux États-Unis »,
  demandent de citer la NASA comme source, interdisent d'impliquer son approbation, et excluent de ce régime ses logos et identifiants. Elles **ne disent pas** si les contenus produits par des universités ou prestataires (ici ASU, qui exploite LROC) sont couverts.
  Nous ne présumons donc pas le « domaine public » : voir **Q-013**.
- **Disposition (lue sur l'image)** : les deux fichiers sont des cartes **équirectangulaires** (cylindriques) : longitude −180° à gauche, +180° à droite, 0° au centre, nord en haut. L'image « pôles » **n'est pas** une projection polaire.
  Contrôle : le cratère Tycho (≈ 43,3° S, 11,4° O) tombe à (959 ; 758) px sur la carte de 2048 × 1024, à l'endroit attendu. Au-delà de ±70° de latitude, l'image est comblée par une carte d'albédo de basse résolution (floue) : **pas de détail polaire réel**.
- **Poids** : 2k ≤ 2 Mo (consigne ATLAS § 3.1).
