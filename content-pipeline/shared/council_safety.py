"""Filesystem barrier for monitor-only council requests."""
import os
from pathlib import Path

CANARY_MARKER = ".council-canaries"


def refuse_canary_paths(*paths):
    """Refuse monitor roots and symlinks before any ingest or publication work.

    Raises:
        ValueError: A path is symlinked or has a canary-marked ancestor.
    """
    for given in paths:
        path = Path(given).absolute()
        for part in (path, *path.parents):
            if part.is_symlink():
                raise ValueError("Council paths cannot contain symlinks")
            if os.path.lexists(part / CANARY_MARKER):
                raise ValueError("Council canaries cannot reach ingest or the database")
