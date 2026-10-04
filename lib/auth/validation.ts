import { z } from "zod";
import { safeNext } from "@/lib/auth/redirects";
const email = z.string().trim().max(254).email();
const password = z.string().min(8).max(72);
const next = z.string().max(2048).optional().transform(value => safeNext(value));
export const signupSchema = z.object({ email, password, next }).strict();
export const loginSchema = signupSchema;
export const forgotPasswordSchema = z.object({ email, next }).strict();
export const resetPasswordSchema = z.object({ password }).strict();
export const logoutSchema = z.object({}).strict();
export const confirmationSchema = z.object({
  token_hash: z.string().regex(/^[A-Za-z0-9_-]{16,1024}$/).optional(),
  type: z.enum(["signup", "recovery"]).optional(),
  code: z.string().regex(/^[A-Za-z0-9_-]{8,2048}$/).optional(),
  flow: z.enum(["signup", "recovery"]).optional(),
  next,
}).strict().superRefine((value, context) => {
  const hashFlow = !!value.token_hash && !!value.type && !value.code;
  const codeFlow = !!value.code && !value.token_hash && !value.type;
  if (!hashFlow && !codeFlow) context.addIssue({ code: "custom", message: "Invalid confirmation" });
  if (value.type && value.flow && value.type !== value.flow) context.addIssue({ code: "custom", message: "Invalid confirmation" });
});
