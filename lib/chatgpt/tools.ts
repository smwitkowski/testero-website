import "server-only";
import { randomInt } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findQuestionExam, loadChatgptQuestions, type ChatgptQuestion } from "@/lib/chatgpt/questions";
import { DEFAULT_CHATGPT_EXAM, getChatgptExam, getChatgptExams } from "@/lib/chatgpt/exams";
import { getCertification } from "@/lib/certifications/data";
import { scheduleChatgptEvent } from "@/lib/chatgpt/analytics";

type PracticeExam = NonNullable<ReturnType<typeof getChatgptExam>>;
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
  return { ...result({ error: "Choose a question from an enabled practice set and a valid option label." }), isError: true };
}
function domains(exam: PracticeExam, questions: readonly ChatgptQuestion[]) {
  return exam.domains.map((domain, index) => ({
    domain: domain.domainCode, number: String(index + 1), title: domain.displayName,
    sampling_weight: domain.weight,
    question_count: questions.filter(question => question.domain === domain.domainCode).length,
  }));
}
function resolveDomain(exam: PracticeExam, value: string) {
  return domains(exam, []).find(domain => [domain.domain, domain.number, domain.title.toLowerCase()].includes(value.trim().toLowerCase())
    || domain.domain === value.trim());
}
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const noauth = { securitySchemes: [{ type: "noauth" }] };

