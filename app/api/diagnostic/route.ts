import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getAnonymousSessionIdFromCookie,
  setAnonymousSessionIdCookie,
} from "@/lib/auth/anonymous-session-server";
import { trackDiagnosticCompleteWithCampaign } from "@/lib/analytics/campaign-analytics-integration";
import { PostHog } from "posthog-node";
import { requireSubscriber } from "@/lib/auth/require-subscriber";
import { selectPmleQuestionsByBlueprint } from "@/lib/diagnostic/pmle-selection";
import { DIAGNOSTIC_CONFIG, getSessionTimeoutMs } from "@/lib/constants/diagnostic-config";

// Types for better type safety

// import { createServerActionClient } from '@supabase/auth-helpers-nextjs'; // Example, adjust if using different helper

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

// Utility functions
import type { SupabaseClient } from "@supabase/supabase-js";

async function cleanExpiredSessions(supabase: SupabaseClient) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("diagnostics_sessions")
    .delete()
    .lt("expires_at", now)
    .is("completed_at", null);

  if (error) {
    console.error("Error cleaning expired sessions:", error);
  }
}

// examType is the string from the frontend, examId is the integer FK for public.exams
function validateStartRequest(
  data: unknown
): { examType: string; numQuestions: number; anonymousSessionId?: string } | null {
  if (!data || typeof data !== "object") return null;

  const body = data as Record<string, unknown>;

  const examType = typeof body.examType === "string" ? body.examType.trim() : "Google ML Engineer"; // Default or ensure valid
  const numQuestions =
    typeof body.numQuestions === "number"
      ? Math.max(
          DIAGNOSTIC_CONFIG.MIN_QUESTION_COUNT,
          Math.min(DIAGNOSTIC_CONFIG.MAX_QUESTION_COUNT, Math.floor(body.numQuestions))
        )
      : DIAGNOSTIC_CONFIG.DEFAULT_QUESTION_COUNT; // Default num questions

  const anonymousSessionId =
    typeof body.anonymousSessionId === "string" ? body.anonymousSessionId.trim() : undefined;

  // Basic validation for examType, more robust validation/mapping to exam_id will happen in the handler
  if (!examType) return null;

  return { examType, numQuestions, anonymousSessionId };
}

function validateAnswerRequest(
  data: unknown
): { questionId: string; selectedLabel: string } | null {
  // questionId is UUID of snapshotted q
  if (!data || typeof data !== "object") return null;

  const body = data as Record<string, unknown>;

  // questionId is the UUID of the *snapshotted* question in diagnostic_questions table
  const questionId = typeof body.questionId === "string" ? body.questionId.trim() : null;
  const selectedLabel =
    typeof body.selectedLabel === "string" ? body.selectedLabel.trim().toUpperCase() : null;

  if (!questionId || !selectedLabel || !["A", "B", "C", "D"].includes(selectedLabel)) {
    return null;
  }

  return { questionId, selectedLabel };
}

// Define a type for questions fetched from the database

