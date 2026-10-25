"""Build a rubric-plus-compact-plan challenger offline. No model, search or DB calls."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.optimize.exemplars import select_compact_exemplars, exemplar_hash
from shared.plan_components import default_components, frozen_decision_rules
from shared.prompt_pack import create_pack, save_pack


def build_zero_cost_pack(splits, *, cert_id, domains=None, doccheck_policy="v6", seed=0,
                         source_run="offline-zero-cost", dataset_manifest_sha256=None):
    """Use only accepted draft-train plans and exact frozen O3/O5/O6 text."""
    from shared.decision_planner import DecisionPlanSignature
    if not isinstance(cert_id, str) or not cert_id.strip():
        raise ValueError("A certification is required")
    if doccheck_policy not in ("v5", "v6"):
        raise ValueError("Unknown doccheck policy")
    selected_domains = sorted(set(domains) if domains is not None else {
        row["domain"] for row in splits["train"] if row.get("scope", {}).get("cert_id") == cert_id})
    exemplars = []
    for domain in selected_domains:
        chosen = select_compact_exemplars(splits, domain=domain, cert_id=cert_id, seed=seed)
        if not chosen:
            raise ValueError(f"No accepted training plan exemplars for domain {domain}")
        exemplars.extend(chosen)
    if not exemplars:
        raise ValueError("No accepted training plan exemplars for this certification")
    policy = {"cert_id": cert_id, "doccheck_policy": doccheck_policy,
        "optimizer": "zero-cost", "domains": selected_domains,
        "training_objectives": sorted({row["objective_id"] for row in exemplars}),
        "exemplars_sha256": exemplar_hash(exemplars), "seed": seed}
    if dataset_manifest_sha256 is not None:
        policy["dataset_manifest_sha256"] = dataset_manifest_sha256
    return create_pack(stage="plan", signature=DecisionPlanSignature,
        components=default_components(), exemplars=exemplars,
        frozen_rubric=frozen_decision_rules(), policy=policy, source_run=source_run, scores={})


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cert-id", required=True)
    parser.add_argument("--domain", action="append", help="Repeat to select domains; default all training domains")
    parser.add_argument("--doccheck-policy", choices=("v5", "v6"), default="v6")
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args(argv)
    if args.output.exists():
        parser.error("Refusing to overwrite an existing prompt pack")
    # This native loader verifies the file hashes and objective-disjoint split
    # manifest. Loading the optimizer module does not run any optimization/calls.
    from scripts.optimize.run_optimizer import load_splits
    splits = load_splits(args.dataset_dir, "draft")
    manifest = args.dataset_dir / "manifest.json"
    if not manifest.is_file():
        parser.error("A hash-bound dataset manifest is required")
    digest = hashlib.sha256(manifest.read_bytes()).hexdigest()
    try:
        pack = build_zero_cost_pack(splits, cert_id=args.cert_id, domains=args.domain,
            doccheck_policy=args.doccheck_policy, seed=args.seed,
            source_run="offline-zero-cost:" + digest, dataset_manifest_sha256=digest)
        save_pack(pack, args.output)
    except ValueError as error:
        parser.error(str(error))
    print(json.dumps({"status": "completed", "output": str(args.output), "model_calls": 0,
        "exemplars": len(pack["writers"][0]["exemplars"]),
        "domains": pack["policy"]["domains"]}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
