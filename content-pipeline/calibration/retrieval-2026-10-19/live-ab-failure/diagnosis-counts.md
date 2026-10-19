# Treatment diagnosis counts

Current treatment SHA-256: `f8c48c83573d0ee255fafd8c4b1af44ce26a192ace71a19903021172b0c54e1a`

36 retained attempts analyzed using actual recorded chunk IDs. Metadata reconstruction chunk IDs equal in 5/36; prefix hashes equal in 36/36.

Overlapping candidate counts: a=1 [6]; b=0 confirmed; c=1 [11]. Unknown remainder: [1, 2, 3, 4, 5, 7, 8, 9, 10, 12].

a requires supported documentation evidence in recorded full pages, with at least one annotated necessary support not contained in old selected spans. All supports must be shown to mark the claim recovered. No unsupported claim is categorized c. c is the narrow documented contradiction, not proof the distractor wins. Cache discoveries are not gold. These are evidence-presence classes, not complete causal diagnoses.

## Omitted supported claim evidence (actual recorded IDs)
- Candidate 6 attempt 3 `t6-a3-014`: Object detection can output individual object bounding boxes and labels.
  - https://docs.cloud.google.com/docs/industry SHA `0d9aafcf309a950c87f9dc01a4540d69f2aabf50e373f40e4216f2941245e82b` [3019,3160): Train custom machine learning models that are capable of detecting individual objects in a given image along with its bounding box and label.
- Candidate 6 attempt 3 `t6-a3-015`: Image classification can assign defined labels to images.
  - https://docs.cloud.google.com/docs/industry SHA `0d9aafcf309a950c87f9dc01a4540d69f2aabf50e373f40e4216f2941245e82b` [2894,2952): classify your images according to your own defined labels.

## Recorded ID resolution

Resolved 728/728 recorded IDs. Unresolved: []. Coverage and omissions use resolved actual recorded spans; no new query.

## Contradiction
- Candidate 11 attempt 1 `t11-a1-015`: Retaining online prediction necessarily retains provisioned idle capacity.
  - https://docs.cloud.google.com/gemini-enterprise-agent-platform/machine-learning/predictions/autoscaling SHA `33b855e682870ec9463b4fc9ff68326856dad91cf81b9e0fcf2ce53bc3255156` [650,865): Alternatively, if you accept using the Scale To Zero feature (Preview), the dedicatedResources.minReplicaCount field can be set to 0 and the workload scales to zero replicas when there is no traffic on the endpoint.
