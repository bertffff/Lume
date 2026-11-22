import { safeTargetLabel, validateDatabaseTarget, validateRedisTarget } from "./e2e-target";

/**
 * Safe preflight: validates E2E targets with no network I/O and no secrets in
 * the output. Run before starting any disposable infrastructure.
 *
 *   pnpm --filter @lume/api exec tsx scripts/check-e2e-target.ts
 */
const database = validateDatabaseTarget(process.env.E2E_DATABASE_URL);
const redis = validateRedisTarget(process.env.E2E_REDIS_URL);
console.log(
  `E2E target preflight OK: database=${safeTargetLabel(database)}/${database.name} ` +
    `redis=${safeTargetLabel(redis)}`,
);
