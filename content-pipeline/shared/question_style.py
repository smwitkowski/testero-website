"""Founder-owned authoring rules and original style exemplars, not answer evidence."""

PRE_REPAIR_O3 = 'O3 Wrong options are real approaches a competent engineer might plausibly try. Each fails a\nstated want (cost/upkeep/latency/policy/downtime) because of a Google Cloud/ML fact not given as\nan explicit contradiction in the stem. No distractor can be eliminated using stem text alone;\nanswering must require product/domain knowledge. Never invented/broken config.'
KNOWLEDGE_O3 = 'O3 Wrong options are real approaches a competent engineer might plausibly try. A stated want\nmay distinguish the key: each distractor can fail that want for a documented Google Cloud/ML\nreason the reader must know. Do not fail this check merely because the want is in the stem.\nFail when a literal stem fact or prohibition rules an option out: a batch option for an\nexplicit online endpoint, an approach company policy bans, or prompt design when the stem\nexplicitly requires adaptation through supervised learning. A hand-written server can be a\nvalid distractor for minimal maintenance when rejecting it requires knowing that custom\nprediction routines provide the server. Do not put that capability or a ban on hand-written\nservers into the stem. Multiple distractors may fail the same want for different documented\nreasons; do not add a third want just to give each a different failure. Never invented/broken\nconfig.'

LEGACY_STYLE_RULES_V2 = """S1 Purpose first: the opening must name the business application or a concrete ML task,
in 1–2 sentences. Business-first and task-first openings are both valid. Roughly one third
of a batch may be task-first, as the planner records in opening_style. Never use an abstract
model deployment with no application or task purpose; do not expand the selected objective.
S2 Facts as story: describe what exists and what happened in plain narrative. A numbered list
only for existing workflow steps, never requirements.
S3 Constraints as wants or policies: at most two explicit wants or policies, phrased
"You want to … while minimizing …" or "Company policy does not allow …". Keep the business
story; do not stack requirements or pack extra wants into one sentence. Never "must satisfy
the following requirements" or "Stakeholders have established". Do not write "without X",
"do not use X", or an equivalent ban when X names a target approach and directly negates a
distractor. Let Google Cloud/ML product knowledge eliminate that approach, not the stem.
S4 Natural question line: target about 70% "What should you do?" in a batch. The planner
rotates and records question_line hints; the rest use natural variants suited to the decision,
such as "Which approach should you use?" or "What should you do first?". Do not invent a
first-step premise just to fit a hint. Always end with '?'. Never name settings or config
objects in the question line. The batch target is not a single-item hard gate.
S5 50–110 words; one paragraph, two at most. The mechanical acceptance range is 40–130 words.
S6 Plain register/goals in plain language. Product names only as needed, current short names
Agent Platform Pipelines, Agent Platform Workbench. Full "Gemini Enterprise Agent Platform" at
most once. No setting names, enum values, file formats or code in stem.
S7 Vary moment: max half fresh design, rest running situations: recent deployment, monitoring,
migration, cost/latency reduction, security incident. Planner rotates hints and records them in
the artifact. This is a batch rule, not a single-item count.
S8 Never documentation in stem: "documented", "documentation", "supported specifications", "per
best practices".
S9 No product/model version strings unless the learning objective is explicitly
version-specific. Prefer "a Gemini model" rather than a numbered Gemini model version.
O1 Imperative, parallel practitioner actions similar length. One/two sentences or 2–3 short
numbered steps.
O2 Decisions not syntax: differ approach/service/sequence. Setting names/values only if
objective literally config, then described choices. Even for configuration-heavy objective
1.2:3, compare the approach, tuning or adaptation and why it fits, not setting values or
media resolution per image part.
O3 Wrong options are real approaches a competent engineer might plausibly try. A stated want
may distinguish the key: each distractor can fail that want for a documented Google Cloud/ML
reason the reader must know. Do not fail this check merely because the want is in the stem.
Fail when a literal stem fact or prohibition rules an option out: a batch option for an
explicit online endpoint, an approach company policy bans, or prompt design when the stem
explicitly requires adaptation through supervised learning. A hand-written server can be a
valid distractor for minimal maintenance when rejecting it requires knowing that custom
prediction routines provide the server. Do not put that capability or a ban on hand-written
servers into the stem. Multiple distractors may fail the same want for different documented
reasons; do not add a third want just to give each a different failure. Never invented/broken
config.
O4 Keep all four options parallel in action, structure and detail. Each option's word count
must be within ±20% of the mean word count of all four options. The key must never be uniquely
longest. Vary the longest option's position across the batch, including which non-key option
is longest; do not make the key tied for longest on every item. This variation is a batch rule,
not a single-item check or a batch hard-rejection rule."""

