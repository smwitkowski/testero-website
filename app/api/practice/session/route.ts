/**
 * Practice Session Creation API
 * 
 * Creates domain-targeted practice sessions (e.g., 10-question sets) based on
 * weak domains from diagnostic results or study plan selections.
 * 
 * Frontend Integration:
 * - Diagnostic Results UI: "Start 10-min practice on your weakest topics"
 * - Study Plan: Domain-level "Start practice (10)" buttons
 * 
 * These buttons call this endpoint with domainCodes based on selected weak domains
 * and use sessionId + route from the response to navigate to the practice session.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/auth/rate-limiter";
import { z } from "zod";
import { selectPracticeQuestionsByDomains } from "@/lib/practice/domain-selection";
import { canUseFeature } from "@/lib/access/pmleEntitlements";
import { getPmleAccessLevelForRequest } from "@/lib/access/pmleEntitlements.server";
import { getServerPostHog } from "@/lib/analytics/server-analytics";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";

// Zod schema for input validation
const CreatePracticeSessionRequestSchema = z.object({
  examKey: z.literal("pmle", {
    errorMap: () => ({ message: "Only 'pmle' exam key is currently supported" }),
  }),
  domainCodes: z
    .array(z.string().min(1, "Domain code cannot be empty"))
    .min(1, "At least one domain code must be provided"),
  questionCount: z
    .number()
    .int("Question count must be an integer")
    .min(5, "Must have at least 5 questions")
    .max(20, "Cannot exceed 20 questions")
    .optional()
    .default(10),
  source: z
    .string()
    .min(1, "Source cannot be empty")
    .optional()
    .default("study_plan_domain"),
  sourceSessionId: z.string().uuid("Invalid session ID format").optional(),
});

// TypeScript interface for documentation (Zod schema is the source of truth)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type CreatePracticeSessionRequest = z.infer<typeof CreatePracticeSessionRequestSchema>;

interface CreatePracticeSessionResponse {
  sessionId: string;
  route: string;
  questionCount: number;
  domainDistribution?: Array<{
    domainCode: string;
    selectedCount: number;
    requestedCount: number;
  }>;
}

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

    // Get PMLE access level for entitlement checks
    const { accessLevel, user } = await getPmleAccessLevelForRequest();

    // Check authentication (practice sessions require login)
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
    const validationResult = CreatePracticeSessionRequestSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errors = validationResult.error.errors
        .map((err) => `${err.path.join(".")}: ${err.message}`)
        .join(", ");

      return NextResponse.json({ error: `Invalid request data: ${errors}` }, { status: 400 });
    }

    const { examKey, domainCodes, questionCount, source, sourceSessionId } = validationResult.data;

    // Check practice session access based on access level
    const canAccessUnlimitedPractice = canUseFeature(accessLevel, "PRACTICE_SESSION");
    const canAccessFreeQuota = canUseFeature(accessLevel, "PRACTICE_SESSION_FREE_QUOTA");

    if (!canAccessUnlimitedPractice && !canAccessFreeQuota) {
      // User doesn't have access to practice sessions
      const posthog = getServerPostHog();
      if (posthog) {
        trackEvent(
          posthog,
          ANALYTICS_EVENTS.ENTITLEMENT_CHECK_FAILED,
          {
            route: "/api/practice/session",
            reason: "insufficient_access_level",
            accessLevel,
            feature: "PRACTICE_SESSION",
            userId: user.id,
          },
          user.id
        );
      }
      return NextResponse.json({ code: "PAYWALL" }, { status: 403 });
    }

    // If user has free quota access but not unlimited, check quota limits
    if (canAccessFreeQuota && !canAccessUnlimitedPractice) {
      // Free tier: Check and increment quota
      const { checkAndIncrementQuota } = await import("@/lib/practice/quota");
      const quotaResult = await checkAndIncrementQuota(supabase, user.id, examKey, questionCount);
      
      if (!quotaResult.allowed) {
        const posthog = getServerPostHog();
        if (posthog) {
           trackEvent(
              posthog,
              ANALYTICS_EVENTS.PRACTICE_QUOTA_EXCEEDED,
              {
                  userId: user.id,
                  exam: examKey,
                  week_start: quotaResult.usage?.week_start,
                  sessions_started: quotaResult.usage?.sessions_started,
                  questions_served: quotaResult.usage?.questions_served
              },
              user.id
           );
        }
        return NextResponse.json({ code: "FREE_QUOTA_EXCEEDED" }, { status: 403 });
      }
    }

    // Map examKey to exam_id (currently only PMLE supported)
    const examIdToUse = examKey === "pmle" ? 6 : null;
    if (!examIdToUse) {
      return NextResponse.json(
        { error: `Unsupported exam key: ${examKey}` },
        { status: 400 }
      );
    }

    // Select questions using domain-based selector
    let selectionResult;
    try {
      selectionResult = await selectPracticeQuestionsByDomains(
        supabase,
        examKey,
        domainCodes,
        questionCount
      );
    } catch (error) {
      // Log detailed error for debugging
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error("Error selecting practice questions:", {
        error: errorMessage,
        stack: errorStack,
        examKey,
        domainCodes,
        questionCount,
      });
      
      // For unexpected errors, return 500 with generic message
      return NextResponse.json(
        { error: "Could not fetch questions for the practice session." },
        { status: 500 }
      );
    }

    const selectedQuestions = selectionResult.questions;

    // Validate we have at least some questions
    if (selectedQuestions.length === 0) {
      console.warn("Practice session creation: No questions selected", {
        domainCodes,
        questionCount,
        domainDistribution: selectionResult.domainDistribution,
      });
      return NextResponse.json(
        { error: "No questions available for the requested domains." },
        { status: 404 }
      );
    }

    // Create practice_sessions record
    const { data: newSession, error: sessionError } = await supabase
      .from("practice_sessions")
      .insert({
        user_id: user.id,
        exam: examKey,
        exam_id: examIdToUse,
        source: source,
        source_session_id: sourceSessionId || null,
        question_count: selectedQuestions.length,
      })
      .select("id")
      .single();

    if (sessionError || !newSession) {
      console.error("Error creating practice session:", sessionError);
      return NextResponse.json(
        { error: "Failed to create practice session." },
        { status: 500 }
      );
    }

    // Create practice_questions snapshots
    const questionSnapshots = selectedQuestions.map((q) => {
      return {
        session_id: newSession.id,
        canonical_question_id: q.id,
        stem: q.stem,
        options: q.answers.map((opt) => ({
          label: opt.choice_label,
          text: opt.choice_text,
        })),
        correct_label: q.answers.find((opt) => opt.is_correct)?.choice_label || "",
        domain_code: q.domain_code,
        domain_id: q.domain_id,
      };
    });

    const { error: snapshotError } = await supabase
      .from("practice_questions")
      .insert(questionSnapshots);

    if (snapshotError) {
      console.error("Error creating question snapshots:", snapshotError);
      // Clean up session if snapshot creation fails
      await supabase.from("practice_sessions").delete().eq("id", newSession.id);
      return NextResponse.json(
        { error: "Failed to prepare practice questions." },
        { status: 500 }
      );
    }

    // Build response with route for frontend navigation
    // Route format matches new practice session page structure
    const response: CreatePracticeSessionResponse = {
      sessionId: newSession.id,
      route: `/practice/session/${newSession.id}`,
      questionCount: selectedQuestions.length,
      domainDistribution: selectionResult.domainDistribution.map((dist) => ({
        domainCode: dist.domainCode,
        selectedCount: dist.selectedCount,
        requestedCount: dist.requestedCount,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error creating practice session:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

