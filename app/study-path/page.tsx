"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StudyPathDisplay } from "@/components/study-path";

interface DiagnosticData {
  score: number;
  domains: Array<{
    domain: string;
    correct: number;
    total: number;
    percentage: number;
  }>;
}

const StudyPathPage = () => {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticData | null>(null);

  useEffect(() => {
    // For now, get data from sessionStorage (minimal implementation)
    const storedData = sessionStorage.getItem("diagnosticData");
    if (storedData) {
      try {
        setDiagnosticData(JSON.parse(storedData));
      } catch (error) {
        console.error("Error parsing diagnostic data:", error);
      }
    }
  }, []);

  // Determine message based on score
  const getScoreMessage = (score: number) => {
    if (score < 40) {
      return {
        title: "Foundation Building",
        message: "Let's focus on building strong fundamentals in key areas.",
      };
    } else if (score < 60) {
      return {
        title: "Good Progress",
        message: "You're making solid progress. Let's strengthen weak areas.",
      };
    } else if (score < 80) {
      return {
        title: "Strong Performance",
        message: "Great job! Let's fine-tune your knowledge for exam readiness.",
      };
    } else {
      return {
        title: "Excellent Performance",
        message: "Outstanding! Maintain your edge with targeted practice.",
      };
    }
  };

  const scoreMessage = diagnosticData ? getScoreMessage(diagnosticData.score) : null;

  // Handle authentication states
  if (isAuthLoading) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="text-center">Loading...</div>
      </main>
    );
  }

  // If user is not authenticated, show login prompt but still display data
  if (!user) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold mb-8">Your Personalized Study Path</h1>

        {/* Show diagnostic data if available */}
        {diagnosticData && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Your Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-blue-600">{diagnosticData.score}%</div>
                  <div className="text-gray-600">Overall Score</div>
                </div>
                {scoreMessage && (
                  <div className="text-center p-4 rounded-lg bg-gray-50">
                    <h3 className="text-xl font-semibold mb-2">{scoreMessage.title}</h3>
                    <p className="text-gray-600">{scoreMessage.message}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Login prompt */}
        <Card className="mb-6">
          <CardContent className="text-center py-8">
            <h2 className="text-xl font-semibold mb-4">
              Sign in to access your personalized study path
            </h2>
            <p className="text-gray-600 mb-6">
              Create an account or sign in to save your progress and get tailored recommendations.
            </p>
            <Button onClick={() => router.push("/login?redirect=/study-path")} size="lg">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Authenticated user view
  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-8">Your Personalized Study Path</h1>

      {diagnosticData && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Your Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-blue-600">{diagnosticData.score}%</div>
                <div className="text-gray-600">Overall Score</div>
              </div>
              {scoreMessage && (
                <div className="text-center p-4 rounded-lg bg-gray-50">
                  <h3 className="text-xl font-semibold mb-2">{scoreMessage.title}</h3>
                  <p className="text-gray-600">{scoreMessage.message}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Domain Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {diagnosticData.domains.map((domain) => (
                <div key={domain.domain} className="mb-4 p-3 rounded-lg bg-gray-50">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">{domain.domain}</h4>
                    <span className="font-semibold">{domain.percentage}%</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {domain.correct} out of {domain.total} correct
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {/* Study Path Recommendations */}
      {diagnosticData ? (
        <StudyPathDisplay diagnosticData={diagnosticData} />
      ) : (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Study Path</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Complete a diagnostic test to get personalized study recommendations.
            </p>
          </CardContent>
        </Card>
      )}
    </main>
  );
};

export default StudyPathPage;