STYLE_RULES = (
    LEGACY_STYLE_RULES_V2
    .replace("""S1 Purpose first: the opening must name the business application or a concrete ML task,
in 1–2 sentences. Business-first and task-first openings are both valid. Roughly one third
of a batch may be task-first, as the planner records in opening_style. Never use an abstract
model deployment with no application or task purpose; do not expand the selected objective.
""", """S1 Purpose first: the opening must name the business application or a concrete ML task,
in 1–2 sentences. Never use abstract model deployment with no application or task purpose;
do not expand the selected objective.
""", 1)
    .replace("""S7 Vary moment: max half fresh design, rest running situations: recent deployment, monitoring,
migration, cost/latency reduction, security incident. Planner rotates hints and records them in
the artifact. This is a batch rule, not a single-item count.
""", """S7 Vary moment: max half fresh design, rest running situations: recent deployment, monitoring,
migration, cost/latency reduction, scale growth. Security incident is allowed only for security,
privacy or governance objectives (PMLE 6.1:x and explicitly privacy-related data items).
The moment is framing only: the tested decision must remain the selected objective. Never let
an incident turn a Feature Store objective into an IAM question. Planner records hints in the
artifact. This is a batch rule, not a single-item count.
""", 1)
    .replace("""O1 Imperative""", """S10 Natural human-subject openings: lead with You or Your. Rotate the planner's recorded hints:
You are (~30%), Your company/organization/team (~25%), You work for (~10%), You have/manage/use
(~15%), You need to (~10%), You recently (~10%). A third-person A/An/The plus an organization
or person noun is also valid. Never open with an imperative or a gerund subject. S1 still
requires a business application or concrete ML task; percentages are batch hints, not item gates.
O1 Imperative""", 1)
    .replace("""O4 Keep all four options parallel in action, structure and detail. Each option's word count
must be within ±20% of the mean word count of all four options. The key must never be uniquely
longest. Vary the longest option's position across the batch, including which non-key option
is longest; do not make the key tied for longest on every item. This variation is a batch rule,
not a single-item check or a batch hard-rejection rule.""", """O4 Keep all four options parallel in action, structure and detail. Each option's word count
must be within ±20% of the mean word count of all four options. The key must never be uniquely
longest. Vary the longest option's position across the batch, including which non-key option
is longest; do not make the key tied for longest on every item. This variation is a batch rule,
not a single-item check or a batch hard-rejection rule.
Reach comparable length with comparable detail in distinct approaches, never cloned sentences.
O5 Distinct approaches: options differ in service, architecture, method or sequence. At most
one pair may be variants of the same plan with one small detail changed (location, account,
new versus existing resource, or percentage). Do not clone options to meet O1 parallelism or
O4 length balance. Three or more options sharing eight or more leading words fail mechanically.
Batch targets: median shared leading words <=2; share with three or more options sharing six
or more leading words <=10%. Batch targets are reports, not additional item hard gates.""", 1)
)

FOUNDER_EXEMPLARS = (
    (
        'You work for a regional bank that is launching a customer-facing assistant built on an '
        "open model from Model Garden. The bank's data policy doesn't allow customer data to be "
        "processed by shared, multi-tenant services, so inference must run inside the bank's own "
        'project and VPC network. The assistant will get steady, high request volume around the '
        "clock, and your team doesn't want to build or maintain serving containers. You want to "
        'minimize total cost of ownership. What should you do?'
    ),
    (
        'Your company runs a fraud-scoring model behind an online prediction service on Cloud Run. '
        "You trained a new version that looks better offline, but you aren't sure how it will "
        'behave on live traffic. You want to send a small share of real requests to it first, '
        'compare its latency and error rate with the current version, and raise its share in stages '
        'with as little manual work as possible. What should you do?'
    ),
    (
        'You work for a circuit-board manufacturer. Inspectors want an assistant that flags solder '
        'defects in photos from the assembly line, and you have several thousand labeled defect '
        'photos in Cloud Storage. A prompt-only Gemini prototype misses subtle defects that your '
        'inspectors catch. You want better accuracy on your own defect types without building and '
        'hosting a custom vision model. What should you do?'
    ),
    (
        'You work for a telecom company and are building a churn model in BigQuery ML from customer '
        'interaction data. Retention agents need to see why each customer was flagged, and the '
        'compliance team needs an overall view of which features drive the model for its annual '
        'audit. Early experiments show a tree-based model captures the patterns far better than a '
        'linear one. What should you do?'
    ),
    (
        'You work for an insurance company. You trained a scikit-learn model that scores claims for '
        'fraud risk, and you want to serve it online on Agent Platform. The claims system sends '
        'requests as CSV rows, the model needs your feature normalization applied first, and '
        'adjusters want a risk level (low, medium, high) instead of a probability. You want to test '
        'the serving code locally without writing your own web server or Dockerfile. What should '
        'you do?'
    ),
)

