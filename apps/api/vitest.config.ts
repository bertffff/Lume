import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration tests share one Postgres database. Global aggregates must not
    // race with another file's create/delete cleanup.
    fileParallelism: false,
  },
});
