import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import * as contentLoader from "@/lib/content/loader";
import fs from "fs";
import path from "path";

// Mock data for performance testing
const mockContentData = {
  title: "Test Content",
  description: "Test description",
  date: "2024-01-01",
  author: "Test Author",
  category: "test",
  tags: ["test", "performance"],
};

const mockMarkdownContent = `---
title: ${mockContentData.title}
description: ${mockContentData.description}
date: ${mockContentData.date}
author: ${mockContentData.author}
category: ${mockContentData.category}
tags: ${mockContentData.tags.join(", ")}
---

# Test Content

This is test content for performance testing. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
`.repeat(10); // Repeat to create larger content

describe("Content Loader Performance Tests", () => {
  const testContentDir = path.join(process.cwd(), "__tests__", "test-content");
  const hubDir = path.join(testContentDir, "hub");
  const spokesDir = path.join(testContentDir, "spokes");

  beforeEach(() => {
    // Create test directories and files
    fs.mkdirSync(testContentDir, { recursive: true });
    fs.mkdirSync(hubDir, { recursive: true });
    fs.mkdirSync(spokesDir, { recursive: true });

    // Create 50 test files for performance testing
    for (let i = 0; i < 50; i++) {
      fs.writeFileSync(path.join(hubDir, `test-hub-${i}.md`), mockMarkdownContent);
      fs.writeFileSync(path.join(spokesDir, `test-spoke-${i}.md`), mockMarkdownContent);
    }
  });

  afterEach(() => {
    // Clean up test files
    fs.rmSync(testContentDir, { recursive: true, force: true });
  });

  describe("Event Loop Blocking", () => {
    it("should not block event loop when reading multiple files", async () => {
      const startTime = Date.now();
      let eventLoopBlocked = false;

      // Set up a timer to check if event loop is blocked
      const checkInterval = setInterval(() => {
        const now = Date.now();
        if (now - startTime > 100) {
          eventLoopBlocked = true;
        }
      }, 10);

      // Read all content files
      await contentLoader.getAllHubContent();

      clearInterval(checkInterval);

      expect(eventLoopBlocked).toBe(false);
    });

    it("should handle concurrent requests efficiently", async () => {
      const concurrentRequests = 20;
      const startTime = Date.now();

      // Create concurrent requests
      const promises = Array(concurrentRequests)
        .fill(null)
        .map(() => contentLoader.getAllHubContent());

      await Promise.all(promises);

      const duration = Date.now() - startTime;

      // Should complete within reasonable time (less than 2 seconds for 20 concurrent requests)
      expect(duration).toBeLessThan(2000);
    });
  });

  describe("Performance Benchmarks", () => {
    it("should read 50 files in under 500ms", async () => {
      const startTime = Date.now();

      const content = await contentLoader.getAllHubContent();

      const duration = Date.now() - startTime;

      expect(content.length).toBeGreaterThanOrEqual(50);
      expect(duration).toBeLessThan(500);
    });

    it("should benefit from caching on repeated reads", async () => {
      // First read - cold cache
      const firstReadStart = Date.now();
      await contentLoader.getAllHubContent();
      const firstReadDuration = Date.now() - firstReadStart;

      // Second read - should hit cache
      const secondReadStart = Date.now();
      await contentLoader.getAllHubContent();
      const secondReadDuration = Date.now() - secondReadStart;

      // Cache should make second read significantly faster (at least 50% improvement)
      expect(secondReadDuration).toBeLessThan(firstReadDuration * 0.5);
    });

    it("should handle large content sets without memory issues", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Read content multiple times
      for (let i = 0; i < 10; i++) {
        await contentLoader.getAllHubContent();
        await contentLoader.getAllSpokeContent();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe("Response Time Under Load", () => {
    it("should maintain sub-100ms response time for single file reads", async () => {
      const iterations = 100;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await contentLoader.getHubContent(`test-hub-${i % 50}`);
        durations.push(Date.now() - start);
      }

      const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);

      expect(averageDuration).toBeLessThan(100);
      expect(maxDuration).toBeLessThan(200);
    });

    it("should scale linearly with content volume", async () => {
      // Test with 10 files
      const tenFilesStart = Date.now();
      for (let i = 0; i < 10; i++) {
        await contentLoader.getHubContent(`test-hub-${i}`);
      }
      const tenFilesDuration = Date.now() - tenFilesStart;

      // Test with 50 files
      const fiftyFilesStart = Date.now();
      for (let i = 0; i < 50; i++) {
        await contentLoader.getHubContent(`test-hub-${i}`);
      }
      const fiftyFilesDuration = Date.now() - fiftyFilesStart;

      // Duration should scale roughly linearly (with some overhead tolerance)
      const scalingFactor = fiftyFilesDuration / tenFilesDuration;
      expect(scalingFactor).toBeLessThan(6); // Allow for some overhead
    });
  });
});
