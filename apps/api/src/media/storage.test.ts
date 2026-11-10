import { describe, expect, it } from "vitest";
import { storeObject } from "./storage.js";

describe("object storage", () => {
  it("keeps files local unless S3 or a Telegram chat is configured", async () => {
    const local = await storeObject({ id: "abc", bytes: Buffer.from("hi") });
    expect(local.backend).toBe("local");
    expect(local.url).toBe("/uploads/abc");
    const telegram = await storeObject({
      id: "abc",
      bytes: Buffer.from("hi"),
      telegram: { token: "bot", chatId: "1" },
    });
    expect(telegram.backend).toBe("telegram");
    const s3 = await storeObject({ id: "abc", bytes: Buffer.from("hi"), s3: { endpoint: "https://cdn.example" } });
    expect(s3.backend).toBe("s3");
  });
});