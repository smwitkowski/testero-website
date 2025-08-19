/** @jest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import { AuthFlowTemplate } from "@/components/auth/AuthFlowTemplate";
import { AuthLoadingState } from "@/components/auth/states/AuthLoadingState";
import { AuthSuccessState } from "@/components/auth/states/AuthSuccessState";
import { AuthErrorState } from "@/components/auth/states/AuthErrorState";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("AuthFlowTemplate", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  test("renders with title and description", () => {
    render(
      <AuthFlowTemplate
        title="Reset Password"
        description="Enter your email to receive a password reset link"
      >
        <div>Form content</div>
      </AuthFlowTemplate>
    );

    expect(screen.getByText("Reset Password")).toBeInTheDocument();
    expect(
      screen.getByText("Enter your email to receive a password reset link")
    ).toBeInTheDocument();
    expect(screen.getByText("Form content")).toBeInTheDocument();
  });

  test("renders loading state when state is loading", () => {
    render(
      <AuthFlowTemplate title="Loading" description="Please wait" currentState="loading">
        <AuthLoadingState />
      </AuthFlowTemplate>
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  test("renders success state when state is success", () => {
    render(
      <AuthFlowTemplate title="Success" description="Operation completed" currentState="success">
        <AuthSuccessState />
      </AuthFlowTemplate>
    );

    expect(screen.getByRole("img", { name: /success/i })).toBeInTheDocument();
  });

  test("renders error state when state is error", () => {
    render(
      <AuthFlowTemplate title="Error" description="Something went wrong" currentState="error">
        <AuthErrorState />
      </AuthFlowTemplate>
    );

    expect(screen.getByRole("img", { name: /error/i })).toBeInTheDocument();
  });

  test("renders form state when state is form", () => {
    render(
      <AuthFlowTemplate title="Sign Up" description="Create your account" currentState="form">
        <form>
          <input type="email" placeholder="Email" />
          <button type="submit">Sign Up</button>
        </form>
      </AuthFlowTemplate>
    );

    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
  });

  test("applies custom className", () => {
    const { container } = render(
      <AuthFlowTemplate title="Test" className="custom-template-class">
        <div>Content</div>
      </AuthFlowTemplate>
    );

    const templateContainer = container.querySelector(".custom-template-class");
    expect(templateContainer).toBeInTheDocument();
  });

  test("handles conditional rendering based on state", () => {
    const { rerender } = render(
      <AuthFlowTemplate title="Dynamic" currentState="loading">
        <AuthLoadingState />
      </AuthFlowTemplate>
    );

    expect(screen.getByRole("status")).toBeInTheDocument();

    rerender(
      <AuthFlowTemplate title="Dynamic" currentState="success">
        <AuthSuccessState />
      </AuthFlowTemplate>
    );

    expect(screen.getByRole("img", { name: /success/i })).toBeInTheDocument();
  });

  test("renders with logo and branding", () => {
    render(
      <AuthFlowTemplate
        title="Login"
        showLogo={true}
        brandingText="Testero - ML Engineering Excellence"
      >
        <div>Login form</div>
      </AuthFlowTemplate>
    );

    expect(screen.getByText("Testero - ML Engineering Excellence")).toBeInTheDocument();
  });

  test("renders footer links", () => {
    render(
      <AuthFlowTemplate
        title="Sign Up"
        footerLinks={[
          { text: "Already have an account?", href: "/login", label: "Log In" },
          { text: "Forgot password?", href: "/forgot-password", label: "Reset" },
        ]}
      >
        <div>Sign up form</div>
      </AuthFlowTemplate>
    );

    expect(screen.getByText("Already have an account?")).toBeInTheDocument();
    expect(screen.getByText("Log In")).toBeInTheDocument();
    expect(screen.getByText("Forgot password?")).toBeInTheDocument();
    expect(screen.getByText("Reset")).toBeInTheDocument();
  });

  test("handles responsive layout", () => {
    const { container } = render(
      <AuthFlowTemplate title="Responsive" maxWidth="sm">
        <div>Content</div>
      </AuthFlowTemplate>
    );

    const contentContainer = container.querySelector(".max-w-sm");
    expect(contentContainer).toBeInTheDocument();
  });

  test("supports dark mode", () => {
    const { container } = render(
      <AuthFlowTemplate title="Dark Mode" theme="dark">
        <div>Content</div>
      </AuthFlowTemplate>
    );

    const darkContainer = container.querySelector(".dark");
    expect(darkContainer).toBeInTheDocument();
  });

  test("tracks page view analytics", () => {
    const mockTrackPageView = jest.fn();

    render(
      <AuthFlowTemplate title="Analytics Test" onMount={mockTrackPageView}>
        <div>Content</div>
      </AuthFlowTemplate>
    );

    expect(mockTrackPageView).toHaveBeenCalled();
  });
});
