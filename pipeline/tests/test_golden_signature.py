"""Le fichier d'or signé ne doit pas changer sans nouvelle relecture : son empreinte SHA-256 est écrite dans `docs/REVUE-FICHIER-OR.md`."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
GOLDEN = ROOT / "tests" / "golden" / "body_state_cases.json"
REVIEW = ROOT / "docs" / "REVUE-FICHIER-OR.md"


def _signed_hash() -> str:
    """Empreinte écrite dans la section « Signature » du document de revue."""
    text = REVIEW.read_text(encoding="utf-8")
    m = re.search(r"Empreinte SHA-256.*?`([0-9a-f]{64})`", text)
    assert m, "empreinte SHA-256 introuvable dans docs/REVUE-FICHIER-OR.md"
    return m.group(1)


def test_golden_file_matches_the_signed_hash() -> None:
    """Toute régénération (`py -m pipeline.golden`) change l'empreinte : le test échoue tant que le fichier n'est pas relu et l'empreinte mise à jour."""
    actual = hashlib.sha256(GOLDEN.read_bytes()).hexdigest()
    assert actual == _signed_hash(), (
        "tests/golden/body_state_cases.json a changé depuis sa signature : il doit être RELU de nouveau, "
        f"puis l'empreinte de docs/REVUE-FICHIER-OR.md remplacée par {actual}"
    )


def test_review_document_is_signed() -> None:
    """Le document porte une décision cochée « validé » (☒) : un fichier non relu ne peut pas passer pour figé."""
    text = REVIEW.read_text(encoding="utf-8")
    assert "☒ validé" in text
