/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { RecentActivityList } from "@/components/dashboard/RecentActivityList";

const mockActivities = [
  {
    type: "exam_completed",
    title: "Completed a 50-question exam",
    score: 88,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  },
  {
    type: "domain_mastered",
    title: "Mastered 'Stakeholder Engagement'",
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
  },
  {
    type: "quiz_completed",
    title: "Finished a 25-question quiz",
    score: 75,
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
  },
];

describe("RecentActivityList", () => {
  it("renders all activity items", () => {
    render(<RecentActivityList activities={mockActivities} />);

    expect(screen.getByText(/Completed a 50-question exam/i)).toBeInTheDocument();
    expect(screen.getByText(/Mastered 'Stakeholder Engagement'/i)).toBeInTheDocument();
    expect(screen.getByText(/Finished a 25-question quiz/i)).toBeInTheDocument();
  });

  it("displays relative timestamps", () => {
    render(<RecentActivityList activities={mockActivities} />);

    expect(screen.getByText(/2 hours ago/i)).toBeInTheDocument();
    expect(screen.getByText(/1 day ago/i)).toBeInTheDocument();
    expect(screen.getByText(/3 days ago/i)).toBeInTheDocument();
  });

  it("displays scores when available", () => {
    render(<RecentActivityList activities={mockActivities} />);

    expect(screen.getByText(/Scored 88%/i)).toBeInTheDocument();
    expect(screen.getByText(/Scored 75%/i)).toBeInTheDocument();
  });

  it("renders empty state when no activities", () => {
    render(<RecentActivityList activities={[]} />);

    expect(screen.getByText(/No recent activity/i)).toBeInTheDocument();
  });
});

