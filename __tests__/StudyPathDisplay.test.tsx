import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StudyPathDisplay } from "@/components/study-path/StudyPathDisplay";

// Mock fetch
global.fetch = jest.fn();

describe("StudyPathDisplay - TDD RED Phase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  describe("Component Rendering", () => {
    it("should render loading state initially", () => {
      render(<StudyPathDisplay diagnosticData={{ score: 60, domains: [] }} />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it("should display study path recommendations after loading", async () => {
      const mockRecommendations = [
        {
          domain: "Neural Networks",
          priority: "high",
          topics: ["Introduction to Neural Networks", "Perceptrons"],
          estimatedTime: "2-3 weeks",
        },
        {
          domain: "Model Optimization",
          priority: "medium",
          topics: ["Overfitting and Underfitting"],
          estimatedTime: "1-2 weeks",
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ok",
          recommendations: mockRecommendations,
        }),
      });

      const diagnosticData = {
        score: 40,
        domains: [
          { domain: "Neural Networks", correct: 1, total: 3, percentage: 33 },
          { domain: "Model Optimization", correct: 2, total: 4, percentage: 50 },
        ],
      };

      render(<StudyPathDisplay diagnosticData={diagnosticData} />);

      await waitFor(() => {
        expect(screen.getByText("Neural Networks")).toBeInTheDocument();
        expect(screen.getByText("Model Optimization")).toBeInTheDocument();
        expect(screen.getByText(/high priority/i)).toBeInTheDocument();
        expect(screen.getByText(/2-3 weeks/i)).toBeInTheDocument();
      });
    });

    it("should display topics for each domain", async () => {
      const mockRecommendations = [
        {
          domain: "Machine Learning Basics",
          priority: "high",
          topics: [
            "Supervised vs Unsupervised Learning",
            "Model Evaluation Metrics",
            "Feature Engineering Basics",
          ],
          estimatedTime: "2 weeks",
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ok",
          recommendations: mockRecommendations,
        }),
      });

      render(
        <StudyPathDisplay
          diagnosticData={{
            score: 30,
            domains: [{ domain: "Machine Learning Basics", correct: 1, total: 5, percentage: 20 }],
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Supervised vs Unsupervised Learning")).toBeInTheDocument();
        expect(screen.getByText("Model Evaluation Metrics")).toBeInTheDocument();
        expect(screen.getByText("Feature Engineering Basics")).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("should display error message when API call fails", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      render(<StudyPathDisplay diagnosticData={{ score: 50, domains: [] }} />);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
      });
    });

    it("should retry on error when retry button is clicked", async () => {
      // First call fails
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      // Second call succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ok",
          recommendations: [
            {
              domain: "Test Domain",
              priority: "low",
              topics: ["Test Topic"],
              estimatedTime: "1 week",
            },
          ],
        }),
      });

      render(<StudyPathDisplay diagnosticData={{ score: 50, domains: [] }} />);

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByRole("button", { name: /try again/i });
      await userEvent.click(retryButton);

      // Should show loading then success
      await waitFor(() => {
        expect(screen.getByText("Test Domain")).toBeInTheDocument();
      });
    });

    it("should handle authentication errors", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Authentication required" }),
      });

      render(<StudyPathDisplay diagnosticData={{ score: 50, domains: [] }} />);

      await waitFor(() => {
        expect(screen.getByText(/authentication required/i)).toBeInTheDocument();
      });
    });
  });

  describe("Progress Tracking", () => {
    it("should allow marking topics as completed", async () => {
      const mockRecommendations = [
        {
          domain: "Neural Networks",
          priority: "high",
          topics: ["Introduction to Neural Networks"],
          estimatedTime: "1 week",
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ok",
          recommendations: mockRecommendations,
        }),
      });

      render(<StudyPathDisplay diagnosticData={{ score: 40, domains: [] }} />);

      await waitFor(() => {
        expect(screen.getByText("Introduction to Neural Networks")).toBeInTheDocument();
      });

      // Find and click the checkbox/button to mark as complete
      const completeButton = screen.getByRole("checkbox", { name: /mark.*complete/i });
      await userEvent.click(completeButton);

      // Should show as completed
      expect(completeButton).toBeChecked();
    });

    it("should show overall progress", async () => {
      const mockRecommendations = [
        {
          domain: "Domain 1",
          priority: "high",
          topics: ["Topic 1", "Topic 2", "Topic 3"],
          estimatedTime: "2 weeks",
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ok",
          recommendations: mockRecommendations,
        }),
      });

      render(<StudyPathDisplay diagnosticData={{ score: 40, domains: [] }} />);

      await waitFor(() => {
        expect(screen.getByText(/0% complete/i)).toBeInTheDocument();
      });

      // Mark one topic as complete
      const firstCheckbox = screen.getAllByRole("checkbox")[0];
      await userEvent.click(firstCheckbox);

      // Progress should update
      await waitFor(() => {
        expect(screen.getByText(/33% complete/i)).toBeInTheDocument();
      });
    });
  });

  describe("Visual Prioritization", () => {
    it("should visually distinguish high priority items", async () => {
      const mockRecommendations = [
        {
          domain: "High Priority Domain",
          priority: "high",
          topics: ["Critical Topic"],
          estimatedTime: "3 weeks",
        },
        {
          domain: "Low Priority Domain",
          priority: "low",
          topics: ["Optional Topic"],
          estimatedTime: "1 week",
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "ok",
          recommendations: mockRecommendations,
        }),
      });

      render(<StudyPathDisplay diagnosticData={{ score: 50, domains: [] }} />);

      await waitFor(() => {
        const highPriorityElement = screen
          .getByText("High Priority Domain")
          .closest(".recommendation-card");
        const lowPriorityElement = screen
          .getByText("Low Priority Domain")
          .closest(".recommendation-card");

        // High priority should have special styling
        expect(highPriorityElement).toHaveClass("priority-high");
        expect(lowPriorityElement).toHaveClass("priority-low");
      });
    });
  });
});
