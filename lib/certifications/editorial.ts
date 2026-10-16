// Original preparation advice grounded in the certification registry guides.
export const certificationEditorial: Record<string, { audience: string; steps: string[] }> = {
  "cloud-network-engineer": {
    "audience": "This exam suits engineers who connect cloud workloads to each other and to networks outside Google Cloud. The role combines network design with implementation, troubleshooting, and security decisions. It is particularly relevant when your work involves choosing connectivity patterns, explaining traffic paths, or keeping shared network services usable as applications grow. Preparation should connect configuration details to the behavior users and operators actually observe.",
    "steps": [
      "Use the standard exam guide to map VPC design, managed network services, hybrid connectivity, and network security into a single architecture sketch. Mark the boundaries where routing, name resolution, or access rules could change the result.",
      "Choose Google Cloud Skills Boost labs that let you configure connectivity and inspect traffic. After each exercise, describe what would happen if a route or firewall rule changed, rather than recording only the successful commands.",
      "Work through the official sample questions and justify your choices using the stated network constraints. Treat them as examples of question style, not a complete troubleshooting checklist or a forecast of your result.",
      "Finish by walking through a connectivity incident from symptom to evidence to repair. Include monitoring and operational checks, because a network design is incomplete if you cannot explain how to diagnose it."
    ]
  },
  "associate-google-workspace-administrator": {
    "audience": "This credential is aimed at administrators responsible for the everyday operation of an organization’s Google Workspace environment. Its scope reaches beyond creating accounts: service settings, data governance, access controls, managed devices, and support all matter. It fits people who need to translate an organizational policy into an administrative change while understanding the effect on users. The guide provides a useful way to separate familiar helpdesk tasks from areas needing more deliberate practice.",
    "steps": [
      "Read the standard guide section by section, tracing a user from account creation through service access and eventual departure. Connect Directory management to security and governance decisions instead of treating each console setting as an isolated fact.",
      "Look for relevant Google Cloud Skills Boost labs covering Workspace administration. Practice changes in an appropriate learning environment and record their scope, expected user impact, and the evidence you would check afterward.",
      "Answer the official sample questions with an administrator’s reasoning: identify the policy, the affected users or devices, and the narrowest suitable action. Revisit the documentation when two choices appear plausible rather than memorizing answer positions.",
      "Create a short support runbook that includes service issues, browser or endpoint problems, and access failures. For every investigation, state what you would inspect before making a change and how you would confirm recovery."
    ]
  },
  "cloud-digital-leader": {
    "audience": "Cloud Digital Leader is a foundational option for people who discuss cloud adoption with business and technical teams. The guide covers transformation, data, AI, infrastructure modernization, trust, and operations rather than centering on one engineering specialty. It can help you organize conversations about why an organization might change its technology and what tradeoffs that introduces. Technical implementation is useful context, but the preparation focus here is explaining choices clearly in terms of business needs.",
    "steps": [
      "Start with the standard exam guide and give each section a concrete organizational example. For digital transformation, describe a problem worth solving; for data and AI, explain what information or capability would make the proposed change useful.",
      "Use Google Cloud Skills Boost learning activities for practical business exploration. Compare a modernization scenario with keeping an existing approach, noting operational responsibilities, security concerns, and costs to investigate. Treat hands-on exploration as learning support, not an assumed prerequisite.",
      "Try the official sample questions and explain why the scenario calls for one approach over another. These examples illustrate the question format; they do not establish full coverage, difficulty, or readiness.",
      "Check which assessment path you intend to take before planning registration. Google offers standard, renewal, and skills renewal options; do not assume that their formats or eligibility details are interchangeable."
    ]
  },
  "agentic-architect": {
    "audience": "This assessment concerns people designing agentic workflows across low-code tools, coding assistance, and custom development. The role is not simply about producing a convincing demonstration: evaluation, deployment, security, and governance are part of the guide too. It is relevant when you need to decide how an agent should act, what limits it should have, and how a team can judge its behavior. The sourced guide is for the beta, so assessment status deserves attention alongside technical preparation.",
    "steps": [
      "Read the beta guide and separate low-code agent construction, coding agents, and custom agents into distinct study areas. Write down where each approach could fit a real workflow and where additional control or evaluation would be needed.",
      "Select Google Cloud Skills Boost labs related to agent development and deployment. Keep a record of the inputs, tools, and permissions used in each exercise, then examine how a failed or unexpected action would be detected.",
      "Use the official sample questions to practice interpreting workflow requirements. Explain the evaluation or governance consequence of each choice instead of assuming that a more autonomous design is always preferable.",
      "Review the current official assessment announcements before committing to a schedule. The beta assessment includes required labs as well as the exam; confirm the applicable windows and completion instructions rather than treating optional study labs as those required assessment components."
    ]
  },
  "machine-learning-engineer": {
    "audience": "This exam is relevant to engineers taking ML and AI solutions from an initial approach into repeatable production operation. The guide spans low-code options, shared data and model work, model scaling, serving, pipelines, and monitoring. It therefore asks for broader preparation than training an accurate model in a notebook. People working between data teams, application teams, and platform operations can use the scope to identify which parts of that lifecycle they have not yet practiced.",
    "steps": [
      "Organize the standard guide around a model lifecycle. Connect low-code architecture decisions to data collaboration, then follow a prototype through serving, orchestration, and monitoring. Note where business constraints would change an otherwise reasonable technical choice.",
      "Use the Testero PMLE diagnostic to identify topics for a closer look. Treat the results as a study aid, then check weak areas against the official guide instead of assuming that one diagnostic covers every objective.",
      "Practice with Google Cloud Skills Boost labs that expose deployment and operational behavior as well as model building. Record how you would investigate a pipeline failure, a serving problem, or a change in model behavior.",
      "Review the official sample questions and explain the constraints behind each answer. Return to your lifecycle map afterward and add the missing reasoning, without treating sample performance as a prediction of an exam outcome."
    ]
  },
  "data-practitioner": {
    "audience": "Data Practitioner suits people working with the everyday movement, analysis, and management of data on Google Cloud. Its associate scope connects preparation and ingestion to analysis, presentation, orchestration, and ongoing management. It is useful for someone who can complete individual data tasks but wants a clearer view of how those tasks form a dependable workflow. Preparation should emphasize what the data means, how it changes, and who needs to use the resulting output.",
    "steps": [
      "Turn the standard exam guide into a small end-to-end data scenario. Identify the source, the transformations, the intended analysis, and the responsibilities for maintaining the data. Use the four guide sections to spot gaps in that story.",
      "Choose Google Cloud Skills Boost labs where you can ingest, inspect, and analyze a dataset. Check the results after a transformation and describe how errors or incomplete input could affect the conclusions presented to a user.",
      "Approach the official sample questions by identifying the requested task before choosing a tool or action. Review the explanation you would give a teammate, especially when an answer seems familiar but does not fit the scenario.",
      "Revisit orchestration and data management after the analysis works. Outline how the workflow would run again, who could access its outputs, and what checks would help you notice when the data no longer meets expectations."
    ]
  },
  "cloud-devops-engineer": {
    "audience": "This exam fits engineers responsible for making software delivery and cloud operation dependable. The guide brings together organization setup, delivery pipelines, site reliability engineering, observability, and performance and cost optimization. It is relevant whether your daily work starts with a deployment pipeline or a production incident, because both depend on shared operational choices. Preparation should connect the speed of making changes to the evidence that those changes remain safe and useful.",
    "steps": [
      "Review the standard guide and map its sections onto a service you understand. Include the organization foundation and infrastructure delivery, not just application code, and identify where testing or approval decisions enter the release process.",
      "Build operational practice through Google Cloud Skills Boost labs on delivery and observability. Trace a change from build to deployment, then inspect the signals that would show whether the service is behaving as expected.",
      "Use official sample questions to distinguish a quick local fix from a durable operational improvement. Explain how the proposed action affects reliability, delivery, and the team’s ability to investigate problems rather than selecting by product name alone.",
      "Write a brief incident review and a follow-up optimization plan. Separate immediate recovery from changes to testing, monitoring, performance, or cost, and tie each proposed improvement to an observable problem rather than an abstract preference."
    ]
  },
  "data-engineer": {
    "audience": "Data Engineer is aimed at people designing and operating data systems, not only querying their outputs. The guide follows data through processing design, ingestion, storage, analysis, and automated maintenance. It fits engineers who must balance how data arrives with how reliably and efficiently others can use it. A useful preparation project should therefore include operational decisions and changes over time, rather than ending as soon as the first successful result appears.",
    "steps": [
      "Check whether you are preparing for the standard or renewal exam and open the corresponding guide. Google provides both guides and a separate skills renewal option; verify the path rather than transferring format assumptions between them.",
      "Sketch a data processing system with explicit ingestion, storage, and analysis needs. Compare design choices against those requirements and identify the conditions that would make you reconsider a choice as volume or usage changes.",
      "Use Google Cloud Skills Boost labs to practice moving and transforming data, then inspect how the workflow is maintained. Include a failed input or interrupted run in your reasoning so that recovery receives attention alongside initial setup.",
      "Work through the official sample questions and link unfamiliar decisions back to the relevant guide section. Close your review by explaining how you would automate the workload and detect degraded results; sample answers alone are not evidence of complete preparation."
    ]
  },
  "cloud-architect": {
    "audience": "This exam is for people making cloud architecture decisions across business needs, infrastructure, security, and implementation. It fits roles that must explain why a design is appropriate, not merely show that its components can be deployed. The standard guide also addresses technical and business processes and operational excellence. Preparation should make room for competing requirements, because an architecture that solves one problem can introduce cost, delivery, or operational difficulties elsewhere.",
    "steps": [
      "Select the guide for your intended assessment. Standard and renewal guides have different section coverage; the skills renewal option is another path to check rather than a reason to assume all assessments share one outline.",
      "Develop a short architecture proposal from a business scenario. Describe constraints, compare alternatives, and explain the security and compliance implications. Follow the proposal through provisioning and implementation so that design choices have an operational consequence.",
      "Choose Google Cloud Skills Boost labs that expose the infrastructure behind your proposal. After completing an exercise, explain what you would change for different availability, access, or management needs instead of repeating the lab design unchanged.",
      "Use the official sample questions to rehearse requirement-driven decisions. When reviewing an answer, state which requirement it satisfies and which tradeoff remains, then return to the guide to check areas that your preferred architecture did not exercise."
    ]
  },
  "security-operations-engineer": {
    "audience": "This credential concerns the operational work of finding, investigating, and responding to threats. The guide links platform operations and data management to threat hunting, detection engineering, incident response, and observability. It is relevant to practitioners who need to turn security data into a defensible investigative decision. Preparation should connect the quality and availability of that data to what an analyst can actually conclude, rather than treating every alert as a complete account of an incident.",
    "steps": [
      "Use the standard guide to trace the path from incoming security data to an investigation and response. Identify which responsibilities belong to platform operation, which concern data, and which require detection or analyst judgment.",
      "Select relevant Google Cloud Skills Boost labs to practice security operations workflows. Record the evidence available at each stage and the limits of that evidence, including what you would need to inspect before taking a disruptive action.",
      "Read the official sample questions as short investigative situations. Separate observed facts from assumptions, then justify the next action using the scenario’s constraints. Do not substitute a remembered tool name for an explanation of its purpose.",
      "Create a small detection review and incident timeline. Describe what the detection seeks, how you would investigate a match, and how observability would help confirm whether the response resolved the problem or left important questions unanswered."
    ]
  },
  "cloud-security-engineer": {
    "audience": "Cloud Security Engineer is relevant to practitioners protecting cloud access, communications, and data while supporting operations and compliance needs. The guide spans preventive controls and the work needed to maintain them. It suits people who must explain the scope of a security decision across teams and workloads, rather than focusing on one setting in isolation. Preparation should connect an intended protection to the resources it covers and the evidence that it remains effective.",
    "steps": [
      "Break the standard guide into access, boundary protection, data protection, operations, and compliance review. For each area, write a concrete risk and the kind of control that could reduce it, while noting any operational consequence.",
      "Practice appropriate access and protection tasks through Google Cloud Skills Boost labs. Inspect both the intended behavior and a denied or restricted action so that successful configuration does not become your only test of understanding.",
      "Use the official sample questions to compare controls against stated requirements. Identify who needs access, what must be protected, and which boundaries matter before selecting an answer; similar security terminology can conceal different scopes.",
      "Finish with a review of how controls are operated over time. Explain what you would monitor, how a change would be checked, and what documentation could support a compliance discussion without assuming that a technical setting alone establishes compliance."
    ]
  },
  "cloud-database-engineer": {
    "audience": "This exam suits engineers who choose, migrate, and operate cloud database solutions. The guide includes scalable and highly available design, environments using multiple database technologies, migration, and deployment on Google Cloud. It is relevant when a team needs someone to connect application data needs to the practical behavior of a database system. Preparation should give migration and ongoing operation as much attention as the initial technology choice.",
    "steps": [
      "Read the standard guide and turn its sections into a database decision record. Describe workload needs, availability expectations, and the reasons for a proposed design. Include how multiple database technologies could affect management rather than assuming one system fits every task.",
      "Use Google Cloud Skills Boost labs to practice database deployment and operational checks. Inspect how an application would connect and how you would verify that the deployed system matches the intended access and availability requirements.",
      "Study migration as a sequence of decisions: assess the starting point, plan the move, validate the result, and consider recovery if the outcome is wrong. Tie those decisions to the guide instead of treating copying data as the whole migration.",
      "Review the official sample questions with attention to workload constraints. Explain why a choice supports the scenario and what you would verify in operation; familiarity with a database product is not a substitute for that reasoning."
    ]
  },
  "cloud-engineer": {
    "audience": "Cloud Engineer is an associate credential for people implementing and maintaining Google Cloud environments. The guide connects initial setup and planning to successful operation, access, and security. It fits practitioners whose responsibilities cross several services and who need to make routine changes with a clear understanding of their effects. Preparation should build confidence in following a requirement through configuration and verification, rather than just recognizing service names or console screens.",
    "steps": [
      "Confirm your intended assessment path before choosing a study outline. Google lists standard, renewal, and skills renewal variants, with separate standard and renewal guides. Use the applicable guide and check the current official details for that path.",
      "Build a small solution through Google Cloud Skills Boost labs, starting with environment setup and continuing through deployment. Keep a record of configuration choices and explain which requirement each choice satisfies instead of collecting commands without context.",
      "Work through the official sample questions and identify the operational task in each scenario. When an answer is unfamiliar, return to the relevant guide area and practice the reasoning behind the action rather than memorizing its wording.",
      "Review how you would keep the solution running after deployment. Include access checks and a troubleshooting sequence, and describe what evidence would distinguish an environment problem from an application problem before you change either one."
    ]
  },
  "generative-ai-leader": {
    "audience": "Generative AI Leader is a foundational credential for people evaluating generative AI opportunities and discussing them with delivery teams. The guide combines basic concepts, Google Cloud offerings, ways to improve model output, and business strategy. It fits someone who needs to ask better questions about a proposed use case, including what success looks like and where human judgment remains necessary. Preparation is about informed business decisions, not assuming every useful application requires custom model development.",
    "steps": [
      "Use the standard exam guide to distinguish foundational concepts from product choices and business planning. For each section, explain a small use case in plain language and identify what you would need to learn before recommending it.",
      "Explore relevant Google Cloud Skills Boost learning activities with a practical business question. Compare outputs or approaches against that question, noting usefulness and limitations. This exploration supports understanding; it should not be presented as a technical prerequisite for the credential.",
      "Take the official sample questions as examples of how scenarios are framed. Explain why an option addresses the stated business need, and avoid treating a sample score as evidence of full topic coverage or likely exam performance.",
      "Draft a short proposal that connects output improvement to a business outcome. Include how people would review results, what risks need attention, and what evidence would justify continuing the work rather than adopting generative AI for its own sake."
    ]
  },
  "cloud-developer": {
    "audience": "This exam fits developers building cloud-native applications and taking them through testing, deployment, and service integration. The guide places scalable, secure, and reliable design alongside the practical work of configuring an application to run. It is relevant when your responsibilities extend beyond writing a feature to understanding how that feature behaves in a cloud environment. Preparation should connect implementation choices to deployment and runtime behavior instead of treating those as someone else’s concerns.",
    "steps": [
      "Read the standard guide with one application in mind. Identify its reliability and security needs, how it would be tested, what configuration deployment requires, and where it depends on other Google Cloud services. Use those questions to organize study gaps.",
      "Practice building and deploying through Google Cloud Skills Boost labs. Change one application setting or integration deliberately, then explain the observed result and how you would distinguish a code defect from a deployment configuration issue.",
      "Use the official sample questions to practice choosing an approach under specific constraints. State which part of the application lifecycle the question concerns before comparing answers, especially when several options sound technically possible.",
      "Review the application as a complete delivery unit. Trace a request through its service integrations, consider a failed dependency, and explain how testing and configuration choices support reliable behavior rather than relying only on a successful initial deployment."
    ]
  }
};
