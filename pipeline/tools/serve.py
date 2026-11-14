"""Serveur de développement local : `py -m pipeline.tools.serve` (http://localhost:8000), sans mise en cache."""
from __future__ import annotations

import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

WEB_DIR = Path(__file__).resolve().parents[2] / "web"


class NoCacheHandler(SimpleHTTPRequestHandler):
    """Ajoute `Cache-Control: no-store` : un module JS modifié n'est jamais servi périmé par le navigateur."""

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main() -> None:
    """Lance le serveur sur le dossier `web/`."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--bind", default="127.0.0.1")
    args = parser.parse_args()
    handler = functools.partial(NoCacheHandler, directory=str(WEB_DIR))
    with ThreadingHTTPServer((args.bind, args.port), handler) as server:
        print(f"Lunar Holocron : http://localhost:{args.port} (Ctrl+C pour arrêter)")
        server.serve_forever()


if __name__ == "__main__":
    main()
