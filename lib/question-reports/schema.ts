import { z } from "zod";
export const reportReasons = ["wrong answer", "unclear", "outdated", "typo", "other"] as const;
export const questionReportBody = z.object({
  sessionId: z.uuid(), itemId: z.uuid(), kind: z.enum(["diagnostic", "practice"]),
  reason: z.enum(reportReasons), note: z.string().trim().max(2000).default(""),
  email: z.union([z.literal(""), z.email().max(254)]).optional().default(""),
}).strict();
export type QuestionReportInput = z.infer<typeof questionReportBody>;
