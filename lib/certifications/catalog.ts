import registry from "@/content-pipeline/certs/registry.json";

export const certifications = registry.certifications;
export const PMLE_CERT_ID = "machine-learning-engineer";
export const certificationPath = (certId: string) => `/certifications/${certId}`;
export function certificationForExam(exam: string) {
  return certifications.find(cert => cert.name === exam);
}
export const certificationSummaries: Record<string, string> = {
  "agentic-architect": "Compare the agent architecture assessment, required labs and beta-to-GA announcements before planning your preparation.",
  "associate-google-workspace-administrator": "Explore the administration credential for managing an organization's Google Workspace environment.",
  "cloud-architect": "Review the architecture credential for designing cloud systems and balancing business and technical needs.",
  "cloud-database-engineer": "Explore the database engineering credential for planning and operating cloud database solutions.",
  "cloud-developer": "Review the development credential for building and running applications on Google Cloud.",
  "cloud-devops-engineer": "Explore the DevOps credential for reliable delivery and operation of cloud services.",
  "cloud-digital-leader": "Compare the foundational credential focused on cloud concepts and business use cases.",
  "cloud-engineer": "Review the associate credential for deploying, configuring and maintaining cloud environments.",
  "cloud-network-engineer": "Explore the networking credential for designing and managing cloud connectivity.",
  "cloud-security-engineer": "Review the security engineering credential for protecting cloud workloads and access.",
  "data-engineer": "Explore the data engineering credential for building and operating cloud data systems.",
  "data-practitioner": "Review the associate credential for working with data services and analysis on Google Cloud.",
  "generative-ai-leader": "Compare the foundational credential focused on generative AI concepts and business decisions.",
  "machine-learning-engineer": "The PMLE exam is two hours long, costs $200 plus tax where applicable, and has 50–60 multiple-choice and multiple-select questions, offered in English and Japanese.",
  "security-operations-engineer": "Explore the security operations credential for detecting, investigating and responding to threats.",
};
