import reactHooks from "eslint-plugin-react-hooks";
import { nodeConfig } from "./node.js";

export const reactConfig = [
  ...nodeConfig,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
