"""Read-only quality population for variant family comparisons."""
from copy import deepcopy


def reviewed_siblings(artifact, payload, verdicts):
    """Exclude actual quality rejects before any family-stem decision, in any order.

    Missing judgments remain eligible. Saved generation rejects without a request
    stay rejected. Only copied status is changed; no report/ingest file is written.
    """
    from scripts.ingest_external_verdicts import (_read_json, _validate_candidate,
        _external_decision, _argon_request)
    siblings = deepcopy(payload["candidates"])
    for original, sibling in zip(payload["candidates"], siblings):
        if (not original.get("variant") or original.get("accepted") is True
                or not original.get("external_judge_request")):
            continue
        raw_path = verdicts / (original["candidate_id"] + ".json")
        if not raw_path.exists():
            if (original.get("failure_stage") in ("external_verdict", "judge", "near_duplicate")
                    and original.get("status") != "generation_failed"
                    and original.get("schema_check", {}).get("passed") is not False):
                # A prior ingest's missing-verdict/duplicate diagnostic is not
                # evidence that this still-pending published request failed.
                sibling.pop("failure_stage", None)
                sibling.update(awaiting_external_judge=True, status="awaiting_external_judge")
                sibling["judge_verdict"] = {"passed": False}
                sibling["near_duplicate_check"] = {"passed": True}
            continue
        try:
            if raw_path.is_symlink():
                raise ValueError("Unsafe verdict path")
            scope, question, checked = _validate_candidate(artifact, payload, original)
            decision = _external_decision(question, scope, original["sources"], checked["options"],
                _read_json(raw_path), payload["model"], gate_version=payload["external_judge_version"],
                rules_version=payload.get("rules_version", 4),
                argon_request=_argon_request(artifact, original, payload))
            if decision.passed:
                # A previous dry-run rejection is not the current verdict's decision.
                sibling.pop("failure_stage", None)
                sibling.update(awaiting_external_judge=True, status="awaiting_external_judge")
                sibling["judge_verdict"] = {"passed": True}
                sibling["near_duplicate_check"] = {"passed": True}
            else:
                sibling.update(failure_stage="judge", awaiting_external_judge=False)
        except (ValueError, KeyError, TypeError, OSError):
            sibling.update(failure_stage="external_verdict", awaiting_external_judge=False)
    return siblings
