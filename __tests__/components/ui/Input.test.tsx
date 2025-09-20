import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "@jest/globals";
import { Input } from "@/components/ui/input";

describe("Input", () => {
  test("applies minimum height and base typography for tap targets", () => {
    render(<Input placeholder="Email" />);
    const input = screen.getByPlaceholderText("Email");

    expect(input).toHaveClass("min-h-[44px]");
    expect(input).toHaveClass("py-2.5");
    expect(input).toHaveClass("text-base");
    expect(input).toHaveClass("leading-6");
  });

  test("preserves sizing classes when custom className is provided", () => {
    render(<Input placeholder="Custom" className="px-6" />);
    const input = screen.getByPlaceholderText("Custom");

    expect(input).toHaveClass("min-h-[44px]");
    expect(input).toHaveClass("px-6");
  });
});
