import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { validateDatabaseTarget, validateRedisTarget } from "./e2e-target";

/** Behavioral tests: import the real config / invoke the real CLI. No source-text assertions. */
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

async function loadConfig(overrides: Record<string, string>) {
  const keys = Object.keys(overrides);
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) process.env[key] = overrides[key];
  vi.resetModules();
  try {
    return await import("../../../e2e/helpers/config");
  } finally {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.resetModules();
  }
}

function runCli(overrides: Record<string, string>) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("E2E_")) delete env[key];
  }
  Object.assign(env, overrides);
  return spawnSync(
    "pnpm",
    ["--filter", "@lume/api", "exec", "tsx", "scripts/check-e2e-target.ts"],
    { cwd: repoRoot, env, encoding: "utf8", timeout: 60_000 },
  );
}

const SAFE_DB = "postgresql://e2e:e2e-local-only@127.0.0.1:55432/lume_e2e_cli?schema=public";
const SAFE_REDIS = "redis://127.0.0.1:56379";

describe("E2E config helper behavior", () => {
  it("derives every origin from one set of alternate ports on loopback", async () => {
    const config = await loadConfig({
      E2E_API_PORT: "33001",
      E2E_REALTIME_PORT: "33002",
      E2E_WEB_PORT: "35173",
      E2E_MOCK_PORT: "33099",
    });
    expect(config.ports).toEqual({ api: 33001, realtime: 33002, web: 35173, mock: 33099 });
    expect(config.apiUrl).toBe("http://127.0.0.1:33001");
    expect(config.realtimeUrl).toBe("http://127.0.0.1:33002");
    expect(config.webUrl).toBe("http://127.0.0.1:35173");
    expect(config.mockUrl).toBe("http://127.0.0.1:33099");
    expect(config.oembedBaseUrl).toBe("http://127.0.0.1:33099/oembed");
  });

  it("rejects an invalid port override instead of silently using a default", async () => {
    await expect(
      loadConfig({
        E2E_API_PORT: "not-a-port",
        E2E_REALTIME_PORT: "33002",
        E2E_WEB_PORT: "35173",
        E2E_MOCK_PORT: "33099",
      }),
    ).rejects.toThrow(/valid TCP port/);
  });
});

describe("E2E target validation is local-only and default-port-safe", () => {
  it("rejects the default Postgres port on any hostname, not just loopback", () => {
    for (const host of ["db.internal", "10.0.0.5", "localhost", "127.0.0.1"]) {
      expect(() =>
        validateDatabaseTarget(`postgresql://e2e:pw@${host}:5432/lume_e2e_ci?schema=public`),
      ).toThrow(/default Postgres port/);
    }
  });

  it("rejects a remote database even on an alternate port", () => {
    expect(() =>
      validateDatabaseTarget("postgresql://e2e:pw@db.internal:55432/lume_e2e_ci?schema=public"),
    ).toThrow(/local \(loopback\)/);
  });

  it("rejects the default Redis port on any hostname and remote Redis on any port", () => {
    for (const host of ["cache.internal", "localhost", "127.0.0.1"]) {
      expect(() => validateRedisTarget(`redis://${host}:6379`)).toThrow(/default Redis port/);
    }
    expect(() => validateRedisTarget("redis://cache.internal:56379")).toThrow(/local \(loopback\)/);
  });
});

describe("check-e2e-target CLI behavior", () => {
  it("accepts a disposable local target and prints no credentials", () => {
    const result = runCli({ E2E_DATABASE_URL: SAFE_DB, E2E_REDIS_URL: SAFE_REDIS });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("lume_e2e_cli");
    expect(result.stdout).not.toContain("e2e-local-only");
    // pnpm may emit harmless notices on stderr; only require no secret leakage.
    expect(result.stderr).not.toContain("e2e-local-only");
  });

  it("exits 1 and prints no target on an unsafe remote default-port database", () => {
    const result = runCli({
      E2E_DATABASE_URL: "postgresql://e2e:pw@db.internal:5432/lume_e2e_ci?schema=public",
      E2E_REDIS_URL: SAFE_REDIS,
    });
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("lume_e2e_ci");
    expect(result.stdout).not.toContain("e2e:pw");
    expect(result.stderr).toContain("default Postgres port");
  });
});
