import { buildApp } from "./app.js";
import { loadApiEnv } from "./env.js";
import { loadRepoEnv } from "./load-env.js";

loadRepoEnv();
const env = loadApiEnv(process.env);
const app = await buildApp(env);

await app.listen({ host: env.API_HOST, port: env.API_PORT });
