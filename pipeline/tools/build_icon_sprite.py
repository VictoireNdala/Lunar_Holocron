"""Assemble un sprite SVG local (`web/vendor/icons/sprite.svg`) à partir des icônes Lucide (paquet lucide-static).

Les icônes sont copiées sans modification de leur tracé (licence ISC, et MIT pour celles issues de Feather :
`web/vendor/icons/LICENSE`). Usage : `py -m pipeline.tools.build_icon_sprite <dossier icons/ du paquet>`.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ICONS = ("globe", "map", "compass", "mountain", "book-open", "languages", "circle-help", "search",
         "panel-left-open", "panel-left-close", "play", "pause", "info", "x")
OUT = Path("web/vendor/icons/sprite.svg")


def symbol(name: str, svg: str) -> str:
    """Contenu d'une icône (sans l'élément <svg> englobant) dans un <symbol id="i-…">."""
    view_box = re.search(r'viewBox="([^"]+)"', svg).group(1)
    body = re.search(r"<svg[^>]*>(.*)</svg>", svg, flags=re.S).group(1).strip()
    body = re.sub(r"\s+", " ", body)
    return f'  <symbol id="i-{name}" viewBox="{view_box}">{body}</symbol>'


def main(argv: list[str]) -> int:
    """Écrit le sprite et affiche le nombre d'icônes."""
    src = Path(argv[0])
    parts = [symbol(n, (src / f"{n}.svg").read_text(encoding="utf-8")) for n in ICONS]
    head = ('<!-- Icônes Lucide (lucide-static 1.73.0), ISC / MIT (Feather) : voir LICENSE. Généré par '
            'pipeline/tools/build_icon_sprite.py -->\n<svg xmlns="http://www.w3.org/2000/svg" style="display:none">')
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(head + "\n" + "\n".join(parts) + "\n</svg>\n", encoding="utf-8", newline="\n")
    print(f"{len(parts)} icônes → {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
