/**
 * PMLE Blueprint Domain Weights Configuration
 * 
 * This configuration defines the domain weights for the Professional Machine Learning Engineer (PMLE) exam.
 * These weights are used to compute per-exam question counts for domain-balanced diagnostics.
 * 
 * Usage:
 * - For a diagnostic with N total questions, each domain gets approximately (weight * N) questions
 * - The selection algorithm rounds these targets and balances remainders to ensure exactly N questions
 * - Domains with insufficient questions will have their targets capped, and remaining slots redistributed
 * 
 * IMPORTANT: This is a temporary in-code config. In a future iteration, this should be moved to a 
 * DB-driven blueprint editor to allow non-developers to update weights without code changes.
 * 
 * TODO: Verify these weights match the official Google PMLE exam blueprint percentages.
 * Current weights are estimated based on available question distribution and should be validated
 * against the official exam guide.
 */

export interface PmleDomainConfig {
  /** Domain code matching exam_domains.code exactly */
  domainCode: string;
  /** Human-readable display name for the domain */
  displayName: string;
  /** Weight (0-1) representing approximate percentage of exam questions from this domain */
  weight: number;
}

/**
 * PMLE Blueprint Configuration
 * 
 * Weights should sum to approximately 1.0 (allowing for rounding).
 * These represent the approximate distribution of questions across domains in the PMLE exam.
 */
export const PMLE_BLUEPRINT: PmleDomainConfig[] = [
  {
    domainCode: "ONLINE_AND_BATCH_PREDICTION_DEPLOYMENT",
    displayName: "Online and batch prediction deployment",
    weight: 0.08, // ~8% - High importance for production ML
  },
  {
    domainCode: "CUSTOM_TRAINING_WITH_DIFFERENT_ML_FRAMEWORKS",
    displayName: "Custom training with different ML frameworks",
    weight: 0.08, // ~8% - Core ML engineering skill
  },
  {
    domainCode: "BIGQUERY_ML_FOR_CLASSIFICATION_AND_REGRESSION",
    displayName: "BigQuery ML for classification and regression",
    weight: 0.06, // ~6% - Important GCP-specific tool
  },
  {
    domainCode: "AUTOML_FOR_TABULAR_TEXT_AND_IMAGE_DATA",
    displayName: "AutoML for tabular, text, and image data",
    weight: 0.06, // ~6% - AutoML is a key PMLE topic
  },
  {
    domainCode: "VERTEX_AI_PIPELINES_AND_KUBEFLOW_ORCHESTRATION",
    displayName: "Vertex AI Pipelines and Kubeflow orchestration",
    weight: 0.06, // ~6% - ML pipeline orchestration
  },
  {
    domainCode: "DATA_PREPROCESSING_WITH_DATAFLOW_AND_TFX",
    displayName: "Data preprocessing with Dataflow and TFX",
    weight: 0.05, // ~5% - Data engineering for ML
  },
  {
    domainCode: "DISTRIBUTED_TRAINING_WITH_TPUS_AND_GPUS",
    displayName: "Distributed training with TPUs and GPUs",
    weight: 0.05, // ~5% - Training at scale
  },
  {
    domainCode: "HYPERPARAMETER_TUNING_STRATEGIES",
    displayName: "Hyperparameter tuning strategies",
    weight: 0.05, // ~5% - Model optimization
  },
  {
    domainCode: "ML_APIS_AND_MODEL_GARDEN_APPLICATIONS",
    displayName: "ML APIs and Model Garden applications",
    weight: 0.05, // ~5% - Pre-built ML solutions
  },
  {
    domainCode: "VERTEX_AI_FEATURE_STORE_MANAGEMENT",
    displayName: "Vertex AI Feature Store management",
    weight: 0.05, // ~5% - Feature engineering and management
  },
  {
    domainCode: "VERTEX_AI_WORKBENCH_AND_JUPYTER_ENVIRONMENTS",
    displayName: "Vertex AI Workbench and Jupyter environments",
    weight: 0.05, // ~5% - Development environments
  },
  {
    domainCode: "AUTOMATED_MODEL_RETRAINING_STRATEGIES",
    displayName: "Automated model retraining strategies",
    weight: 0.04, // ~4% - MLOps automation
  },
  {
    domainCode: "CICD_FOR_ML_WITH_CLOUD_BUILD",
    displayName: "CI/CD for ML with Cloud Build",
    weight: 0.04, // ~4% - ML DevOps
  },
  {
    domainCode: "MODEL_MONITORING_AND_DRIFT_DETECTION",
    displayName: "Model monitoring and drift detection",
    weight: 0.04, // ~4% - Production monitoring
  },
  {
    domainCode: "MODEL_VERSIONING_AND_AB_TESTING",
    displayName: "Model versioning and A/B testing",
    weight: 0.04, // ~4% - Model management
  },
  {
    domainCode: "RESPONSIBLE_AI_AND_BIAS_DETECTION",
    displayName: "Responsible AI and bias detection",
    weight: 0.04, // ~4% - Ethics and fairness
  },
  {
    domainCode: "SCALING_SERVING_INFRASTRUCTURE_AND_HARDWARE_SELECTION",
    displayName: "Scaling serving infrastructure and hardware selection",
    weight: 0.04, // ~4% - Infrastructure scaling
  },
  {
    domainCode: "FINE_TUNING_FOUNDATIONAL_MODELS",
    displayName: "Fine-tuning foundational models",
    weight: 0.03, // ~3% - LLM/GenAI focus
  },
  {
    domainCode: "ML_EXPERIMENTS_TRACKING_WITH_VERTEX_AI_EXPERIMENTS",
    displayName: "ML experiments tracking with Vertex AI Experiments",
    weight: 0.03, // ~3% - Experimentation
  },
  {
    domainCode: "RETRIEVAL_AUGMENTED_GENERATION_RAG_WITH_VERTEX_AI_AGENT_BUILDER",
    displayName: "Retrieval Augmented Generation (RAG) with Vertex AI Agent Builder",
    weight: 0.03, // ~3% - GenAI applications
  },
  {
    domainCode: "EXPLAINABLE_AI_AND_MODEL_INTERPRETABILITY",
    displayName: "Explainable AI and model interpretability",
    weight: 0.02, // ~2% - Model explainability
  },
  {
    domainCode: "ML_METADATA_TRACKING_AND_LINEAGE",
    displayName: "ML metadata tracking and lineage",
    weight: 0.02, // ~2% - Metadata management
  },
  {
    domainCode: "MODEL_OPTIMIZATION_FOR_PRODUCTION",
    displayName: "Model optimization for production",
    weight: 0.02, // ~2% - Performance optimization
  },
];

/**
 * Map of domain codes to their configuration for quick lookups
 */
export const PMLE_BLUEPRINT_MAP: Record<string, PmleDomainConfig> = 
  PMLE_BLUEPRINT.reduce((acc, config) => {
    acc[config.domainCode] = config;
    return acc;
  }, {} as Record<string, PmleDomainConfig>);

/**
 * Get domain config by code
 */
export function getPmleDomainConfig(domainCode: string): PmleDomainConfig | undefined {
  return PMLE_BLUEPRINT_MAP[domainCode];
}

/**
 * Validate that blueprint weights sum to approximately 1.0
 * (allowing for small rounding differences)
 */
export function validateBlueprintWeights(): boolean {
  const totalWeight = PMLE_BLUEPRINT.reduce((sum, config) => sum + config.weight, 0);
  // Allow 5% tolerance for rounding
  return Math.abs(totalWeight - 1.0) < 0.05;
}

