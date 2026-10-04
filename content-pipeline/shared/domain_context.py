"""Domain context mappings for PMLE question generation.

This module provides domain-specific context (services, topics, guidance) 
for generating PMLE questions aligned with the official exam guide.
"""

from typing import Dict, Any, List

# PMLE domain context based on official exam guide
# Exam weights: Section 1 (~13%), Section 2 (~14%), Section 3 (~18%), 
# Section 4 (~20%), Section 5 (~22%), Section 6 (~13%)
PMLE_DOMAIN_CONTEXT: Dict[str, Dict[str, Any]] = {
    "ARCHITECTING_LOW_CODE_ML_SOLUTIONS": {
        "display_name": "Architecting Low-Code AI Solutions",
        "exam_weight": 13,
        "subsections": {
            "1.1": {
                "title": "Developing ML models by using BigQuery ML",
                "services": ["BigQuery ML"],
                "considerations": [
                    "Building the appropriate BigQuery ML model (e.g., linear and binary classification, regression, time-series, matrix factorization, boosted trees, autoencoders) based on the business problem",
                    "Feature engineering or selection by using BigQuery ML",
                    "Generating predictions by using BigQuery ML"
                ]
            },
            "1.2": {
                "title": "Building AI solutions by using ML APIs or foundation models",
                "services": ["Model Garden", "Document AI API", "Retail API", "Vertex AI Agent Builder"],
                "considerations": [
                    "Building applications by using ML APIs from Model Garden",
                    "Building applications by using industry-specific APIs (e.g., Document AI API, Retail API)",
                    "Implementing retrieval augmented generation (RAG) applications by using Vertex AI Agent Builder"
                ]
            },
            "1.3": {
                "title": "Training models by using AutoML",
                "services": ["AutoML Tables", "AutoML Vision", "AutoML Text", "AutoML Video", "Tabular Workflows"],
                "considerations": [
                    "Preparing data for AutoML (e.g., feature selection, data labeling, Tabular Workflows on AutoML)",
                    "Using available data (e.g., tabular, text, speech, images, videos) to train custom models",
                    "Using AutoML for tabular data",
                    "Creating forecasting models by using AutoML",
                    "Configuring and debugging trained models"
                ]
            }
        },
        "services": [
            "BigQuery ML",
            "AutoML Tables",
            "AutoML Vision",
            "AutoML Text",
            "AutoML Video",
            "Tabular Workflows",
            "ML APIs",
            "Model Garden",
            "Vertex AI Agent Builder",
            "Vertex AI Search",
            "Document AI API",
            "Retail API",
        ],
        "topics": [
            "BigQuery ML model types (linear, binary classification, regression, time-series, matrix factorization, boosted trees, autoencoders)",
            "Feature engineering with BigQuery ML",
            "Generating predictions with BigQuery ML",
            "ML APIs from Model Garden",
            "Industry-specific APIs (Document AI, Retail API)",
            "Retrieval Augmented Generation (RAG) with Vertex AI Agent Builder",
            "AutoML data preparation (feature selection, data labeling, Tabular Workflows)",
            "AutoML for tabular, text, speech, image, and video data",
            "AutoML forecasting models",
            "Configuring and debugging AutoML models",
            "Low-code/no-code ML solutions",
        ],
        "guidance": (
            "Focus on low-code and no-code approaches to ML. Questions should test "
            "understanding of when to use BigQuery ML vs AutoML vs pre-trained APIs. "
            "Include scenarios about choosing between different BigQuery ML model types "
            "(time-series, matrix factorization, boosted trees, autoencoders) based on business problems. "
            "Test knowledge of industry-specific APIs (Document AI, Retail API) and RAG applications. "
            "Cover AutoML Tabular Workflows, forecasting models, and model configuration/debugging. "
            "Emphasize practical decision-making for business scenarios where ML expertise may be limited."
        ),
    },
    "COLLABORATING_TO_MANAGE_DATA_AND_MODELS": {
        "display_name": "Collaborating within and across teams to manage data and models",
        "exam_weight": 14,
        "subsections": {
            "2.1": {
                "title": "Exploring and preprocessing organization-wide data",
                "services": ["Cloud Storage", "BigQuery", "Spanner", "Cloud SQL", "Apache Spark", "Apache Hadoop", "Dataflow", "TensorFlow Extended (TFX)", "Vertex AI Feature Store"],
                "considerations": [
                    "Organizing different types of data (e.g., tabular, text, speech, images, videos) for efficient training",
                    "Managing datasets in Vertex AI",
                    "Data preprocessing (e.g., Dataflow, TensorFlow Extended [TFX], BigQuery)",
                    "Creating and consolidating features in Vertex AI Feature Store",
                    "Privacy implications of data usage and/or collection (e.g., handling sensitive data such as personally identifiable information [PII] and protected health information [PHI])",
                    "Ingesting different data sources (e.g., text documents) into Vertex AI for inference"
                ]
            },
            "2.2": {
                "title": "Model prototyping using Jupyter notebooks",
                "services": ["Vertex AI Workbench", "Colab Enterprise", "Dataproc", "Model Garden"],
                "considerations": [
                    "Choosing the appropriate Jupyter backend on Google Cloud (e.g., Vertex AI Workbench, Colab Enterprise, notebooks on Dataproc)",
                    "Applying security best practices in Vertex AI Workbench",
                    "Using Spark kernels",
                    "Integrating code source repositories",
                    "Developing models in Vertex AI Workbench by using common frameworks (e.g., TensorFlow, PyTorch, sklearn, Spark, JAX)",
                    "Leveraging a variety of foundation and open-source models in Model Garden"
                ]
            },
            "2.3": {
                "title": "Tracking and running ML experiments",
                "services": ["Vertex AI Experiments", "Kubeflow Pipelines", "Vertex AI TensorBoard"],
                "considerations": [
                    "Choosing the appropriate Google Cloud environment for development and experimentation (e.g., Vertex AI Experiments, Kubeflow Pipelines, Vertex AI TensorBoard with TensorFlow and PyTorch) given the framework",
                    "Evaluating generative AI solutions"
                ]
            }
        },
        "services": [
            "Vertex AI Feature Store",
            "Vertex AI Workbench",
            "Vertex AI Experiments",
            "Vertex AI TensorBoard",
            "Dataflow",
            "TensorFlow Extended (TFX)",
            "Cloud Storage",
            "BigQuery",
            "Spanner",
            "Cloud SQL",
            "Apache Spark",
            "Apache Hadoop",
            "Colab Enterprise",
            "Dataproc",
            "Model Garden",
        ],
        "topics": [
            "Organizing data types (tabular, text, speech, images, videos) for training",
            "Managing datasets in Vertex AI",
            "Data preprocessing pipelines (Dataflow, TFX, BigQuery)",
            "Feature store management and consolidation",
            "Privacy implications and handling sensitive data (PII, PHI)",
            "Ingesting data sources into Vertex AI for inference",
            "Jupyter notebook backends (Vertex AI Workbench, Colab Enterprise, Dataproc)",
            "Security best practices in Vertex AI Workbench",
            "Spark kernels",
            "Code source repository integration",
            "ML frameworks (TensorFlow, PyTorch, sklearn, Spark, JAX)",
            "Foundation and open-source models in Model Garden",
            "ML experiment tracking (Vertex AI Experiments, Kubeflow Pipelines)",
            "Vertex AI TensorBoard with TensorFlow and PyTorch",
            "Evaluating generative AI solutions",
            "Collaborative development environments",
            "Data versioning and lineage",
            "Cross-team feature sharing",
        ],
        "guidance": (
            "Focus on collaboration and data/model management workflows. Questions should "
            "test understanding of Vertex AI Feature Store for sharing features across teams, "
            "experiment tracking for reproducibility, and collaborative development setups. "
            "Include scenarios about managing data pipelines, versioning, and enabling "
            "multiple teams to work together effectively. Test knowledge of privacy considerations "
            "for PII/PHI, choosing appropriate Jupyter backends, security best practices, "
            "Spark kernels, code repository integration, and framework selection (including JAX). "
            "Cover evaluation of generative AI solutions and TensorBoard integration."
        ),
    },
    "SCALING_PROTOTYPES_INTO_ML_MODELS": {
        "display_name": "Scaling prototypes into ML models",
        "exam_weight": 18,
        "subsections": {
            "3.1": {
                "title": "Building models",
                "services": ["Vertex AI", "Model Garden"],
                "considerations": [
                    "Choosing ML framework and model architecture",
                    "Modeling techniques given interpretability requirements"
                ]
            },
            "3.2": {
                "title": "Training models",
                "services": ["Cloud Storage", "BigQuery", "Vertex AI Custom Training", "Kubeflow on GKE", "AutoML", "Tabular Workflows", "Model Garden"],
                "considerations": [
                    "Organizing training data (e.g., tabular, text, speech, images, videos) on Google Cloud (e.g., Cloud Storage, BigQuery)",
                    "Ingestion of various file types (e.g., CSV, JSON, images, Hadoop, databases) into training",
                    "Training using different SDKs (e.g., Vertex AI custom training, Kubeflow on Google Kubernetes Engine, AutoML, tabular workflows)",
                    "Using distributed training to organize reliable pipelines",
                    "Hyperparameter tuning",
                    "Troubleshooting ML model training failures",
                    "Fine-tuning foundation models (e.g., Vertex AI, Model Garden)"
                ]
            },
            "3.3": {
                "title": "Choosing appropriate hardware for training",
                "services": ["Cloud TPU", "Cloud GPU", "Reduction Server", "Horovod"],
                "considerations": [
                    "Evaluation of compute and accelerator options (e.g., CPU, GPU, TPU, edge devices)",
                    "Distributed training with TPUs and GPUs (e.g., Reduction Server on Vertex AI, Horovod)"
                ]
            }
        },
        "services": [
            "Vertex AI Custom Training",
            "Vertex AI Training",
            "Cloud TPU",
            "Cloud GPU",
            "Vertex AI Hyperparameter Tuning",
            "Vertex AI Model Registry",
            "Kubeflow on GKE",
            "Reduction Server",
            "Horovod",
            "Cloud Storage",
            "BigQuery",
            "AutoML",
            "Tabular Workflows",
            "Model Garden",
        ],
        "topics": [
            "ML framework and model architecture selection",
            "Modeling techniques for interpretability requirements",
            "Organizing training data (tabular, text, speech, images, videos) on Cloud Storage and BigQuery",
            "Ingesting file types (CSV, JSON, images, Hadoop, databases) into training",
            "Training SDKs (Vertex AI custom training, Kubeflow on GKE, AutoML, tabular workflows)",
            "Distributed training for reliable pipelines",
            "Hyperparameter tuning strategies",
            "Troubleshooting ML model training failures",
            "Fine-tuning foundation models (Vertex AI, Model Garden)",
            "Hardware selection (CPU, GPU, TPU, edge devices)",
            "Distributed training with TPUs and GPUs (Reduction Server, Horovod)",
            "Training infrastructure scaling",
        ],
        "guidance": (
            "Focus on moving from prototypes to production-ready models. Questions should "
            "test understanding of custom training options, distributed training strategies, "
            "and hyperparameter optimization. Include scenarios about choosing training "
            "infrastructure (TPU vs GPU vs CPU), optimizing training performance, and scaling "
            "training workloads. Test knowledge of interpretability requirements, troubleshooting "
            "training failures, fine-tuning foundation models, and distributed training approaches "
            "(Reduction Server, Horovod). Cover data organization and ingestion of various file types. "
            "Emphasize practical considerations for production ML."
        ),
    },
    "SERVING_AND_SCALING_MODELS": {
        "display_name": "Serving and scaling models",
        "exam_weight": 20,
        "subsections": {
            "4.1": {
                "title": "Serving models",
                "services": ["Vertex AI", "Dataflow", "BigQuery ML", "Dataproc", "Vertex AI Model Registry"],
                "considerations": [
                    "Batch and online inference (e.g., Vertex AI, Dataflow, BigQuery ML, Dataproc)",
                    "Using different frameworks (e.g., PyTorch, XGBoost) to serve models",
                    "Organizing a model registry",
                    "A/B testing different versions of a model"
                ]
            },
            "4.2": {
                "title": "Scaling online model serving",
                "services": ["Vertex AI Feature Store", "Vertex AI public endpoints", "Vertex AI private endpoints"],
                "considerations": [
                    "Vertex AI Feature Store",
                    "Vertex AI public and private endpoints",
                    "Choosing appropriate hardware (e.g., CPU, GPU, TPU, edge)",
                    "Scaling the serving backend based on the throughput (e.g., Vertex AI Prediction, containerized serving)",
                    "Tuning ML models for training and serving in production (e.g., simplification techniques, optimizing the ML solution for increased performance, latency, memory, throughput)"
                ]
            }
        },
        "services": [
            "Vertex AI Endpoints",
            "Vertex AI public endpoints",
            "Vertex AI private endpoints",
            "Vertex AI Batch Prediction",
            "Vertex AI Feature Store",
            "Dataflow",
            "BigQuery ML",
            "Dataproc",
            "Cloud Run",
            "Google Kubernetes Engine",
            "Vertex AI Model Registry",
            "Cloud Load Balancing",
        ],
        "topics": [
            "Batch and online inference (Vertex AI, Dataflow, BigQuery ML, Dataproc)",
            "Serving frameworks (PyTorch, XGBoost)",
            "Model registry organization",
            "A/B testing model versions",
            "Vertex AI Feature Store for serving",
            "Public vs private endpoints",
            "Hardware selection for inference (CPU, GPU, TPU, edge)",
            "Scaling serving backend based on throughput",
            "Model optimization techniques (simplification, performance, latency, memory, throughput)",
            "Containerized serving",
            "Model versioning",
            "Serving infrastructure scaling",
        ],
        "guidance": (
            "Focus on deploying and scaling models in production. Questions should test "
            "understanding of online vs batch prediction, model versioning, A/B testing, "
            "and infrastructure scaling. Include scenarios about choosing deployment options "
            "(Vertex AI, Dataflow, BigQuery ML, Dataproc), selecting appropriate hardware, "
            "and optimizing inference performance. Test knowledge of serving frameworks (PyTorch, XGBoost), "
            "public vs private endpoints, Feature Store integration, and model optimization techniques "
            "(simplification, latency, memory, throughput). Emphasize production considerations like "
            "latency, throughput, reliability, and cost optimization."
        ),
    },
    "AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES": {
        "display_name": "Automating and orchestrating ML pipelines",
        "exam_weight": 22,
        "subsections": {
            "5.1": {
                "title": "Developing end-to-end ML pipelines",
                "services": ["Vertex AI Pipelines", "Kubeflow Pipelines", "Cloud Composer", "Cloud Build", "Cloud Run", "MLFlow", "TensorFlow Extended (TFX)", "Dataflow"],
                "considerations": [
                    "Data and model validation",
                    "Ensuring consistent data pre-processing between training and serving",
                    "Hosting third-party pipelines on Google Cloud (e.g., MLFlow)",
                    "Identifying components, parameters, triggers, and compute needs (e.g., Cloud Build, Cloud Run)",
                    "Orchestration framework (e.g., Kubeflow Pipelines, Vertex AI Pipelines, Cloud Composer)",
                    "Hybrid or multicloud strategies",
                    "System design with TFX components or Kubeflow DSL (e.g., Dataflow)"
                ]
            },
            "5.2": {
                "title": "Automating model retraining",
                "services": ["Cloud Build", "Jenkins", "Vertex AI Pipelines"],
                "considerations": [
                    "Determining an appropriate retraining policy",
                    "Continuous integration and continuous delivery (CI/CD) model deployment (e.g., Cloud Build, Jenkins)"
                ]
            },
            "5.3": {
                "title": "Tracking and auditing metadata",
                "services": ["Vertex AI Experiments", "Vertex ML Metadata"],
                "considerations": [
                    "Tracking and comparing model artifacts and versions (e.g., Vertex AI Experiments, Vertex ML Metadata)",
                    "Hooking into model and dataset versioning",
                    "Model and data lineage"
                ]
            }
        },
        "services": [
            "Vertex AI Pipelines",
            "Kubeflow Pipelines",
            "Cloud Build",
            "Cloud Composer",
            "Cloud Run",
            "Cloud Functions",
            "Pub/Sub",
            "Vertex AI Metadata",
            "Vertex ML Metadata",
            "MLFlow",
            "TensorFlow Extended (TFX)",
            "Dataflow",
            "Jenkins",
        ],
        "topics": [
            "Data and model validation",
            "Consistent data pre-processing between training and serving",
            "Third-party pipeline hosting (MLFlow)",
            "Pipeline components, parameters, triggers, and compute needs",
            "Orchestration frameworks (Kubeflow Pipelines, Vertex AI Pipelines, Cloud Composer)",
            "Hybrid and multicloud strategies",
            "TFX components and Kubeflow DSL",
            "Automated model retraining policies",
            "CI/CD for ML (Cloud Build, Jenkins)",
            "Model and dataset versioning",
            "Model and data lineage",
            "Tracking model artifacts and versions",
            "ML metadata tracking",
            "Pipeline scheduling and triggers",
            "MLOps best practices",
        ],
        "guidance": (
            "Focus on automating ML workflows and pipeline orchestration. Questions should "
            "test understanding of Vertex AI Pipelines, CI/CD for ML, automated retraining, "
            "and metadata tracking. Include scenarios about designing end-to-end ML pipelines, "
            "setting up automation, and managing ML lifecycle. Test knowledge of data/model validation, "
            "consistent preprocessing, third-party pipelines (MLFlow), hybrid/multicloud strategies, "
            "TFX components, Kubeflow DSL, retraining policies, CI/CD tools (Cloud Build, Jenkins), "
            "and comprehensive metadata tracking including lineage. Emphasize MLOps practices and "
            "operational excellence."
        ),
    },
    "MONITORING_ML_SOLUTIONS": {
        "display_name": "Monitoring AI solutions",
        "exam_weight": 13,
        "subsections": {
            "6.1": {
                "title": "Identifying risks to AI solutions",
                "services": ["Vertex AI", "Vertex AI Prediction"],
                "considerations": [
                    "Building secure AI systems by protecting against unintentional exploitation of data or models (e.g., hacking)",
                    "Aligning with Google's Responsible AI practices (e.g., monitoring for bias)",
                    "Assessing AI solution readiness (e.g., fairness, bias)",
                    "Model explainability on Vertex AI (e.g., Vertex AI Prediction)"
                ]
            },
            "6.2": {
                "title": "Monitoring, testing, and troubleshooting AI solutions",
                "services": ["Vertex AI Model Monitoring", "Explainable AI"],
                "considerations": [
                    "Establishing continuous evaluation metrics (e.g., Vertex AI Model Monitoring, Explainable AI)",
                    "Monitoring for training-serving skew",
                    "Monitoring for feature attribution drift",
                    "Monitoring model performance against baselines, simpler models, and across the time dimension",
                    "Monitoring for common training and serving errors"
                ]
            }
        },
        "services": [
            "Vertex AI Model Monitoring",
            "Vertex AI Explainable AI",
            "Cloud Monitoring",
            "Cloud Logging",
            "Vertex AI Pipelines",
            "Vertex AI Prediction",
        ],
        "topics": [
            "Secure AI systems and protection against exploitation",
            "Google's Responsible AI practices",
            "Monitoring for bias",
            "Assessing AI solution readiness (fairness, bias)",
            "Model explainability on Vertex AI",
            "Continuous evaluation metrics",
            "Training-serving skew detection",
            "Feature attribution drift monitoring",
            "Model performance monitoring against baselines and simpler models",
            "Time-series performance monitoring",
            "Common training and serving error monitoring",
            "Data drift detection",
            "Model drift detection",
            "Alerting and incident response",
        ],
        "guidance": (
            "Focus on monitoring and maintaining ML solutions in production. Questions should "
            "test understanding of model monitoring, drift detection, explainability, and "
            "responsible AI practices. Include scenarios about detecting performance degradation, "
            "identifying data/model drift, ensuring fairness, and making models interpretable. "
            "Test knowledge of training-serving skew, feature attribution drift, security against "
            "exploitation, fairness assessment, and continuous evaluation metrics. Cover monitoring "
            "against baselines, simpler models, and across time dimensions. Emphasize operational "
            "monitoring, ethical considerations, and Google's Responsible AI practices."
        ),
    },
}


