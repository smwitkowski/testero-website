# Sample MCP tool transcript

Recorded with the MCP client SDK against a local ephemeral HTTP server.
The opaque question token is redacted. Option order changes on every call.

```text
listTools()
[
  "pmle_exam_overview",
  "get_practice_question",
  "check_answer"
]

get_practice_question({"domain":"6"})
{
  "question_token": "<opaque token from preceding call>",
  "domain": "Monitoring AI solutions",
  "stem": "You are assessing answer quality for a retailer's customer-support agent as its running deployment migrates to Agent Platform. The agent uses a fully managed Gemini model, Cloud Trace is enabled, and the telemetry needed for evaluation is already being exported. Customer traffic varies sharply during promotions. You want ongoing quality scores from live conversations while keeping evaluation workload bounded as traffic grows. What should you do?",
  "options": [
    {
      "label": "A",
      "text": "Create an Online Monitor with response-quality metrics. Filter live traces by conversation duration, and rely on that filter to bound evaluation workload as customer traffic grows."
    },
    {
      "label": "B",
      "text": "Run an offline evaluation with response-quality metrics on a fixed selection of historical conversations captured during migration. Use the resulting report to track production quality."
    },
    {
      "label": "C",
      "text": "Use the model observability dashboard to monitor the managed Gemini model. Track API error rates, first-token latency, and token throughput as indicators of answer quality."
    },
    {
      "label": "D",
      "text": "Create an Online Monitor with response-quality metrics. Sample live traces and set a maximum number of samples per run to bound the evaluation workload."
    }
  ]
}

User: A
check_answer({"question_token":"<opaque token from preceding call>","choice":"A"})
{
  "correct": false,
  "chosen_option": {
    "label": "A",
    "text": "Create an Online Monitor with response-quality metrics. Filter live traces by conversation duration, and rely on that filter to bound evaluation workload as customer traffic grows.",
    "explanation": "This fails the requirement to keep evaluation workload bounded as traffic grows. Agent Platform duration filters determine which traces qualify for evaluation, but they do not impose a maximum sample count. Online Monitors provide a maximum-samples-per-run cap to control evaluation volume.",
    "doc_url": "https://docs.cloud.google.com/gemini-enterprise-agent-platform/optimize/evaluation/evaluate-online",
    "doc_quote": "Filters: Enter criteria to target specific traffic. You can filter by properties such as Duration (for example, Duration > 2) or Token usage."
  },
  "correct_option": {
    "label": "D",
    "text": "Create an Online Monitor with response-quality metrics. Sample live traces and set a maximum number of samples per run to bound the evaluation workload.",
    "explanation": "The agent needs continuous quality assessment of live conversations and a bounded evaluation workload. Agent Platform Online Monitors asynchronously score sampled production traces using configured evaluation metrics. A maximum sample count per run caps evaluation volume as traffic grows. The model observability dashboard measures operational performance, offline evaluation assesses selected historical interactions, and duration filters select matching traces rather than cap their number.",
    "doc_url": "https://docs.cloud.google.com/gemini-enterprise-agent-platform/optimize/evaluation/evaluate-online",
    "doc_quote": "Configure Metrics: Add the metrics you want to track continuously, such as Safety. Set Sampling: Sampling percentage: Define what percentage of your live traffic should be evaluated. Max samples per run: Set a cap to manage evaluation costs."
  },
  "diagnostic": "Get a full readiness diagnostic at https://testero.ai/diagnostic"
}
```
