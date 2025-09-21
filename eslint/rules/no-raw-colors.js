"use strict";

const { loadDesignConfig } = require("../utils/config");
const { normaliseFilename, isFileAllowlisted } = require("../utils/files");

const HEX_COLOR_REGEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_COLOR_REGEX = /^rgba?\([^)]*\)$/i;
const HSL_COLOR_REGEX = /^hsla?\([^)]*\)$/i;

const seenTemplateLiterals = new WeakSet();
const reportedNodes = new WeakSet();

function isRawColorLiteral(value) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.includes("var(--")) {
    return false;
  }

  if (HEX_COLOR_REGEX.test(trimmed)) {
    return { type: "hex", literal: trimmed };
  }

  if (RGB_COLOR_REGEX.test(trimmed)) {
    return { type: "rgb", literal: trimmed };
  }

  if (HSL_COLOR_REGEX.test(trimmed)) {
    return { type: "hsl", literal: trimmed };
  }

  return false;
}

function reportIfRawColor(context, node, value) {
  const match = isRawColorLiteral(value);
  if (!match || reportedNodes.has(node)) {
    return;
  }

  const messageId = match.type === "hsl" ? "useHslVar" : "useTokens";
  reportedNodes.add(node);
  context.report({
    node,
    messageId,
    data: {
      literal: match.literal,
    },
  });
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow raw color literals in application code",
      recommended: false,
    },
    messages: {
      useTokens:
        "Avoid raw color literal '{{literal}}'. Use design tokens or Tailwind utilities (e.g., text-fg, bg-accent, var(--token)).",
      useHslVar:
        "Wrap HSL colors with CSS variables: replace '{{literal}}' with hsl(var(--token-name)).",
    },
    schema: [],
  },
  create(context) {
    const cwd = typeof context.getCwd === "function" ? context.getCwd() : process.cwd();
    const filename = normaliseFilename(context.getFilename(), cwd);
    const config = loadDesignConfig(context);

    if (isFileAllowlisted(filename, config)) {
      return {};
    }

    function checkLiteral(node) {
      if (typeof node.value !== "string") {
        return;
      }
      reportIfRawColor(context, node, node.value);
    }

    function checkTemplateLiteral(node) {
      if (seenTemplateLiterals.has(node)) {
        return;
      }
      seenTemplateLiterals.add(node);
      node.quasis.forEach((quasi) => {
        if (typeof quasi.value.cooked === "string") {
          reportIfRawColor(context, quasi, quasi.value.cooked);
        }
      });
    }

    function checkJSXAttribute(node) {
      if (!node.value) {
        return;
      }

      if (node.value.type === "Literal") {
        reportIfRawColor(context, node.value, node.value.value);
        return;
      }

      if (node.value.type === "JSXExpressionContainer") {
        const expression = node.value.expression;
        if (!expression) {
          return;
        }

        if (expression.type === "Literal") {
          reportIfRawColor(context, expression, expression.value);
        } else if (expression.type === "TemplateLiteral") {
          checkTemplateLiteral(expression);
        }
      }
    }

    return {
      Literal: checkLiteral,
      TemplateLiteral: checkTemplateLiteral,
      JSXAttribute: checkJSXAttribute,
      Property(node) {
        if (
          node.key &&
          ((node.key.type === "Identifier" && /color/i.test(node.key.name)) ||
            (node.key.type === "Literal" && typeof node.key.value === "string" && /color/i.test(node.key.value)))
        ) {
          const value = node.value;
          if (value.type === "Literal") {
            reportIfRawColor(context, value, value.value);
          } else if (value.type === "TemplateLiteral") {
            checkTemplateLiteral(value);
          }
        }
      },
      VariableDeclarator(node) {
        if (node.init) {
          if (node.init.type === "Literal") {
            reportIfRawColor(context, node.init, node.init.value);
          } else if (node.init.type === "TemplateLiteral") {
            checkTemplateLiteral(node.init);
          }
        }
      },
      AssignmentExpression(node) {
        if (node.right.type === "Literal") {
          reportIfRawColor(context, node.right, node.right.value);
        } else if (node.right.type === "TemplateLiteral") {
          checkTemplateLiteral(node.right);
        }
      },
      CallExpression(node) {
        node.arguments.forEach((arg) => {
          if (arg.type === "Literal") {
            reportIfRawColor(context, arg, arg.value);
          } else if (arg.type === "TemplateLiteral") {
            checkTemplateLiteral(arg);
          }
        });
      },
      NewExpression(node) {
        node.arguments.forEach((arg) => {
          if (arg.type === "Literal") {
            reportIfRawColor(context, arg, arg.value);
          } else if (arg.type === "TemplateLiteral") {
            checkTemplateLiteral(arg);
          }
        });
      },
      JSXExpressionContainer(node) {
        const expression = node.expression;
        if (expression.type === "Literal") {
          reportIfRawColor(context, expression, expression.value);
        } else if (expression.type === "TemplateLiteral") {
          checkTemplateLiteral(expression);
        }
      },
    };
  },
};
