import { describe, expect, it } from "vitest";
import {
  UnsafeTargetError,
  validateDatabaseTarget,
  validateRedisTarget,
} from "./e2e-target";

// The occupied local defaults. These strings are credentials-free fixtures for
// a throwaway container, never the values from the developer's .env file.
const OCCUPIED_DB_DEFAULT = "postgresql://lume:lume@127.0.0.1:5432/lume_test?schema=public";
const OCCUPIED_REDIS_DEFAULT = "redis://127.0.0.1:6379";
const DISPOSABLE_DB = "postgresql://lume:lume@127.0.0.1:55432/lume_e2e_task0?schema=public";
const DISPOSABLE_REDIS = "redis://127.0.0.1:56379";

describe("E2E database target guard", () => {
  it("rejects an omitted E2E_DATABASE_URL instead of falling back to a shared default", () => {
    expect(() => validateDatabaseTarget(undefined)).toThrow(UnsafeTargetError);
    expect(() => validateDatabaseTarget(undefined)).toThrow(/required/i);
  });

  it("rejects the occupied default shared database before any connection is made", () => {
    expect(() => validateDatabaseTarget(OCCUPIED_DB_DEFAULT)).toThrow(UnsafeTargetError);
  });

  it.each([
    ["no disposable e2e marker", "postgresql://lume:lume@127.0.0.1:55432/lume?schema=public"],
    [
      "the API-integration test database name",
      "postgresql://lume:lume@127.0.0.1:55432/lume_test?schema=public",
    ],
    [
      "a quoted/injectable name",
      'postgresql://lume:lume@127.0.0.1:55432/lume_e2e";DROP TABLE x?schema=public',
    ],
    ["an empty name", "postgresql://lume:lume@127.0.0.1:55432/?schema=public"],
    ["a non-Postgres protocol", "mysql://lume:lume@127.0.0.1:55432/lume_e2e"],
    [
      "the occupied default port even with a disposable name",
      "postgresql://lume:lume@127.0.0.1:5432/lume_e2e?schema=public",
    ],
  ])("rejects %s", (_label, url) => {
    expect(() => validateDatabaseTarget(url)).toThrow(UnsafeTargetError);
  });

  it("accepts a positively identified disposable database on an alternate port", () => {
    const target = validateDatabaseTarget(DISPOSABLE_DB);
    expect(target.name).toBe("lume_e2e_task0");
    expect(target.port).toBe("55432");
    expect(target.maintenanceUrl).toContain("/postgres");
    expect(target.maintenanceUrl).not.toContain("lume_e2e_task0");
    expect(target.url).toBe(DISPOSABLE_DB);
  });
});

describe("E2E Redis target guard", () => {
  it("rejects an omitted E2E_REDIS_URL instead of falling back to a shared default", () => {
    expect(() => validateRedisTarget(undefined)).toThrow(UnsafeTargetError);
  });

  it("rejects the occupied default shared redis", () => {
    expect(() => validateRedisTarget(OCCUPIED_REDIS_DEFAULT)).toThrow(UnsafeTargetError);
  });

  it("accepts a dedicated redis on an alternate port", () => {
    expect(validateRedisTarget(DISPOSABLE_REDIS).port).toBe("56379");
  });
});
