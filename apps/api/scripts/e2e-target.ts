/**
 * Pure, I/O-free validation of E2E infrastructure targets.
 *
 * Shared by the Playwright config, the destructive DB prepare script and the
 * guard tests. Nothing in here opens a socket, so a refused target can never
 * stop an existing service or touch a shared database on the way out.
 */

export class UnsafeTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeTargetError";
  }
}

export interface DatabaseTarget {
  url: string;
  name: string;
  host: string;
  port: string;
  maintenanceUrl: string;
}

export interface RedisTarget {
  url: string;
  host: string;
  port: string;
}

const RESERVED_DATABASES = new Set(["lume", "lume_test", "postgres", "template0", "template1"]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const DEFAULT_SHARED_DB_PORT = "5432";
const DEFAULT_SHARED_REDIS_PORT = "6379";

function loopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.replace(/^\[|\]$/g, ""));
}

function parseUrl(rawUrl: string | undefined, label: string): URL {
  if (!rawUrl) {
    throw new UnsafeTargetError(`${label} is required. Refusing to use a shared default.`);
  }
  try {
    return new URL(rawUrl);
  } catch {
    throw new UnsafeTargetError(`${label} is not a valid URL.`);
  }
}

/**
 * A destructive E2E setup must point at a database that is positively marked
 * disposable, served by a local process, and NOT on the default shared port.
 */
export function validateDatabaseTarget(rawUrl: string | undefined): DatabaseTarget {
  const url = parseUrl(rawUrl, "E2E_DATABASE_URL");
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new UnsafeTargetError(`E2E_DATABASE_URL must use postgres:, got ${url.protocol}`);
  }

  let name: string;
  try {
    name = decodeURIComponent(url.pathname.replace(/^\//, "").replace(/\/$/, ""));
  } catch {
    throw new UnsafeTargetError("E2E_DATABASE_URL contains an invalid database name.");
  }

  if (!/^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(name)) {
    throw new UnsafeTargetError(
      `E2E_DATABASE_URL must point at a simple database name, got ${name || "(empty)"}`,
    );
  }
  if (!/(^|_)e2e(_|$)/.test(name)) {
    throw new UnsafeTargetError(
      `E2E database name must be positively marked disposable with an "e2e" segment, got ${name}`,
    );
  }
  if (RESERVED_DATABASES.has(name.toLowerCase())) {
    throw new UnsafeTargetError(`E2E_DATABASE_URL must not target the reserved database ${name}`);
  }

  const port = url.port || DEFAULT_SHARED_DB_PORT;
  if (port === DEFAULT_SHARED_DB_PORT) {
    throw new UnsafeTargetError(
      `E2E_DATABASE_URL points at the occupied default Postgres port (${port}) on ${url.hostname}. ` +
        "Provide an explicitly disposable local cluster on an alternate port.",
    );
  }
  if (!loopbackHost(url.hostname)) {
    throw new UnsafeTargetError(
      `E2E_DATABASE_URL must point at a local (loopback) disposable cluster, got ${url.hostname}`,
    );
  }

  const maintenanceUrl = new URL(url.toString());
  maintenanceUrl.pathname = "/postgres";
  maintenanceUrl.search = "";
  maintenanceUrl.hash = "";

  return {
    url: url.toString(),
    name,
    host: url.hostname,
    port,
    maintenanceUrl: maintenanceUrl.toString(),
  };
}

/** E2E needs a dedicated, local Redis, never the developer's default instance. */
export function validateRedisTarget(rawUrl: string | undefined): RedisTarget {
  const url = parseUrl(rawUrl, "E2E_REDIS_URL");
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new UnsafeTargetError(`E2E_REDIS_URL must use redis:, got ${url.protocol}`);
  }
  const port = url.port || DEFAULT_SHARED_REDIS_PORT;
  if (port === DEFAULT_SHARED_REDIS_PORT) {
    throw new UnsafeTargetError(
      `E2E_REDIS_URL points at the occupied default Redis port (${port}) on ${url.hostname}. ` +
        "Provide a dedicated local Redis on an alternate port.",
    );
  }
  if (!loopbackHost(url.hostname)) {
    throw new UnsafeTargetError(
      `E2E_REDIS_URL must point at a local (loopback) dedicated Redis, got ${url.hostname}`,
    );
  }
  return { url: url.toString(), host: url.hostname, port };
}

/** Credentials-free summary safe to print in preflight output. */
export function safeTargetLabel(target: DatabaseTarget | RedisTarget): string {
  return `${target.host}:${target.port}`;
}
