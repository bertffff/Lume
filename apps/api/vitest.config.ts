import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["./vitest.global-setup.ts"],
    // Integration tests share one Postgres database. Global aggregates must not
    // race with another file's create/delete cleanup.
    fileParallelism: false,
    // The first Prisma query in CI can be slower than the 5s Vitest default.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
