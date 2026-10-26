"""Offline current-name guidance for opt-in doccheck v6 prompts.

This is prompt guidance, not an evidence rewriter or product-capability authority.
Frozen PDE 5.2/5.3 guide aliases deliberately use Dataproc and Cloud Composer;
leave those historical policies unchanged. New doccheck v6 uses the current
Spark/Airflow brands instead. Knowledge Catalog is an explicit doccheck naming
rule; the checked-in PDE guide still says Dataplex.
"""
from __future__ import annotations

import json
from pathlib import Path

LEXICON_PATH = Path(__file__).resolve().parents[1] / "certs/product-lexicon.json"

# Explicit naming relationships only. Spark and Knowledge Catalog are doccheck
# requirements; the other names also occur in the checked-in style/guide rules.
# Do not invert the frozen PDE_NAME_ALIASES mechanically: their guide-name
# preference is not the current-name policy for doccheck v6.
_CURRENT_NAME_OVERRIDES = (
    ("Dataproc", "Managed Service for Apache Spark"),
    ("Dataplex", "Knowledge Catalog"),
    ("Cloud Composer", "Managed Service for Apache Airflow"),
    ("Cloud DLP", "Sensitive Data Protection"),
    ("Cloud Bigtable", "Bigtable"),
)


def current_name_instructions() -> str:
    """Return current-first naming guidance from local files, without rewriting data.

    The caller opts into this guidance when building the initial v6 prompt, before
    retrieval or a documentation veto. Historical prompt versions must not use it.
    """
    data = json.loads(LEXICON_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or data.get("version") != 1 or not isinstance(data.get("products"), list):
        raise ValueError("Invalid product freshness lexicon")
    names = []
    for item in data["products"]:
        if (not isinstance(item, dict)
                or set(item) != {"old", "new", "status", "source"}
                or item["status"] not in ("retired", "renamed")
                or any(not isinstance(value, str) or not value.strip() for value in item.values())):
            raise ValueError("Invalid product freshness lexicon entry")
        names.append((item["old"], item["new"]))
    names.extend(_CURRENT_NAME_OVERRIDES)
    return (
        "Current product names for new doccheck v6 plans and learner prose (apply from the first plan):\n"
        + "\n".join(f"- {current} (legacy name: {old})." for old, current in names)
        + "\nUse these current names even when an older exam guide uses a legacy alias. "
          "Do not invent names or infer product capabilities from this naming guidance. "
          "Preserve official source text, evidence quotes, URLs and receipts byte-exact; "
          "never rename them. This guidance does not change frozen historical style policies."
    )
