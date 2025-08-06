import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import * as contentLoader from "@/lib/content/loader";
import fs from "fs";
import path from "path";

describe("Content Loader Async Operations Tests", () => {
  const testContentDir = path.join(process.cwd(), "__tests__", "test-content-async");
  const hubDir = path.join(testContentDir, "hub");
  const spokesDir = path.join(testContentDir, "spokes");

  // Mock the path.join function to redirect content paths to test directories
  let originalPathJoin: typeof path.join;
  
  beforeEach(() => {
    // Create test directories
    fs.mkdirSync(testContentDir, { recursive: true });
    fs.mkdirSync(hubDir, { recursive: true });
    fs.mkdirSync(spokesDir, { recursive: true });

    // Mock path.join to redirect content directory paths to test directories
    originalPathJoin = path.join;
    jest.spyOn(path, 'join').mockImplementation((...args: string[]) => {
      const joined = originalPathJoin(...args);
      
      // If the path contains the production content directories, redirect to test directories
      if (joined.includes('app/content/hub')) {
        return joined.replace(/.*app\/content\/hub/, hubDir);
      }
      if (joined.includes('app/content/spokes')) {
        return joined.replace(/.*app\/content\/spokes/, spokesDir);
      }
      
      return joined;
    });
  });

  afterEach(() => {
    // Clean up test files
    fs.rmSync(testContentDir, { recursive: true, force: true });
    
    // Restore path.join mock
    jest.restoreAllMocks();
  });

  describe("Async File Operations", () => {
    it("should use async file reading instead of sync operations", async () => {
      // Create a test file in the test directory (path.join will be mocked to redirect)
      const testContent = `---
title: Async Test
description: Testing async operations
date: 2024-01-01
---

# Async Test Content`;

      // Write to test directory (the path mock will handle redirection)
      fs.writeFileSync(path.join(hubDir, "async-test.md"), testContent);

      // Spy on fs operations to ensure async methods are used
      const readFileSpy = jest.spyOn(fs.promises, "readFile");
      const readFileSyncSpy = jest.spyOn(fs, "readFileSync");

      await contentLoader.getHubContent("async-test");

      // Should use async readFile, not sync
      expect(readFileSpy).toHaveBeenCalled();
      expect(readFileSyncSpy).not.toHaveBeenCalled();

      readFileSpy.mockRestore();
      readFileSyncSpy.mockRestore();
    });

    it("should handle missing files gracefully", async () => {
      const content = await contentLoader.getHubContent("non-existent-file");

      expect(content).toBeNull();
    });

    it("should handle corrupted markdown files", async () => {
      // Create a file with invalid frontmatter
      const corruptedContent = `---
title: Invalid
date: not-a-date
---`;

      fs.writeFileSync(path.join(hubDir, "corrupted.md"), corruptedContent);

      const content = await contentLoader.getHubContent("corrupted");

      // Should still parse but with defaults for invalid data
      expect(content).not.toBeNull();
      expect(content?.meta.title).toBe("Invalid");
      expect(content?.meta.date).toBeTruthy(); // Should have a valid date
    });

    it("should handle concurrent file reads efficiently", async () => {
      // Create multiple test files
      for (let i = 0; i < 10; i++) {
        fs.writeFileSync(
          path.join(hubDir, `concurrent-${i}.md`),
          `---
title: Concurrent Test ${i}
---

Content ${i}`
        );
      }

      // Read files concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(contentLoader.getHubContent(`concurrent-${i}`));
      }

      const results = await Promise.all(promises);

      // All reads should succeed
      expect(results.every((r) => r !== null)).toBe(true);
      expect(results.length).toBe(10);
    });
  });

  describe("Cache Operations", () => {
    it("should cache parsed content", async () => {
      const testContent = `---
title: Cache Test
description: Testing caching
---

# Cache Test`;

      // Write to test directory (path mock will handle redirection)
      fs.writeFileSync(path.join(hubDir, "cache-test.md"), testContent);

      // First read
      const content1 = await contentLoader.getHubContent("cache-test");

      // Second read should be from cache
      const content2 = await contentLoader.getHubContent("cache-test");

      expect(content1).toEqual(content2);
    });

    it("should invalidate cache when file is modified", async () => {
      const originalContent = `---
title: Original Title
---

Original content`;

      const updatedContent = `---
title: Updated Title
---

Updated content`;

      const filePath = path.join(hubDir, "cache-invalidation.md");

      // Write original content
      fs.writeFileSync(filePath, originalContent);
      const content1 = await contentLoader.getHubContent("cache-invalidation");

      // Update file after a delay to ensure different mtime
      await new Promise((resolve) => setTimeout(resolve, 1100)); // Ensure >1 second difference
      fs.writeFileSync(filePath, updatedContent);
      
      // Explicitly modify the file timestamp to ensure cache invalidation
      const futureTime = new Date(Date.now() + 2000);
      fs.utimesSync(filePath, futureTime, futureTime);

      // Read again - should get updated content
      const content2 = await contentLoader.getHubContent("cache-invalidation");

      expect(content1?.meta.title).toBe("Original Title");
      expect(content2?.meta.title).toBe("Updated Title");
    });

    it("should handle cache misses gracefully", async () => {
      // Try to read a file that doesn't exist (cache miss)
      const content = await contentLoader.getHubContent("cache-miss-test");

      expect(content).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should handle file system errors gracefully", async () => {
      // Mock fs.promises.readFile to throw an error
      const readFileSpy = jest
        .spyOn(fs.promises, "readFile")
        .mockRejectedValueOnce(new Error("EACCES: Permission denied"));

      const content = await contentLoader.getHubContent("permission-denied");

      expect(content).toBeNull();

      readFileSpy.mockRestore();
    });

    it("should handle directory read errors", async () => {
      // Mock fs.promises.readdir to throw an error
      const readdirSpy = jest
        .spyOn(fs.promises, "readdir")
        .mockRejectedValueOnce(new Error("ENOENT: No such directory"));

      const content = await contentLoader.getAllHubContent();

      expect(content).toEqual([]);

      readdirSpy.mockRestore();
    });

    it("should log errors appropriately", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      // Try to read a non-existent file
      await contentLoader.getHubContent("error-test");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error fetching hub content for slug error-test:"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Async Directory Operations", () => {
    it("should use async methods for directory operations", async () => {
      // Create test files in test directory (path mock will handle redirection)
      for (let i = 0; i < 5; i++) {
        fs.writeFileSync(
          path.join(hubDir, `test-dir-${i}.md`),
          `---\ntitle: Dir Test ${i}\n---\n\nContent`
        );
      }

      // Spy on directory operations
      const readdirSpy = jest.spyOn(fs.promises, "readdir");
      const readdirSyncSpy = jest.spyOn(fs, "readdirSync");
      const accessSpy = jest.spyOn(fs.promises, "access");
      const existsSyncSpy = jest.spyOn(fs, "existsSync");

      await contentLoader.getAllHubContent();

      // Should use async methods
      expect(readdirSpy).toHaveBeenCalled();
      expect(accessSpy).toHaveBeenCalled();

      // Should not use sync methods
      expect(readdirSyncSpy).not.toHaveBeenCalled();
      expect(existsSyncSpy).not.toHaveBeenCalled();

      readdirSpy.mockRestore();
      readdirSyncSpy.mockRestore();
      accessSpy.mockRestore();
      existsSyncSpy.mockRestore();
    });
  });
});