STYLE_INSTRUCTIONS = (
    "Testero writing style (apply to generation and every correction):\n"
    + STYLE_RULES
    + "\n\nFive founder-approved original stem exemplars. Follow their voice, not their technical claims; "
      "fetched docs remain the only factual authority. These historical exemplars are not exhaustive "
      "current policy and do not override the rules above, including the current limits on wants and "
      "direct distractor-negating constraints. Preserve their quoted text as style references. "
      "Do not copy these scenarios into generated content. "
      "A necessary business interface such as CSV rows in exemplar 5 is context, not a settings/syntax quiz.\n"
    + "\n\n".join(f"Exemplar {index}: {stem}" for index, stem in enumerate(FOUNDER_EXEMPLARS, 1))
)

# Exact frozen policy text is only for matching historical original requests.
LEGACY_STYLE_INSTRUCTIONS_V2 = STYLE_INSTRUCTIONS.replace(STYLE_RULES, LEGACY_STYLE_RULES_V2, 1)

# Frozen original references are retained only for historical request verification.
LEGACY_FOUNDER_EXEMPLARS = FOUNDER_EXEMPLARS
LEGACY_STYLE_INSTRUCTIONS_V3 = STYLE_INSTRUCTIONS
LEGACY_STYLE_RULES_V3 = STYLE_RULES

