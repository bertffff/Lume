import { loadRealtimeEnv } from "./env.js";
import { loadRepoEnv } from "./load-env.js";
import { startRealtime } from "./server.js";

loadRepoEnv();
const env = loadRealtimeEnv(process.env);
await startRealtime(env);