def get_domain_context(domain_code: str) -> Dict[str, Any]:
    """Get context for a specific PMLE domain.
    
    Args:
        domain_code: Domain code (e.g., "ARCHITECTING_LOW_CODE_ML_SOLUTIONS")
        
    Returns:
        Dictionary with display_name, exam_weight, subsections, services, topics, and guidance
        
    Raises:
        ValueError: If domain_code is not found
    """
    if domain_code not in PMLE_DOMAIN_CONTEXT:
        raise ValueError(
            f"Domain code '{domain_code}' not found. "
            f"Valid codes: {list(PMLE_DOMAIN_CONTEXT.keys())}"
        )
    return PMLE_DOMAIN_CONTEXT[domain_code]


def get_subsection_context(domain_code: str, subsection_code: str) -> Dict[str, Any]:
    """Get context for a specific exam subsection.
    
    Args:
        domain_code: Domain code (e.g., "ARCHITECTING_LOW_CODE_ML_SOLUTIONS")
        subsection_code: Subsection code (e.g., "1.1", "1.2")
        
    Returns:
        Dictionary with title, services, and considerations for the subsection
        
    Raises:
        ValueError: If domain_code or subsection_code is not found
    """
    domain = get_domain_context(domain_code)
    subsections = domain.get("subsections", {})
    
    if subsection_code not in subsections:
        raise ValueError(
            f"Subsection '{subsection_code}' not found in domain '{domain_code}'. "
            f"Valid subsections: {list(subsections.keys())}"
        )
    return subsections[subsection_code]


