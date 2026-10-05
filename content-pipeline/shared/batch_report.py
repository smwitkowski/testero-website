"""Offline option-length audit for generation and external ingestion artifacts."""

KEY_LONGEST_TARGET = 0.35


def _summarize(entries):
    counts = []
    for entry in entries:
        options = entry.get("options")
        if (not isinstance(options, list) or len(options) != 4
                or any(not isinstance(option, dict) for option in options)
                or sorted(option.get("label", "") for option in options) != list("ABCD")):
            continue
        mapping = {option["label"]: option.get("text") for option in options}
        if entry.get("key") not in mapping or any(not isinstance(text, str) or not text.strip() for text in mapping.values()):
            continue
        lengths = {label: len(text.split()) for label, text in mapping.items()}
        key = lengths[entry["key"]]
        other = max(value for label, value in lengths.items() if label != entry["key"])
        counts.append((key >= other, key > other))
    total = len(counts)
    longest = sum(pair[0] for pair in counts)
    unique = sum(pair[1] for pair in counts)
    rate = longest / total if total else None
    return {"count": total, "excluded": len(entries) - total,
            "key_is_longest_count": longest, "key_is_longest_rate": rate,
            "key_is_uniquely_longest_count": unique,
            "key_is_uniquely_longest_rate": unique / total if total else None,
            "target_met": rate <= KEY_LONGEST_TARGET if rate is not None else None}


def option_length_report(candidates):
    """Count key-longest including ties, and unique-longest separately, by stage."""
    return {"definition": "key-is-longest includes ties; uniquely-longest excludes ties",
            "target_max_rate": KEY_LONGEST_TARGET, **_summarize(candidates),
            "awaiting_external_judge": _summarize([entry for entry in candidates if entry.get("awaiting_external_judge") is True]),
            "accepted": _summarize([entry for entry in candidates if entry.get("accepted") is True])}


def format_option_length_report(report):
    """Format the stored definition and target without hiding ties or empty samples."""
    rate = report["key_is_longest_rate"]
    text = f"{rate:.2%}" if rate is not None else "not available"
    unique = report["key_is_uniquely_longest_rate"]
    unique_text = f"{unique:.2%}" if unique is not None else "not available"
    warning = "; WARNING target exceeded" if report["target_met"] is False else ""
    stages = ""
    for name in ("awaiting_external_judge", "accepted"):
        sample = report[name]
        if sample["count"]:
            flag = ", target exceeded" if sample["target_met"] is False else ""
            stages += (f"; {name}: {sample['key_is_longest_count']}/{sample['count']} "
                       f"({sample['key_is_longest_rate']:.2%}{flag})")
    return (f"Option lengths: key-is-longest {report['key_is_longest_count']}/{report['count']} "
            f"({text}, ties included); uniquely-longest {unique_text}; "
            f"target <= {report['target_max_rate']:.0%}{warning}{stages}")
