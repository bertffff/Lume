import { createPrismaClient } from "@lume/db";
import { buildApp } from "./app.js";
import { loadApiEnv } from "./env.js";
import { loadRepoEnv } from "./load-env.js";

loadRepoEnv();
const env = loadApiEnv(process.env);
const prisma = env.DATABASE_URL ? createPrismaClient() : undefined;
const app = await buildApp(env, prisma ? { prisma } : {});

await app.listen({ host: env.API_HOST, port: env.API_PORT });
