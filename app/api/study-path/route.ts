import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

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

// Priority calculation based on score
function calculatePriority(percentage: number): "high" | "medium" | "low" {
  if (percentage < 40) return "high";
  if (percentage < 70) return "medium";
  return "low";
}

// Generate topics based on domain and performance
function generateTopics(domain: string, percentage: number): string[] {
  const isWeak = percentage < 50;

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

// Estimate study time based on priority
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

// Generate study path recommendations
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
      }
    } catch (error) {
      // Log error but don't fail the request
      console.error("Failed to save study path:", error);
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
    console.error("Study path generation error:", error);
    return NextResponse.json({ error: "Failed to generate study path" }, { status: 500 });
  }
}
