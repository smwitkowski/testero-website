import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/auth/rate-limiter";

// Input validation schema
const studyPathRequestSchema = z.object({
  score: z.number().min(0).max(100),
  domains: z.array(
    z.object({
      domain: z.string(),
      correct: z.number(),
      total: z.number(),
      percentage: z.number(),
    })
  ),
});

// Types
interface DomainScore {
  domain: string;
  correct: number;
  total: number;
  percentage: number;
}

interface StudyRecommendation {
  domain: string;
  priority: "high" | "medium" | "low";
  topics: string[];
  estimatedTime: string;
}

// Priority thresholds for domain performance categorization
const PRIORITY_THRESHOLD_HIGH = 40;
const PRIORITY_THRESHOLD_MEDIUM = 70;

// Threshold for determining weak performance in topic generation
const WEAK_PERFORMANCE_THRESHOLD = 50;

/**
 * Calculates the priority level for a domain based on performance percentage
 * @param percentage - The percentage score (0-100) for the domain
 * @returns Priority level: "high" (< 40%), "medium" (40-70%), or "low" (> 70%)
 */
function calculatePriority(percentage: number): "high" | "medium" | "low" {
  if (percentage < PRIORITY_THRESHOLD_HIGH) return "high";
  if (percentage < PRIORITY_THRESHOLD_MEDIUM) return "medium";
  return "low";
}

/**
 * Generates personalized topic recommendations based on domain and performance
 * @param domain - The knowledge domain (e.g., "Neural Networks", "Machine Learning Basics")
 * @param percentage - The percentage score in this domain
 * @returns Array of topic recommendations tailored to the user's performance level
 */
function generateTopics(domain: string, percentage: number): string[] {
  const isWeak = percentage < WEAK_PERFORMANCE_THRESHOLD;

  // Domain-specific topic recommendations
  const topicMap: Record<string, { weak: string[]; strong: string[] }> = {
    "Neural Networks": {
      weak: [
        "Introduction to Neural Networks",
        "Perceptrons and Activation Functions",
        "Backpropagation Fundamentals",
      ],
      strong: [
        "Advanced Neural Architectures",
        "Optimization Algorithms",
        "Neural Network Regularization",
      ],
    },
    "Machine Learning Basics": {
      weak: [
        "Supervised vs Unsupervised Learning",
        "Model Evaluation Metrics",
        "Feature Engineering Basics",
      ],
      strong: ["Advanced Model Selection", "Ensemble Methods", "Feature Selection Techniques"],
    },
    "Model Optimization": {
      weak: [
        "Overfitting and Underfitting",
        "Regularization Techniques",
        "Hyperparameter Tuning Basics",
      ],
      strong: [
        "Advanced Hyperparameter Optimization",
        "Automated ML Pipelines",
        "Model Compression Techniques",
      ],
    },
    // Default topics for unknown domains
    default: {
      weak: ["Fundamental Concepts", "Basic Techniques", "Practice Problems"],
      strong: ["Advanced Concepts", "Optimization Strategies", "Real-world Applications"],
    },
  };

  const topics = topicMap[domain] || topicMap.default;
  return isWeak ? topics.weak : topics.strong;
}

/**
 * Estimates the study time required based on priority level
 * @param priority - The priority level of the domain
 * @returns Estimated time range as a human-readable string
 */
function estimateTime(priority: "high" | "medium" | "low"): string {
  switch (priority) {
    case "high":
      return "2-3 weeks";
    case "medium":
      return "1-2 weeks";
    case "low":
      return "1 week";
  }
}

/**
 * Generates comprehensive study path recommendations from diagnostic results
 * @param domains - Array of domain scores from diagnostic test
 * @returns Array of study recommendations sorted by priority (weakest domains first)
 */
function generateRecommendations(domains: DomainScore[]): StudyRecommendation[] {
  // Sort domains by percentage (lowest first - highest priority)
  const sortedDomains = [...domains].sort((a, b) => a.percentage - b.percentage);

  return sortedDomains.map((domain) => {
    const priority = calculatePriority(domain.percentage);
    return {
      domain: domain.domain,
      priority,
      topics: generateTopics(domain.domain, domain.percentage),
      estimatedTime: estimateTime(priority),
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    // Extract IP for rate limiting
    const ip =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

    // Check rate limit
    if (!(await checkRateLimit(ip))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }

    // Validate input
    const validationResult = studyPathRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }

    // Check authentication
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { score, domains } = validationResult.data;

    // Generate recommendations
    const recommendations = generateRecommendations(domains);

    // Try to save study path to database (optional - don't fail if it doesn't work)
    let studyPathId = null;
    try {
      const { data: studyPath, error: dbError } = await supabase
        .from("study_paths")
        .insert({
          user_id: user.id,
          diagnostic_score: score,
          recommendations: recommendations,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!dbError && studyPath) {
        studyPathId = studyPath.id;
      } else if (dbError) {
        // Structured logging for database errors
        console.error("[StudyPath API] Database error:", {
          error: dbError.message,
          userId: user.id,
          timestamp: new Date().toISOString(),
          context: "saving study path",
          recommendationCount: recommendations.length,
        });
      }
    } catch (error) {
      // Structured logging for unexpected errors
      console.error("[StudyPath API] Unexpected error saving study path:", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: user.id,
        timestamp: new Date().toISOString(),
        context: "database operation",
      });
    }

    // Return recommendations
    const response: {
      status: string;
      recommendations: StudyRecommendation[];
      studyPathId?: string;
    } = {
      status: "ok",
      recommendations,
    };

    if (studyPathId) {
      response.studyPathId = studyPathId;
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    // Structured logging for API-level errors
    console.error("[StudyPath API] Request processing error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
      context: "request processing",
      ip,
    });
    return NextResponse.json({ error: "Failed to generate study path" }, { status: 500 });
  }
}
