"""QA-lab switches. Off unless the Electron host sets DW_QA_LAB=1."""

from __future__ import annotations

import os

ENV_NAME = "DW_QA_LAB"


def enabled() -> bool:
    return os.environ.get(ENV_NAME, "").strip() == "1"
