import { jwtVerify, SignJWT } from "jose";

export interface AccessClaims {
  userId: string;
  displayName: string;
  telegramId: string | null;
}

export async function mintAccessToken(input: {
  secret: string;
  userId: string;
  telegramId: string | null;
  displayName?: string;
  ttlSeconds: number;
}): Promise<string> {
  const key = new TextEncoder().encode(input.secret);
  return new SignJWT({ tg: input.telegramId, name: input.displayName ?? "" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(`${input.ttlSeconds}s`)
    .sign(key);
}

export async function verifyAccessToken(secret: string, token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("unauthorized");
  }
  const displayName =
    typeof payload.name === "string" && payload.name.trim().length > 0 ? payload.name : "Гость";
  const telegramId = typeof payload.tg === "string" ? payload.tg : null;
  return { userId: payload.sub, displayName, telegramId };
}
