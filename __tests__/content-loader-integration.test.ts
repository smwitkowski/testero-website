import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import * as contentLoader from "@/lib/content/loader";
import fs from "fs";
import path from "path";

describe("Content Loader Integration Tests", () => {
  const testContentDir = path.join(process.cwd(), "__tests__", "test-content-integration");
  const hubDir = path.join(testContentDir, "hub");
  const spokesDir = path.join(testContentDir, "spokes");

  // Sample content for testing
  const hubContent = {
    "certification-guide": {
      title: "Google ML Certification Guide",
      description: "Complete guide to ML certification",
      date: "2024-01-01",
      type: "hub" as const,
      content: "# Certification Guide\n\nThis is the main hub content.",
    },
    "study-roadmap": {
      title: "Study Roadmap 2024",
      description: "Your path to certification",
      date: "2024-01-02",
      type: "hub" as const,
      content: "# Study Roadmap\n\nFollow this roadmap.",
    },
  };

  const spokeContent = {
    "week-1-fundamentals": {
      title: "Week 1: ML Fundamentals",
      description: "Getting started with ML basics",
      date: "2024-01-03",
      type: "spoke" as const,
      hubSlug: "certification-guide",
      spokeOrder: 1,
      content: "# Week 1\n\nLearn the fundamentals.",
    },
    "week-2-advanced": {
      title: "Week 2: Advanced Topics",
      description: "Deep dive into ML",
      date: "2024-01-04",
      type: "spoke" as const,
      hubSlug: "certification-guide",
      spokeOrder: 2,
      content: "# Week 2\n\nAdvanced concepts.",
    },
    "resources-list": {
      title: "Resource List",
      description: "Helpful resources",
      date: "2024-01-05",
      type: "spoke" as const,
      hubSlug: "study-roadmap",
      spokeOrder: 1,
      content: "# Resources\n\nUseful links and materials.",
    },
  };

  beforeAll(() => {
    // Create test directories and files
    fs.mkdirSync(hubDir, { recursive: true });
    fs.mkdirSync(spokesDir, { recursive: true });

    // Create hub content files
    Object.entries(hubContent).forEach(([slug, data]) => {
      const frontmatter = `---
title: ${data.title}
description: ${data.description}
date: ${data.date}
type: ${data.type}
---

${data.content}`;
      fs.writeFileSync(path.join(hubDir, `${slug}.md`), frontmatter);
    });

    // Create spoke content files
    Object.entries(spokeContent).forEach(([slug, data]) => {
      const frontmatter = `---
title: ${data.title}
description: ${data.description}
date: ${data.date}
type: ${data.type}
hubSlug: ${data.hubSlug}
spokeOrder: ${data.spokeOrder}
---

${data.content}`;
      fs.writeFileSync(path.join(spokesDir, `${slug}.md`), frontmatter);
    });
  });

  afterAll(() => {
    // Clean up test files
    fs.rmSync(testContentDir, { recursive: true, force: true });
  });

  describe("Content Loading Integration", () => {
    it("should load single hub content correctly", async () => {
      const content = await contentLoader.getHubContent("certification-guide");

      expect(content).not.toBeNull();
      expect(content?.meta.title).toBe("Google ML Certification Guide");
      expect(content?.meta.type).toBe("hub");
      expect(content?.content).toContain("<h1>Certification Guide</h1>");
    });

    it("should load single spoke content correctly", async () => {
      const content = await contentLoader.getSpokeContent("week-1-fundamentals");

      expect(content).not.toBeNull();
      expect(content?.meta.title).toBe("Week 1: ML Fundamentals");
      expect(content?.meta.type).toBe("spoke");
      expect(content?.meta.hubSlug).toBe("certification-guide");
      expect(content?.meta.spokeOrder).toBe(1);
    });

    it("should load all hub content and sort by date", async () => {
      const allHubs = await contentLoader.getAllHubContent();

      expect(allHubs.length).toBeGreaterThanOrEqual(2);

      // Check sorting (newest first)
      const dates = allHubs.map((h) => new Date(h.meta.date).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
      }
    });

    it("should load spokes for a specific hub", async () => {
      const spokes = await contentLoader.getSpokesForHub("certification-guide");

      expect(spokes.length).toBe(2);
      expect(spokes[0].meta.spokeOrder).toBe(1);
      expect(spokes[1].meta.spokeOrder).toBe(2);
      expect(spokes[0].meta.title).toBe("Week 1: ML Fundamentals");
      expect(spokes[1].meta.title).toBe("Week 2: Advanced Topics");
    });

    it("should get all content slugs for static generation", async () => {
      const { hubSlugs, spokeSlugs } = await contentLoader.getAllContentSlugs();

      expect(hubSlugs).toContain("certification-guide");
      expect(hubSlugs).toContain("study-roadmap");
      expect(spokeSlugs).toContain("week-1-fundamentals");
      expect(spokeSlugs).toContain("week-2-advanced");
      expect(spokeSlugs).toContain("resources-list");
    });
  });

  describe("Markdown Processing", () => {
    it("should process markdown with GFM features", async () => {
      // Create a file with GitHub Flavored Markdown
      const gfmContent = `---
title: GFM Test
---

# Tables

| Feature | Supported |
|---------|-----------|
| Tables  | Yes       |
| Lists   | Yes       |

## Task Lists

- [x] Completed task
- [ ] Incomplete task

## Code Blocks

\`\`\`javascript
const test = 'hello';
console.log(test);
\`\`\`
`;

      fs.writeFileSync(path.join(hubDir, "gfm-test.md"), gfmContent);

      const content = await contentLoader.getHubContent("gfm-test");

      expect(content?.content).toContain("<table>");
      expect(content?.content).toContain("<code");
    });

    it("should handle special characters correctly", async () => {
      const specialContent = `---
title: Special Characters
---

# Special Characters Test

Non-breaking hyphen: Machine‑Learning
Regular hyphen: Machine-Learning
Em dash: Machine—Learning
`;

      fs.writeFileSync(path.join(hubDir, "special-chars.md"), specialContent);

      const content = await contentLoader.getHubContent("special-chars");

      // All hyphens should be normalized to regular hyphens
      expect(content?.content).toContain("Machine-Learning");
      expect(content?.content).not.toContain("Machine‑Learning");
    });

    it("should calculate reading time correctly", async () => {
      const longContent = `---
title: Long Article
---

${"Lorem ipsum dolor sit amet. ".repeat(200)}`;

      fs.writeFileSync(path.join(hubDir, "long-article.md"), longContent);

      const content = await contentLoader.getHubContent("long-article");

      // ~1200 words at 200 wpm = 6 minutes
      expect(content?.meta.readingTime).toBe(6);
    });
  });

  describe("Error Recovery", () => {
    it("should handle empty directories gracefully", async () => {
      // Temporarily rename directories
      const tempHubDir = hubDir + "-temp";
      const tempSpokesDir = spokesDir + "-temp";

      fs.renameSync(hubDir, tempHubDir);
      fs.renameSync(spokesDir, tempSpokesDir);

      const hubs = await contentLoader.getAllHubContent();
      const spokes = await contentLoader.getAllSpokeContent();

      expect(hubs).toEqual([]);
      expect(spokes).toEqual([]);

      // Restore directories
      fs.renameSync(tempHubDir, hubDir);
      fs.renameSync(tempSpokesDir, spokesDir);
    });

    it("should handle mixed valid and invalid files", async () => {
      // Create an invalid file
      fs.writeFileSync(path.join(hubDir, "not-markdown.txt"), "This is not markdown");
      fs.writeFileSync(path.join(hubDir, ".hidden.md"), "# Hidden file");

      const allHubs = await contentLoader.getAllHubContent();

      // Should only include valid .md files (not .txt or hidden files)
      const slugs = allHubs.map((h) => h.slug);
      expect(slugs).not.toContain("not-markdown");
      expect(slugs).not.toContain(".hidden");

      // Clean up
      fs.unlinkSync(path.join(hubDir, "not-markdown.txt"));
      fs.unlinkSync(path.join(hubDir, ".hidden.md"));
    });
  });

  describe("Performance with React Cache", () => {
    it("should deduplicate requests with React cache", async () => {
      // Make multiple simultaneous requests for the same content
      const promises = Array(5)
        .fill(null)
        .map(() => contentLoader.getHubContent("certification-guide"));

      const results = await Promise.all(promises);

      // All results should be identical (same reference due to caching)
      const firstResult = results[0];
      results.forEach((result) => {
        expect(result).toBe(firstResult);
      });
    });
  });
});
