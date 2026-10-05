"""Founder-owned authoring rules and original style exemplars, not answer evidence."""

STYLE_RULES = """S1 Business first: open with who you are and what the ML system does for the business, in 1–2
sentences.
S2 Facts as story: describe what exists and what happened in plain narrative. A numbered list
only for existing workflow steps, never requirements.
S3 Constraints as wants or policies: 1–2 decisive constraints phrased "You want to … while
minimizing …" or "Company policy does not allow …". Never "must satisfy the following
requirements" or "Stakeholders have established".
S4 End "What should you do?"; another question only if naturally better e.g. "How should you
reconfigure the architecture?". Never name settings/config files in it.
S5 50–110 words; one paragraph, two at most. The mechanical acceptance range is 40–130 words.
S6 Plain register/goals in plain language. Product names only as needed, current short names
Agent Platform Pipelines, Agent Platform Workbench. Full "Gemini Enterprise Agent Platform" at
most once. No setting names, enum values, file formats or code in stem.
S7 Vary moment: max half fresh design, rest running situations: recent deployment, monitoring,
migration, cost/latency reduction, security incident. Planner rotates hints and records them in
the artifact. This is a batch rule, not a single-item count.
S8 Never documentation in stem: "documented", "documentation", "supported specifications", "per
best practices".
O1 Imperative, parallel practitioner actions similar length. One/two sentences or 2–3 short
numbered steps.
O2 Decisions not syntax: differ approach/service/sequence. Setting names/values only if
objective literally config, then described choices.
O3 Wrong options real approaches fail one stated want (cost/upkeep/latency/policy/downtime);
never invented/broken config."""

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
      "fetched docs remain the only factual authority. Do not copy these scenarios into generated content. "
      "A necessary business interface such as CSV rows in exemplar 5 is context, not a settings/syntax quiz.\n"
    + "\n\n".join(f"Exemplar {index}: {stem}" for index, stem in enumerate(FOUNDER_EXEMPLARS, 1))
)
