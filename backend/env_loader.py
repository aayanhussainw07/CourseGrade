from __future__ import annotations

import os
from pathlib import Path


def load_backend_env(filename: str = ".env") -> None:
    """
    Lightweight dotenv loader for direct `python app.py` runs.
    Does not override variables already present in the shell.
    """
    env_path = Path(__file__).resolve().parent / filename
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue

        # Support basic quoted values.
        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
            value = value[1:-1]

        if key not in os.environ:
            os.environ[key] = value
