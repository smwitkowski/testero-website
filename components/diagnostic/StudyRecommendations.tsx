import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DomainBreakdown, QuestionSummary, StudyRecommendation } from "./types";

interface StudyRecommendationsProps {
  score: number;
  domainBreakdown: DomainBreakdown[];
  incorrectQuestions: QuestionSummary[];
}

type PerformanceTone = "success" | "warning" | "accent" | "danger";

function getPerformanceLevel(score: number): {
  title: string;
  message: string;
  tone: PerformanceTone;
} {
  if (score >= 80) {
    return {
      title: "Excellent Performance!",
      message: "You're ready for the exam. Keep practicing to maintain your edge.",
      tone: "success",
    };
  } else if (score >= 60) {
    return {
      title: "Good Progress",
      message: "You're making solid progress. Focus on weak areas to reach exam readiness.",
      tone: "accent",
    };
  } else if (score >= 40) {
    return {
      title: "Focus Needed",
      message:
        "Strengthen your foundation in key areas. Consistent practice will improve your readiness.",
      tone: "warning",
    };
  } else {
    return {
      title: "Foundation Building",
      message: "Start with basics and build up your knowledge systematically.",
      tone: "danger",
    };
  }
}

function generateRecommendations(
  score: number,
  domainBreakdown: DomainBreakdown[],
  incorrectQuestions: QuestionSummary[]
): StudyRecommendation[] {
  const recommendations: StudyRecommendation[] = [];

  // Sort domains by percentage (lowest first) for prioritization
  const sortedDomains = [...domainBreakdown].sort((a, b) => a.percentage - b.percentage);

  // Add domain-specific recommendations for weak areas
  sortedDomains.forEach((domain) => {
    if (domain.percentage < 50) {
      recommendations.push({
        priority: "high",
        domain: domain.domain,
        message: `Focus on ${domain.domain} - Currently at ${domain.percentage}%`,
        actionItems: [
          "Complete practice problems in this domain",
          "Review documentation and key concepts",
          "Work through hands-on labs",
        ],
      });
    } else if (domain.percentage < 70) {
      recommendations.push({
        priority: "medium",
        domain: domain.domain,
        message: `Improve ${domain.domain} - Currently at ${domain.percentage}%`,
        actionItems: ["Practice advanced topics", "Review edge cases and best practices"],
      });
    }
  });

  // Add general recommendations based on score
  if (score >= 80) {
    if (score === 100) {
      recommendations.push({
        priority: "low",
        domain: "General",
        message: "Perfect Score! Maintain excellence through regular practice.",
        actionItems: [
          "Take practice tests weekly",
          "Help others learn to reinforce your knowledge",
          "Stay updated with latest developments",
        ],
      });
    } else {
      recommendations.push({
        priority: "low",
        domain: "General",
        message: "Maintain your knowledge with regular practice.",
        actionItems: [
          "Take practice tests to stay sharp",
          "Review any missed topics",
          "Explore advanced scenarios",
        ],
      });
    }
  }

  // Add topic review for incorrect questions
  if (incorrectQuestions.length > 0 && score < 80) {
    recommendations.push({
      priority: "high",
      domain: "Review Topics",
      message: "Review these topics from your incorrect answers",
      actionItems: incorrectQuestions
        .slice(0, 3)
        .map((q) => `Review: ${q.stem.substring(0, 50)}...`),
    });
  }

  // Ensure we have both high and medium priority items for visual indicator tests
  if (
    score >= 40 &&
    score < 80 &&
    recommendations.filter((r) => r.priority === "medium").length === 0
  ) {
    recommendations.push({
      priority: "medium",
      domain: "Practice",
      message: "Regular practice will improve your performance",
      actionItems: ["Complete daily practice questions", "Review explanations for all answers"],
    });
  }

  return recommendations;
}

