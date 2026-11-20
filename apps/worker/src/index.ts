import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { createPrismaClient } from "@lume/db";
import { loadWorkerEnv } from "./env.js";
import { listenHealth } from "./health.js";
import { loadRepoEnv } from "./load-env.js";
import { createMediaResolver, createUrlResolver, mediaResolveQueue, type MediaResolveJob } from "./jobs/resolve-media.js";
import { accountPurgeQueue, purgeDueAccounts, purgeRepeat } from "./jobs/purge.js";
import { createDigestRunner, digestQueue, digestRepeat } from "./jobs/digest.js";
import { mediaRefreshQueue, mediaRefreshRepeat, refreshDueStreamUrls } from "./jobs/refresh-media.js";

loadRepoEnv();
const env = loadWorkerEnv(process.env);

const prisma = env.DATABASE_URL ? createPrismaClient() : null;
const resolver = createMediaResolver(env);
const urlResolver = createUrlResolver(env);
const digest = prisma ? createDigestRunner(prisma, env) : null;
let redisUp = false;

if (env.REDIS_URL) {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on("ready", () => {
    redisUp = true;
  });
  connection.on("error", () => {
    redisUp = false;
  });

  const queue = new Queue<MediaResolveJob>(mediaResolveQueue, { connection });
  const worker = new Worker<MediaResolveJob>(
    mediaResolveQueue,
    async (job) => resolver(job.data),
    { connection },
  );
  worker.on("failed", (job, error) => {
    console.error(JSON.stringify({ queue: mediaResolveQueue, jobId: job?.id, message: error.message }));
  });

  const purge = new Queue(accountPurgeQueue, { connection });
  await purge.upsertJobScheduler("account-purge-daily", purgeRepeat, { name: "purge", data: {} });
  const purgeWorker = new Worker(accountPurgeQueue, async () => purgeDueAccounts(), { connection });
  purgeWorker.on("failed", (job, error) => {
    console.error(JSON.stringify({ queue: accountPurgeQueue, jobId: job?.id, message: error.message }));
  });

  const digests = new Queue(digestQueue, { connection });
  await digests.upsertJobScheduler("notify-digest", digestRepeat, { name: "digest", data: {} });
  const digestWorker = new Worker(
    digestQueue,
    async () => (digest ? digest() : { due: 0, sent: 0, failed: 0, skipped: 0, rescheduled: 0 }),
    { connection },
  );
  digestWorker.on("failed", (job, error) => {
    console.error(JSON.stringify({ queue: digestQueue, jobId: job?.id, message: error.message }));
  });

  if (prisma && urlResolver.enabled) {
    const refresh = new Queue(mediaRefreshQueue, { connection });
    await refresh.upsertJobScheduler("media-refresh", mediaRefreshRepeat, { name: "refresh", data: {} });
    const refreshWorker = new Worker(
      mediaRefreshQueue,
      async () => {
        const stats = await refreshDueStreamUrls(prisma, urlResolver.resolve);
        if (stats.refreshed > 0 || stats.failed > 0) {
          console.log(JSON.stringify({ queue: mediaRefreshQueue, ...stats }));
        }
        return stats;
      },
      { connection },
    );
    refreshWorker.on("failed", (job, error) => {
      console.error(JSON.stringify({ queue: mediaRefreshQueue, jobId: job?.id, message: error.message }));
    });
  }

  console.log(
    JSON.stringify({
      service: "worker",
      queue: queue.name,
      purge: purgeRepeat.pattern,
      digest: digestRepeat.pattern,
      extractors: { enabled: resolver.enabled, adapters: resolver.adapters, disabled: resolver.disabledAdapters },
      redis: "connecting",
    }),
  );
} else {
  console.log(JSON.stringify({ service: "worker", redis: "unset", mode: "idle" }));
}

listenHealth(env.WORKER_HOST, env.WORKER_PORT, () => ({
  status: redisUp ? "ready" : "degraded",
  redis: redisUp ? "up" : "down",
  extractors: { enabled: resolver.enabled, adapters: resolver.adapters },
  queues: [mediaResolveQueue, accountPurgeQueue, digestQueue, ...(urlResolver.enabled ? [mediaRefreshQueue] : [])],
}));

process.once("SIGTERM", () => {
  void prisma?.$disconnect().finally(() => process.exit(0));
});
process.once("SIGINT", () => {
  void prisma?.$disconnect().finally(() => process.exit(0));
});
