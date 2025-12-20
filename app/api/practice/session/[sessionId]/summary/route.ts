import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPmleDomainConfig } from "@/lib/constants/pmle-blueprint";
import { canUseFeature } from "@/lib/access/pmleEntitlements";
import { getPmleAccessLevelForRequest } from "@/lib/access/pmleEntitlements.server";

// Types for practice questions with responses
interface PracticeResponse {
  selected_label: string;
  is_correct: boolean;
  responded_at: string;
}

interface PracticeQuestionWithResponse {
  id: string;
  stem: string;
  options: Array<{ label: string; text: string }>;
  correct_label: string;
  canonical_question_id: string | null;
  domain_code: string | null;
  domain_id: string | null;
  practice_responses: PracticeResponse[] | null;
}

/**
 * GET /api/practice/session/[sessionId]/summary
 * 
 * Returns practice session results: score, domain breakdown, question review.
 * Mirrors the diagnostic summary endpoint pattern.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const supabase = createServerSupabaseClient();

  // Get PMLE access level for entitlement checks
  const { accessLevel, user } = await getPmleAccessLevelForRequest();

  // Check if user can access practice summary
  if (!canUseFeature(accessLevel, "PRACTICE_SESSION")) {
    return NextResponse.json({ code: "PAYWALL" }, { status: 403 });
  }

  try {
    const { sessionId } = await params;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    // Practice sessions require authentication
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Fetch session from DB
    const { data: dbSession, error: sessionError } = await supabase
      .from("practice_sessions")
      .select("id, user_id, completed_at, exam, created_at, question_count, source, source_session_id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !dbSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Authorization check
    if (dbSession.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized to access this session" }, { status: 403 });
    }

    // Check if session is completed
    if (!dbSession.completed_at) {
      return NextResponse.json({ error: "Session not completed yet" }, { status: 400 });
    }

    // Fetch practice questions (snapshots) with responses and domain info
    const { data: questionsWithResponses, error: questionsError } = await supabase
      .from("practice_questions")
      .select(`
        id,
        stem,
        options,
        correct_label,
        canonical_question_id,
        domain_code,
        domain_id,
        practice_responses (
          selected_label,
          is_correct,
          responded_at
        )
      `)
      .eq("session_id", sessionId)
      .order("id", { ascending: true });

    if (questionsError) {
      console.error("Error fetching questions with responses:", questionsError);
      return NextResponse.json({ error: "Failed to load session data" }, { status: 500 });
    }

    // Calculate overall statistics
    const totalQuestions = questionsWithResponses.length;
    const correctAnswers = questionsWithResponses.filter(
      (q) => q.practice_responses?.[0]?.is_correct
    ).length;
    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

    // Calculate domain breakdown from snapshot domain_code
    const domainStats: { [key: string]: { correct: number; total: number } } = {};

    const typedQuestions = questionsWithResponses as PracticeQuestionWithResponse[];

    typedQuestions
      .filter((q) => q.domain_code) // Only process questions with domain_code
      .forEach((q) => {
        // Get human-readable domain name from blueprint config
        const domainCode = q.domain_code!;
        const domainConfig = getPmleDomainConfig(domainCode);
        const domain = domainConfig?.displayName || domainCode;

        if (!domainStats[domain]) {
          domainStats[domain] = { correct: 0, total: 0 };
        }

        domainStats[domain].total++;
        if (q.practice_responses?.[0]?.is_correct) {
          domainStats[domain].correct++;
        }
      });

    const domainBreakdown = Object.entries(domainStats).map(([domain, stats]) => ({
      domain,
      correct: stats.correct,
      total: stats.total,
      percentage: Math.round((stats.correct / stats.total) * 100),
    }));

    // Gate explanations based on access level
    const canAccessExplanations = canUseFeature(accessLevel, "EXPLANATIONS");

    let explanationByCanonicalId: Record<string, string> = {};

    if (canAccessExplanations) {
      // Fetch canonical explanations in bulk
      const canonicalQuestionIds = typedQuestions
        .map((q) => q.canonical_question_id)
        .filter((id): id is string => id !== null && id !== undefined);

      if (canonicalQuestionIds.length > 0) {
        const { data: canonicalExplanations, error: canonicalExplanationsError } = await supabase
          .from("explanations")
          .select("question_id, explanation_text")
          .in("question_id", canonicalQuestionIds);

        if (canonicalExplanationsError) {
          console.error("Error fetching canonical explanations for summary:", canonicalExplanationsError);
        } else if (canonicalExplanations) {
          explanationByCanonicalId = Object.fromEntries(
            canonicalExplanations.map((e: { question_id: string; explanation_text: string }) => [
              e.question_id,
              e.explanation_text,
            ])
          );
        }
      }
    }

    // Format questions for client, including explanations (if user has access)
    const questions = typedQuestions.map((q) => {
      let explanation: string | null = null;

      if (canAccessExplanations && q.canonical_question_id) {
        explanation = explanationByCanonicalId[q.canonical_question_id] ?? null;
      }

      return {
        id: q.id,
        stem: q.stem,
        options: q.options,
        userAnswer: q.practice_responses?.[0]?.selected_label || "",
        correctAnswer: q.correct_label,
        isCorrect: q.practice_responses?.[0]?.is_correct || false,
        explanation,
        domain: q.domain_code
          ? getPmleDomainConfig(q.domain_code)?.displayName || q.domain_code
          : null,
      };
    });

    const summary = {
      sessionId: dbSession.id,
      exam: dbSession.exam,
      totalQuestions,
      correctAnswers,
      score,
      startedAt: dbSession.created_at,
      completedAt: dbSession.completed_at,
      source: dbSession.source,
      sourceSessionId: dbSession.source_session_id,
      questions,
    };

    return NextResponse.json({
      summary,
      domainBreakdown,
    });
  } catch (error) {
    console.error("GET practice summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

