import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { trackEvent, ANALYTICS_EVENTS } from "@/lib/analytics/analytics";
import { PostHog } from "posthog-node";
import { z } from "zod";
import { checkRateLimit } from "@/lib/auth/rate-limiter";
import { 
  DIAGNOSTIC_CONFIG, 
  getSessionTimeoutMs 
} from "@/lib/constants/diagnostic-config";

// Zod schema for input validation
const CreateSessionRequestSchema = z.object({
  examKey: z.literal("pmle", {
    errorMap: () => ({ message: "Only 'pmle' exam key is currently supported" })
  }),
  blueprintVersion: z.string().optional().default("current"),
  betaVariant: z.enum(["A", "B"], {
    errorMap: () => ({ message: "Beta variant must be either 'A' or 'B'" })
  }).optional(),
  source: z.string().min(1, "Source cannot be empty").optional().default("beta_welcome"),
  numQuestions: z.number()
    .int("Number of questions must be an integer")
    .min(DIAGNOSTIC_CONFIG.MIN_QUESTION_COUNT, `Must have at least ${DIAGNOSTIC_CONFIG.MIN_QUESTION_COUNT} question`)
    .max(DIAGNOSTIC_CONFIG.MAX_QUESTION_COUNT, `Cannot exceed ${DIAGNOSTIC_CONFIG.MAX_QUESTION_COUNT} questions`)
    .optional()
    .default(DIAGNOSTIC_CONFIG.BETA_QUESTION_COUNT)
});

// TypeScript interface for documentation (Zod schema is the source of truth)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

interface CreateSessionResponse {
  sessionId: string;
}

// Initialize PostHog for server-side analytics
const posthog = new PostHog(
  process.env.NEXT_PUBLIC_POSTHOG_KEY || "",
  {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
  }
);

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient();

  try {
    // Extract IP address for rate limiting
    const ip = req.headers.get("x-forwarded-for") || 
               req.headers.get("x-real-ip") || 
               "unknown";

    // Check rate limit
    if (!(await checkRateLimit(ip))) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Check beta access - user must have early access or explicit beta access
    const hasEarlyAccess = user.user_metadata?.is_early_access === true;
    const hasBetaFlag = user.user_metadata?.beta_access === true;
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (!isDevelopment && !hasEarlyAccess && !hasBetaFlag) {
      return NextResponse.json(
        { error: "Beta access required" },
        { status: 403 }
      );
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Validate input using Zod schema
    const validationResult = CreateSessionRequestSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      
      return NextResponse.json(
        { error: `Invalid request data: ${errors}` },
        { status: 400 }
      );
    }

    const { examKey, blueprintVersion, betaVariant, source, numQuestions } = validationResult.data;

    // Create diagnostic session using existing logic from main diagnostic endpoint
    const examType = "Google ML Engineer";
    const examIdToUse = 6; // PMLE exam ID

    // Get current exam version
    const { data: currentExamVersion, error: versionError } = await supabase
      .from("exam_versions")
      .select("id")
      .eq("exam_id", examIdToUse)
      .eq("is_current", true)
      .single();

    if (versionError || !currentExamVersion) {
      console.error("Error fetching current exam version:", versionError);
      return NextResponse.json(
        { error: "Could not determine current exam version." },
        { status: 500 }
      );
    }

    // Fetch diagnostic questions
    const { data: dbQuestions, error: questionsFetchError } = await supabase
      .from("questions")
      .select(
        "id, stem, topic, difficulty, options(label, text, is_correct), explanations(text)"
      )
      .eq("exam_version_id", currentExamVersion.id)
      .eq("is_diagnostic_eligible", true)
      .limit(numQuestions * DIAGNOSTIC_CONFIG.QUESTION_SELECTION_MULTIPLIER);

    if (questionsFetchError || !dbQuestions || dbQuestions.length < numQuestions) {
      console.error("Error fetching questions:", questionsFetchError);
      return NextResponse.json(
        { error: "Could not fetch enough questions for the diagnostic." },
        { status: 500 }
      );
    }

    // Randomize and select questions
    const selectedQuestions = dbQuestions
      .sort(() => 0.5 - Math.random())
      .slice(0, numQuestions);

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
      return NextResponse.json(
        { error: "Failed to start diagnostic session." },
        { status: 500 }
      );
    }

    // Create question snapshots
    const questionSnapshots = selectedQuestions.map((q) => ({
      session_id: newSession.id,
      original_question_id: q.id,
      stem: q.stem,
      options: q.options.map((opt) => ({ label: opt.label, text: opt.text })),
      correct_label: q.options.find((opt) => opt.is_correct)?.label || "",
    }));

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

    // Track analytics event
    trackEvent(
      posthog,
      ANALYTICS_EVENTS.DIAGNOSTIC_SESSION_CREATED,
      {
        session_id: newSession.id,
        exam_key: examKey,
        blueprint_version: blueprintVersion || "current",
        source: source || "beta_welcome",
        beta_variant: betaVariant,
        user_id: user.id,
      },
      user.id
    );

    return NextResponse.json({ sessionId: newSession.id } as CreateSessionResponse);
  } catch (error) {
    console.error("Error creating diagnostic session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}