STYLE_RULES = LEGACY_STYLE_RULES_V3 + """
Rules v4 — decision-first practitioner difficulty:
S11 Use Agent Platform short names only in new learner prose, never Vertex AI, AI Platform,
or Gemini Enterprise Agent Platform. Official source URLs/quotes retain their actual names.
S12 Ask what an ML engineer should do to achieve an outcome. Include only necessary facts.
Test one primary engineering decision and one clear task. Difficulty comes from scenario
tradeoffs, not arbitrary limits, hidden exceptions, API trivia, or unsupported feature gotchas.
Choose the decision before detailed retrieval. Use overview/choose-between docs to verify it.
If docs do not support a uniquely best action and three realistic mistakes, replace the
unsupported decision; never add scenario exceptions or security wrappers to force the key.
O6 Each mistake loses for a scenario-specific engineering reason (such as unnecessary
migration, wrong execution mode, wrong metric, or missing validation). Keep all four choices
at comparable granularity. Unsupported impossibility claims and brittle feature trivia fail.
O7 Follow key_length_rank hints: 1 shortest, 2 second-shortest, 3 second-longest, 4 longest.
Ranks rotate evenly across a batch, so only about 25% of keys are longest (including ties).
Rank 4 should tie one other option for longest, never create a uniquely longest key. Keep
O4's mechanical length balance and two-word key lead limit; do not pad or clone choices.
"""
STYLE_RULES = STYLE_RULES.replace(
    'Agent Platform Pipelines, Agent Platform Workbench. Full "Gemini Enterprise Agent Platform" at\n'
    'most once. No setting names, enum values, file formats or code in stem.',
    'Agent Platform Pipelines, Agent Platform Workbench. Use short Agent Platform names only;\n'
    'no legacy full names in new learner prose. No setting names, enum values, file formats or code in stem.',
    1,
)
FOUNDER_EXEMPLAR_IDS = (3, 9, 11, 17, 18)
FOUNDER_EXEMPLARS = (
    (
        'You are designing an ML feature management architecture using Gemini Enterprise Agent Platfo'
        'rm Feature Store. Your team maintains feature data across two separate BigQuery tables: one '
        'containing customer demographic attributes and the other containing customer behavioral aggr'
        'egations. Both tables contain historical records over time with multiple rows per customer e'
        'ntity ID, formatted as a time series using a feature_timestamp column. \n\nYou need to consoli'
        'date features from both tables into a single endpoint to serve the latest feature values for'
        ' low-latency online predictions, while preserving the ability to retrieve point-in-time hist'
        'orical feature values for offline model training. \n\nWhat should you do?'
    ),
    (
        'A travel company recently deployed a Gemini assistant that writes tour descriptions. Reviewe'
        'rs still correct recurring wording errors after several prompt revisions. A BigQuery table c'
        'ontains 400 package prompts paired with approved descriptions, and a Boolean column marks 80'
        ' rows reserved for evaluation. You want Gemini to learn from these corrections while minimiz'
        "ing changes to the team's existing SQL workflow. You also want the reserved rows used for ev"
        'aluation during tuning. What should you do?'
    ),
    (
        "Your company's security operations assistant uses a Llama model from Model Garden to classif"
        'y incident reports. A recent security incident exposed recurring errors in company-specific '
        'categories despite extensive prompt refinement. The model supports both full and parameter-e'
        'fficient tuning, and analysts have prepared 600 carefully labeled complete reports represent'
        'ative of production traffic. You want more reliable classification while minimizing tuning c'
        'ompute. Company policy requires all tuning resources to stay in the Netherlands. Which appro'
        'ach should you use?'
    ),
    (
        'Your company runs a support-reply assistant, and its growing product catalog has expanded th'
        'e terminology the assistant encounters. Your team already experiments in Agent Platform Work'
        'bench and is considering several open foundation models from Model Garden. You want to explo'
        're model-specific tuning code for prototypes using your support examples while minimizing th'
        'e work to set up those experiments. What should you do first?'
    ),
    (
        'You need to build a transaction fraud classifier for a payment processor using historical tr'
        'ansactions in BigQuery. Reviewers will use its scores to investigate flagged payments, and m'
        'odel owners will review its behavior across an evaluation dataset. You want to show how each'
        " transaction's features contributed to its score relative to a baseline and summarize featur"
        'e influence across the evaluation dataset. What should you do?'
    ),
)
STYLE_INSTRUCTIONS = (
    "Testero writing style, rules v4 (apply to generation and every correction):\n"
    + STYLE_RULES
    + "\n\nFive original founder-approved items from the fresh-review pack, all labelled ok. "
      "They show voice and decision zoom only, not technical authority or templates. "
      "Their exact historical wording is preserved; current rules override legacy full names "
      "and configuration details. Use Agent Platform short names in new learner prose. "
      "Do not copy these scenarios. Official samples and dumps are never prompted examples. "
      "Fetched official docs are the only factual authority.\n"
    + "\n\n".join(f"Approved item {ident}: {stem}" for ident, stem in zip(FOUNDER_EXEMPLAR_IDS, FOUNDER_EXEMPLARS))
)

RULES_V4_STYLE_INSTRUCTIONS = STYLE_INSTRUCTIONS + "\n\n" + """Rules v4: Plan decisions before retrieving docs. Docs veto unsupported decisions;
never manufacture difficulty from fine print. Test one primary ML engineering decision.
Use comparable-granularity alternatives representing real scenario-specific mistakes.
No obscure exception, incidental file format or startup behavior as the main hinge.
Do not add security merely to distinguish options. Use current short product names.
All S1-S10/O1-O5 rules still apply. Exemplars calibrate style, not product truth.
"""
RULES_V4_STYLE_RULES = STYLE_RULES
RULES_V5_ADDITIONS = """
Rules v5 — product-specific decisions and template diversity:
S13 Prefer decisions whose hinge is a specific Google Cloud capability, limit or trade-off.
Do not repeat generic measure/benchmark/validate two constraints and choose whatever meets
both. Such generic keys are capped at 20% of a batch, not a default decision template.
O8 At least one distractor must be a plausible Google Cloud-specific alternative whose
scenario-specific loss requires product knowledge. All distractors merely ignoring one
stated requirement makes a reading-comprehension item, not a PMLE decision. Keep every v4 guard.
"""
STYLE_RULES += RULES_V5_ADDITIONS
STYLE_INSTRUCTIONS = (STYLE_INSTRUCTIONS + RULES_V5_ADDITIONS).strip()


