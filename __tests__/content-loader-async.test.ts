import { describe, it, expect } from "@jest/globals";
import path from "path";
import { createContentLoaderTestHarness } from "./test-utils/createContentLoaderTestHarness";

const hubDir = path.join(process.cwd(), "app/content/hub");

const createHubMarkdown = (title: string, publishedAt: string = "2024-01-01") => `---
title: "${title}"
description: "Example content"
date: "${publishedAt}"
publishedAt: "${publishedAt}"
type: hub
tags:
  - test
---

# ${title}
`;

describe("Content Loader Async Behaviour", () => {
  it("uses async fs APIs when reading a single hub document", async () => {
    const filePath = path.join(hubDir, "async-test.md");
    const harness = await createContentLoaderTestHarness({
      directories: [hubDir],
      files: {
        [filePath]: createHubMarkdown("Async Test"),
      },
    });

    const { getHubContent } = harness.loader;

    const result = await getHubContent("async-test");

    expect(result?.meta.title).toBe("Async Test");
    expect(harness.fsMocks.readFile).toHaveBeenCalledTimes(1);
    expect(harness.fsMocks.readFileSync).not.toHaveBeenCalled();
  });

  it("returns null for missing hub slugs without throwing", async () => {
    const harness = await createContentLoaderTestHarness({
      directories: [hubDir],
      files: {},
    });

    const { getHubContent } = harness.loader;

    await expect(getHubContent("missing"))
      .resolves.toBeNull();
    expect(harness.fsMocks.readFile).not.toHaveBeenCalled();
  });

  it("performs directory reads asynchronously when gathering collections", async () => {
    const harness = await createContentLoaderTestHarness({
      directories: [hubDir],
      files: {
        [path.join(hubDir, "first.md")]: createHubMarkdown("First", "2024-01-02"),
        [path.join(hubDir, "second.md")]: createHubMarkdown("Second", "2024-01-01"),
      },
    });

    const { getAllHubContent } = harness.loader;

    const results = await getAllHubContent();

    expect(results).toHaveLength(2);
    expect(results.map((entry) => entry.meta.title)).toEqual(["First", "Second"]);
    expect(harness.fsMocks.readdir).toHaveBeenCalledWith(hubDir);
    expect(harness.fsMocks.readdirSync).not.toHaveBeenCalled();
  });

  it("reuses cached content on subsequent reads to avoid duplicate async work", async () => {
    const filePath = path.join(hubDir, "cache.md");
    const harness = await createContentLoaderTestHarness({
      directories: [hubDir],
      files: {
        [filePath]: createHubMarkdown("Cache Test"),
      },
    });

    const { getHubContent } = harness.loader;

    const first = await getHubContent("cache");
    const second = await getHubContent("cache");

    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    expect(harness.cacheMocks.get).toHaveBeenCalledTimes(2);
    expect(harness.cacheMocks.set).toHaveBeenCalledTimes(1);
    expect(harness.fsMocks.readFile).toHaveBeenCalledTimes(1);
  });
});
