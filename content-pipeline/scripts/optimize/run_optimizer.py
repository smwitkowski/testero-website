"""Optimize writer-only DSPy modules; live work requires explicit coordinator opt-in."""
from __future__ import annotations

import argparse
import hashlib
import json
import random
from pathlib import Path
import sys

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import dspy
from scripts.optimize.budget import (BudgetExceeded, MetricLimitExceeded, MetricLimiter,
                                     SpendBudget, budgeted_calls, serial_dspy_execution)

DEFAULT_STUDENT = "deepseek/deepseek-v4.1-flash-1017"
AUTO_METRIC_CALLS = {"light": 50, "medium": 150}


def openrouter_model(value):
    if value == "codex" or value.startswith(("codex/", "claude")):
        raise ValueError("Optimization student and reflection must be OpenRouter IDs")
    ident = value.removeprefix("openrouter/")
    if len(ident.split("/")) != 2 or not all(ident.split("/")):
        raise ValueError("Expected an OpenRouter vendor/model ID")
    return "openrouter/" + ident


def stage_signature(stage):
    if stage == "plan":
        from shared.decision_planner import DecisionPlanSignature
        return DecisionPlanSignature
    if stage == "draft":
        from shared.llm_generator import QuestionWithEvidenceSignature
        return QuestionWithEvidenceSignature
    raise ValueError("Unknown writer stage")


class WriterPredict(dspy.Predict):
    """A tunable DSPy predictor using the production strict writer adapters."""

    def __init__(self, signature, model, max_tokens, *, stage, cert_id=None, doccheck_policy="v5"):
        super().__init__(signature)
        self.writer_model, self.writer_max_tokens = model, max_tokens
        self.stage, self.cert_id, self.doccheck_policy = stage, cert_id, doccheck_policy

    def effective_signature(self):
        """Apply frozen production transforms per call, never to exported base."""
        if self.stage == "draft":
            from shared.question_style import practitioner_signature
            return practitioner_signature(self.signature, self.cert_id)
        from shared.decision_planner import planning_prompt
        from shared.prompt_pack import create_pack, use_prompt_pack
        pack = create_pack(stage="plan", signature=stage_signature("plan"),
                           instructions=self.signature.instructions, policy={},
                           source_run="optimizer-effective-signature", scores={})
        with use_prompt_pack(pack):
            effective, _ = planning_prompt({"domain_prompt": "", "cert_id": self.cert_id,
                                            "doccheck_policy": self.doccheck_policy}, stable_prefix=True)
        return effective

    def forward(self, **kwargs):
        from shared.call_logging import log_lm_calls
        from shared.llm_generator import _generation_lm
        from shared.llm_limits import reject_token_limit
        from shared.openrouter_writer import (WriterJSONAdapter, WriterChatAdapter,
                                               supports_structured_output, validate_writer_output)
        adapter = WriterJSONAdapter() if supports_structured_output(self.writer_model) else WriterChatAdapter()
        lm = _generation_lm(self.writer_model, max_tokens=self.writer_max_tokens)
        lm.num_retries = 0
        # Keep this predictor's optimized signature and demos, unlike calling the
        # production helper that constructs a new predictor for each request.
        with log_lm_calls(lm, self.writer_model), reject_token_limit(lm, capture=adapter.capture), dspy.context(adapter=adapter):
            result = super().forward(**kwargs, signature=self.effective_signature(), lm=lm)
            raw = {name: getattr(result, name) for name in self.signature.output_fields}
            return dspy.Prediction(**validate_writer_output(raw, self.signature, adapter.capture))


class StageProgram(dspy.Module):
    def __init__(self, stage, model, max_tokens=32000, *, cert_id=None, doccheck_policy="v5"):
        super().__init__()
        self.writer = WriterPredict(stage_signature(stage), model, max_tokens, stage=stage,
                                    cert_id=cert_id, doccheck_policy=doccheck_policy)

    def forward(self, **inputs):
        return self.writer(**inputs)


