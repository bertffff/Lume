import { execFileSync } from "node:child_process";
import { createPrismaClient } from "@lume/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import setup from "../vitest.global-setup.js";

// Exercise real setup and validation without ever calling Prisma or pnpm.
const { execute, disconnect } = vi.hoisted(() => ({ execute: vi.fn(), disconnect: vi.fn() }));
vi.mock("@lume/db", () => ({
  createPrismaClient: vi.fn(() => ({ $executeRawUnsafe: execute, $disconnect: disconnect })),
}));
vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

const isolatedUrl = "postgresql://fixture:fixture@127.0.0.1:55433/lume_api_test_guard?schema=public";
const developerUrl = "postgresql://fixture:fixture@127.0.0.1:5432/lume";

describe("API test database setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DATABASE_URL", developerUrl);
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each([
    undefined,
    "not a URL",
    "https://127.0.0.1:55433/lume_api_test_guard",
    "postgresql://127.0.0.1/lume_api_test_guard",
    "postgresql://127.0.0.1:5432/lume_api_test_guard",
    "postgresql://127.0.0.1:55433/lume_test",
    "postgresql://127.0.0.1:55433/lume_e2e_ci",
    "postgresql://127.0.0.1:55433/lume_api_test_e2e_ci",
    "postgresql://db.internal:55433/lume_api_test_guard",
    "postgresql://127.0.0.1:55433/lume_api_test_bad%22",
    "postgresql://127.0.0.1:55433/lume_api_test_guard?host=db.internal",
    "postgresql://127.0.0.1:55433/lume_api_test_guard?schema=other",
  ])("rejects an unsafe API_TEST_DATABASE_URL (%s) before any external call", async (url) => {
    vi.stubEnv("API_TEST_DATABASE_URL", url);

    await expect(setup()).rejects.toThrow(/API_TEST_DATABASE_URL/);
    expect(createPrismaClient).not.toHaveBeenCalled();
    expect(execFileSync).not.toHaveBeenCalled();
    expect(process.env.DATABASE_URL).toBe(developerUrl);
  });

  it("creates a fresh database on the configured cluster and migrates only that database", async () => {
    vi.stubEnv("API_TEST_DATABASE_URL", isolatedUrl);
    execute.mockImplementationOnce(() => {
      expect(process.env.DATABASE_URL).toBe("postgresql://fixture:fixture@127.0.0.1:55433/postgres");
    });

    await setup();

    expect(execute.mock.calls).toEqual([['CREATE DATABASE "lume_api_test_guard" TEMPLATE template0']]);
    expect(execFileSync).toHaveBeenCalledExactlyOnceWith(
      "pnpm",
      ["--filter", "@lume/db", "exec", "prisma", "migrate", "deploy"],
      expect.objectContaining({ env: expect.objectContaining({ DATABASE_URL: isolatedUrl }) }),
    );
    expect(process.env.DATABASE_URL).toBe(developerUrl);
  });

  it("stops if the database already exists instead of dropping or migrating it", async () => {
    vi.stubEnv("API_TEST_DATABASE_URL", isolatedUrl);
    execute.mockRejectedValueOnce(new Error("database already exists"));

    await expect(setup()).rejects.toThrow(/already exists/);
    expect(execute.mock.calls).toEqual([['CREATE DATABASE "lume_api_test_guard" TEMPLATE template0']]);
    expect(disconnect).toHaveBeenCalledOnce();
    expect(execFileSync).not.toHaveBeenCalled();
    expect(process.env.DATABASE_URL).toBe(developerUrl);
  });
});
