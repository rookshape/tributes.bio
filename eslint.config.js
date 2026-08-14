import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist"] },
  {
    ...js.configs.recommended,
    files: ["*.js", "*.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
];
