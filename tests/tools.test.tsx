import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { toolCertifications } from "@/lib/tools/data";
import { defaultAnswers, recommendCertifications, pickerHash, readPickerHash } from "@/lib/tools/picker";
import { buildStudyPlan, studyPlanText } from "@/lib/tools/study-plan";
import { tools, toolPaths } from "@/lib/tools/pages";
import PickerPage from "@/app/tools/which-google-cloud-certification/page";
import StudyPage from "@/app/tools/study-plan/page";
import TrackerPage from "@/app/tools/exam-guide-changes/page";
import IndexPage from "@/app/tools/page";
import sitemap from "@/app/sitemap";
import { getCertification } from "@/lib/certifications/data";

const certs = toolCertifications();
const pmle = certs.find(cert => cert.cert_id === "machine-learning-engineer")!;
describe("certification matching", () => {
  it("offers an associate starting point and preserves official experience guidance", () => {
    const matches = recommendCertifications(defaultAnswers, certs);
    expect(matches.map(match => match.cert.cert_id)).toEqual(["cloud-engineer", "cloud-digital-leader", "cloud-architect"]);
    expect(matches[0].why).toContain("Associate"); expect(matches[0].why).toContain(matches[0].cert.experience);
  });
  it("distinguishes business AI, experienced specialists and Workspace", () => {
    expect(recommendCertifications({ ...defaultAnswers, role: "business", focus: "ml", goal: "foundation" }, certs)[0].cert.cert_id).toBe("generative-ai-leader");
    expect(recommendCertifications({ ...defaultAnswers, focus: "ml", cloud: "one-year", industry: "experienced", goal: "specialize" }, certs)[0].cert.cert_id).toBe(pmle.cert_id);
    expect(recommendCertifications({ ...defaultAnswers, focus: "workspace" }, certs)[0].cert.cert_id).toBe("associate-google-workspace-administrator");
    expect(recommendCertifications({ ...defaultAnswers, role: "data", focus: "data" }, certs)[0].cert.cert_id).toBe("data-practitioner");
  });
  it("round-trips only valid cert IDs, capped at three, without answers or PII", () => {
    const ids = [pmle.cert_id, "cloud-engineer"];
    expect(readPickerHash(pickerHash(ids), certs).map(match => match.cert.cert_id)).toEqual(ids);
    expect(readPickerHash("#certs=person@example.com", certs)).toEqual([]);
    expect(readPickerHash("#certs=unknown,cloud-engineer,cloud-engineer", certs).map(match => match.cert.cert_id)).toEqual(["cloud-engineer"]);
    expect(readPickerHash(pickerHash(certs.map(cert => cert.cert_id)), certs)).toHaveLength(3);
  });
});
describe("weighted study budgets", () => {
  it("conserves all minutes across sections and partial weeks for 101% weights", () => {
    const plan = buildStudyPlan(pmle, "2026-10-27", 5, "2026-10-16");
    expect(plan.totalWeight).toBe(101); expect(plan.totalMinutes).toBe(Math.round(11 / 7 * 300));
    expect(plan.weeks).toHaveLength(2);
    expect(plan.weeks[1]).toMatchObject({ start: "2026-10-23", end: "2026-10-26" });
    expect(plan.sections.reduce((sum, section) => sum + section.minutes, 0)).toBe(plan.totalMinutes);
    expect(plan.weeks.flatMap(week => week.tasks).reduce((sum, task) => sum + task.minutes, 0)).toBe(plan.totalMinutes);
    for (const section of plan.sections) {
      expect(Math.abs(section.minutes - plan.totalMinutes * section.weight_percent! / 101)).toBeLessThan(1);
      expect(plan.weeks.flatMap(week => week.tasks).filter(task => task.sectionId === section.id).reduce((sum, task) => sum + task.minutes, 0)).toBe(section.minutes);
    }
    expect(studyPlanText(plan)).toContain("total 101%");
    expect(studyPlanText(plan)).toContain("Week 2: 2026-10-23 – 2026-10-26");
  });
  it("merges a trailing single day without losing minutes", () => {
    const plan = buildStudyPlan(pmle, "2026-11-29", 6, "2026-10-17");
    expect(plan.weeks).toHaveLength(6);
    expect(plan.weeks.at(-1)!.end).toBe("2026-11-28");
    expect(plan.weeks.reduce((sum, week) => sum + week.minutes, 0)).toBe(plan.totalMinutes);
    expect(plan.weeks.flatMap(week => week.tasks).reduce((sum, task) => sum + task.minutes, 0)).toBe(plan.totalMinutes);
  });
  it("handles fractional weights and missing weights without inventing exam percentages", () => {
    const architect = certs.find(cert => cert.cert_id === "cloud-architect")!;
    const plan = buildStudyPlan(architect, "2026-11-13", 10, "2026-10-16");
    expect(plan.sections.find(section => section.weight_percent === 17.5)?.minutes).toBe(420);
    const noWeights = { ...pmle, guide: { ...pmle.guide, sections: pmle.guide.sections.map(section => ({ ...section, weight_percent: null })) } };
    const even = buildStudyPlan(noWeights, "2026-10-23", 6, "2026-10-16");
    expect(even.weighted).toBe(false); expect(new Set(even.sections.map(section => section.minutes))).toEqual(new Set([60]));
    expect(studyPlanText(even)).toContain("split evenly");
  });
  it("excludes sections not assessed, keeps one-day plans valid and rejects invalid input", () => {
    const renewal = getCertification("cloud-engineer")!.guides.find(guide => guide.variant === "renewal")!;
    const cert = { ...certs.find(cert => cert.cert_id === "cloud-engineer")!, guide: renewal };
    const plan = buildStudyPlan(cert, "2026-10-17", 1, "2026-10-16");
    expect(plan.sections).toHaveLength(3); expect(plan.weighted).toBe(true);
    expect(plan.weeks[0].end).toBe("2026-10-16");
    for (const date of ["2026-10-16", "2026-10-15", "2027-12-31", "2027-02-30", "", "bad"]) expect(() => buildStudyPlan(pmle, date, 5, "2026-10-16")).toThrow();
    for (const hours of [0, -1, 41, NaN, Infinity]) expect(() => buildStudyPlan(pmle, "2026-10-23", hours, "2026-10-16")).toThrow();
  });
  it("keeps beta availability and source provenance in exported schedules", () => {
    const beta = certs.find(cert => cert.cert_id === "agentic-architect")!;
    const plan = buildStudyPlan(beta, "2026-10-23", 5, "2026-10-16");
    const text = studyPlanText(plan);
    expect(text).toContain("Official beta exam guide:"); expect(text).toContain(beta.guide.url);
    expect(text).toContain("Beta registration is closed"); expect(text).toContain("Separate required labs are not scheduled");
  });
  it.each(certs)("schedules $cert_id deterministically", cert => {
    for (const days of [1, 2, 7, 45, 366]) {
      const date = new Date(Date.UTC(2026, 9, 16) + days * 86400000).toISOString().slice(0, 10);
      const plan = buildStudyPlan(cert, date, 1.5, "2026-10-16");
      expect(plan.weeks.reduce((sum, week) => sum + week.minutes, 0)).toBe(plan.totalMinutes);
      expect(plan.weeks.every(week => week.minutes === week.tasks.reduce((sum, task) => sum + task.minutes, 0))).toBe(true);
      expect(plan).toEqual(buildStudyPlan(cert, date, 1.5, "2026-10-16"));
    }
  });
});
describe("indexable tools", () => {
  it("ships explanatory copy, bounded metadata, breadcrumbs and sitemap URLs", () => {
    for (const tool of tools) { expect(tool.title.length + " | Testero".length).toBeLessThanOrEqual(60); expect(tool.description.length).toBeLessThanOrEqual(150); }
    for (const path of toolPaths) expect(sitemap().some(entry => entry.url === `https://testero.ai${path}`)).toBe(true);
    for (const Page of [PickerPage, StudyPage, TrackerPage, IndexPage]) {
      const html = renderToStaticMarkup(createElement(Page));
      expect(html).toContain("BreadcrumbList"); expect(html).toContain("These tools do not predict an exam outcome.");
      const prose = html.match(/<section class="max-w-3xl space-y-4 text-body print:hidden">([\s\S]*?)<\/section>/)![1].replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean);
      expect(prose.length).toBeGreaterThanOrEqual(150); expect(prose.length).toBeLessThanOrEqual(300);
    }
  });
  it("tracks all guides and lifecycle gaps with their actual source dates", () => {
    const html = renderToStaticMarkup(createElement(TrackerPage));
    for (const cert of certs) {
      expect(html).toContain(`id="${cert.cert_id}"`);
      for (const guide of getCertification(cert.cert_id)!.guides) expect(html).toContain(guide.url.replaceAll("&", "&amp;"));
    }
    expect(html).toContain("no full date is inferred");
    expect(html).toContain("2026-10-04"); expect(html).not.toContain("2026-10-16");
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