/** Fresh server per HTTP request; no account, score, learner answer or session state is retained. */
export function createChatgptServer(request: Request) {
  const available = getChatgptExams().map(exam => exam.id);
  // prefault validates the default too: disabling PMLE must not silently enable it.
  const examInput = z.enum(available, { error: `Unknown or disabled exam. Available exams: ${available.join(", ") || "none"}.` })
    .prefault(DEFAULT_CHATGPT_EXAM).describe("Enabled exam ID. Omit for Professional Machine Learning Engineer (PMLE).");
  const server = new McpServer({ name: "testero", version: "1.1.0" }, {
    instructions: "Google Cloud exam practice from a fixed IDs-only selection for each enabled exam, subject to current availability. The default exam is PMLE. Show one question and its options, wait for the learner to choose, then call check_answer. Keep any score only in the conversation. Questions may repeat. This app does only four things: exam overview, practice domains, one practice question at a time, and answer checks with explanations for every option. Describe only those; do not offer or describe mock exams, timed tests, adaptive practice, study plans, readiness assessments or score predictions. This app does not sell anything and has no prices, plans, purchases or checkout: if the learner asks about pricing, paid plans or unlocking more, say this app provides only its free practice sets, and do not look up or present prices, plans or purchase or checkout links. Testero is independent, not affiliated with Google.",
  });
  server.registerTool("exam_overview", {
    title: "Exam overview",
    description: "Read stored exam format, recommended experience and guide domains for an enabled Google Cloud exam. Defaults to PMLE. Does not register for an exam or predict a result.",
    inputSchema: z.object({ exam: examInput }).strict(), annotations, _meta: noauth,
  }, async ({ exam: examId }) => {
    const exam = getChatgptExam(examId);
    if (!exam) return unavailable();
    const questions = await loadChatgptQuestions(exam.id);
    if (!questions) return unavailable();
    try {
      const cert = getCertification(exam.certId);
      const variant = cert?.exam_variants.find(item => item.variant === "standard");
      const guide = cert?.guides.find(item => item.variant === "standard");
      if (!cert || !variant || !guide) return unavailable();
      // Deliberately project only study facts; registry records also contain transaction fields.
      return result({ exam_id: exam.id, exam: cert.name, duration_minutes: variant.duration_minutes,
        question_count: variant.question_count, question_types: variant.question_types,
        languages: variant.languages, recommended_experience: cert.recommended_experience,
        guide_as_of: guide.as_of_date,
        guide_retrieved_at: cert.sources.filter(source => source.role === "exam_guide" && source.url === guide.url)
          .map(source => source.retrieved_at).sort().at(-1) ?? null,
        certification_page_retrieved_at: cert.sources.filter(source => source.role === "certification")
          .map(source => source.retrieved_at).sort().at(-1) ?? null,
        recommended_experience_retrieved_at: cert.sources.filter(source => source.role === "recommended_experience")
          .map(source => source.retrieved_at).sort().at(-1) ?? null,
        domains: domains(exam, questions), available_questions: questions.length,
        practice_selection_size: exam.questionIds.length,
        ...(exam.weightNote ? { weight_note: exam.weightNote } : {}),
        ...(exam.id === DEFAULT_CHATGPT_EXAM ? { informational_link: `https://testero.ai/certifications/machine-learning-engineer${TAGS}` } : {}),
      });
    } catch { return unavailable(); }
  });
  server.registerTool("list_practice_domains", {
    title: "List practice domains",
    description: "List an enabled exam's supported domains and available original questions from its fixed IDs-only selection. Defaults to PMLE. Domain codes, exact titles or numbers select a practice domain.",
    inputSchema: z.object({ exam: examInput }).strict(), annotations, _meta: noauth,
  }, async ({ exam: examId }) => {
    const exam = getChatgptExam(examId);
    if (!exam) return unavailable();
    const questions = await loadChatgptQuestions(exam.id);
    if (!questions) return unavailable();
    return result({ exam_id: exam.id, domains: domains(exam, questions), total_questions: exam.questionIds.length, available_questions: questions.length });
  });
  server.registerTool("get_practice_question", {
    title: "Get a practice question",
    description: "Get one randomly selected eligible original question and A–D options from an enabled exam's fixed selection, optionally within a domain. Defaults to PMLE. Availability may decrease and questions may repeat. No answer or explanation is returned; wait for a choice before checking it.",
    inputSchema: z.object({ exam: examInput,
      domain: z.string().min(1).max(200).optional().describe("Domain code, exact title, or number from list_practice_domains for this exam. Omit for mixed practice.") }).strict(),
    annotations: { ...annotations, idempotentHint: false }, _meta: noauth,
  }, async ({ exam: examId, domain }) => {
    const exam = getChatgptExam(examId);
    if (!exam) return unavailable();
    const selectedDomain = domain === undefined ? undefined : resolveDomain(exam, domain);
    if (domain !== undefined && !selectedDomain) return { ...result({ error: "Choose a supported domain for this exam.", exam_id: exam.id,
      available_domains: domains(exam, []).map(item => ({ domain: item.domain, title: item.title, number: item.number })) }), isError: true };
    const questions = await loadChatgptQuestions(exam.id);
    if (!questions) return unavailable();
    const pool = questions.filter(question => !selectedDomain || question.domain === selectedDomain.domain);
    if (!pool.length) return problem();
    const question = pool[randomInt(pool.length)];
    scheduleChatgptEvent(request, "chatgpt_question_served", exam.id, question.domain);
    return result({ exam_id: exam.id, question_id: question.id, domain: question.domain, stem: question.stem,
      options: question.options.map(option => ({ label: option.label, text: option.text })),
    });
  });
  server.registerTool("check_answer", {
    title: "Check a practice answer",
    description: "Check a chosen A–D label for a question in an enabled exam's fixed practice set. Returns right/wrong, the correct option, and full explanations for every option. No answer history is stored. Cannot retrieve questions outside enabled sets.",
    inputSchema: z.object({ question_id: z.string().uuid().describe("Question ID returned by get_practice_question."),
      selected_label: z.enum(["A", "B", "C", "D"]).describe("The learner's selected option label.") }).strict(),
    annotations, _meta: noauth,
  }, async ({ question_id, selected_label }) => {
    const exam = findQuestionExam(question_id);
    if (!exam) return problem();
    const questions = await loadChatgptQuestions(exam.id);
    if (!questions) return unavailable();
    const question = questions.find(item => item.id === question_id);
    if (!question) return problem();
    const correct = question.options.find(option => option.is_correct);
    if (!correct) return problem();
    const isCorrect = selected_label === correct.label;
    scheduleChatgptEvent(request, "chatgpt_answer_checked", exam.id, question.domain, isCorrect);
    return result({ exam_id: exam.id, question_id: question.id, domain: question.domain, is_correct: isCorrect,
      selected_label, correct_option: correct.label,
      options: question.options.map(option => ({ label: option.label, text: option.text, explanation: option.explanation })),
      ...(exam.id === DEFAULT_CHATGPT_EXAM ? { informational_link: `https://testero.ai/diagnostic${TAGS}` } : {}),
    });
  });
  return server;
}
