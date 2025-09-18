import { describe, it, expect } from "@jest/globals";
import path from "path";
import { createContentLoaderTestHarness } from "./test-utils/createContentLoaderTestHarness";

const hubDir = path.join(process.cwd(), "app/content/hub");
const spokeDir = path.join(process.cwd(), "app/content/spokes");

const createHubFile = (title: string, publishedAt: string) => `---
title: "${title}"
description: "${title} description"
date: "${publishedAt}"
publishedAt: "${publishedAt}"
type: hub
tags:
  - performance
---

# ${title}
`;

const createSpokeFile = (title: string, publishedAt: string, order: number, hubSlug: string) => `---
title: "${title}"
description: "${title} description"
date: "${publishedAt}"
publishedAt: "${publishedAt}"
type: spoke
hubSlug: "${hubSlug}"
spokeOrder: ${order}
tags:
  - performance
---

# ${title}
`;

describe("Content Loader performance-friendly behaviour", () => {
  it("loads all hub entries asynchronously without using sync fs fallbacks", async () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 5; i += 1) {
      const publishedAt = `2024-01-0${i + 1}`;
      files[path.join(hubDir, `article-${i}.md`)] = createHubFile(`Article ${i}`, publishedAt);
    }

    const harness = await createContentLoaderTestHarness({
      directories: [hubDir],
      files,
    });

    const { getAllHubContent } = harness.loader;

    const content = await getAllHubContent();

    expect(content).toHaveLength(5);
    expect(harness.fsMocks.readFile).toHaveBeenCalledTimes(5);
    expect(harness.fsMocks.readFileSync).not.toHaveBeenCalled();
  });

  it("reuses cached hub content on repeated aggregate reads", async () => {
    const files = {
      [path.join(hubDir, "cached.md")]: createHubFile("Cached", "2024-02-01"),
    };

    const harness = await createContentLoaderTestHarness({
      directories: [hubDir],
      files,
    });

    const { getAllHubContent } = harness.loader;

    await getAllHubContent();
    await getAllHubContent();

    expect(harness.fsMocks.readFile).toHaveBeenCalledTimes(1);
    expect(harness.cacheMocks.get.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(harness.cacheMocks.set).toHaveBeenCalledTimes(1);
  });

  it("handles parallel requests across hub and spoke content without redundant reads", async () => {
    const files = {
      [path.join(hubDir, "parallel-hub.md")]: createHubFile("Parallel Hub", "2024-03-01"),
      [path.join(spokeDir, "parallel-spoke.md")]: createSpokeFile("Parallel Spoke", "2024-03-02", 1, "parallel-hub"),
    };

    const harness = await createContentLoaderTestHarness({
      directories: [hubDir, spokeDir],
      files,
    });

    const { getHubContent, getSpokeContent } = harness.loader;

    const [hub, spoke] = await Promise.all([
      getHubContent("parallel-hub"),
      getSpokeContent("parallel-spoke"),
    ]);

    expect(hub?.meta.title).toBe("Parallel Hub");
    expect(spoke?.meta.title).toBe("Parallel Spoke");
    expect(harness.fsMocks.readFile).toHaveBeenCalledTimes(2);
    expect(harness.fsMocks.readFileSync).not.toHaveBeenCalled();
  });
});
