# Rules v5.1 reviewed ML/MLOps objectives

24 allowed; 28 excluded. Reviewed the 52 top-level objectives and parent subsections in
`certs/machine-learning-engineer.json`, normalized guide hash
`bee925a0fb365488f57fee26b1fca8cdfc82e67fdb8753afb0472c2d3b257701`.
This is offline guide-text review, not live guide or model validation.

Allow transferable ML/MLOps decisions explicitly about practice. Exclude mandatory
named-product/environment/tool choices. “e.g.” examples need not be the hinge;
model families, metrics and hardware principles are not cloud products. Prefer
realistic Google Cloud context. No scope expansion or factual/evidence waiver.
Mixed product-heavy orchestration, container, endpoint, scaling and security-tool
objectives remain excluded conservatively. Unknown IDs and other certs default off.

Only product_knowledge_hinge, cloud_specific_alternative and generic_validation_key
are relaxed. Every remaining style check stays mandatory. Raw recorded FAIL/score
may reflect these checks alone: offline evaluation ignores that aggregate FAIL/low
style score only if a relaxed check is triggered, every required check is true,
and the verdict is not UNCERTAIN. Raw outputs remain unchanged. The derived aggregate score uses the unwaived gate scores
when the waived recorded style score is below 0.8; raw style score is preserved. Otherwise require
PASS and score >=0.8. Fresh style prompts direct scoring against required checks.
This interpretation is necessary to replay b18's style-only recorded failure;
it does not establish all-gate quality or improve live acceptance by itself.
Blind, evidence, Argon requests/verdict thresholds, dedupe and key balance are unchanged.
The generic-key batch cap still applies to passing non-allowance candidates only;
allowance candidates neither count against it nor dilute its denominator.

## Per-objective reasoning

IDs below have prefix `machine-learning-engineer:standard:`.

