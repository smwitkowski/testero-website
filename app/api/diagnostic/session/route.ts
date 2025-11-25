/**
 * Diagnostic Session Creation Endpoint (Alternative/API-focused)
 * 
 * NOTE: This endpoint provides an alternative API-focused interface for creating diagnostic sessions.
 * The PRIMARY frontend path uses POST /api/diagnostic with action: "start".
 * 
 * This endpoint uses the same canonical PMLE selection logic as the main diagnostic endpoint.
 * Both endpoints now use selectPmleQuestionsByBlueprint() for PMLE exams.
 * 
 * TODO: Consider consolidating these endpoints or clearly documenting when to use each.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
// Analytics imports for future use
import { trackDiagnosticStartWithCampaign } from "@/lib/analytics/campaign-analytics-integration";
import { PostHog } from "posthog-node";
import { z } from "zod";
import { checkRateLimit } from "@/lib/auth/rate-limiter";
import { DIAGNOSTIC_CONFIG, getSessionTimeoutMs } from "@/lib/constants/diagnostic-config";
import { requireSubscriber } from "@/lib/auth/require-subscriber";
import { selectPmleQuestionsByBlueprint } from "@/lib/diagnostic/pmle-selection";

// Zod schema for input validation
const CreateSessionRequestSchema = z.object({
  examKey: z.literal("pmle", {
    errorMap: () => ({ message: "Only 'pmle' exam key is currently supported" }),
  }),
  blueprintVersion: z.string().optional().default("current"),
  betaVariant: z
    .enum(["A", "B"], {
      errorMap: () => ({ message: "Beta variant must be either 'A' or 'B'" }),
    })
    .optional(),
  source: z.string().min(1, "Source cannot be empty").optional().default("beta_welcome"),
  numQuestions: z
    .number()
    .int("Number of questions must be an integer")
    .min(
      DIAGNOSTIC_CONFIG.MIN_QUESTION_COUNT,
      `Must have at least ${DIAGNOSTIC_CONFIG.MIN_QUESTION_COUNT} question`
    )
    .max(
      DIAGNOSTIC_CONFIG.MAX_QUESTION_COUNT,
      `Cannot exceed ${DIAGNOSTIC_CONFIG.MAX_QUESTION_COUNT} questions`
    )
    .optional()
    .default(DIAGNOSTIC_CONFIG.BETA_QUESTION_COUNT),
});

// TypeScript interface for documentation (Zod schema is the source of truth)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

interface CreateSessionResponse {
  sessionId: string;
}

// Initialize PostHog for server-side analytics
const posthog = (() => {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) {
    return null;
  }

  return new PostHog(apiKey, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
  });
})();

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient();

  try {
    // Extract IP address for rate limiting
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    // Check rate limit
    if (!(await checkRateLimit(ip))) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Premium gate check
    const block = await requireSubscriber(req, "/api/diagnostic/session");
    if (block) return block;

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    // Validate input using Zod schema
    const validationResult = CreateSessionRequestSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");

      return NextResponse.json({ error: `Invalid request data: ${errors}` }, { status: 400 });
    }

    const { examKey, blueprintVersion, betaVariant, source, numQuestions } = validationResult.data;

    // Create diagnostic session using canonical PMLE questions with blueprint weights
    const examType = "Google ML Engineer";
    const examIdToUse = 6; // PMLE exam ID

    // Select PMLE questions using canonical schema and blueprint weights
    //
    // This uses selectPmleQuestionsByBlueprint() which:
    // - Filters canonical questions by exam='GCP_PM_ML_ENG' and status='ACTIVE'
    // - Joins to answers table to build options
    // - Uses PMLE_BLUEPRINT domain weights to calculate per-domain targets
    // - Randomly selects from each domain pool to meet target counts
    // - Redistributes remaining slots if some domains have insufficient questions
    //
    // Debug logging: Set DIAGNOSTIC_BLUEPRINT_DEBUG=true to see domain distribution
    // in console logs (domain code, selectedCount/targetCount, available count)
    let selectionResult;
    try {
      selectionResult = await selectPmleQuestionsByBlueprint(supabase, numQuestions);
      
      // Debug logging for PMLE domain distribution (when enabled)
      if (process.env.DIAGNOSTIC_BLUEPRINT_DEBUG === 'true') {
        console.log(`[PMLE Diagnostic] Session creation - Domain distribution:`, 
          selectionResult.domainDistribution.map(d => 
            `${d.domainCode}: ${d.selectedCount}/${d.targetCount}`
          ).join(', ')
        );
      }
    } catch (error) {
      console.error("Error selecting PMLE questions:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not fetch questions for the diagnostic." },
        { status: 500 }
      );
    }

    const selectedQuestions = selectionResult.questions;

    // Create session
    const sessionExpiresAt = new Date(Date.now() + getSessionTimeoutMs());

    const { data: newSession, error: sessionError } = await supabase
      .from("diagnostics_sessions")
      .insert({
        user_id: user.id,
        exam_id: examIdToUse,
        exam_type: examType,
        question_count: selectedQuestions.length,
        started_at: new Date().toISOString(),
        expires_at: sessionExpiresAt.toISOString(),
        anonymous_session_id: null, // User is authenticated
      })
      .select("id")
      .single();

    if (sessionError || !newSession) {
      console.error("Error creating session:", sessionError);
      return NextResponse.json({ error: "Failed to start diagnostic session." }, { status: 500 });
    }

    // Create question snapshots with domain info
    // For PMLE canonical questions, use canonical_question_id (UUID) to link to canonical questions.
    // This endpoint only handles PMLE exams, so all questions will be canonical UUIDs.
    const questionSnapshots = selectedQuestions.map((q) => {
      // PMLE questions use UUID IDs - set canonical_question_id
      const canonicalQuestionId = typeof q.id === "string" && q.id.includes("-")
        ? q.id
        : null;

      return {
        session_id: newSession.id,
        canonical_question_id: canonicalQuestionId,
        original_question_id: null, // PMLE sessions don't use legacy bigint IDs
        stem: q.stem,
        options: q.answers.map((opt) => ({ label: opt.choice_label, text: opt.choice_text })),
        correct_label: q.answers.find((opt) => opt.is_correct)?.choice_label || "",
        domain_id: q.domain_id,
        domain_code: q.domain_code,
      };
    });

    const { error: snapshotError } = await supabase
      .from("diagnostic_questions")
      .insert(questionSnapshots);

    if (snapshotError) {
      console.error("Error creating question snapshots:", snapshotError);
      return NextResponse.json(
        { error: "Failed to prepare diagnostic questions." },
        { status: 500 }
      );
    }

    // Track analytics event with campaign attribution
    trackDiagnosticStartWithCampaign(
      posthog,
      {
        session_id: newSession.id,
        exam_key: examKey,
        exam_type: examType,
        blueprint_version: blueprintVersion || "current",
        source: source || "beta_welcome",
        beta_variant: betaVariant,
        question_count: selectedQuestions.length,
        user_id: user.id,
      },
      user.id
    );

    // Debug logging for PMLE sessions (when enabled)
    if (process.env.DIAGNOSTIC_BLUEPRINT_DEBUG === 'true') {
      console.log(`[PMLE Diagnostic] Created session ${newSession.id} with ${selectedQuestions.length} questions`);
    }

    return NextResponse.json({ sessionId: newSession.id } as CreateSessionResponse);
  } catch (error) {
    console.error("Error creating diagnostic session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
