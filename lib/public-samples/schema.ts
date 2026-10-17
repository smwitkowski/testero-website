import { z } from "zod";
import { PMLE_BLUEPRINT } from "@/lib/constants/pmle-blueprint";

export const optionLabels = ["A", "B", "C", "D"] as const;
export type OptionLabel = typeof optionLabels[number];
const text = z.string().trim().min(1);
const options = z.strictObject({ A: text, B: text, C: text, D: text });
const officialUrl = z.url().refine(value => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password &&
    ["cloud.google.com", "docs.cloud.google.com"].includes(url.hostname);
}, "Use an official Google Cloud HTTPS documentation URL");
export const publicSampleSchema = z.strictObject({
  id: z.uuid(),
  domain: text.refine(value => PMLE_BLUEPRINT.some(domain => domain.domainCode === value), "Unknown PMLE domain"),
  stem: text,
  options,
  key: z.enum(optionLabels),
  rationale: options,
  officialDocs: z.array(z.strictObject({ title: text, url: officialUrl })).min(1),
});
export const publicSamplesSchema = z.array(publicSampleSchema).refine(
  questions => questions.length === 0 || questions.length === 10,
  "Publish an empty collection or exactly ten reviewed samples",
).refine(questions => new Set(questions.map(question => question.id)).size === questions.length, "Duplicate sample IDs");
export type PublicSample = z.infer<typeof publicSampleSchema>;
