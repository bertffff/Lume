import { execFileSync } from "node:child_process";
import { createPrismaClient } from "@lume/db";

/**
 * API integration tests mutate global tables (leaderboards, global stats,
 * watch history). They must not share the developer or E2E database, otherwise
 * leftover rows make the leaderboard's top-50 assertions flaky.
 *
 * Each run recreates `lume_test` and applies the real migrations, so the tests
 * still exercise Postgres and Prisma rather than mocks.
 */
const testDatabaseUrl = "postgresql://lume:lume@127.0.0.1:5432/lume_test?schema=public";
const maintenanceDatabaseUrl = "postgresql://lume:lume@127.0.0.1:5432/postgres?schema=public";

export default async function setup(): Promise<void> {
  process.env.DATABASE_URL = maintenanceDatabaseUrl;
  const prisma = createPrismaClient();
  try {
    await prisma.$executeRawUnsafe('DROP DATABASE IF EXISTS "lume_test" WITH (FORCE)');
    await prisma.$executeRawUnsafe('CREATE DATABASE "lume_test"');
  } finally {
    await prisma.$disconnect();
  }

  execFileSync("pnpm", ["--filter", "@lume/db", "exec", "prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "inherit",
  });
}
