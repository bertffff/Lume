import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "@lume/db";

/**
 * Playwright E2E must never write into the developer database `lume`.
 * Every run recreates the test database and applies the real migrations, so
 * rooms, users and watch history created by the specs stay out of `lume`.
 */
const testDatabaseUrl =
  process.env.E2E_DATABASE_URL ?? "postgresql://lume:lume@127.0.0.1:5432/lume_test?schema=public";
const testUrl = new URL(testDatabaseUrl);
const databaseName = testUrl.pathname.replace(/^\//, "");
if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
  throw new Error(`E2E_DATABASE_URL must point at a simple database name, got ${databaseName || "(empty)"}`);
}
const maintenanceUrl = new URL(testDatabaseUrl);
maintenanceUrl.pathname = "/postgres";
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

process.env.DATABASE_URL = maintenanceUrl.toString();
const prisma = createPrismaClient();
try {
  await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await prisma.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
} finally {
  await prisma.$disconnect();
}

execFileSync("pnpm", ["--filter", "@lume/db", "exec", "prisma", "migrate", "deploy"], {
  cwd: repositoryRoot,
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  stdio: "inherit",
});
