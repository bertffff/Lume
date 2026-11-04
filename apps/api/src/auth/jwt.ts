import { SignJWT } from "jose";

export async function mintAccessToken(input: {
  secret: string;
  userId: string;
  telegramId: string | null;
  ttlSeconds: number;
}): Promise<string> {
  const key = new TextEncoder().encode(input.secret);
  return new SignJWT({ tg: input.telegramId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(`${input.ttlSeconds}s`)
    .sign(key);
}
