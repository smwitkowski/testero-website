"""Local IO-only snapshots of public official docs; no stale-on-error fallback."""
from __future__ import annotations

import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

TTL_SECONDS = 7 * 24 * 60 * 60
MAX_SNAPSHOT_BYTES = 32 * 1024 * 1024  # JSON escaping can expand the 4 MiB HTML limit.


class DiskDocumentationCache:
    def __init__(self, directory, *, ttl_seconds=TTL_SECONDS, clock=None):
        self.directory = Path(directory)
        self.ttl_seconds = ttl_seconds
        self.clock = clock or (lambda: datetime.now(timezone.utc))

    def _path(self, url):
        from shared.doc_search import approved_documentation_url
        approved_documentation_url(url, discovery=True)
        return self.directory / (hashlib.sha256(url.encode()).hexdigest() + ".json")

    def get(self, url):
        from shared.doc_search import documentation_context, DocumentationError
        path = self._path(url)
        try:
            with path.open("rb") as stream:
                raw = stream.read(MAX_SNAPSHOT_BYTES + 1)
            if len(raw) > MAX_SNAPSHOT_BYTES:
                return None
            record = json.loads(raw)
            source = record["source"]
            if record["version"] != 1 or record["requested_url"] != url or source["requested_url"] != url:
                return None
            documentation_context([source])
            fetched = datetime.fromisoformat(record["fetched_at"])
            if fetched.tzinfo is None or record["fetched_at"] != source["retrieved_at"]:
                return None
            age = (self.clock() - fetched).total_seconds()
            if not 0 <= age < self.ttl_seconds:
                return None
            return source
        except (OSError, ValueError, KeyError, TypeError, DocumentationError):
            return None

    def put(self, url, source):
        from shared.doc_search import documentation_context
        path = self._path(url)
        documentation_context([source])
        if source["requested_url"] != url:
            raise ValueError("Cache key must match requested URL")
        self.directory.mkdir(parents=True, exist_ok=True)
        record = {"version": 1, "requested_url": url, "fetched_at": source["retrieved_at"], "source": source}
        fd, name = tempfile.mkstemp(dir=self.directory, prefix=".snapshot-", suffix=".tmp")
        try:
            with os.fdopen(fd, "w") as stream:
                json.dump(record, stream, ensure_ascii=False)
            os.replace(name, path)
        finally:
            Path(name).unlink(missing_ok=True)
