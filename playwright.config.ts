import { defineConfig, devices } from "@playwright/test";
import {
  apiUrl,
  mockUrl,
  oembedBaseUrl,
  ports,
  realtimeUrl,
  webUrl,
} from "./e2e/helpers/config";
import {
  safeTargetLabel,
  validateDatabaseTarget,
  validateRedisTarget,
} from "./apps/api/scripts/e2e-target";

/**
 * Propagate the single source of truth to test workers. Specs that still read
 * process.env.API_URL must observe the same origin as the web servers below;
 * without this they silently fall back to hardcoded 127.0.0.1 defaults.
 */
process.env.E2E_API_PORT = String(ports.api);
process.env.E2E_REALTIME_PORT = String(ports.realtime);
process.env.E2E_WEB_PORT = String(ports.web);
process.env.E2E_MOCK_PORT = String(ports.mock);
process.env.API_URL = apiUrl;
process.env.REALTIME_URL = realtimeUrl;
process.env.WEB_ORIGIN = webUrl;

// Validation is pure: an omitted or unsafe target fails before any destructive
// setup and without contacting the occupied local defaults (5432 / 6379).
const database = validateDatabaseTarget(process.env.E2E_DATABASE_URL);
const redis = validateRedisTarget(process.env.E2E_REDIS_URL);
console.log(
  `E2E targets: database=${safeTargetLabel(database)}/${database.name} ` +
    `redis=${safeTargetLabel(redis)} web=${webUrl} api=${apiUrl} realtime=${realtimeUrl}`,
);

const sharedEnv = {
  ...process.env,
  DATABASE_URL: database.url,
  REDIS_URL: redis.url,
  REDIS_KEY_PREFIX: "lume:e2e",
  JWT_SECRET: process.env.JWT_SECRET ?? "e2e-only-not-a-real-secret",
  ALLOW_STUB_AUTH: "true",
  ALLOW_STUB_VOICE: "true",
  WEB_ORIGIN: webUrl,
  API_URL: apiUrl,
  REALTIME_URL: realtimeUrl,
  API_HOST: "127.0.0.1",
  REALTIME_HOST: "127.0.0.1",
  API_PORT: String(ports.api),
  REALTIME_PORT: String(ports.realtime),
  MOCK_METADATA_PORT: String(ports.mock),
  OEMBED_BASE_URL: oembedBaseUrl,
  STREAM_ALLOWLIST: "127.0.0.1",
  STREAM_ALLOW_PRIVATE_HOSTS: "true",
  STREAM_MAX_BYTES: "1048576",
  STUN_URLS: process.env.STUN_URLS ?? "stun:127.0.0.1:3478",
  TURN_URLS: process.env.TURN_URLS ?? "turn:127.0.0.1:3478,turns:127.0.0.1:5349",
  TURN_USERNAME: process.env.TURN_USERNAME ?? "lume-turn",
  TURN_CREDENTIAL: process.env.TURN_CREDENTIAL ?? "lume-turn-test",
};

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: webUrl,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "node e2e/mock-metadata.mjs",
      url: `${mockUrl}/health`,
      reuseExistingServer: false,
      env: sharedEnv,
    },
    {
      // Recreate the disposable E2E database before the API boots so a dev API
      // on the default port (pointing at `lume`) can never be reused for E2E.
      command:
        "pnpm --filter @lume/api exec tsx scripts/prepare-e2e-db.ts && pnpm --filter @lume/api start",
      url: `${apiUrl}/health`,
      reuseExistingServer: false,
      env: sharedEnv,
    },
    {
      command: "pnpm --filter @lume/realtime start",
      url: `${realtimeUrl}/health`,
      reuseExistingServer: false,
      env: sharedEnv,
    },
    {
      // VITE_* origins are baked in at BUILD time (turbo.json hashes them).
      // `vite preview` only serves that build on the parameterized port.
      command: `pnpm --filter @lume/web exec vite preview --host 127.0.0.1 --port ${ports.web} --strictPort`,
      url: webUrl,
      reuseExistingServer: false,
      env: { ...sharedEnv, NODE_ENV: "production" },
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
