import type { ToolCertification } from "./data";

export const pickerOptions = {
  role: [["technical", "Engineer or administrator"], ["data", "Data or ML practitioner"], ["security", "Security practitioner"], ["business", "Business, product or leadership"], ["new", "Student or career changer"]],
  cloud: [["none", "Less than 6 months"], ["six-months", "6–11 months"], ["one-year", "1–2 years"], ["two-years", "2+ years"]],
  industry: [["new", "Less than 3 years"], ["experienced", "3–4 years"], ["senior", "5+ years"]],
  focus: [["infrastructure", "Infrastructure and architecture"], ["data", "Data and analytics"], ["ml", "Machine learning and AI"], ["agents", "Agentic AI architecture"], ["security", "Cloud security"], ["operations", "Security operations"], ["networking", "Networking"], ["dev", "Application development"], ["devops", "DevOps and reliability"], ["workspace", "Google Workspace"], ["databases", "Databases"], ["business", "Cloud business concepts"]],
  goal: [["foundation", "Understand the fundamentals"], ["hands-on", "Build hands-on skills"], ["specialize", "Validate a professional specialty"]],
} as const;
export type PickerAnswers = { [K in keyof typeof pickerOptions]: typeof pickerOptions[K][number][0] };
export const defaultAnswers: PickerAnswers = { role: "technical", cloud: "none", industry: "new", focus: "infrastructure", goal: "hands-on" };
const specialists: Record<PickerAnswers["focus"], string> = {
  infrastructure: "cloud-architect", data: "data-engineer", ml: "machine-learning-engineer", agents: "agentic-architect", security: "cloud-security-engineer", operations: "security-operations-engineer", networking: "cloud-network-engineer", dev: "cloud-developer", devops: "cloud-devops-engineer", workspace: "associate-google-workspace-administrator", databases: "cloud-database-engineer", business: "cloud-digital-leader",
};
export function recommendationWhy(cert: ToolCertification) {
  const level = `${cert.level[0].toUpperCase()}${cert.level.slice(1)}`;
  return `${level} credential. ${cert.experience ? `Google recommends: ${cert.experience}` : "Google does not state recommended experience in this registry snapshot."}`;
}
/** A study-path suggestion, not a test of eligibility or exam readiness. */
export function recommendCertifications(answers: PickerAnswers, certs: ToolCertification[]) {
  const ids: string[] = [];
  const business = answers.role === "business" || answers.goal === "foundation" || answers.focus === "business";
  const ai = answers.focus === "ml" || answers.focus === "agents";
  const ready = answers.cloud !== "none" && answers.cloud !== "six-months" && answers.industry !== "new";
  const foundation = ai ? "generative-ai-leader" : "cloud-digital-leader";
  const associate = answers.focus === "workspace" ? "associate-google-workspace-administrator" : answers.focus === "data" || answers.role === "data" ? "data-practitioner" : "cloud-engineer";
  if (business) ids.push(foundation);
  else if (ready && answers.goal === "specialize") ids.push(specialists[answers.focus]);
  else ids.push(associate);
  if (!business && !ready && answers.cloud === "none") ids.push(foundation);
  if (answers.goal !== "foundation" && answers.focus !== "business") ids.push(specialists[answers.focus]);
  return [...new Set(ids)].slice(0, 3).flatMap(id => {
    const cert = certs.find(cert => cert.cert_id === id);
    return cert ? [{ cert, why: `${id === ids[0] ? "Suggested starting point for your selected role, focus and goal." : "An alternative or longer-term direction for your selected focus."} ${recommendationWhy(cert)}` }] : [];
  });
}
export function pickerHash(ids: string[]) { return `#certs=${ids.join(",")}`; }
export function readPickerHash(hash: string, certs: ToolCertification[]) {
  if (!/^#certs=[a-z,-]+$/.test(hash)) return [];
  return [...new Set(hash.slice(7).split(","))].slice(0, 3).flatMap(id => {
    const cert = certs.find(cert => cert.cert_id === id);
    return cert ? [{ cert, why: recommendationWhy(cert) }] : [];
  });
}
