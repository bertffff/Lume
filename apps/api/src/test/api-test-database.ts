const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** Parse the only permitted database target for normal API integration fixtures. */
export function getApiTestDatabaseTarget() {
  const raw = process.env.API_TEST_DATABASE_URL;
  if (!raw) {
    throw new Error("API_TEST_DATABASE_URL is required; there is no shared default.");
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("API_TEST_DATABASE_URL is not a valid URL.");
  }

  if (!["postgresql:", "postgres:"].includes(url.protocol)) {
    throw new Error("API_TEST_DATABASE_URL must use PostgreSQL.");
  }
  if (!LOOPBACK_HOSTS.has(url.hostname) || !url.port || url.port === "0" || url.port === "5432") {
    throw new Error("API_TEST_DATABASE_URL must use a loopback host and an explicit alternate port (not 5432).");
  }

  const name = url.pathname.slice(1);
  if (name.length > 63 || !/^lume_api_test_[a-z0-9]+(?:_[a-z0-9]+)*$/.test(name)) {
    throw new Error("API_TEST_DATABASE_URL must name a fresh lume_api_test_<suffix> database.");
  }
  if (name.split("_").includes("e2e")) {
    throw new Error('API_TEST_DATABASE_URL must not include the Playwright database marker "e2e".');
  }
  if (url.hash || (url.search !== "" && url.search !== "?schema=public")) {
    throw new Error("API_TEST_DATABASE_URL only accepts the optional ?schema=public query and no fragment.");
  }

  const maintenanceUrl = new URL(url);
  maintenanceUrl.pathname = "/postgres";
  maintenanceUrl.search = "";
  return { name, url: url.href, maintenanceUrl: maintenanceUrl.href };
}

export function apiTestDatabaseUrl(): string {
  return getApiTestDatabaseTarget().url;
}
