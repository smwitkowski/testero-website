import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QuestionReview } from "@/components/diagnostic/QuestionReview";
import { QuestionSummary } from "@/components/diagnostic/types";

describe("QuestionReview", () => {
  const mockQuestions: QuestionSummary[] = [
    {
      id: "1",
      stem: "What is the primary purpose of a neural network?",
      userAnswer: "B",
      correctAnswer: "A",
      isCorrect: false,
      options: [
        { label: "A", text: "To mimic the human brain's pattern recognition" },
        { label: "B", text: "To store large amounts of data" },
        { label: "C", text: "To perform mathematical calculations" },
        { label: "D", text: "To replace traditional algorithms" },
      ],
    },
    {
      id: "2",
      stem: "Which of the following is a supervised learning algorithm?",
      userAnswer: "C",
      correctAnswer: "C",
      isCorrect: true,
      options: [
        { label: "A", text: "K-means clustering" },
        { label: "B", text: "PCA" },
        { label: "C", text: "Linear regression" },
        { label: "D", text: "DBSCAN" },
      ],
    },
    {
      id: "3",
      stem: "This is a very long question that contains a lot of text to test the expand/collapse functionality. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
      userAnswer: "A",
      correctAnswer: "B",
      isCorrect: false,
      options: [
        { label: "A", text: "Option A with long text that might need wrapping on smaller screens" },
        { label: "B", text: "Option B is the correct answer" },
        { label: "C", text: "Option C is another choice" },
        { label: "D", text: "Option D is the final option" },
      ],
    },
  ];

  describe("Basic rendering", () => {
    it("should display all questions with numbers", () => {
      render(<QuestionReview questions={mockQuestions} />);

      expect(screen.getByText("Question 1")).toBeInTheDocument();
      expect(screen.getByText("Question 2")).toBeInTheDocument();
      expect(screen.getByText("Question 3")).toBeInTheDocument();
    });

    it("should display question stems", () => {
      render(<QuestionReview questions={mockQuestions} />);

      expect(screen.getByText(/primary purpose of a neural network/)).toBeInTheDocument();
      expect(screen.getByText(/supervised learning algorithm/)).toBeInTheDocument();
    });

    it("should display all answer options", () => {
      render(<QuestionReview questions={mockQuestions} />);

      // Check first question options
      expect(screen.getByText(/mimic the human brain/)).toBeInTheDocument();
      expect(screen.getByText(/store large amounts of data/)).toBeInTheDocument();
      expect(screen.getByText(/perform mathematical calculations/)).toBeInTheDocument();
      expect(screen.getByText(/replace traditional algorithms/)).toBeInTheDocument();
    });
  });

  describe("Correct/Incorrect indicators", () => {
    it("should show correct/incorrect badges", () => {
      render(<QuestionReview questions={mockQuestions} />);

      const incorrectBadges = screen.getAllByText("INCORRECT");
      const correctBadges = screen.getAllByText("CORRECT");

      expect(incorrectBadges).toHaveLength(2);
      expect(correctBadges).toHaveLength(1);
    });

    it("should use appropriate colors for badges", () => {
      render(<QuestionReview questions={mockQuestions} />);

      const correctBadge = screen.getAllByText("CORRECT")[0];
      const incorrectBadge = screen.getAllByText("INCORRECT")[0];

      expect(correctBadge).toHaveClass("bg-green-500");
      expect(incorrectBadge).toHaveClass("bg-red-500");
    });
  });

  describe("Answer highlighting", () => {
    it("should highlight user's answer", () => {
      render(<QuestionReview questions={mockQuestions} />);

      // For question 1, user answered B
      const question1Container = screen.getByTestId("question-1");
      const userAnswerB = within(question1Container).getByTestId("option-B");

      expect(userAnswerB).toHaveClass("border-blue-500");
      expect(within(userAnswerB).getByText(/your answer/i)).toBeInTheDocument();
    });

    it("should show correct answer when wrong", () => {
      render(<QuestionReview questions={mockQuestions} />);

      // For question 1, correct answer is A
      const question1Container = screen.getByTestId("question-1");
      const correctAnswerA = within(question1Container).getByTestId("option-A");

      expect(correctAnswerA).toHaveClass("bg-green-50");
      expect(within(correctAnswerA).getByText(/correct/i)).toBeInTheDocument();
    });

    it("should show single indicator when user answer is correct", () => {
      render(<QuestionReview questions={mockQuestions} />);

      // For question 2, user correctly answered C
      const question2Container = screen.getByTestId("question-2");
      const correctAnswerC = within(question2Container).getByTestId("option-C");

      expect(correctAnswerC).toHaveClass("bg-green-50");
      const indicators = within(correctAnswerC).getAllByText(/your answer|correct/i);
      expect(indicators).toHaveLength(1);
    });
  });

  describe("Expand/Collapse functionality", () => {
    it("should expand/collapse long questions", () => {
      render(<QuestionReview questions={mockQuestions} expandable={true} />);

      const question3Container = screen.getByTestId("question-3");
      const expandButton = within(question3Container).getByRole("button", {
        name: /expand|show more/i,
      });

      expect(expandButton).toBeInTheDocument();

      // Initially collapsed
      expect(question3Container).toHaveClass("max-h-96");

      // Click to expand
      fireEvent.click(expandButton);
      expect(question3Container).not.toHaveClass("max-h-96");

      // Click to collapse
      fireEvent.click(expandButton);
      expect(question3Container).toHaveClass("max-h-96");
    });

    it("should not show expand button for short questions", () => {
      render(<QuestionReview questions={mockQuestions} expandable={true} />);

      const question1Container = screen.getByTestId("question-1");
      const expandButton = within(question1Container).queryByRole("button", {
        name: /expand|show more/i,
      });

      expect(expandButton).not.toBeInTheDocument();
    });

    it("should not have expand functionality when expandable is false", () => {
      render(<QuestionReview questions={mockQuestions} expandable={false} />);

      const expandButtons = screen.queryAllByRole("button", { name: /expand|show more/i });
      expect(expandButtons).toHaveLength(0);
    });
  });

  describe("Group by domain", () => {
    it("should group questions by domain when enabled", () => {
      const questionsWithDomain = mockQuestions.map((q, index) => ({
        ...q,
        domain: index === 0 ? "Neural Networks" : "Machine Learning",
      }));

      render(<QuestionReview questions={questionsWithDomain} groupByDomain={true} />);

      expect(screen.getByText("Neural Networks")).toBeInTheDocument();
      expect(screen.getByText("Machine Learning")).toBeInTheDocument();
    });

    it("should show domain headers", () => {
      const questionsWithDomain = mockQuestions.map((q) => ({
        ...q,
        domain: "Machine Learning",
      }));

      render(<QuestionReview questions={questionsWithDomain} groupByDomain={true} />);

      const domainHeader = screen.getByTestId("domain-header-Machine Learning");
      expect(domainHeader).toBeInTheDocument();
      expect(domainHeader).toHaveTextContent("Machine Learning");
    });

    it("should not group when groupByDomain is false", () => {
      const questionsWithDomain = mockQuestions.map((q) => ({
        ...q,
        domain: "Machine Learning",
      }));

      render(<QuestionReview questions={questionsWithDomain} groupByDomain={false} />);

      const domainHeaders = screen.queryAllByTestId(/domain-header/);
      expect(domainHeaders).toHaveLength(0);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty questions array", () => {
      render(<QuestionReview questions={[]} />);

      expect(screen.getByText(/no questions to review/i)).toBeInTheDocument();
    });

    it("should handle questions with missing options", () => {
      const questionWithMissingOptions: QuestionSummary[] = [
        {
          id: "1",
          stem: "Test question",
          userAnswer: "A",
          correctAnswer: "B",
          isCorrect: false,
          options: [],
        },
      ];

      render(<QuestionReview questions={questionWithMissingOptions} />);

      expect(screen.getByText("Test question")).toBeInTheDocument();
      expect(screen.getByText(/no options available/i)).toBeInTheDocument();
    });

    it("should handle very long option text", () => {
      const longOptionQuestion: QuestionSummary[] = [
        {
          id: "1",
          stem: "Test question",
          userAnswer: "A",
          correctAnswer: "A",
          isCorrect: true,
          options: [
            {
              label: "A",
              text: "A".repeat(500), // Very long text
            },
          ],
        },
      ];

      render(<QuestionReview questions={longOptionQuestion} />);

      const option = screen.getByTestId("option-A");
      expect(option).toHaveClass("break-words");
    });
  });

  describe("Accessibility", () => {
    it("should have proper heading hierarchy", () => {
      render(<QuestionReview questions={mockQuestions} />);

      const mainHeading = screen.getByRole("heading", { name: /question details/i });
      expect(mainHeading).toBeInTheDocument();

      const questionHeadings = screen.getAllByRole("heading", { name: /question \d+/i });
      expect(questionHeadings).toHaveLength(3);
    });

    it("should announce correct/incorrect status to screen readers", () => {
      render(<QuestionReview questions={mockQuestions} />);

      const question1 = screen.getByTestId("question-1");
      expect(question1).toHaveAttribute("aria-label", expect.stringMatching(/incorrect/i));

      const question2 = screen.getByTestId("question-2");
      expect(question2).toHaveAttribute("aria-label", expect.stringMatching(/correct/i));
    });

    it("should be keyboard navigable", () => {
      render(<QuestionReview questions={mockQuestions} expandable={true} />);

      const expandButtons = screen.getAllByRole("button", { name: /expand|show more/i });

      expandButtons[0].focus();
      expect(expandButtons[0]).toHaveFocus();

      fireEvent.keyDown(expandButtons[0], { key: "Enter" });
      // Should expand on Enter key
    });
  });

  describe("Visual styling", () => {
    it("should have appropriate spacing between questions", () => {
      render(<QuestionReview questions={mockQuestions} />);

      const questionContainers = screen.getAllByTestId(/question-\d+/);
      questionContainers.forEach((container) => {
        expect(container).toHaveClass("mb-4");
      });
    });

    it("should have hover effects on options", () => {
      render(<QuestionReview questions={mockQuestions} />);

      const option = screen.getAllByTestId(/option-/)[0];
      expect(option).toHaveClass("hover:shadow-sm");
    });

    it("should use consistent border radius", () => {
      render(<QuestionReview questions={mockQuestions} />);

      const questionContainers = screen.getAllByTestId(/question-\d+/);
      questionContainers.forEach((container) => {
        expect(container).toHaveClass("rounded-lg");
      });
    });
  });

  describe("Filtering and searching", () => {
    it("should filter questions when filter prop is provided", () => {
      render(<QuestionReview questions={mockQuestions} filter="incorrect" />);

      const displayedQuestions = screen.getAllByTestId(/question-\d+/);
      expect(displayedQuestions).toHaveLength(2); // Only incorrect questions
    });

    it("should support custom filter function", () => {
      const customFilter = (q: QuestionSummary) => q.id === "2";

      render(<QuestionReview questions={mockQuestions} filterFn={customFilter} />);

      const displayedQuestions = screen.getAllByTestId(/question-\d+/);
      expect(displayedQuestions).toHaveLength(1);
      expect(screen.getByText(/supervised learning algorithm/)).toBeInTheDocument();
    });
  });
});
