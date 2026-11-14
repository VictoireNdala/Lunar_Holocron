"""Tableau des contrastes WCAG 2.x des jetons de web/css/tokens.css (UI-DESIGN § 6.5 : calculés, pas à l'œil).

Le verre (--glass, semi-transparent) est composé sur la scène --bg-0 (cas le plus courant : panneau au-dessus du fond noir).
Seuils : texte ≥ 4,5:1 ; éléments d'interface (bordures de contrôles, icônes, accents) ≥ 3:1.
Usage : `.venv\\Scripts\\python.exe tests/reference/contrast_tokens.py` ; code de sortie 1 si un seuil n'est pas tenu.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

TOKENS = Path(__file__).resolve().parents[2] / "web" / "css" / "tokens.css"


def parse_tokens(text: str) -> dict[str, tuple[float, float, float, float]]:
    """Lit les couleurs `--nom: #rrggbb` et `--nom: rgba(r, g, b, a)`."""
    out: dict[str, tuple[float, float, float, float]] = {}
    for name, value in re.findall(r"(--[a-z0-9-]+):\s*([^;]+);", text):
        value = value.strip()
        if m := re.fullmatch(r"#([0-9a-fA-F]{6})", value):
            h = m.group(1)
            out[name] = (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 1.0)
        elif m := re.fullmatch(r"rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)", value):
            out[name] = (float(m.group(1)), float(m.group(2)), float(m.group(3)), float(m.group(4)))
    return out


def over(fg: tuple[float, float, float, float], bg: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
    """Composition alpha de fg sur un fond opaque bg."""
    a = fg[3]
    return (fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1.0)


def luminance(c: tuple[float, float, float, float]) -> float:
    """Luminance relative WCAG."""
    def lin(v: float) -> float:
        s = v / 255.0
        return s / 12.92 if s <= 0.04045 else ((s + 0.055) / 1.055) ** 2.4
    return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])


def ratio(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> float:
    """Rapport de contraste (L1 + 0,05) / (L2 + 0,05)."""
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def main() -> int:
    """Imprime le tableau Markdown et renvoie 1 si un seuil n'est pas tenu."""
    t = parse_tokens(TOKENS.read_text(encoding="utf-8"))
    backgrounds = {"--bg-0": t["--bg-0"], "--bg-1": t["--bg-1"], "--bg-2": t["--bg-2"], "--glass/--bg-0": over(t["--glass"], t["--bg-0"])}
    checks = [(f, 4.5, "texte") for f in ("--text", "--text-2", "--text-3")]
    checks += [(f, 3.0, "interface") for f in ("--line-strong", "--sun", "--earth", "--ok", "--warn", "--err")]
    checks += [(f, 4.5, "texte d'état") for f in ("--sun", "--earth", "--ok", "--warn", "--err")]
    failed = 0
    print("| Premier plan | Usage | Seuil | " + " | ".join(backgrounds) + " |")
    print("|---|---|---|" + "---|" * len(backgrounds))
    for fg, threshold, usage in checks:
        cells = []
        for bg in backgrounds.values():
            r = ratio(over(t[fg], bg), bg)
            ok = r >= threshold
            failed += not ok
            cells.append(f"{r:.2f}{'' if ok else ' ✗'}")
        print(f"| `{fg}` | {usage} | {threshold} | " + " | ".join(cells) + " |")
    print(f"\n{failed} case(s) sous le seuil")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
