"use strict";

const { loadDesignConfig } = require("../utils/config");
const { normaliseFilename, isFileAllowlisted } = require("../utils/files");

const COLOR_PREFIXES = new Set([
  "bg",
  "text",
  "from",
  "via",
  "to",
  "border",
  "outline",
  "shadow",
  "stroke",
  "fill",
]);

const SPACING_PREFIX_PATTERN = /^(?:-?(?:m|p)(?:[trblxy])?|(?:inset|top|right|bottom|left)(?:-[xy])?|(?:w|h|min-w|max-w|min-h|max-h)|(?:gap|space-[xy])|(?:rounded(?:-[trbl](?:[lr])?)?)|(?:translate-[xy])|(?:border(?:-[trbl](?:[lr])?)?)|outline|basis|size)$/;
const TYPOGRAPHY_PREFIX_PATTERN = /^(?:leading|tracking)$/;

const HEX_COLOR_REGEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_COLOR_REGEX = /^rgba?\([^)]*\)$/i;
const HSL_COLOR_REGEX = /^hsla?\([^)]*\)$/i;
const NUMBER_WITH_UNIT_REGEX = /^-?\d+(?:\.\d+)?(?:px|rem|em|vh|vw|%)?$/;
const Z_INDEX_REGEX = /^\d+$/;

function compileAllowlistPatterns(patterns) {
  return patterns
    .map((pattern) => {
      try {
        return new RegExp(pattern);
      } catch (error) {
        throw new Error(`Invalid class allowlist pattern '${pattern}': ${error.message}`);
      }
    })
    .filter(Boolean);
}

function hasAllowlistedClass(className, allowlistRegexes) {
  return allowlistRegexes.some((regex) => regex.test(className));
}

function getAllStringLiteralsFromExpression(expression, helpers) {
  const mergeHelpers = helpers.classMergeHelpers || [];
  switch (expression.type) {
    case "Literal":
      if (typeof expression.value === "string") {
        return [expression.value];
      }
      return [];
    case "TemplateLiteral":
      return expression.quasis.map((quasi) => quasi.value.cooked || "");
    case "ArrayExpression":
      return expression.elements.flatMap((element) =>
        element && element.type ? getAllStringLiteralsFromExpression(element, helpers) : []
      );
    case "ObjectExpression":
      return expression.properties.flatMap((prop) => {
        if (prop.type !== "Property") {
          return [];
        }
        if (prop.key.type === "Literal" && typeof prop.key.value === "string") {
          if (prop.value.type === "Literal" && prop.value.value === true) {
            return [prop.key.value];
          }
          return [];
        }
        if (prop.key.type === "Identifier") {
          if (prop.value.type === "Literal" && prop.value.value === true) {
            return [prop.key.name];
          }
          return [];
        }
        return [];
      });
    case "CallExpression": {
      if (
        expression.callee.type === "Identifier" &&
        mergeHelpers.includes(expression.callee.name)
      ) {
        return expression.arguments.flatMap((arg) =>
          arg && arg.type ? getAllStringLiteralsFromExpression(arg, helpers) : []
        );
      }
      return [];
    }
    case "ConditionalExpression": {
      const consequent = getAllStringLiteralsFromExpression(expression.consequent, helpers);
      const alternate = getAllStringLiteralsFromExpression(expression.alternate, helpers);
      return [...consequent, ...alternate];
    }
    case "BinaryExpression":
      if (expression.operator === "+") {
        return [
          ...getAllStringLiteralsFromExpression(expression.left, helpers),
          ...getAllStringLiteralsFromExpression(expression.right, helpers),
        ];
      }
      return [];
    case "LogicalExpression":
      return [
        ...getAllStringLiteralsFromExpression(expression.left, helpers),
        ...getAllStringLiteralsFromExpression(expression.right, helpers),
      ];
    default:
      return [];
  }
}

function isColorValue(raw) {
  if (!raw) {
    return false;
  }
  if (raw.includes("var(--")) {
    return false;
  }
  const trimmed = raw.trim();
  return HEX_COLOR_REGEX.test(trimmed) || RGB_COLOR_REGEX.test(trimmed) || HSL_COLOR_REGEX.test(trimmed);
}

