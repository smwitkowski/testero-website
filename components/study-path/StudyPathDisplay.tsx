"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Clock, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DomainScore {
  domain: string;
  correct: number;
  total: number;
  percentage: number;
}

export interface DiagnosticData {
  score: number;
  domains: DomainScore[];
}

export interface StudyRecommendation {
  domain: string;
  priority: "high" | "medium" | "low";
  topics: string[];
  estimatedTime: string;
}

export interface StudyPathDisplayProps {
  diagnosticData: DiagnosticData;
}

export function StudyPathDisplay({ diagnosticData }: StudyPathDisplayProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<StudyRecommendation[]>([]);
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set());

  // Load completed topics from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("studyPathProgress");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCompletedTopics(new Set(parsed));
        }
      }
    } catch (error) {
      console.error("[StudyPath] Failed to load progress from localStorage:", error);
    }
  }, []);

  const fetchRecommendations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/study-path", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(diagnosticData),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        if (response.status === 401) {
          throw new Error("Authentication required");
        }
        throw new Error(data.error || "Failed to generate study path");
      }

      const data = (await response.json()) as { recommendations?: StudyRecommendation[] };
      setRecommendations(data.recommendations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate study path");
    } finally {
      setIsLoading(false);
    }
  }, [diagnosticData]);

  // Fetch recommendations on mount
  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const toggleTopicCompletion = (topicId: string) => {
    setCompletedTopics((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(topicId)) {
        newSet.delete(topicId);
      } else {
        newSet.add(topicId);
      }

      // Save to localStorage for persistence
      try {
        localStorage.setItem("studyPathProgress", JSON.stringify(Array.from(newSet)));
      } catch (error) {
        console.error("[StudyPath] Failed to save progress to localStorage:", error);
      }

      return newSet;
    });
  };

  // Calculate overall progress
  const totalTopics = recommendations.reduce((sum, rec) => sum + rec.topics.length, 0);
  const completedCount = completedTopics.size;
  const progressPercentage = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-600">Loading study recommendations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchRecommendations} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Your Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Completion</span>
              <span className="font-medium">{progressPercentage}% complete</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-sm text-gray-600 mt-2">
              {completedCount} of {totalTopics} topics completed
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <div className="space-y-4">
        {recommendations.map((recommendation, domainIndex) => {
          const domainTopicsCompleted = recommendation.topics.filter((topic, topicIndex) =>
            completedTopics.has(`${recommendation.domain}-${domainIndex}-${topicIndex}`)
          ).length;
          const domainProgress =
            recommendation.topics.length > 0
              ? Math.round((domainTopicsCompleted / recommendation.topics.length) * 100)
              : 0;

          return (
            <Card
              key={domainIndex}
              role="region"
              aria-label={`Study recommendations for ${recommendation.domain}`}
              className={cn(
                "recommendation-card transition-all",
                recommendation.priority === "high" && "priority-high border-red-200",
                recommendation.priority === "medium" && "priority-medium border-yellow-200",
                recommendation.priority === "low" && "priority-low border-green-200"
              )}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{recommendation.domain}</CardTitle>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-full",
                          recommendation.priority === "high" && "bg-red-100 text-red-700",
                          recommendation.priority === "medium" && "bg-yellow-100 text-yellow-700",
                          recommendation.priority === "low" && "bg-green-100 text-green-700"
                        )}
                      >
                        <Target className="w-3 h-3" />
                        {recommendation.priority} priority
                      </span>
                      <span className="flex items-center gap-1 text-gray-600">
                        <Clock className="w-3 h-3" />
                        {recommendation.estimatedTime}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{domainProgress}%</div>
                    <div className="text-xs text-gray-600">complete</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recommendation.topics.map((topic, topicIndex) => {
                    const topicId = `${recommendation.domain}-${domainIndex}-${topicIndex}`;
                    const isCompleted = completedTopics.has(topicId);

                    return (
                      <div
                        key={topicIndex}
                        className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <Checkbox
                          id={topicId}
                          checked={isCompleted}
                          onCheckedChange={() => toggleTopicCompletion(topicId)}
                          aria-label={`Mark ${topic} as complete`}
                        />
                        <label
                          htmlFor={topicId}
                          className={cn(
                            "flex-1 cursor-pointer text-sm",
                            isCompleted && "line-through text-gray-500"
                          )}
                        >
                          {topic}
                        </label>
                      </div>
                    );
                  })}
                </div>
                {domainTopicsCompleted > 0 && (
                  <div className="mt-4">
                    <Progress value={domainProgress} className="h-1" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
