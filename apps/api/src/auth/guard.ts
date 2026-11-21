import { verifyAccessToken, type AccessClaims } from "@lume/contracts/node";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiEnv } from "../env.js";

export async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
  env: ApiEnv,
): Promise<AccessClaims | null> {
  if (!env.JWT_SECRET) {
    await reply.code(503).send({ error: "jwt_unconfigured" });
    return null;
  }
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    await reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  try {
    return await verifyAccessToken(env.JWT_SECRET, header.slice("Bearer ".length));
  } catch {
    await reply.code(401).send({ error: "unauthorized" });
    return null;
  }
}
