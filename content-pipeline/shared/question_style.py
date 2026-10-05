"""Founder-owned authoring rules and original style exemplars, not answer evidence."""

PRE_REPAIR_O3 = 'O3 Wrong options are real approaches a competent engineer might plausibly try. Each fails a\nstated want (cost/upkeep/latency/policy/downtime) because of a Google Cloud/ML fact not given as\nan explicit contradiction in the stem. No distractor can be eliminated using stem text alone;\nanswering must require product/domain knowledge. Never invented/broken config.'
KNOWLEDGE_O3 = 'O3 Wrong options are real approaches a competent engineer might plausibly try. A stated want\nmay distinguish the key: each distractor can fail that want for a documented Google Cloud/ML\nreason the reader must know. Do not fail this check merely because the want is in the stem.\nFail when a literal stem fact or prohibition rules an option out: a batch option for an\nexplicit online endpoint, an approach company policy bans, or prompt design when the stem\nexplicitly requires adaptation through supervised learning. A hand-written server can be a\nvalid distractor for minimal maintenance when rejecting it requires knowing that custom\nprediction routines provide the server. Do not put that capability or a ban on hand-written\nservers into the stem. Multiple distractors may fail the same want for different documented\nreasons; do not add a third want just to give each a different failure. Never invented/broken\nconfig.'

STYLE_RULES = """S1 Purpose first: the opening must name the business application or a concrete ML task,
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
