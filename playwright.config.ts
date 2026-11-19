import { defineConfig, devices } from "@playwright/test";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://lume:lume@127.0.0.1:5432/lume?schema=public";
const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const jwtSecret = process.env.JWT_SECRET ?? "e2e-only-not-a-real-secret";

const sharedEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  REDIS_URL: redisUrl,
  JWT_SECRET: jwtSecret,
  ALLOW_STUB_AUTH: "true",
  ALLOW_STUB_VOICE: "true",
  WEB_ORIGIN: "http://127.0.0.1:5173",
  API_URL: "http://127.0.0.1:3001",
  OEMBED_BASE_URL: "http://127.0.0.1:3099/oembed",
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
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "node e2e/mock-metadata.mjs",
      url: "http://127.0.0.1:3099/health",
      reuseExistingServer: !process.env.CI,
      env: sharedEnv,
    },
    {
      command: "pnpm --filter @lume/api start",
      url: "http://127.0.0.1:3001/health",
      reuseExistingServer: !process.env.CI,
      env: sharedEnv,
    },
    {
      command: "pnpm --filter @lume/realtime start",
      url: "http://127.0.0.1:3002/health",
      reuseExistingServer: !process.env.CI,
      env: sharedEnv,
    },
    {
      command: "pnpm --filter @lume/web exec vite preview --host 127.0.0.1 --port 5173 --strictPort",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      env: sharedEnv,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