def practitioner_text(text, cert_id=None):
    """Keep frozen PMLE wording exact; remove ML-only role wording for other certs."""
    if cert_id in (None, "machine-learning-engineer", "GCP_PM_ML_ENG"):
        return text
    return (text.replace("an ML engineer", "the practitioner")
            .replace("An ML engineer", "The practitioner")
            .replace("ML engineering decision", "engineering decision")
            .replace("a PMLE decision", "an engineering decision"))


def practitioner_signature(signature, cert_id=None):
    text = practitioner_text(signature.instructions, cert_id)
    if text == signature.instructions:
        return signature
    selected = signature.with_instructions(text)
    selected.__name__ = signature.__name__
    return selected


# Aggregate authoring guidance only. No external sample or dump text is included.
PDE_STYLE_RULES = """Rules v5.2 — Professional Data Engineer learner style:
Keep every existing decision, knowledge-dependent distractor, option-balance,
distinct-approach, evidence and independent solver guard. The rules below override
only conflicting ML-specific wording and S4/S5/S6/S11 presentation defaults.
Test a data engineering decision in a concrete business setting, with a natural
human-subject opening. Use plain narrative with at most two wants or policies.
Stem: aim for about 60 words. About 20% of a batch may be shorter, 30–50 words.
The inclusive mechanical stem range is 30–85 words; never exceed 85 words.
Options: aim for 15–22 words each, with comparable detail in distinct actions.
Do not pad options to reach that target or restate the business goal in options.
The existing balance and shared-prefix guards still apply; the option target is
not a new hard per-option word limit. Use exactly four single-answer choices;
never request choose-two or other multi-select answers.
Use What should you do? for about 85% of a batch; other natural decision lines
are allowed. This percentage is a batch authoring target, not an item gate.
Use the product names in the selected current data-engineer exam guide, including
Dataproc and Cloud Composer rather than renamed Managed Service brand aliases.
Name the service in product-specific actions, including SQL actions. A service may
be inferred for the product cap only from an unambiguous single-product context;
missing or ambiguous attribution blocks the cap rather than guessing a service.
Guide naming overrides the ML-specific Agent Platform naming instructions.
Keep official evidence quotes and URLs byte-exact; normalize learner prose only.
Describe observable symptoms, existing infrastructure and constraints, not the
root-cause diagnosis or the mechanism the best action uses. Reject a stem that
supplies that diagnosis or remediation mechanism, even if the action still sounds
technical. Solving must require data/product knowledge to infer the cause or
suitable action. Naming an existing product or infrastructure is not itself a
failure. Options must not repeat the goal as a substitute for a concrete action.
"""

PDE_STYLE_INSTRUCTIONS = (
    "Testero data engineering writing style. Aggregate guidance only; no examples.\n"
    + PDE_STYLE_RULES
    + "\n" + STYLE_RULES
    + "\nThe PDE v5.2 overrides above take precedence where presentation rules conflict."
)


# Additive policy only: the 5.2 constants above remain frozen for old requests.
PDE_FILLER_STYLE_ADDITIONS = """Rules v5.3 — no generic non-solution distractors:
Keep every v5.2 guard. Each choice must address the scenario's actual engineering
problem through a plausible mechanism, even when it loses on a documented trade-off.
Reject stock actions that do not address that problem; a real command or service
name alone does not make an option a useful alternative. Do not pad with generic
restarts, retries, more resources or unrelated query changes without a credible
scenario-specific mechanism. Evaluate the action in context, not by keyword.
For example, adding LIMIT to reduce returned rows is filler when the problem is
bytes scanned by a non-clustered BigQuery query or a join multiplying intermediate
rows: limiting final results does not repair those mechanisms. Do not blacklist
LIMIT: it can be a legitimate alternative for returned-row volume, top-N output,
or a documented access pattern where early termination can reduce work. Keep all
evidence and independent gates; plausibility never makes an incorrect key valid.
"""
PDE_FILLER_STYLE_RULES = PDE_STYLE_RULES + "\n" + PDE_FILLER_STYLE_ADDITIONS
PDE_FILLER_STYLE_INSTRUCTIONS = (
    PDE_STYLE_INSTRUCTIONS + "\n" + PDE_FILLER_STYLE_ADDITIONS
)
