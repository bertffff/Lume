import { createServer, type Server as HttpServer } from "node:http";
import { createAdapter } from "@socket.io/redis-adapter";
import { Server } from "socket.io";
import type { RealtimeEnv } from "./env.js";
import { connectRedis, type RedisPair } from "./redis.js";
import { registerSocketHandlers } from "./socket/handlers.js";

export interface RealtimeServer {
  httpServer: HttpServer;
  io: Server;
  redis: RedisPair | null;
}

export async function startRealtime(env: RealtimeEnv): Promise<RealtimeServer> {
  const redis = await connectRedis(env.REDIS_URL);
  const httpServer = createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }
    if (request.url === "/internal/close" && request.method === "POST") {
      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.on("end", () => {
        let roomId = "";
        try {
          roomId = String((JSON.parse(Buffer.concat(chunks).toString() || "{}") as { roomId?: string }).roomId ?? "");
        } catch {
          roomId = "";
        }
        if (roomId) {
          io.to(roomId).emit("room:error", { code: "closed", message: "Комната закрыта" });
          void io.in(roomId).fetchSockets().then((sockets) => {
            for (const socket of sockets) {
              socket.disconnect(true);
            }
          });
        }
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
      });
      return;
    }
    if (request.url === "/ready") {
      const ready = redis !== null;
      response.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          status: ready ? "ready" : "degraded",
          redis: ready ? "up" : "down",
          replicaIndex: env.REALTIME_REPLICA_INDEX,
          replicaCount: env.REALTIME_REPLICA_COUNT,
          enforceRoomOwner: env.REALTIME_ENFORCE_ROOM_OWNER,
        }),
      );
      return;
    }
    response.writeHead(404);
    response.end();
  });

  const io = new Server(httpServer, {
    cors: { origin: env.WEB_ORIGIN },
  });
  if (redis) {
    io.adapter(createAdapter(redis.pub, redis.sub));
  }
  registerSocketHandlers(io, env, redis);

  await new Promise<void>((resolve) => {
    httpServer.listen(env.REALTIME_PORT, env.REALTIME_HOST, () => resolve());
  });

  console.log(
    JSON.stringify({
      service: "realtime",
      port: env.REALTIME_PORT,
      redis: redis ? "up" : "down",
      replicaIndex: env.REALTIME_REPLICA_INDEX,
      replicaCount: env.REALTIME_REPLICA_COUNT,
    }),
  );

  return { httpServer, io, redis };
}
