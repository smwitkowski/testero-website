/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextBestStepCard } from "@/components/dashboard/NextBestStepCard";

describe("NextBestStepCard", () => {
  it("renders AI RECOMMENDATION badge", () => {
    render(
      <NextBestStepCard
        domain="Risk Management"
        questionCount={25}
        estimatedTime="30 mins"
      />
    );

    expect(screen.getByText("AI RECOMMENDATION")).toBeInTheDocument();
  });

  it("displays recommendation description", () => {
    render(
      <NextBestStepCard
        domain="Risk Management"
        questionCount={25}
        estimatedTime="30 mins"
      />
    );

    expect(
      screen.getByText(/Targeted Practice: Strengthen your weakest area/i)
    ).toBeInTheDocument();
  });

  it("displays domain name, question count, and estimated time", () => {
    render(
      <NextBestStepCard
        domain="Risk Management"
        questionCount={25}
        estimatedTime="30 mins"
      />
    );

    expect(screen.getByText("Risk Management")).toBeInTheDocument();
    expect(screen.getByText("25 Questions")).toBeInTheDocument();
    expect(screen.getByText("30 mins")).toBeInTheDocument();
  });

  it("calls onStartSession when Start Session clicked", async () => {
    const user = userEvent.setup();
    const onStartSession = jest.fn();

    render(
      <NextBestStepCard
        domain="Risk Management"
        questionCount={25}
        estimatedTime="30 mins"
        onStartSession={onStartSession}
      />
    );

    const button = screen.getByRole("button", { name: /Start Session/i });
    await user.click(button);

    expect(onStartSession).toHaveBeenCalledTimes(1);
  });

  it("calls onChooseAnotherMode when Choose another mode clicked", async () => {
    const user = userEvent.setup();
    const onChooseAnotherMode = jest.fn();

    render(
      <NextBestStepCard
        domain="Risk Management"
        questionCount={25}
        estimatedTime="30 mins"
        onChooseAnotherMode={onChooseAnotherMode}
      />
    );

    const button = screen.getByRole("button", { name: /Choose another mode/i });
    await user.click(button);

    expect(onChooseAnotherMode).toHaveBeenCalledTimes(1);
  });
});



