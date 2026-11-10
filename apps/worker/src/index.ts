import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { loadWorkerEnv } from "./env.js";
import { listenHealth } from "./health.js";
import { loadRepoEnv } from "./load-env.js";
import { mediaResolveQueue, resolveMedia, type MediaResolveJob } from "./jobs/resolve-media.js";
import { accountPurgeQueue, purgeDueAccounts, purgeRepeat } from "./jobs/purge.js";

loadRepoEnv();
const env = loadWorkerEnv(process.env);

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
    async (job) => resolveMedia(job.data),
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
  console.log(JSON.stringify({ service: "worker", queue: queue.name, purge: purgeRepeat.pattern, redis: "connecting" }));
} else {
  console.log(JSON.stringify({ service: "worker", redis: "unset", mode: "idle" }));
}

listenHealth(env.WORKER_HOST, env.WORKER_PORT, () => ({
  status: redisUp ? "ready" : "degraded",
  redis: redisUp ? "up" : "down",
  queues: [mediaResolveQueue, accountPurgeQueue],
}));
