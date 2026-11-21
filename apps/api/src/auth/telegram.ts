import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { telegramWebAppUserSchema, type TelegramWebAppUser } from "@lume/contracts";

export type TelegramVerifyResult =
  | { ok: true; user: TelegramWebAppUser; authDate: number; queryId?: string }
  | { ok: false; reason: "malformed" | "missing_user" | "bad_hash" | "expired" };

function dataCheckString(params: URLSearchParams): string {
  const entries = [...params.entries()].filter(([key]) => key !== "hash");
  entries.sort((left, right) => left[0].localeCompare(right[0]));
  return entries.map(([key, value]) => `${key}=${value}`).join("\n");
}

export function telegramHash(botToken: string, params: URLSearchParams): string {
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  return createHmac("sha256", secret).update(dataCheckString(params)).digest("hex");
}

function safeEqualHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length === 0 || leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyTelegramInitData(
  initData: string,
  options: { botToken: string; nowMs: number; maxAgeSeconds: number },
): TelegramVerifyResult {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const hash = params.get("hash");
  const authDateRaw = params.get("auth_date");
  const userRaw = params.get("user");
  if (!hash || !authDateRaw || !userRaw) {
    return { ok: false, reason: "malformed" };
  }

  const authDate = Number(authDateRaw);
  if (!Number.isInteger(authDate)) {
    return { ok: false, reason: "malformed" };
  }

  const expected = telegramHash(options.botToken, params);
  if (!safeEqualHex(hash, expected)) {
    return { ok: false, reason: "bad_hash" };
  }

  const ageSeconds = options.nowMs / 1000 - authDate;
  if (ageSeconds > options.maxAgeSeconds || ageSeconds < -30) {
    return { ok: false, reason: "expired" };
  }

  let userJson: unknown;
  try {
    userJson = JSON.parse(userRaw);
  } catch {
    return { ok: false, reason: "missing_user" };
  }
  const user = telegramWebAppUserSchema.safeParse(userJson);
  if (!user.success) {
    return { ok: false, reason: "missing_user" };
  }

  const queryId = params.get("query_id") ?? undefined;
  return queryId
    ? { ok: true, user: user.data, authDate, queryId }
    : { ok: true, user: user.data, authDate };
}

/** Telegram Login Widget: secret is SHA-256 of the bot token, not the WebAppData key. */
export function verifyLoginWidget(
  fields: Record<string, string>,
  botToken: string,
  nowMs: number,
  maxAgeSeconds: number,
): boolean {
  const hash = fields.hash;
  const authDate = Number(fields.auth_date);
  if (!hash || !Number.isInteger(authDate)) return false;
  const check = Object.keys(fields)
    .filter((key) => key !== "hash")
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(check).digest("hex");
  if (!safeEqualHex(hash, expected)) return false;
  const ageSeconds = nowMs / 1000 - authDate;
  return ageSeconds <= maxAgeSeconds && ageSeconds >= -30;
}

export function localeFromTelegram(languageCode: string | undefined): "ru" | "en" {
  if (!languageCode || languageCode.toLowerCase().startsWith("ru")) {
    return "ru";
  }
  return "en";
}