def load_splits(dataset_dir, stage):
    directory = Path(dataset_dir)
    splits = {}
    manifest_path = directory / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    for split in ("train", "dev", "test"):
        path = directory / f"{stage}.{split}.json"
        raw = path.read_bytes()
        expected_hash = manifest.get("files", {}).get(path.name)
        if expected_hash is not None and hashlib.sha256(raw).hexdigest() != expected_hash:
            raise ValueError("Dataset file does not match split manifest hash")
        payload = json.loads(raw)
        rows = payload if isinstance(payload, list) else payload["examples"]
        if not isinstance(rows, list) or any(not isinstance(row, dict) or not row.get("objective_id") for row in rows):
            raise ValueError("Dataset records require objective_id")
        if "splits" in manifest:
            allowed = set(manifest["splits"][split])
            if any(row["objective_id"] not in allowed for row in rows):
                raise ValueError("Dataset objective does not match declared split")
        splits[split] = rows
    objective_sets = {key: {row["objective_id"] for row in rows} for key, rows in splits.items()}
    if any(objective_sets[a] & objective_sets[b] for a, b in (("train", "dev"), ("train", "test"), ("dev", "test"))):
        raise ValueError("Dataset splits must be objective-disjoint")
    # Do not trust a manually edited dataset to bypass protected cohorts.
    if any(str(row.get("cohort", "")).lower() in ("canary", "gold")
           or row.get("is_canary") or row.get("is_gold") for row in splits["train"]):
        raise ValueError("Protected cohorts cannot train writers")
    return splits


def to_example(row, signature):
    from shared.cli_models import output_model
    inputs, outputs = row["inputs"], row["outputs"]
    if row["scope"].get("objective_id") != row["objective_id"]:
        raise ValueError("Dataset envelope and scope objective IDs differ")
    if "plan" in outputs and outputs["plan"].get("objective_id") != row["objective_id"]:
        raise ValueError("Dataset plan changed its objective")
    if set(inputs) != set(signature.input_fields):
        raise ValueError("Dataset inputs differ from writer signature")
    validated = output_model(signature).model_validate(outputs).model_dump()
    return dspy.Example(**inputs, **validated, scope=row["scope"], sources=row.get("sources", []),
                        objective_id=row["objective_id"], domain=row.get("domain", ""),
                        proof=row.get("proof", {})).with_inputs(*signature.input_fields)


def select_diverse_demos(rows, *, stage, per_domain=4, seed=0):
    """Choose 3-5 train-only positives per domain, maximizing lexical diversity."""
    if per_domain not in (3, 4, 5):
        raise ValueError("Demos per domain must be between three and five")
    groups = {}
    for row in rows:
        if stage == "plan" and row.get("proof", {}).get("passed") is not True:
            continue
        groups.setdefault(str(row.get("domain", "unknown")), []).append(row)
    selected = []
    rng = random.Random(seed)
    for domain in sorted(groups):
        pool = sorted(groups[domain], key=lambda row: json.dumps(row["outputs"], sort_keys=True))
        rng.shuffle(pool)
        chosen = []
        while pool and len(chosen) < per_domain:
            def tokens(row):
                return set(json.dumps(row["outputs"], sort_keys=True).lower().split())
            def distance(row):
                a = tokens(row)
                return min((1 - len(a & tokens(other)) / max(1, len(a | tokens(other)))
                            for other in chosen), default=1)
            best = max(range(len(pool)), key=lambda index: distance(pool[index]))
            chosen.append(pool.pop(best))
        selected.extend(chosen)
    if not selected:
        raise ValueError("No accepted training demos are available")
    return selected


def filter_rows(splits, *, cert_id, policy, method):
    """Bind rows to one certification. Bootstrap reuses recorded outcomes as demos,
    so it also requires the recorded doc-check policy; GEPA uses rows only as inputs
    and re-scores every rollout live under `policy`, so any recorded policy is valid."""
    return {split: [row for row in rows
                    if row["scope"].get("cert_id") == cert_id
                    and (method == "gepa" or row["scope"].get("doccheck_policy", "v5") == policy)]
            for split, rows in splits.items()}


def development_subset(rows, count, seed):
    """Fixed-seed objective-balanced dev slice; full test is never consulted."""
    if type(count) is not int or count < 1:
        raise ValueError("Development sample size must be positive")
    groups = {}
    for row in rows:
        groups.setdefault(row["objective_id"], []).append(row)
    rng = random.Random(seed)
    objectives = sorted(groups)
    rng.shuffle(objectives)
    for objective in objectives:
        groups[objective].sort(key=lambda row: json.dumps(row["inputs"], sort_keys=True))
        rng.shuffle(groups[objective])
    selected = []
    while len(selected) < count and any(groups.values()):
        for objective in objectives:
            if groups[objective] and len(selected) < count:
                selected.append(groups[objective].pop())
    return selected


