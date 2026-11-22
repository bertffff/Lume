import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createPrismaClient } from "@lume/db";
import { safeTargetLabel, validateDatabaseTarget } from "./e2e-target";

/**
 * Playwright E2E must never write into the developer database `lume`, nor the
 * API integration suite's `lume_test`. An explicit, positively disposable
 * E2E_DATABASE_URL on a non-default cluster port is mandatory; validation runs
 * before any connection, so a refused target cannot touch a shared database.
 */
const target = validateDatabaseTarget(process.env.E2E_DATABASE_URL);
console.log(`Preparing disposable E2E database ${target.name} on ${safeTargetLabel(target)}`);

const maintenanceUrl = target.maintenanceUrl;
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

process.env.DATABASE_URL = maintenanceUrl;
const prisma = createPrismaClient();
try {
  await prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${target.name}" WITH (FORCE)`);
  await prisma.$executeRawUnsafe(`CREATE DATABASE "${target.name}"`);
} finally {
  await prisma.$disconnect();
}

execFileSync("pnpm", ["--filter", "@lume/db", "exec", "prisma", "migrate", "deploy"], {
  cwd: repositoryRoot,
  env: { ...process.env, DATABASE_URL: target.url },
  stdio: "inherit",
});