| ID | Allow | Official objective | Reason |
|---|---|---|---|
| 1.1:1 | no | Building models in BigQuery ML or Agent Platform AutoML (e.g., classification, regression, forecasting, and clustering) based on the business problem | Named BigQuery ML / Agent Platform AutoML model building is the explicit task; generic model-type selection alone drops that scope. |
| 1.1:2 | no | Performing feature engineering or selection using BigQuery ML | Feature engineering is expressly performed using BigQuery ML; product behavior must remain decisive. |
| 1.1:3 | no | Generating predictions using BigQuery ML | Predictions expressly use BigQuery ML; generic inference knowledge does not cover this product task. |
| 1.1:4 | no | Training models using Agent Platform AutoML | Training expressly uses Agent Platform AutoML. |
| 1.1:5 | no | Fine-tuning Gemini models using BigQuery | Gemini fine-tuning expressly uses BigQuery; named integration is central. |
| 1.2:1 | no | Evaluating and selecting the appropriate model for a given task from Gemini Enterprise Agent Platform Model Garden | Selection is explicitly from Model Garden; catalog capability/availability is central. |
| 1.2:2 | no | Building applications using industry-specific APIs (e.g., Document AI API, Vision API, and Translate API) | The task is industry-specific API applications; the listed APIs exemplify a product-specific competency. |
| 1.2:3 | no | Building solutions and tuning models for specific use cases (e.g., Gemini, Imagen, Veo, and models as a service in Model Garden) | Although phrased broadly, the parent subsection and all examples concern named foundation-model services; conservatively require their knowledge. |
| 1.2:4 | no | Optimizing Gemini-based applications for cost, latency, and availability | Gemini-based optimization needs Gemini capability/limit knowledge, not generic latency/cost advice. |
| 2.1:1 | yes | Organizing and exploring different data types (e.g., tabular, text, and images) for efficient experimenting, training, and serving | Data organization across modalities for training/serving is a general ML practice with no mandated product. |
| 2.1:2 | no | Choosing the right tool for data preprocessing based on scale and complexity (e.g., BigQuery [SQL], Dataflow, Apache Spark, and in-memory Python frameworks) | Tool choice by scale/complexity is centrally a platform/tool capability comparison; generic preprocessing advice is insufficient. |
| 2.1:3 | no | Creating and consolidating features in Gemini Enterprise Agent Platform Feature Store | Feature creation/consolidation expressly uses Agent Platform Feature Store. |
| 2.1:4 | yes | Ensuring data privacy and handling sensitive information (e.g., personally identifiable information [PII]) | Privacy and PII handling are general data practices; no named product is required. |
| 2.2:1 | yes | Applying collaboration and security best practices when setting up and running notebook environments | Notebook collaboration/security best practices can turn on access isolation or safe collaboration knowledge without a product-specific limit. |
| 2.2:2 | no | Developing models in Agent Platform Workbench or Colab Enterprise notebooks using common frameworks (e.g., PyTorch, sklearn, and JAX) | Model development explicitly occurs in Workbench or Colab Enterprise; framework-only questions would displace the environment competency. |
| 2.2:3 | no | Using a variety of foundational and open-source models in Model Garden to create model prototypes in notebook environments | Prototyping explicitly uses models in Model Garden. |
| 2.3:1 | no | Choosing the appropriate Google Cloud environment for development and experimentation (e.g., Experiments on Gemini Enterprise Agent Platform, Gemini Enterprise Agent Platform Pipelines, and Kubeflow Pipelines) given the framework | Choosing an appropriate Google Cloud environment is the explicit decision. |
| 2.3:2 | yes | Evaluating predictive and gen AI solutions (e.g., model evaluation metrics and LLM-as-a-judge) | Predictive/gen AI evaluation and metrics/LLM-as-judge are explicit general ML evaluation competencies. |
| 2.3:3 | yes | Tracking and comparing model artifacts, versions, and lineage (e.g., Experiments on Agent Platform and Gemini Enterprise Agent Platform ML Metadata) | Artifacts, versions, and lineage are general experiment/reproducibility practices; named services are examples rather than the mandatory task. |
| 3.1:1 | yes | Choosing the model type (e.g., ARIMA, DNN, and LLM) | Model-type selection is general ML knowledge; ARIMA/DNN/LLM examples name model families, not required cloud products. |
| 3.1:2 | no | Choosing the product (e.g., Agent Platform AutoML, BigQuery ML, and Agent Platform Pipelines) | Choosing the product is expressly the objective. |
| 3.1:3 | yes | Choosing the deployment strategy | Deployment-strategy choice is general ML/MLOps; keep it a substantive strategy tradeoff, not service trivia. |
| 3.1:4 | yes | Modeling techniques given interpretability requirements | Interpretability-driven modeling techniques are general ML knowledge. |
| 3.2:1 | no | Organizing training data (e.g., tabular, text, speech, images, and videos) on Google Cloud (e.g., Cloud Storage and BigQuery) | Training-data organization explicitly occurs on Google Cloud with storage products; conservatively retain a cloud-specific hinge. |
| 3.2:2 | yes | Ingesting structured and unstructured data from various sources into training pipelines | Structured/unstructured pipeline ingestion is generic data/ML pipeline practice without a required service. |
| 3.2:3 | no | Model training using different software development kits (SDKs) (e.g., Agent Platform custom training, Kubeflow on Google Kubernetes Engine [GKE], Agent Platform AutoML, and Tabular Workflows) and organizing training on Google Cloud | Training SDKs and organization on Google Cloud are central, with all examples naming platform execution choices. |
| 3.2:4 | yes | Troubleshooting ML model training failures | Diagnosing ML training failures can hinge on numerical stability, data defects, or model behavior without product knowledge. |
| 3.2:5 | yes | Hyperparameter tuning | Hyperparameter tuning is an explicit general ML practice. |
| 3.2:6 | no | Fine-tuning foundational models from Agent Platform and Model Garden and when tuning should be considered | Fine-tuning explicitly concerns foundational models from Agent Platform and Model Garden; the generic when-to-tune clause does not remove named-model scope. |
| 3.3:1 | yes | Evaluation of compute and accelerator options (e.g., CPU, GPU, and TPU) | CPU/GPU/TPU workload-fit evaluation can test compute principles without a named service capability. |
| 3.3:2 | yes | Understanding the options for distributed training on GPUs and TPUs using data and model parallelism strategies | Data/model parallelism on GPUs/TPUs is general distributed ML training knowledge; no required cloud execution product. |
| 4.1:1 | no | Deploying models for batch and online inference using appropriate services (e.g., Agent Platform, Model Garden, Cloud Run, and GKE) | Choosing appropriate services for batch/online deployment is central; product capability comparison must decide the answer. |
| 4.1:2 | no | Packaging and serving models from different frameworks (e.g., PyTorch and XGBoost) using prebuilt and custom containers | Conservatively retain product/container packaging knowledge; prebuilt support and framework-specific container behavior are central. |
| 4.1:3 | no | Organizing and versioning models in Gemini Enterprise Agent Platform Model Registry | Model organization/versioning expressly uses Agent Platform Model Registry. |
| 4.1:4 | yes | Implementing model rollout strategies (e.g., A /B testing and canary deployments) to compare model versions | A/B versus canary rollout and model-version comparison are explicit general MLOps strategies. |
| 4.1:5 | yes | Developing solutions for inference preprocessing and postprocessing | Inference pre/postprocessing is general ML serving design. |
| 4.2:1 | no | Managing and serving features using Agent Platform Feature Store | Feature management/serving expressly uses Agent Platform Feature Store. |
| 4.2:2 | no | Deploying models to public and private endpoints | Endpoint exposure and public/private deployment are platform networking choices; retain product hinge. |
| 4.2:3 | yes | Choosing appropriate hardware (e.g., CPU, GPU, TPU, and edge) | CPU/GPU/TPU/edge selection is hardware/workload-fit knowledge, not a named service requirement. |
| 4.2:4 | no | Scaling the serving backend based on the throughput (e.g., Gemini Enterprise Agent Platform Inference and containerized serving) | Backend scaling examples explicitly name Agent Platform Inference and containerized serving; retain platform scaling hinge. |
| 4.2:5 | yes | Tuning ML models for training and serving in production | Production model training/serving tuning is general ML systems knowledge. |
| 5.1:1 | yes | Validating data and models | Data/model validation is general ML/MLOps knowledge. |
| 5.1:2 | no | Building and orchestrating pipelines using managed or unmanaged services and from templates or custom solutions (e.g., Agent Platform Pipelines, Managed Service for Apache Airflow, and Ray on Gemini Enterprise Agent Platform) | Choosing managed/unmanaged orchestration services is a service-capability comparison; retain product hinge. |
| 5.1:3 | yes | Ensuring consistent data preprocessing between training and serving | Consistent training/serving preprocessing is an explicit general ML correctness practice. |
| 5.2:1 | yes | Determining an appropriate retraining policy | Retraining-policy selection is general ML lifecycle knowledge. |
| 5.2:2 | yes | Deploying models in continuous integration, continuous delivery, and continuous training (CI/CD/CT) pipelines (e.g., Cloud Build) | CI/CD/CT deployment is general MLOps; Cloud Build is an example, not the mandatory competency. |
| 6.1:1 | no | Building secure AI systems by protecting against unintentional exploitation and leaks of data or models (e.g., data exfiltration, malicious prompting, and sharing sensitive data with LLMs) using the appropriate security tool (e.g., Regex, safety filters, and Model Armor) | Selecting an appropriate security tool (including Model Armor) is central; retain tool-capability hinge. |
| 6.1:2 | yes | Aligning with responsible AI practices (e.g., monitoring for bias) | Responsible AI/bias monitoring is general ML practice. |
| 6.1:3 | no | Model explainability on Agent Platform (e.g., Agent Platform Inference) | Explainability expressly occurs on Agent Platform; platform capability knowledge remains central. |
| 6.2:1 | no | Configuring and using Model Monitoring on Gemini Enterprise Agent Platform to establish continuous evaluation metrics for production models | Configuring/using Agent Platform Model Monitoring is expressly the task. |
| 6.2:2 | yes | Monitoring for common issues (e.g., training-serving skew, data drift, concept drift, and feature attribution drift) | Training-serving skew and drift types/diagnosis are general ML monitoring knowledge. |
| 6.2:3 | yes | Monitoring, testing, and evaluating gen AI solutions | Gen AI monitoring/testing/evaluation is generic model-quality practice without a mandatory product. |
