import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 32)) as Buffer;
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, salt, digest] = stored.split("$");
  if (kind !== "scrypt" || !salt || !digest) {
    return false;
  }
  const hash = (await scryptAsync(password, salt, 32)) as Buffer;
  const expected = Buffer.from(digest, "hex");
  if (expected.length !== hash.length) {
    return false;
  }
  return timingSafeEqual(expected, hash);
}
