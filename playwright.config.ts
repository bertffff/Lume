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
