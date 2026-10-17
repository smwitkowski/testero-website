export const mappingSource = "https://docs.cloud.google.com/gemini-enterprise-agent-platform/vertex-ai-name-changes";
export const mappingChecked = "2026-10-17";
// Only mappings already published in the name-mapping article, rechecked against Google's table.
export const nameMappings = [
  {
    "old": "Vertex AI Platform",
    "new": "Gemini Enterprise Agent Platform",
    "purpose": "Build, train and manage ML models."
  },
  {
    "old": "Vertex AI API",
    "new": "Gemini Enterprise Agent Platform API",
    "purpose": "API surface; this is a naming reference, not an endpoint migration guide."
  },
  {
    "old": "Vertex AI Model Garden",
    "new": "Gemini Enterprise Agent Platform Model Garden",
    "purpose": "Find and select a model for a task."
  },
  {
    "old": "Vertex AI Training",
    "new": "Gemini Enterprise Agent Platform Managed Training",
    "purpose": "Run managed model training."
  },
  {
    "old": "Vertex AI Serverless Training",
    "new": "Gemini Enterprise Agent Platform Serverless Training",
    "purpose": "Use managed compute for distributed training."
  },
  {
    "old": "Vertex AI Pipelines",
    "new": "Gemini Enterprise Agent Platform Pipelines",
    "purpose": "Build and orchestrate ML workflows."
  },
  {
    "old": "Vertex AI Workbench",
    "new": "Gemini Enterprise Agent Platform Workbench",
    "purpose": "Prototype models in notebooks."
  },
  {
    "old": "Vertex AI Feature Store",
    "new": "Feature Store on Gemini Enterprise Agent Platform",
    "purpose": "Manage and serve model features."
  },
  {
    "old": "Vertex AI Model Registry",
    "new": "Model Registry on Gemini Enterprise Agent Platform",
    "purpose": "Organize and version models."
  },
  {
    "old": "Vertex AI Model Evaluation",
    "new": "Model Evaluation on Gemini Enterprise Agent Platform",
    "purpose": "Evaluate model quality."
  },
  {
    "old": "Vertex AI Experiments",
    "new": "Experiments on Agent Platform",
    "purpose": "Track and compare experiments, artifacts and versions."
  },
  {
    "old": "Vertex AI Model Monitoring",
    "new": "Model Monitoring on Gemini Enterprise Agent Platform",
    "purpose": "Monitor production models and data drift."
  },
  {
    "old": "Vertex AI AutoML (Vision/Video/Tables)",
    "new": "AutoML on Gemini Enterprise Agent Platform",
    "purpose": "Develop models with low-code tools; check current support before use."
  },
  {
    "old": "Vertex AI Batch Inference",
    "new": "Gemini Enterprise Agent Platform Batch Inference",
    "purpose": "Run batch model inference."
  },
  {
    "old": "Vertex AI Online Inference",
    "new": "Gemini Enterprise Agent Platform Online Inference",
    "purpose": "Serve online model inference."
  }
] as const;

// TODO: enable an email action only after the conversion sender supports this resource.
// The printable page is available without email or a signup.
export const CHEAT_SHEET_EMAIL_ENABLED = false;