@serial_dspy_execution()
def compile_program(program, *, method, trainset, devset, metric, reflection_lm=None,
                    max_metric_calls=50, seed=0, bootstrap_mode="labeled", log_dir=None):
    """Small injectable boundary used by fake-LM offline tests."""
    if method == "bootstrap":
        if bootstrap_mode == "labeled":
            return dspy.LabeledFewShot(k=len(trainset)).compile(program, trainset=trainset, sample=False)
        scalar_metric = lambda gold, pred, trace=None: float(metric(gold, pred, trace).score)
        threshold = 1.0 if "plan" in program.writer.signature.output_fields else 0.8
        optimizer = dspy.BootstrapFewShot(metric=scalar_metric, metric_threshold=threshold,
                                         max_bootstrapped_demos=min(5, len(trainset)),
                                         max_labeled_demos=len(trainset), max_rounds=1, max_errors=1)
        return optimizer.compile(program, trainset=trainset)
    if method != "gepa":
        raise ValueError("Unknown optimizer method")
    # DSPy 3.0.4 forbids auto and max_metric_calls together. Resolve CLI auto to
    # a concrete cap outside this API, and also enforce it in MetricLimiter.
    optimizer = dspy.GEPA(metric=metric, reflection_lm=reflection_lm,
                          max_metric_calls=max_metric_calls, num_threads=1,
                          seed=seed, log_dir=log_dir, track_stats=True)
    return optimizer.compile(program, trainset=trainset, valset=devset)


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--stage", choices=("plan", "draft"), required=True)
    p.add_argument("--method", choices=("gepa", "bootstrap"), required=True)
    p.add_argument("--dataset-dir", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--student-model", default=DEFAULT_STUDENT)
    p.add_argument("--cert-id", help="Filter one certification; required when a dataset contains multiple certifications")
    p.add_argument("--reflection-model")
    p.add_argument("--checker-model", help="Plan proof checker; omitted means production writer model")
    p.add_argument("--include-evidence-metric", action="store_true")
    p.add_argument("--max-metric-calls", type=int)
    p.add_argument("--dev-examples", type=int, help="Objective-balanced dev sample; default min(12, max_metric_calls // 5)")
    p.add_argument("--budget-usd", required=True)
    p.add_argument("--prices", type=Path, required=True, help="Approved nonzero USD per million token upper bounds")
    p.add_argument("--auto", choices=("light", "medium"), default="light")
    p.add_argument("--bootstrap-mode", choices=("labeled", "generate"), default="labeled")
    p.add_argument("--demos-per-domain", type=int, choices=(3, 4, 5), default=4)
    p.add_argument("--max-output-tokens", type=int, default=32000)
    p.add_argument("--cli-output-token-bound", type=int, default=131072)
    p.add_argument("--doccheck-policy", choices=("v5", "v6"), default="v5")
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--allow-live", action="store_true", help="Coordinator approval for model calls; never set in offline tests")
    return p


def main(argv=None):
    args = parser().parse_args(argv)
    live = args.method == "gepa" or args.bootstrap_mode == "generate"
    if live and not args.allow_live:
        raise SystemExit("Live optimization requires explicit --allow-live coordinator approval")
    if args.method == "gepa" and not args.reflection_model:
        raise SystemExit("GEPA requires --reflection-model")
    from scripts.optimize.metrics import make_plan_metric, make_draft_metric
    from shared.prompt_pack import create_pack, save_pack
    if args.output.exists():
        raise SystemExit("Refusing to overwrite an existing prompt pack")
    model = openrouter_model(args.student_model)
    signature = stage_signature(args.stage)
    splits = load_splits(args.dataset_dir, args.stage)
    certifications = {row["scope"].get("cert_id") for rows in splits.values() for row in rows}
    cert_id = args.cert_id
    if cert_id is None:
        if len(certifications) > 1:
            raise SystemExit("Mixed certification datasets require --cert-id")
        cert_id = next(iter(certifications), None)
    # A run binds one certification and recorded production proof policy. Do not
    # relabel accepted v6 demos as if they had passed v5, or vice versa.
    splits = filter_rows(splits, cert_id=cert_id, policy=args.doccheck_policy, method=args.method)
    train_rows = (select_diverse_demos(splits["train"], stage=args.stage,
                                     per_domain=args.demos_per_domain, seed=args.seed)
                  if args.method == "bootstrap" else splits["train"])
    limit = args.max_metric_calls if args.max_metric_calls is not None else AUTO_METRIC_CALLS[args.auto]
    if args.method == "gepa" and limit < 4:
        raise SystemExit("GEPA needs at least four metric calls for baseline and candidate comparison")
    dev_count = args.dev_examples if args.dev_examples is not None else min(12, max(1, limit // 5))
    if args.method == "gepa" and dev_count > limit // 2:
        raise SystemExit("Development sample cannot consume more than half the metric cap")
    dev_rows = development_subset(splits["dev"], dev_count, args.seed) if splits["dev"] else []
    train = [to_example(row, signature) for row in train_rows]
    dev = [to_example(row, signature) for row in dev_rows]
    if not train or (args.method == "gepa" and not dev):
        raise SystemExit("Nonempty training data and GEPA development data are required")
    metric_impl = (make_plan_metric(writer_model=model, checker_model=args.checker_model)
                   if args.stage == "plan" else make_draft_metric(include_evidence=args.include_evidence_metric))
    metric = MetricLimiter(metric_impl, limit, cache=True)
    run_dir = args.output.parent / (args.output.stem + ".run")
    if run_dir.exists():
        raise SystemExit("Refusing an existing optimizer run directory; use a fresh output name, never resume foreign GEPA state")
    run_dir.mkdir(parents=True, exist_ok=False)
    # GEPA resumes state from its log directory automatically. Every optimizer
    # run gets a fresh directory so a changed split cannot inherit old demos.
    budget = SpendBudget(args.budget_usd, json.loads(args.prices.read_text()), run_dir / "spend.jsonl")
    program = StageProgram(args.stage, model, args.max_output_tokens,
                           cert_id=cert_id, doccheck_policy=args.doccheck_policy)
    manifest_path = args.dataset_dir / "manifest.json"
    manifest_hash = hashlib.sha256(manifest_path.read_bytes()).hexdigest()
    report = {"stage": args.stage, "method": args.method, "student_model": model,
              "seed": args.seed, "dataset_manifest_sha256": manifest_hash,
              "training_objectives": sorted({row["objective_id"] for row in train_rows}),
              "test_objectives": sorted({row["objective_id"] for row in splits["test"]}),
              "status": "started", "max_metric_calls": limit,
              "cert_id": cert_id, "doccheck_policy": args.doccheck_policy,
              "dev_examples": len(dev_rows),
              "development_objectives": sorted({row["objective_id"] for row in dev_rows})}
    try:
        with budgeted_calls(budget, cli_output_tokens=args.cli_output_token_bound):
            reflection = None
            if args.method == "gepa":
                from shared.llm_generator import _generation_lm
                reflection = _generation_lm(openrouter_model(args.reflection_model), max_tokens=args.max_output_tokens)
                reflection.num_retries = 0
            optimized = compile_program(program, method=args.method, trainset=train, devset=dev,
                                        metric=metric, reflection_lm=reflection,
                                        max_metric_calls=limit, seed=args.seed,
                                        bootstrap_mode=args.bootstrap_mode, log_dir=str(run_dir / "gepa"))
        fields = set(signature.fields)
        demos = [{key: value for key, value in dict(demo).items() if key in fields}
                 for demo in optimized.writer.demos]
        scores = {"metric_calls": float(metric.calls)}
        if metric.scores:
            scores["observed_metric_mean"] = sum(metric.scores) / len(metric.scores)
        # Only train demos are compiled. GEPA instruction updates use train/dev,
        # never test; test objectives are reserved for evaluate_pack.py.
        pack = create_pack(stage=args.stage, signature=signature,
                           instructions=optimized.writer.signature.instructions, demos=demos,
                           policy={**({"cert_id": cert_id} if cert_id else {}),
                                   "doccheck_policy": args.doccheck_policy,
                                   "dataset_manifest_sha256": manifest_hash,
                                   "training_objectives": report["training_objectives"],
                                   "optimizer": args.method},
                           source_run=str(run_dir), scores=scores)
        save_pack(pack, args.output)
        report.update(status="completed", output=str(args.output), scores=scores)
    except (BudgetExceeded, MetricLimitExceeded) as error:
        report.update(status="stopped", stop_reason=str(error))
    except KeyboardInterrupt:
        report.update(status="stopped", stop_reason="Interrupted by coordinator")
    except Exception as error:
        # Never copy a provider body, credential or arbitrary exception message
        # into persisted evidence. Failure is explicit, not a forever-started run.
        report.update(status="failed", error_class=type(error).__name__)
    finally:
        report.update(budget=budget.snapshot(), metric_calls=metric.calls, metric_cache_hits=metric.cache_hits)
        (run_dir / "run.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    return 0 if report["status"] == "completed" else 2


if __name__ == "__main__":
    raise SystemExit(main())