function isHardDimensionValue(prefix, raw) {
  if (!raw) {
    return false;
  }
  if (!SPACING_PREFIX_PATTERN.test(prefix)) {
    return false;
  }
  const trimmed = raw.trim();
  return NUMBER_WITH_UNIT_REGEX.test(trimmed) && /(?:\d|px|rem|em|vh|vw|%)/.test(trimmed);
}

function isZIndexValue(prefix, raw) {
  return prefix === "z" && Z_INDEX_REGEX.test(raw.trim());
}

function isTypographyValue(prefix, raw) {
  return TYPOGRAPHY_PREFIX_PATTERN.test(prefix) && raw.trim().length > 0;
}

function getBaseClassSegment(className) {
  const withoutVariants = className.split(":").pop();
  return withoutVariants || className;
}

function parseArbitraryValue(className) {
  const segment = getBaseClassSegment(className);
  const bracketIndex = segment.indexOf("-[");
  if (bracketIndex === -1) {
    return null;
  }
  if (!segment.endsWith("]")) {
    return null;
  }

  const prefix = segment.slice(0, bracketIndex);
  const rawValue = segment.slice(bracketIndex + 2, -1);

  if (!prefix || rawValue === undefined) {
    return null;
  }

  return { prefix, rawValue };
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Tailwind arbitrary values in class strings",
      recommended: false,
    },
    messages: {
      disallowColor:
        "Avoid Tailwind arbitrary color '{{className}}'. Use design tokens or CSS variables (e.g., text-fg, bg-accent, hsl(var(--token))).",
      disallowDimension:
        "Avoid Tailwind arbitrary size '{{className}}'. Map to spacing/sizing scale or design tokens.",
      disallowZIndex:
        "Avoid arbitrary z-index '{{className}}'. Use semantic layering tokens (e.g., z-overlay, z-modal).",
      disallowTypography:
        "Avoid arbitrary typography value '{{className}}'. Use the typography scale or update tokens.",
    },
    schema: [],
  },
  create(context) {
    const cwd = typeof context.getCwd === "function" ? context.getCwd() : process.cwd();
    const filename = normaliseFilename(context.getFilename(), cwd);
    const config = loadDesignConfig(context);
    const allowlistRegexes = compileAllowlistPatterns(config.allowlist.classPatterns || []);

    if (isFileAllowlisted(filename, config)) {
      return {};
    }

    const isStoryFile = /\.stories\.(?:tsx|mdx)$/i.test(filename);

    function report(node, messageId, className, warnOnly = false) {
      if (warnOnly) {
        context.report({
          node,
          messageId,
          data: { className },
        });
        return;
      }

      context.report({
        node,
        messageId,
        data: { className },
      });
    }

    function analyzeClassValue(node, classValue) {
      if (typeof classValue !== "string") {
        return;
      }

      const classes = classValue.split(/\s+/).filter(Boolean);
      classes.forEach((className) => {
        if (!/-\[[^\]]+\]/.test(className)) {
          return;
        }

        if (hasAllowlistedClass(className, allowlistRegexes)) {
          return;
        }

        const parsed = parseArbitraryValue(className);
        if (!parsed) {
          return;
        }

        const { prefix, rawValue } = parsed;

        if (isColorValue(rawValue) && COLOR_PREFIXES.has(prefix)) {
          report(node, "disallowColor", className);
          return;
        }

        if (isZIndexValue(prefix, rawValue)) {
          report(node, "disallowZIndex", className);
          return;
        }

        if (isTypographyValue(prefix, rawValue)) {
          const warn = config.warnLineHeightAndTracking !== false;
          report(node, "disallowTypography", className, warn && !isStoryFile);
          return;
        }

        if (isHardDimensionValue(prefix, rawValue)) {
          report(node, "disallowDimension", className);
        }
      });
    }

    function checkJSXAttribute(node) {
      if (!node.value) {
        return;
      }

      const attributeName = node.name.name || (node.name.type === "JSXNamespacedName" ? node.name.name : null);
      if (attributeName !== "class" && attributeName !== "className") {
        return;
      }

      if (node.value.type === "Literal") {
        analyzeClassValue(node.value, node.value.value);
        return;
      }

      if (node.value.type === "JSXExpressionContainer") {
        const expression = node.value.expression;
        if (!expression) {
          return;
        }

        getAllStringLiteralsFromExpression(expression, config).forEach((classString) => {
          analyzeClassValue(node.value, classString);
        });
      }
    }

    return {
      JSXAttribute: checkJSXAttribute,
    };
  },
};
