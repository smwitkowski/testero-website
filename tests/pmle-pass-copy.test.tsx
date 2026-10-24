import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { PMLE_PASS_PRICE, PMLE_PASS_PRICE_DISPLAY } from "@/lib/billing/pmle-pass";
import { practiceOptions } from "@/lib/pmle/practice-options";
import PricingPage, { metadata } from "@/app/pricing/page";
import FaqPage from "@/app/faq/page";

const mocks = vi.hoisted(() => ({ inventory: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/lib/pmle/inventory", () => ({ getPmleInventory: mocks.inventory }));
beforeEach(() => mocks.inventory.mockResolvedValue({ count: 237, domainCount: 6 }));

it("uses one PMLE price in display, metadata and our comparison row, without changing competitors", async () => {
  expect(PMLE_PASS_PRICE).toBe(39.99);
  expect(PMLE_PASS_PRICE_DISPLAY).toBe(`$${PMLE_PASS_PRICE.toFixed(2)}`);
  expect(renderToStaticMarkup(await PricingPage())).toContain(PMLE_PASS_PRICE_DISPLAY);
  expect(metadata.description).toContain(PMLE_PASS_PRICE_DISPLAY);
  expect(metadata.openGraph?.description).toContain(PMLE_PASS_PRICE_DISPLAY);
  expect(practiceOptions[0].price).toContain(PMLE_PASS_PRICE_DISPLAY);
  expect(practiceOptions.find(option => option.name === "GCP Study Hub")?.price).toBe("$39/month; $89/3 months; $249/year. Membership prices, not a PMLE-only purchase.");
});
it("puts no-cap practice and progress tracking in Free and concrete features in Pass", async () => {
  const html = renderToStaticMarkup(await PricingPage());
  const free = html.split('aria-labelledby="free-plan"')[1].split('aria-labelledby="paid-plan"')[0];
  for (const feature of ["Practice with no monthly limit", "correct answer after each question", "Progress tracking: per-domain history", "Diagnostic of 5, 10 or 20 questions"]) expect(free).toContain(feature);
  const pass = html.split('aria-labelledby="paid-plan"')[1];
  for (const feature of ["Explanations for the question and every option", "50 questions, 120 minutes", "Fresh-first practice", "then repeats when needed", "Weak-area drills", "diagnostic focus fallback", "Pass-only question variants", "7-day refund", "No auto-renew"]) expect(pass).toContain(feature);
});
it("uses the live original-question inventory without inventing a fallback count", async () => {
  expect(renderToStaticMarkup(await PricingPage())).toContain("Unlimited practice from 237 questions, updated weekly.");
  mocks.inventory.mockResolvedValue({ count: 19, domainCount: 2 });
  const changed = renderToStaticMarkup(await PricingPage());
  expect(changed).toContain("Unlimited practice from 19 questions, updated weekly.");
  expect(changed).toContain("across 2 domains");
  mocks.inventory.mockResolvedValue(null);
  const missing = renderToStaticMarkup(await PricingPage());
  expect(missing).not.toContain("Unlimited practice from");
  expect(missing).toContain("Practice with no monthly limit");
});
it("answers what is free and what Pass adds without the old monthly allowance", () => {
  const html = renderToStaticMarkup(<FaqPage />);
  expect(html).toContain("What’s free?");
  expect(html).toContain("What does PMLE Pass add?");
  expect(html).toContain("progress tracking by domain");
  expect(html).toContain("timed mock exams");
  expect(html).toContain(PMLE_PASS_PRICE_DISPLAY);
  expect(html).not.toMatch(/60 (?:practice )?questions|monthly free allowance/);
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}
it("guards app/components/lib against stale PMLE price and volume claims", () => {
  const violations: string[] = [];
  for (const file of ["app", "components", "lib"].flatMap(sourceFiles)) {
    const text = readFileSync(file, "utf8");
    for (const [index, line] of text.split("\n").entries()) {
      // This exact third-party membership price is not Testero's PMLE Pass.
      const competitor = file === join("lib", "pmle", "practice-options.ts") && line.includes('"price": "$39/month; $89/3 months; $249/year. Membership prices, not a PMLE-only purchase."');
      if ((!competitor && /\$39(?!\.99)(?=\D|$)|\b3900\b/.test(line)) || /unlimited questions|thousands of questions|60 (?:free )?practice questions (?:per|each)|60 questions (?:per|a) month/i.test(line)) violations.push(`${file}:${index + 1}: ${line.trim()}`);
      if (file !== join("lib", "billing", "pmle-pass.ts") && /\$39\.99|\b39\.99\b/.test(line)) violations.push(`${file}:${index + 1}: price must use the shared constant`);
    }
  }
  expect(violations).toEqual([]);
});