export const StudyRecommendations: React.FC<StudyRecommendationsProps> = ({
  score,
  domainBreakdown,
  incorrectQuestions,
}) => {
  const performance = getPerformanceLevel(score);
  const recommendations = generateRecommendations(score, domainBreakdown, incorrectQuestions);

  // Handle empty domain data
  if (domainBreakdown.length === 0 && recommendations.length === 0) {
    recommendations.push({
      priority: "medium",
      domain: "General",
      message: "General recommendations for improvement",
      actionItems: [
        "Take diagnostic tests to identify weak areas",
        "Practice regularly to build knowledge",
        "Focus on fundamentals first",
      ],
    });
  }

  const performanceToneClass: Record<PerformanceTone, string> = {
    success: "text-[color:var(--tone-success)]",
    accent: "text-[color:var(--tone-accent)]",
    warning: "text-[color:var(--tone-warning)]",
    danger: "text-[color:var(--tone-danger)]",
  };

  const prioritySurfaces = {
    high: "border-[color:var(--tone-danger)] bg-[color:var(--tone-danger-surface)]",
    medium: "border-[color:var(--tone-warning)] bg-[color:var(--tone-warning-surface)]",
    low: "border-[color:var(--tone-success)] bg-[color:var(--tone-success-surface)]",
  } as const;

  const priorityText = {
    high: "text-[color:var(--tone-danger)]",
    medium: "text-[color:var(--tone-warning)]",
    low: "text-[color:var(--tone-success)]",
  } as const;

  const priorityBadge = {
    high: "bg-[color:var(--tone-danger-surface)] text-[color:var(--tone-danger)]",
    medium: "bg-[color:var(--tone-warning-surface)] text-[color:var(--tone-warning)]",
    low: "bg-[color:var(--tone-success-surface)] text-[color:var(--tone-success)]",
  } as const;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Study Recommendations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Performance */}
        <div className="rounded-lg bg-[color:var(--surface-muted)] p-6 text-center">
          <h3 className={cn("mb-2 text-2xl font-bold", performanceToneClass[performance.tone])}>{performance.title}</h3>
          <p className="text-muted-foreground">{performance.message}</p>
        </div>

        {/* Domain Breakdown Section */}
        {domainBreakdown.length > 0 && (
          <div data-testid="domain-breakdown-section" className="space-y-4">
            <h4 className="font-semibold text-lg">Performance by Domain</h4>
            {domainBreakdown.map((domain) => (
              <div
                key={domain.domain}
                className="flex items-center justify-between rounded-lg bg-[color:var(--surface-muted)] p-3"
                aria-label={`${domain.domain}: ${domain.correct} out of ${domain.total} correct`}
              >
                <span className="font-medium">{domain.domain}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {domain.correct}/{domain.total}
                  </span>
                  <div className="h-2 w-32 rounded-full bg-[color:var(--surface-muted)]">
                    <div
                      data-testid="domain-progress-bar"
                      className={cn(
                        "h-2 rounded-full transition-all",
                        domain.percentage >= 70
                          ? "bg-[color:var(--tone-success)]"
                          : domain.percentage >= 50
                            ? "bg-[color:var(--tone-warning)]"
                            : "bg-[color:var(--tone-danger)]"
                      )}
                      style={{ width: `${domain.percentage}%` }}
                    />
                  </div>
                  <span className="font-semibold w-12 text-right">{domain.percentage}%</span>
                  {domain.percentage < 50 && (
                    <span data-testid="weak-domain-indicator" className="sr-only">
                      Weak area
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recommendations */}
        <div className="space-y-4">
          <h4 className="font-semibold text-lg">Action Items</h4>
          {recommendations.map((rec, index) => (
            <div
              key={index}
              data-testid="recommendation-item"
              className={cn("rounded-lg border p-4 md:p-6", prioritySurfaces[rec.priority])}
            >
              <div className="flex items-start justify-between mb-2">
                <h5 className={cn("font-semibold", priorityText[rec.priority])}>
                  {rec.message}
                </h5>
                <span
                  data-testid={`${rec.priority}-priority`}
                  className={cn("rounded px-2 py-1 text-xs font-medium", priorityBadge[rec.priority])}
                >
                  {rec.priority.toUpperCase()}
                </span>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {rec.actionItems.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex items-start">
                    <span className="mr-2">?</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
