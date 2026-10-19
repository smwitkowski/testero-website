# Parent / variant review

Keys are shown for founder review; these are not publication approvals.

## Pair 1

Max family stem Jaccard: 0.3289

### Parent `a23ed85e-042b-5eaf-ba0d-ccf52b149bd8`

You are improving a water utility's recently deployed dashboard for planning pump maintenance. It groups pumping stations by equipment manufacturer, but crews report that stations in the same group often behave differently. BigQuery holds historical station-level summaries of energy consumption, operating hours, and pressure variation. You want to discover maintenance peer groups from actual operating patterns while minimizing changes to the team's SQL workflow. What should you do?

- **A**: Build BigQuery ML time-series forecasting models for each station's energy consumption, and group stations with similar predicted energy use into maintenance peer groups.
- **B**: Train a BigQuery ML k-means model on standardized station operating measurements, and use the resulting cluster assignments to identify maintenance peer groups.
- **C**: Train an Agent Platform AutoML classification model using operating measurements as features and manufacturer groups as labels, and use predicted classes as maintenance peer groups.
- **D**: Fit a BigQuery ML principal component analysis model to station operating measurements, and assign maintenance peer groups according to each station's highest component score.

**Key: B**

### Variant `b26f4827-3cf7-5e83-9446-f277bdd6296f`

Your organization, Reefward Conservancy, uses a monitoring dashboard to plan reef restoration work. During monthly reviews, field teams report that reefs grouped under the same management authority often have very different ecological conditions. BigQuery holds historical reef-level summaries of coral cover, fish abundance, and water-temperature variation. You want to discover restoration peer groups from these ecological patterns while minimizing changes to the team's SQL workflow. What should you do?

- **A**: Fit a BigQuery ML principal component analysis model to reef ecological measurements, and assign restoration peer groups according to each reef's highest component score.
- **B**: Build BigQuery ML time-series forecasting models for each reef's coral cover, and group reefs with similar predicted coral cover into restoration peer groups.
- **C**: Train an Agent Platform AutoML classification model using ecological measurements as features and management authorities as labels, and use predicted classes as restoration peer groups.
- **D**: Train a BigQuery ML k-means model on standardized reef ecological measurements, and use the resulting cluster assignments to identify restoration peer groups.

**Key: D**

## Pair 2

Max family stem Jaccard: 0.4247

### Parent `2552fa69-5a20-5744-90a3-2c76eba518d2`

You are maintaining a recently deployed bus-delay predictor for a transit operator. Its prepared training table is in BigQuery, where new trips and occasional corrections arrive daily. Most historical records stay unchanged, but the current table no longer matches the data used by earlier training runs. You want to preserve each run's training cohort for exploration and repeatable training several months later while minimizing additional storage costs. What should you do?

- **A**: Copy the prepared BigQuery table into a separate standard table for each training run, and retain every copy for later exploration and repeatable training.
- **B**: Create a BigQuery table snapshot of the prepared table for each training run, and retain it for later exploration and repeatable training.
- **C**: Create an automatically refreshed BigQuery materialized view over the prepared training table, and query that view for later cohort exploration and repeatable training.
- **D**: Record the timestamp of each training run, and use BigQuery time travel to query the corresponding training cohort when analysts revisit it several months later.

**Key: B**

### Variant `ad7207d5-cc2b-5db0-adf1-359c7c3534c4`

Your organization, ReefWatch, uses a coral-bleaching predictor to prioritize reef surveys. During routine monitoring, analysts investigating prediction errors find that the current BigQuery training table no longer matches earlier training cohorts. Survey observations arrive daily, and scientists occasionally correct measurements, although most historical records remain unchanged. You want to preserve each training cohort for exploration and repeatable training several months later while minimizing additional storage costs. What should you do?

- **A**: Create a BigQuery table snapshot of the prepared survey table for each training run, and retain each snapshot for later cohort exploration and repeatable model training.
- **B**: Create an automatically refreshed BigQuery materialized view over the prepared survey table, and use its results for later exploration of training cohorts and repeated model training.
- **C**: Record each training run's timestamp, and use BigQuery time travel to retrieve its survey cohort when analysts revisit prediction errors and repeat training several months later.
- **D**: Copy the prepared BigQuery survey table into a separate standard table for each training run, and retain every copy for later cohort exploration and repeatable model training.

**Key: A**

## Pair 3

Max family stem Jaccard: 0.3553

### Parent `9a174e39-5c98-524a-abec-952a689185d0`

Your company uses a custom image classifier to route damaged parcels for manual inspection. Monitoring shows more classification errors after new packaging materials entered circulation. Reviewers have labeled thousands of representative parcel photos, and engineers spend substantial time maintaining training code. The routing system also records shipment weight, dimensions, and delivery history. You want to learn the company's damage categories from the labeled photos while minimizing training-code maintenance. What should you do?

- **A**: Move the custom image classifier's training into Agent Platform Pipelines and automate retraining with the reviewed parcel photos. Compare each candidate with the running model before replacing the production classifier.
- **B**: Train an image classifier with Agent Platform AutoML using the reviewed parcel photos. Compare its performance with the running model on held-out photos before replacing the production classifier.
- **C**: Apply Cloud Vision API label detection to parcel photos and map its returned labels to the company's damage categories. Compare routing accuracy with the running classifier using held-out reviewed photos.
- **D**: Train a BigQuery ML logistic regression classifier using shipment weight, dimensions, and delivery history. Compare its routing accuracy with the running model before replacing the production classifier.

**Key: B**

### Variant `fc352b8a-1171-593e-b174-e41368ec21be`

You are maintaining ReefWatch's recently deployed image classifier, which assigns coral health categories to guide reef restoration surveys. Its first field review found frequent errors on coral varieties absent from earlier surveys. Marine biologists have labeled thousands of representative underwater photos. Engineers spend substantial time maintaining training code, and survey records also contain water temperature, depth, and site history. You want to learn the organization's coral health categories from the labeled photos while minimizing training-code maintenance. What should you do?

- **A**: Train a BigQuery ML logistic regression classifier using water temperature, depth, and site history. Compare its classification performance with the running model before replacing the production coral health classifier.
- **B**: Train an image classifier with Agent Platform AutoML using the biologists' labeled underwater photos. Compare its classification performance with the running model on held-out photos before replacing the production classifier.
- **C**: Apply Cloud Vision API label detection to underwater photos and map its returned labels to coral health categories. Compare classification performance with the running model using held-out photos labeled by biologists.
- **D**: Move the custom classifier's training into Agent Platform Pipelines and automate retraining using the biologists' labeled underwater photos. Evaluate each candidate against the running model on held-out photos before replacing the production classifier.

**Key: B**

