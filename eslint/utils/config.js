"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_CONFIG = {
  warnLineHeightAndTracking: true,
  classMergeHelpers: ["clsx", "classnames", "cn"],
};

const configCache = new Map();

function parseJsonWithComments(content) {
  const withoutLineComments = content.replace(/(^|\s+)#.*$/gm, "");
  const withoutInlineComments = withoutLineComments.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutDoubleSlash = withoutInlineComments.replace(/(^|[^:\\])\/\/.*$/gm, (match, prefix) =>
    prefix === undefined ? "" : prefix
  );
  return JSON.parse(withoutDoubleSlash);
}

function loadAllowlist(cwd, allowlistPath) {
  if (!allowlistPath) {
    return { paths: [], classPatterns: [] };
  }

  const resolved = path.resolve(cwd, allowlistPath);
  if (!fs.existsSync(resolved)) {
    return { paths: [], classPatterns: [] };
  }

  try {
    const raw = fs.readFileSync(resolved, "utf8");
    const parsed = parseJsonWithComments(raw);
    return {
      paths: Array.isArray(parsed?.paths) ? parsed.paths : [],
      classPatterns: Array.isArray(parsed?.classPatterns)
        ? parsed.classPatterns
        : [],
    };
  } catch (error) {
    throw new Error(
      `Failed to read Tailwind arbitrary value allowlist at ${resolved}: ${error.message}`
    );
  }
}

function loadDesignConfig(context) {
  const cwd = typeof context.getCwd === "function" ? context.getCwd() : process.cwd();
  const settings = (context.settings && context.settings.design) || {};
  const configPath = settings.configPath
    ? path.resolve(cwd, settings.configPath)
    : null;
  const allowlistPath = settings.allowlistPath
    ? path.resolve(cwd, settings.allowlistPath)
    : null;

  const cacheKey = `${cwd}|${configPath || ""}|${allowlistPath || ""}`;
  if (configCache.has(cacheKey)) {
    return configCache.get(cacheKey);
  }

  let configFromFile = {};
  if (configPath && fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, "utf8");
      configFromFile = parseJsonWithComments(raw);
    } catch (error) {
      throw new Error(
        `Failed to parse ESLint design rule config at ${configPath}: ${error.message}`
      );
    }
  }

  const merged = {
    ...DEFAULT_CONFIG,
    ...configFromFile,
  };

  const allowlist = loadAllowlist(cwd, allowlistPath || merged.allowlistPath);
  const resolvedConfig = {
    ...merged,
    allowlist,
    configPath,
    allowlistPath: allowlistPath || merged.allowlistPath,
  };

  configCache.set(cacheKey, resolvedConfig);
  return resolvedConfig;
}

module.exports = {
  loadDesignConfig,
};