def build_domain_prompt_context(domain_code: str, domain_name: str, subsection_code: str = None) -> str:
    """Build a comprehensive prompt context string for LLM generation.
    
    Args:
        domain_code: Domain code
        domain_name: Human-readable domain name
        subsection_code: Optional subsection code (e.g., "1.1") to target specific exam subsection
        
    Returns:
        Formatted context string for LLM prompts
    """
    context = get_domain_context(domain_code)
    
    services_text = ", ".join(context["services"])
    topics_text = ", ".join(context["topics"])
    exam_weight = context.get("exam_weight", 0)
    
    prompt_context = f"""Domain: {domain_name} ({domain_code})
Exam Weight: ~{exam_weight}% of the exam

Relevant Google Cloud Services: {services_text}

Key Topics: {topics_text}

Guidance: {context["guidance"]}"""
    
    # Add subsection-specific context if provided
    if subsection_code:
        try:
            subsection = get_subsection_context(domain_code, subsection_code)
            subsection_services = ", ".join(subsection.get("services", []))
            subsection_considerations = "\n".join([f"- {c}" for c in subsection.get("considerations", [])])
            
            prompt_context += f"""

Target Subsection: {subsection["title"]} ({subsection_code})
Subsection Services: {subsection_services}
Subsection Considerations:
{subsection_considerations}

Generate a question specifically targeting this subsection."""
        except ValueError:
            # If subsection not found, continue without subsection context
            pass
    
    prompt_context += """

Generate a realistic, scenario-based PMLE question that tests practical knowledge of this domain. 
The question should present a business scenario requiring a decision between different Google Cloud ML approaches.
Use specific service names and realistic constraints."""
    
    return prompt_context
