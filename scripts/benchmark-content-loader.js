#!/usr/bin/env node

/**
 * Performance benchmark for content loader
 * Compares sync vs async file operations and caching performance
 */

const fs = require("fs");
const path = require("path");

// Create test content directory and files
const testDir = path.join(process.cwd(), "benchmark-test-content");
const hubDir = path.join(testDir, "hub");
const spokesDir = path.join(testDir, "spokes");

// Create test data
function setupTestData(numFiles = 100) {
  fs.mkdirSync(hubDir, { recursive: true });
  fs.mkdirSync(spokesDir, { recursive: true });

  for (let i = 0; i < numFiles; i++) {
    const content = `---
title: Test Content ${i}
description: This is test content number ${i}
date: 2024-01-01
---

# Test Content ${i}

This is the content for test file number ${i}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
`.repeat(5); // Make content reasonably sized

    fs.writeFileSync(path.join(hubDir, `test-${i}.md`), content);
    fs.writeFileSync(path.join(spokesDir, `test-spoke-${i}.md`), content);
  }
}

// Clean up test data
function cleanupTestData() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

// Benchmark sync operations (simulated old implementation)
async function benchmarkSyncOperations(numFiles) {
  const start = Date.now();

  // Simulate sync directory read
  const files = fs.readdirSync(hubDir);

  // Simulate sync file reads
  for (const file of files) {
    if (file.endsWith(".md")) {
      const content = fs.readFileSync(path.join(hubDir, file), "utf8");
      // Simulate processing
      const lines = content.split("\n");
    }
  }

  return Date.now() - start;
}

// Benchmark async operations (new implementation)
async function benchmarkAsyncOperations(numFiles) {
  const { promises: fsPromises } = fs;
  const start = Date.now();

  // Async directory read
  const files = await fsPromises.readdir(hubDir);

  // Async file reads in parallel
  await Promise.all(
    files
      .filter((file) => file.endsWith(".md"))
      .map(async (file) => {
        const content = await fsPromises.readFile(path.join(hubDir, file), "utf8");
        // Simulate processing
        const lines = content.split("\n");
      })
  );

  return Date.now() - start;
}

// Benchmark with caching (simulated)
async function benchmarkWithCache(numFiles) {
  const { promises: fsPromises } = fs;
  const cache = new Map();

  // First read (cold cache)
  const coldStart = Date.now();
  const files = await fsPromises.readdir(hubDir);

  await Promise.all(
    files
      .filter((file) => file.endsWith(".md"))
      .map(async (file) => {
        const content = await fsPromises.readFile(path.join(hubDir, file), "utf8");
        cache.set(file, content);
        const lines = content.split("\n");
      })
  );

  const coldDuration = Date.now() - coldStart;

  // Second read (warm cache)
  const warmStart = Date.now();

  for (const file of files) {
    if (file.endsWith(".md")) {
      const content = cache.get(file);
      if (content) {
        const lines = content.split("\n");
      }
    }
  }

  const warmDuration = Date.now() - warmStart;

  return { cold: coldDuration, warm: warmDuration };
}

// Run benchmarks
async function runBenchmarks() {
  console.log("🚀 Content Loader Performance Benchmark\n");

  const testSizes = [10, 50, 100];

  for (const size of testSizes) {
    console.log(`\n📊 Testing with ${size} files:`);
    console.log("─".repeat(40));

    // Setup test data
    cleanupTestData();
    setupTestData(size);

    // Run sync benchmark
    const syncTime = await benchmarkSyncOperations(size);
    console.log(`Sync operations:     ${syncTime}ms`);

    // Run async benchmark
    const asyncTime = await benchmarkAsyncOperations(size);
    console.log(`Async operations:    ${asyncTime}ms`);

    // Calculate improvement
    const improvement = (((syncTime - asyncTime) / syncTime) * 100).toFixed(1);
    console.log(`Improvement:         ${improvement}% faster`);

    // Run cache benchmark
    const cacheResults = await benchmarkWithCache(size);
    console.log(`\nWith caching:`);
    console.log(`  Cold cache:        ${cacheResults.cold}ms`);
    console.log(`  Warm cache:        ${cacheResults.warm}ms`);
    console.log(`  Cache speedup:     ${(cacheResults.cold / cacheResults.warm).toFixed(1)}x`);
  }

  // Cleanup
  cleanupTestData();

  console.log("\n✅ Benchmark complete!\n");
}

// Handle process termination
process.on("SIGINT", () => {
  cleanupTestData();
  process.exit(0);
});

// Run benchmarks
runBenchmarks().catch((error) => {
  console.error("Benchmark failed:", error);
  cleanupTestData();
  process.exit(1);
});
