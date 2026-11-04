import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { loadWorkerEnv } from "./env.js";
import { listenHealth } from "./health.js";
import { loadRepoEnv } from "./load-env.js";
import { mediaResolveQueue, resolveMedia, type MediaResolveJob } from "./jobs/resolve-media.js";

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
  console.log(JSON.stringify({ service: "worker", queue: queue.name, redis: "connecting" }));
} else {
  console.log(JSON.stringify({ service: "worker", redis: "unset", mode: "idle" }));
}

listenHealth(env.WORKER_HOST, env.WORKER_PORT, () => ({
  status: redisUp ? "ready" : "degraded",
  redis: redisUp ? "up" : "down",
  queues: [mediaResolveQueue],
}));
