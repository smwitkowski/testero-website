"use strict";

const path = require("path");
const minimatchModule = require("minimatch");
const minimatch = typeof minimatchModule === "function" ? minimatchModule : minimatchModule.minimatch;

function normaliseFilename(filename, cwd) {
  if (!filename || filename === "<input>" || filename === "<text>") {
    return "";
  }

  const candidates = [];

  const processRelative = path.relative(process.cwd(), filename);
  if (processRelative) {
    candidates.push(processRelative);
  }

  if (cwd) {
    const cwdRelative = path.relative(cwd, filename);
    if (cwdRelative) {
      candidates.push(cwdRelative);
    }
  }

  candidates.push(filename);

  const sanitized = candidates
    .map((candidate) => candidate.replace(/\\/g, "/"))
    .map((candidate) => candidate.replace(/^\.\/*/, ""))
    .map((candidate) => candidate.replace(/^\/+/, ""));

  const withDirectory = sanitized.find((candidate) => candidate && candidate.includes("/"));
  if (withDirectory) {
    return withDirectory;
  }

  const withoutTraversal = sanitized.find((candidate) => candidate && !candidate.startsWith("../"));
  if (withoutTraversal) {
    return withoutTraversal;
  }

  return sanitized[0] || filename.replace(/\\/g, "/");
}

function matchesAnyPattern(filename, patterns) {
  if (!filename || !Array.isArray(patterns) || patterns.length === 0) {
    return false;
  }
  return patterns.some((pattern) => minimatch(filename, pattern, { nocase: true, dot: true }));
}

function isFileAllowlisted(filename, config) {
  if (!filename || !config) {
    return false;
  }

  if (matchesAnyPattern(filename, config.allowlist?.paths)) {
    return true;
  }

  if (matchesAnyPattern(filename, config.exemptPaths)) {
    return true;
  }

  return false;
}

module.exports = {
  normaliseFilename,
  matchesAnyPattern,
  isFileAllowlisted,
};

