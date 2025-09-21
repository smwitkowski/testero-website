"use strict";

module.exports = {
  rules: {
    "no-raw-colors": require("../../rules/no-raw-colors"),
    "no-tailwind-arbitrary-values": require("../../rules/no-tailwind-arbitrary-values"),
  },
  configs: {
    recommended: {
      rules: {
        "design/no-raw-colors": "error",
        "design/no-tailwind-arbitrary-values": "error",
      },
    },
  },
};