export async function GET(req: Request) {
  // Premium gate check
  const block = await requireSubscriber(req, "/api/diagnostic");
  if (block) return block;

  const supabase = createServerSupabaseClient();
  await cleanExpiredSessions(supabase); // Clean expired sessions

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId"); // This is diagnostics_sessions.id (UUID)
    const clientAnonymousSessionId = searchParams.get("anonymousSessionId"); // For anonymous resume attempt

    // Try to get anonymous session ID from cookie as fallback
    const cookieAnonymousSessionId = await getAnonymousSessionIdFromCookie();
    const effectiveAnonymousSessionId = clientAnonymousSessionId || cookieAnonymousSessionId;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Invalid session ID provided" }, { status: 400 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Fetch session from DB
    const { data: dbSession, error: sessionError } = await supabase
      .from("diagnostics_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !dbSession) {
      console.error("Error fetching session or session not found:", sessionError);
      return NextResponse.json({ error: "Session not found or expired." }, { status: 404 });
    }

    // Check session expiration
    if (dbSession.expires_at && new Date(dbSession.expires_at) < new Date()) {
      // Optionally delete it here or rely on cleanExpiredSessions
      return NextResponse.json({ error: "Session expired." }, { status: 410 });
    }

    // Authorization check
    if (dbSession.user_id) {
      // Session belongs to a logged-in user
      if (!user || dbSession.user_id !== user.id) {
        return NextResponse.json(
          { error: "Unauthorized to access this session." },
          { status: 403 }
        );
      }
    } else {
      // Anonymous session
      if (
        dbSession.anonymous_session_id &&
        effectiveAnonymousSessionId !== dbSession.anonymous_session_id
      ) {
        // If the session has an anonymous ID, the client must provide it to resume
        return NextResponse.json(
          { error: "Invalid anonymous session identifier." },
          { status: 403 }
        );
      }
      // If dbSession.anonymous_session_id is null, it's an older anonymous session perhaps, or an issue.
      // For now, if user_id is null and client provides no anonymousId, or if it doesn't match, deny.
    }

    // Fetch snapshotted questions for this session
    const { data: sessionQuestions, error: questionsError } = await supabase
      .from("diagnostic_questions") // This is the snapshot table
      .select("id, stem, options, original_question_id") // options are JSONB, correct_label is not sent to client initially
      .eq("session_id", sessionId);

    if (questionsError) {
      console.error("Error fetching session questions:", questionsError);
      return NextResponse.json(
        { error: "Failed to load questions for the session." },
        { status: 500 }
      );
    }

    // Reconstruct session object for client, similar to previous structure but from DB
    const clientSessionData = {
      id: dbSession.id,
      userId: dbSession.user_id, // Will be null for anonymous
      examType: dbSession.exam_type, // Textual exam type
      questions: sessionQuestions.map((q) => ({
        // These are from diagnostic_questions (snapshot)
        id: q.id, // UUID of the snapshotted question
        stem: q.stem,
        options: q.options, // JSONB options {label, text}
        // original_question_id: q.original_question_id // Not strictly needed by client during quiz
      })),
      // Answers are not sent back here; client builds them up or fetches current progress differently
      // For simplicity, client can refetch answers or this endpoint can be extended
      startedAt: dbSession.started_at,
      currentQuestion: 0, // Client will determine this based on its state or answers submitted
      expiresAt: dbSession.expires_at,
      anonymousSessionId: dbSession.anonymous_session_id, // Send back if present
    };

    return NextResponse.json({ session: clientSessionData });
  } catch (error) {
    console.error("GET diagnostic error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Main diagnostic API endpoint
 * 
 * This is the PRIMARY canonical diagnostic creation path for PMLE diagnostics.
 * The frontend diagnostic page uses this endpoint with action: "start".
 * 
 * For PMLE exams (exam_id = 6), this endpoint uses:
 * - Canonical questions schema (questions, answers, explanations, exam_domains)
 * - Blueprint-weighted domain selection via selectPmleQuestionsByBlueprint()
 * - Domain info snapshots in diagnostic_questions (domain_id, domain_code)
 * 
 * Legacy exams continue to use exam_versions and legacy question selection.
 */
export async function POST(req: Request) {
  // Premium gate check
  const block = await requireSubscriber(req, "/api/diagnostic");
  if (block) return block;

  const supabase = createServerSupabaseClient();
  await cleanExpiredSessions(supabase); // Clean expired sessions

  try {
    const body = (await req.json()) as { action: string; sessionId?: string; data?: unknown };
    const { action, sessionId, data } = body; // sessionId is diagnostics_sessions.id (UUID)

    if (typeof action !== "string" || !["start", "answer", "complete"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser(); // user can be null

    switch (action) {
      case "start":
        const validatedData = validateStartRequest(data);
        if (!validatedData) {
          return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
        }

        const {
          examType,
          numQuestions,
          anonymousSessionId: clientAnonymousSessionId,
        } = validatedData;

        // Try to get anonymous session ID from cookie as fallback
        const cookieAnonymousSessionId = await getAnonymousSessionIdFromCookie();
        const effectiveAnonymousSessionId = clientAnonymousSessionId || cookieAnonymousSessionId;

        // 1. Determine exam_id (e.g., "Google ML Engineer" -> 2)
        // This mapping should be robust, perhaps from a config or query `public.exams`
        let examIdToUse: number | null = null;
        // The questions are linked to exam_versions.id = 2, which has exam_id = 6.
        // So, "Google ML Engineer" should map to exams.id = 6.
        if (
          examType === "Google ML Engineer" ||
          examType === "Google Professional ML Engineer" ||
          examType === "Google Professional Machine Learning Engineer"
        ) {
          examIdToUse = 6;
        } else {
          // Fallback or fetch from DB:
          const { data: examData, error: examError } = await supabase
            .from("exams")
            .select("id")
            .eq("name", examType) // Or use 'code'
            .single();
          if (examError || !examData) {
            console.error(`Exam type '${examType}' not found or error:`, examError);
            return NextResponse.json({ error: `Invalid exam type: ${examType}` }, { status: 400 });
          }
          examIdToUse = examData.id;
        }
        if (!examIdToUse) {
          return NextResponse.json({ error: "Could not determine exam ID." }, { status: 400 });
        }

        // 1.b. (Optional) Resume anonymous session
        if (!user && effectiveAnonymousSessionId) {
          const { data: existingAnonSession, error: anonSessionError } = await supabase
            .from("diagnostics_sessions")
            .select("id, expires_at, completed_at")
            .eq("anonymous_session_id", effectiveAnonymousSessionId)
            .is("user_id", null)
            .order("started_at", { ascending: false })
            .limit(1)
            .single();

          if (existingAnonSession && !anonSessionError) {
            if (
              !existingAnonSession.completed_at &&
              new Date(existingAnonSession.expires_at) > new Date()
            ) {
              // Found a resumable anonymous session
              // Fetch its questions and return
              const { data: existingQuestions, error: existingQuestionsError } = await supabase
                .from("diagnostic_questions")
                .select("id, stem, options")
                .eq("session_id", existingAnonSession.id);

              if (existingQuestions && !existingQuestionsError) {
                // Ensure the cookie is set if it was missing
                if (!cookieAnonymousSessionId && effectiveAnonymousSessionId) {
                  await setAnonymousSessionIdCookie(effectiveAnonymousSessionId);
                }

                return NextResponse.json({
                  sessionId: existingAnonSession.id,
                  questions: existingQuestions,
                  totalQuestions: existingQuestions.length,
                  expiresAt: existingAnonSession.expires_at,
                  anonymousSessionId: effectiveAnonymousSessionId, // return it back
                  resumed: true,
                });
              }
            }
          }
        }

        // 2. Select questions - use canonical PMLE selection for PMLE exams, legacy for others
        let selectedQuestions: Array<{
          id: string;
          stem: string;
          options: Array<{ label: string; text: string; is_correct: boolean }>;
          domain_id?: string;
          domain_code?: string;
        }>;

        if (examIdToUse === 6) {
          // PMLE: Use canonical schema with blueprint weights
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
          try {
            const selectionResult = await selectPmleQuestionsByBlueprint(supabase, numQuestions);
            selectedQuestions = selectionResult.questions.map((q) => ({
              id: q.id,
              stem: q.stem,
              options: q.answers.map((a) => ({
                label: a.choice_label,
                text: a.choice_text,
                is_correct: a.is_correct,
              })),
              domain_id: q.domain_id,
              domain_code: q.domain_code,
            }));

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
              {
                error:
                  error instanceof Error
                    ? error.message
                    : "Could not fetch questions for the diagnostic.",
              },
              { status: 500 }
            );
          }
        } else {
          // Legacy: Use exam_versions for non-PMLE exams
          const { data: currentExamVersion, error: versionError } = await supabase
            .from("exam_versions")
            .select("id")
            .eq("exam_id", examIdToUse)
            .eq("is_current", true)
            .single();

          if (versionError || !currentExamVersion) {
            console.error(
              `Error fetching current exam version for exam_id ${examIdToUse}:`,
              versionError
            );
            return NextResponse.json(
              { error: "Could not determine current exam version." },
              { status: 500 }
            );
          }
          const currentExamVersionId = currentExamVersion.id;

          const { data: dbQuestions, error: questionsFetchError } = await supabase
            .from("questions")
            .select(
              "id, stem, topic, difficulty, options(label, text, is_correct), explanations(text)"
            )
            .eq("exam_version_id", currentExamVersionId)
            .eq("is_diagnostic_eligible", true)
            .limit(numQuestions * 5);

          if (questionsFetchError || !dbQuestions || dbQuestions.length < numQuestions) {
            console.error(
              "Error fetching questions from DB or not enough questions:",
              questionsFetchError
            );
            return NextResponse.json(
              { error: "Could not fetch enough questions for the diagnostic." },
              { status: 500 }
            );
          }

          selectedQuestions = dbQuestions.sort(() => 0.5 - Math.random()).slice(0, numQuestions);
        }

        // 3. Create diagnostics_sessions record
        const newSessionExpiresAt = new Date(Date.now() + getSessionTimeoutMs());
        const newAnonymousId = user ? null : effectiveAnonymousSessionId || crypto.randomUUID();

        const { data: newSessionRecord, error: newSessionError } = await supabase
          .from("diagnostics_sessions")
          .insert({
            user_id: user ? user.id : null,
            exam_id: examIdToUse,
            exam_type: examType, // Store the display name/requested type
            question_count: selectedQuestions.length,
            started_at: new Date().toISOString(),
            expires_at: newSessionExpiresAt.toISOString(),
            anonymous_session_id: newAnonymousId,
          })
          .select("id") // Get the generated UUID for the session
          .single();

        if (newSessionError || !newSessionRecord) {
          console.error("Error creating new session record:", newSessionError);
          return NextResponse.json(
            { error: "Failed to start diagnostic session." },
            { status: 500 }
          );
        }
        const newDbSessionId = newSessionRecord.id;

        // 4. Create diagnostic_questions (snapshot) records
        const questionSnapshotsToInsert = selectedQuestions.map((q) => ({
          session_id: newDbSessionId,
          original_question_id: q.id, // This is public.questions.id (UUID for canonical, bigint for legacy)
          stem: q.stem,
          // Ensure options are in {label: string, text: string} format for snapshot
          options: q.options.map((opt) => ({ label: opt.label, text: opt.text })),
          correct_label: q.options.find((opt) => opt.is_correct)?.label || "", // Store correct label in snapshot
          // Include domain info for canonical PMLE questions
          domain_id: q.domain_id || null,
          domain_code: q.domain_code || null,
        }));

        const { error: snapshotInsertError } = await supabase
          .from("diagnostic_questions")
          .insert(questionSnapshotsToInsert);

        if (snapshotInsertError) {
          console.error("Error inserting question snapshots:", snapshotInsertError);
          // TODO: Consider cleanup / transaction rollback if part of it fails
          return NextResponse.json(
            { error: "Failed to prepare diagnostic questions." },
            { status: 500 }
          );
        }

        // Fetch the newly created snapshots to get their UUIDs for the client
        const { data: finalSessionQuestions, error: finalQuestionsError } = await supabase
          .from("diagnostic_questions")
          .select("id, stem, options") // only id, stem, options sent to client
          .eq("session_id", newDbSessionId);

        if (finalQuestionsError || !finalSessionQuestions) {
          console.error("Error fetching final session questions for client:", finalQuestionsError);
          return NextResponse.json({ error: "Failed to load session questions." }, { status: 500 });
        }

        // Set cookie for new anonymous sessions
        if (!user && newAnonymousId) {
          await setAnonymousSessionIdCookie(newAnonymousId);
        }

        // Debug logging for PMLE sessions (when enabled)
        if (examIdToUse === 6 && process.env.DIAGNOSTIC_BLUEPRINT_DEBUG === 'true') {
          console.log(`[PMLE Diagnostic] Created session ${newDbSessionId} with ${finalSessionQuestions.length} questions`);
        }

        return NextResponse.json({
          sessionId: newDbSessionId,
          questions: finalSessionQuestions, // These are from diagnostic_questions, with their UUIDs
          totalQuestions: finalSessionQuestions.length,
          expiresAt: newSessionExpiresAt.toISOString(),
          anonymousSessionId: newAnonymousId, // Send back for anonymous users
        });

      case "answer":
        if (typeof sessionId !== "string" || !sessionId) {
          return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
        }
        const validatedAnswer = validateAnswerRequest(data); // questionId is UUID of snapshotted q
        if (!validatedAnswer) {
          return NextResponse.json({ error: "Invalid answer data" }, { status: 400 });
        }

        const { questionId: snapshottedQuestionId, selectedLabel } = validatedAnswer;

        // Fetch the session
        const { data: answerDbSession, error: ansSessErr } = await supabase
          .from("diagnostics_sessions")
          .select("id, user_id, expires_at, completed_at, anonymous_session_id")
          .eq("id", sessionId)
          .single();

        if (ansSessErr || !answerDbSession) {
          return NextResponse.json({ error: "Session not found." }, { status: 404 });
        }
        if (answerDbSession.completed_at) {
          return NextResponse.json({ error: "Session already completed." }, { status: 400 });
        }
        if (new Date(answerDbSession.expires_at) < new Date()) {
          return NextResponse.json({ error: "Session expired." }, { status: 410 });
        }

        // Authorization for answer
        if (answerDbSession.user_id && (!user || answerDbSession.user_id !== user.id)) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
        }
        // For anonymous, if anonymous_session_id is set, client should provide it (not implemented here yet for answer)

        // Fetch the snapshotted question to get correct_label and original_question_id
        const { data: snapQuestion, error: snapQError } = await supabase
          .from("diagnostic_questions")
          .select("id, correct_label, original_question_id")
          .eq("id", snapshottedQuestionId) // UUID of the question in diagnostic_questions
          .eq("session_id", sessionId)
          .single();

        if (snapQError || !snapQuestion) {
          return NextResponse.json(
            { error: "Question not found in this session." },
            { status: 404 }
          );
        }

        const isCorrect = snapQuestion.correct_label === selectedLabel;

        // Store the response
        const { error: insertResponseError } = await supabase.from("diagnostic_responses").insert({
          session_id: sessionId,
          question_id: snapshottedQuestionId, // Match DB column name (was diagnostic_question_id)
          selected_label: selectedLabel,
          is_correct: isCorrect,
          responded_at: new Date().toISOString(),
        });

        if (insertResponseError) {
          console.error("Error inserting response:", insertResponseError);
          return NextResponse.json({ error: "Failed to save answer." }, { status: 500 });
        }

        // Fetch explanation from canonical explanations table using original_question_id
        // This endpoint uses canonical public.explanations as the sole explanation source.
        // Missing canonical explanations return null and are logged for cleanup.
        let explanationText: string | null = null;
        if (snapQuestion.original_question_id) {
          const { data: canonicalExplanation, error: canonicalError } = await supabase
            .from("explanations")
            .select("explanation_text")
            .eq("question_id", snapQuestion.original_question_id)
            .single();

          if (canonicalExplanation && !canonicalError) {
            explanationText = canonicalExplanation.explanation_text;
          } else {
            // Canonical explanation missing - return null and log for cleanup
            // For non-canonical or historical sessions where no canonical explanation exists,
            // the endpoint returns explanation: null rather than querying legacy tables.
            console.warn(
              `Missing canonical explanation for question ${snapQuestion.original_question_id} in session ${sessionId}`
            );
            explanationText = null;
          }
        }

        return NextResponse.json({
          isCorrect,
          correctAnswer: snapQuestion.correct_label,
          explanation: explanationText,
        });

      case "complete":
        if (typeof sessionId !== "string" || !sessionId) {
          return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
        }

        // Fetch session
        const { data: completeDbSession, error: compSessErr } = await supabase
          .from("diagnostics_sessions")
          .select(
            "id, user_id, exam_type, question_count, expires_at, completed_at, anonymous_session_id"
          )
          .eq("id", sessionId)
          .single();

        if (compSessErr || !completeDbSession) {
          return NextResponse.json({ error: "Session not found." }, { status: 404 });
        }
        if (completeDbSession.completed_at) {
          // Potentially re-fetch results if already completed
          return NextResponse.json(
            { error: "Session already marked as completed." },
            { status: 400 }
          );
        }
        if (new Date(completeDbSession.expires_at) < new Date()) {
          return NextResponse.json({ error: "Session expired." }, { status: 410 });
        }

        // Authorization for complete
        if (completeDbSession.user_id && (!user || completeDbSession.user_id !== user.id)) {
          return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
        }
        // Add anonymous check if needed

        // Fetch all responses for this session
        const { data: responses, error: responsesError } = await supabase
          .from("diagnostic_responses")
          .select("is_correct")
          .eq("session_id", sessionId);

        if (responsesError) {
          console.error("Error fetching responses for completion:", responsesError);
          return NextResponse.json(
            { error: "Could not retrieve answers to score." },
            { status: 500 }
          );
        }

        const correctAnswers = responses.filter((r) => r.is_correct).length;
        const totalQuestionsInSession = completeDbSession.question_count; // Use the count stored at session start

        const score =
          totalQuestionsInSession > 0 ? (correctAnswers / totalQuestionsInSession) * 100 : 0;

        // Update session completed_at
        const { error: updateSessionError } = await supabase
          .from("diagnostics_sessions")
          .update({ completed_at: new Date().toISOString() })
          .eq("id", sessionId);

        if (updateSessionError) {
          console.error("Error marking session complete:", updateSessionError);
          // Continue to return results even if update fails, but log it
        }

        // Track diagnostic completion with campaign attribution
        trackDiagnosticCompleteWithCampaign(
          posthog,
          {
            session_id: sessionId,
            exam_type: completeDbSession.exam_type,
            total_questions: totalQuestionsInSession,
            correct_answers: correctAnswers,
            score: Math.round(score),
            completion_time_ms: Date.now(), // Could calculate based on session start
            user_id: completeDbSession.user_id,
          },
          completeDbSession.user_id || undefined
        );

        // Simplified recommendations
        const recommendations = ["Focus on areas where you were unsure."];
        if (score < 70)
          recommendations.push(
            "Consider reviewing the fundamentals of " + completeDbSession.exam_type
          );
        else recommendations.push("Great job! Consider advanced topics or practice tests.");

        return NextResponse.json({
          totalQuestions: totalQuestionsInSession,
          correctAnswers: correctAnswers,
          score: Math.round(score),
          recommendations,
          examType: completeDbSession.exam_type,
        });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("POST diagnostic error:", error);
    // Don't leak internal error details
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}
