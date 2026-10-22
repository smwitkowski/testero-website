import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { isInternalRequest } from "@/lib/analytics/server";
import { getChatgptExam } from "@/lib/chatgpt/exams";

type ChatgptEvent = "chatgpt_question_served" | "chatgpt_answer_checked";
/** Event-only identity, never an IP, cookie, chat text, question ID or supplied analytics ID. */
export function scheduleChatgptEvent(request: Request, event: ChatgptEvent, examId: string, domain: string, isCorrect?: boolean) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY || isInternalRequest(request)) return;
  const exam = getChatgptExam(examId);
  if (!exam?.domains.some(item => item.domainCode === domain)) return;
  try {
    after(async () => {
      try {
        await fetch(`${(process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "")}/i/v0/e/`, {
          method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
          signal: AbortSignal.timeout(1000),
          body: JSON.stringify({ api_key: process.env.NEXT_PUBLIC_POSTHOG_KEY, event, properties: {
            distinct_id: `chatgpt_event_${randomUUID()}`, source: "server", $process_person_profile: false,
            $geoip_disable: true, exam_id: examId, domain,
            ...(event === "chatgpt_answer_checked" && typeof isCorrect === "boolean" ? { is_correct: isCorrect } : {}),
          } }),
        });
      } catch { /* Best effort: analytics cannot change a tool result. */ }
    });
  } catch { /* No request lifecycle context: do not affect practice. */ }
}
