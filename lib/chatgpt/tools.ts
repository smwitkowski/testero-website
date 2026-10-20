import "server-only";
import { randomInt } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CHATGPT_SELECTION_SIZE, isAllowedQuestionId, loadChatgptQuestions, type ChatgptQuestion } from "@/lib/chatgpt/questions";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";
import { getCertification } from "@/lib/certifications/data";
import { scheduleChatgptEvent } from "@/lib/chatgpt/analytics";

const DISCLAIMER = "Testero is independent, not affiliated with Google.";
const TAGS = "?utm_source=chatgpt&utm_medium=app&utm_campaign=mcp";
function result(data: Record<string, unknown>) {
  const structuredContent = { ...data, disclaimer: DISCLAIMER };
  return { content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }], structuredContent };
}
function unavailable() {
  return { ...result({ error: "Practice content is temporarily unavailable. Try again later." }), isError: true };
}
function problem() {
  return { ...result({ error: "Choose a question from this practice set and a valid option label." }), isError: true };
}
function domains(questions: readonly ChatgptQuestion[]) {
  return PMLE_BLUEPRINT.map((domain, index) => ({
    domain: domain.domainCode, number: String(index + 1), title: domain.displayName,
    sampling_weight: domain.weight,
    question_count: questions.filter(question => question.domain === domain.domainCode).length,
  }));
}
function resolveDomain(value: string) {
  return domains([]).find(domain => [domain.domain, domain.number, domain.title.toLowerCase()].includes(value.trim().toLowerCase())
    || domain.domain === value.trim());
}
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const noauth = { securitySchemes: [{ type: "noauth" }] };

/** Fresh server per HTTP request; no account, score, learner answer or session state is retained. */
export function createChatgptServer(request: Request) {
  const server = new McpServer({ name: "testero-pmle-practice", version: "1.0.0" }, {
    instructions: "PMLE practice from a fixed allowlist of 40 independent original questions across six domains, subject to current availability. Show one question and its options, wait for the learner to choose, then call check_answer. Keep any score only in the conversation. Questions may repeat. This app does not sell anything and has no prices, plans, purchases or checkout: if the learner asks about pricing, paid plans or unlocking more, say this app provides only this free practice set, and do not look up or present prices, plans or purchase or checkout links. Testero is independent, not affiliated with Google.",
  });
  server.registerTool("pmle_exam_overview", {
    title: "PMLE exam overview",
    description: "Read the PMLE exam format, recommended experience and six blueprint domains from the official guide facts cached on Testero. Does not register for an exam or predict a result.",
    inputSchema: z.object({}).strict(), annotations, _meta: noauth,
  }, async () => {
    const questions = await loadChatgptQuestions();
    if (!questions) return unavailable();
    const cert = getCertification("machine-learning-engineer")!;
    const exam = cert.exam_variants.find(variant => variant.variant === "standard")!;
    const guide = cert.guides.find(item => item.variant === "standard")!;
    return result({ exam: cert.name, duration_minutes: exam.duration_minutes,
      question_count: exam.question_count, question_types: exam.question_types,
      languages: exam.languages, recommended_experience: cert.recommended_experience,
      guide_as_of: guide.as_of_date, domains: domains(questions), available_questions: questions.length, practice_selection_size: CHATGPT_SELECTION_SIZE,
      weight_note: "Official approximate weights total 101%; sampling weights are normalized to sum to one.",
      informational_link: `https://testero.ai/certifications/machine-learning-engineer${TAGS}`,
    });
  });
  server.registerTool("list_practice_domains", {
    title: "List PMLE practice domains",
    description: "List the six PMLE domains and currently available original questions from a fixed 40-ID practice selection. Domain codes, titles or numbers can select a practice domain.",
    inputSchema: z.object({}).strict(), annotations, _meta: noauth,
  }, async () => {
    const questions = await loadChatgptQuestions();
    if (!questions) return unavailable();
    return result({ domains: domains(questions), total_questions: CHATGPT_SELECTION_SIZE, available_questions: questions.length });
  });
  server.registerTool("get_practice_question", {
    title: "Get a PMLE practice question",
    description: "Get one randomly selected eligible original question and A–D options from a fixed 40-ID selection, optionally within a PMLE domain. Availability may decrease. Questions may repeat. No answer or explanation is returned; wait for a choice before checking it.",
    inputSchema: z.object({ domain: z.string().min(1).max(200).optional().describe("PMLE domain code, exact title, or number 1–6. Omit for mixed practice.") }).strict(),
    annotations: { ...annotations, idempotentHint: false }, _meta: noauth,
  }, async ({ domain }) => {
    const selectedDomain = domain === undefined ? undefined : resolveDomain(domain);
    if (domain !== undefined && !selectedDomain) return problem();
    const questions = await loadChatgptQuestions();
    if (!questions) return unavailable();
    const pool = questions.filter(question => !selectedDomain || question.domain === selectedDomain.domain);
    if (!pool.length) return problem();
    const question = pool[randomInt(pool.length)];
    scheduleChatgptEvent(request, "chatgpt_question_served", question.domain);
    return result({ question_id: question.id, domain: question.domain, stem: question.stem,
      options: question.options.map(option => ({ label: option.label, text: option.text })),
    });
  });
  server.registerTool("check_answer", {
    title: "Check a PMLE practice answer",
    description: "Check a chosen A–D label for a question in this fixed practice set. Returns right/wrong, the correct option, and full explanations for every option. No answer history is stored. Cannot retrieve questions outside this set.",
    inputSchema: z.object({ question_id: z.string().uuid().describe("Question ID returned by get_practice_question."),
      selected_label: z.enum(["A", "B", "C", "D"]).describe("The learner's selected option label.") }).strict(),
    annotations, _meta: noauth,
  }, async ({ question_id, selected_label }) => {
    if (!isAllowedQuestionId(question_id)) return problem();
    const questions = await loadChatgptQuestions();
    if (!questions) return unavailable();
    const question = questions.find(item => item.id === question_id);
    if (!question) return problem();
    const correct = question.options.find(option => option.is_correct);
    if (!correct) return problem();
    const isCorrect = selected_label === correct.label;
    scheduleChatgptEvent(request, "chatgpt_answer_checked", question.domain, isCorrect);
    return result({ question_id: question.id, domain: question.domain, is_correct: isCorrect,
      selected_label, correct_option: correct.label,
      options: question.options.map(option => ({ label: option.label, text: option.text, explanation: option.explanation })),
      informational_link: `https://testero.ai/diagnostic${TAGS}`,
    });
  });
  return server;
}
