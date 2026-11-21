import { defineConfig } from "vitest/config";

/**
 * Guard tests are pure validation and dry-run contract checks. They deliberately
 * have NO globalSetup: running them must never open, reset, or drop a database.
 *
 * Run with:
 *   pnpm --filter @lume/api exec vitest run --config vitest.guard.config.ts
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.test.ts"],
  },
});
