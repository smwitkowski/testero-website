import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StudyRecommendations } from "@/components/diagnostic/StudyRecommendations";
import { DomainBreakdown, QuestionSummary } from "@/components/diagnostic/types";

describe("StudyRecommendations", () => {
  const mockQuestions: QuestionSummary[] = [
    {
      id: "1",
      stem: "What is machine learning?",
      userAnswer: "A",
      correctAnswer: "B",
      isCorrect: false,
      options: [
        { label: "A", text: "Wrong answer" },
        { label: "B", text: "Correct answer" },
      ],
    },
    {
      id: "2",
      stem: "What is deep learning?",
      userAnswer: "A",
      correctAnswer: "A",
      isCorrect: true,
      options: [
        { label: "A", text: "Correct answer" },
        { label: "B", text: "Wrong answer" },
      ],
    },
  ];

  const mockDomainBreakdown: DomainBreakdown[] = [
    { domain: "Machine Learning", correct: 2, total: 5, percentage: 40 },
    { domain: "Deep Learning", correct: 4, total: 5, percentage: 80 },
    { domain: "MLOps", correct: 1, total: 3, percentage: 33 },
  ];

  describe("Score-based recommendations", () => {
    it('should display "Excellent" recommendations for scores >= 80%', () => {
      render(
        <StudyRecommendations
          score={85}
          domainBreakdown={mockDomainBreakdown}
          incorrectQuestions={[]}
        />
      );

      expect(screen.getByText(/excellent performance/i)).toBeInTheDocument();
      expect(screen.getByText(/ready for the exam/i)).toBeInTheDocument();
    });

    it('should display "Good progress" recommendations for scores 60-79%', () => {
      render(
        <StudyRecommendations
          score={70}
          domainBreakdown={mockDomainBreakdown}
          incorrectQuestions={mockQuestions.filter((q) => !q.isCorrect)}
        />
      );

      expect(screen.getByText(/good progress/i)).toBeInTheDocument();
      expect(screen.getByText(/focus on weak areas/i)).toBeInTheDocument();
    });

    it('should display "Focus needed" recommendations for scores 40-59%', () => {
      render(
        <StudyRecommendations
          score={50}
          domainBreakdown={mockDomainBreakdown}
          incorrectQuestions={mockQuestions.filter((q) => !q.isCorrect)}
        />
      );

      expect(screen.getByText(/focus needed/i)).toBeInTheDocument();
      expect(screen.getByText(/strengthen your foundation/i)).toBeInTheDocument();
    });

    it('should display "Foundation building" recommendations for scores < 40%', () => {
      render(
        <StudyRecommendations
          score={30}
          domainBreakdown={mockDomainBreakdown}
          incorrectQuestions={mockQuestions}
        />
      );

      expect(screen.getByText(/foundation building/i)).toBeInTheDocument();
      expect(screen.getByText(/start with basics/i)).toBeInTheDocument();
    });
  });

  describe("Domain-specific recommendations", () => {
    it("should highlight weak domains (< 50% correct)", () => {
      render(
        <StudyRecommendations
          score={60}
          domainBreakdown={mockDomainBreakdown}
          incorrectQuestions={mockQuestions.filter((q) => !q.isCorrect)}
        />
      );

      // Should highlight Machine Learning (40%) and MLOps (33%)
      // Check for weak domain indicators
      const weakIndicators = screen.getAllByTestId("weak-domain-indicator");
      expect(weakIndicators).toHaveLength(2);

      // Check that percentages are displayed
      expect(screen.getByText("40%")).toBeInTheDocument();
      expect(screen.getByText("33%")).toBeInTheDocument(); // At least one 33% is shown

      // Check that recommendations mention these domains
      const recommendations = screen.getAllByTestId("recommendation-item");
      const recommendationTexts = recommendations.map((r) => r.textContent).join(" ");
      expect(recommendationTexts).toMatch(/MLOps.*33%/);
      expect(recommendationTexts).toMatch(/Machine Learning.*40%/);
    });

    it("should prioritize recommendations by impact", () => {
      render(
        <StudyRecommendations
          score={60}
          domainBreakdown={mockDomainBreakdown}
          incorrectQuestions={mockQuestions.filter((q) => !q.isCorrect)}
        />
      );

      // Get all recommendation items
      const recommendations = screen.getAllByTestId("recommendation-item");

      // MLOps (33%) should appear before Machine Learning (40%)
      expect(recommendations[0]).toHaveTextContent(/mlops/i);
      expect(recommendations[1]).toHaveTextContent(/machine learning/i);
    });

    it("should handle empty domain data gracefully", () => {
      render(
        <StudyRecommendations
          score={60}
          domainBreakdown={[]}
          incorrectQuestions={mockQuestions.filter((q) => !q.isCorrect)}
        />
      );

      // Should show review topics and practice recommendations
      expect(screen.queryByTestId("domain-breakdown-section")).not.toBeInTheDocument();
      const recommendations = screen.getAllByTestId("recommendation-item");
      expect(recommendations.length).toBeGreaterThan(0);
      // Should include review topics for incorrect questions
      expect(screen.getByText(/review these topics/i)).toBeInTheDocument();
    });
  });

  describe("Question-based recommendations", () => {
    it("should show specific recommendations for incorrect questions", () => {
      const incorrectQuestions = mockQuestions.filter((q) => !q.isCorrect);

      render(
        <StudyRecommendations
          score={50}
          domainBreakdown={mockDomainBreakdown}
          incorrectQuestions={incorrectQuestions}
        />
      );

      expect(screen.getByText(/review these topics/i)).toBeInTheDocument();
      // Check that the topic is mentioned in the recommendations
      const recommendations = screen.getAllByTestId("recommendation-item");
      const hasMLTopic = recommendations.some((r) => r.textContent?.includes("machine learning"));
      expect(hasMLTopic).toBe(true);
    });

    it("should not show question recommendations when all answers are correct", () => {
      render(
        <StudyRecommendations
          score={100}
          domainBreakdown={mockDomainBreakdown}
          incorrectQuestions={[]}
        />
      );

      expect(screen.queryByText(/review these topics/i)).not.toBeInTheDocument();
    });
  });

  describe("Study plan actions", () => {
    it("should provide actionable study items for weak areas", () => {
      render(
        <StudyRecommendations
          score={45}
          domainBreakdown={mockDomainBreakdown}
          incorrectQuestions={mockQuestions.filter((q) => !q.isCorrect)}
        />
      );

      // Should show specific action items - check first recommendation
      const firstRecommendation = screen.getAllByTestId("recommendation-item")[0];
      const allText = firstRecommendation.textContent || "";
      expect(allText).toMatch(/practice problems/i);
      expect(allText).toMatch(/review documentation/i);
      expect(allText).toMatch(/hands-on labs/i);
    });

    it("should suggest maintenance activities for high scores", () => {
      render(
        <StudyRecommendations
          score={90}
          domainBreakdown={mockDomainBreakdown}
          incorrectQuestions={[]}
        />
      );

      expect(screen.getByText(/maintain your knowledge/i)).toBeInTheDocument();
      expect(screen.getByText(/practice tests/i)).toBeInTheDocument();
    });
  });

  describe("Visual indicators", () => {
    it("should use appropriate colors for priority levels", () => {
      render(
        <StudyRecommendations
          score={45}
          domainBreakdown={mockDomainBreakdown}
          incorrectQuestions={mockQuestions.filter((q) => !q.isCorrect)}
        />
      );

      const highPriorityItems = screen.getAllByTestId("high-priority");
      const mediumPriorityItems = screen.getAllByTestId("medium-priority");

      expect(highPriorityItems.length).toBeGreaterThan(0);
      expect(mediumPriorityItems.length).toBeGreaterThan(0);
    });

    it("should display progress bars for domain scores", () => {
      render(
        <StudyRecommendations
          score={60}
          domainBreakdown={mockDomainBreakdown}
          incorrectQuestions={mockQuestions.filter((q) => !q.isCorrect)}
        />
      );

      const progressBars = screen.getAllByTestId("domain-progress-bar");
      expect(progressBars).toHaveLength(mockDomainBreakdown.length);
    });
  });

  describe("Edge cases", () => {
    it("should handle zero score gracefully", () => {
      render(
        <StudyRecommendations
          score={0}
          domainBreakdown={mockDomainBreakdown.map((d) => ({ ...d, correct: 0, percentage: 0 }))}
          incorrectQuestions={mockQuestions}
        />
      );

      expect(screen.getByText(/foundation building/i)).toBeInTheDocument();
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });

    it("should handle perfect score gracefully", () => {
      render(
        <StudyRecommendations
          score={100}
          domainBreakdown={mockDomainBreakdown.map((d) => ({
            ...d,
            correct: d.total,
            percentage: 100,
          }))}
          incorrectQuestions={[]}
        />
      );

      expect(screen.getByText(/perfect score/i)).toBeInTheDocument();
      expect(screen.getByText(/maintain excellence/i)).toBeInTheDocument();
    });

    it("should handle missing data gracefully", () => {
      render(<StudyRecommendations score={60} domainBreakdown={[]} incorrectQuestions={[]} />);

      expect(screen.getByText(/good progress/i)).toBeInTheDocument();
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });
  });
});
