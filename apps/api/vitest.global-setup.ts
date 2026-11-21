import { execFileSync } from "node:child_process";
import { createPrismaClient } from "@lume/db";
import { getApiTestDatabaseTarget } from "./src/test/api-test-database.js";

/**
 * API integration tests mutate global tables (leaderboards, global stats,
 * watch history). They must not share the developer or E2E database, otherwise
 * leftover rows make the leaderboard's top-50 assertions flaky.
 *
 * CREATE DATABASE also acts as the ownership check: if a database by that
 * name already exists, fail without dropping, migrating or reusing it.
 */
export default async function setup(): Promise<void> {
  const target = getApiTestDatabaseTarget();
  const previousDatabaseUrl = process.env.DATABASE_URL;
  try {
    process.env.DATABASE_URL = target.maintenanceUrl;
    const prisma = createPrismaClient();
    try {
      // PostgreSQL cannot bind an identifier, so interpolate only the validated name.
      await prisma.$executeRawUnsafe(`CREATE DATABASE "${target.name}" TEMPLATE template0`);
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }

  execFileSync("pnpm", ["--filter", "@lume/db", "exec", "prisma", "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: target.url },
    stdio: "inherit",
  });
}
