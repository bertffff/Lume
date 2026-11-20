import { describe, expect, it } from "vitest";
import { createEmailSender } from "./email.js";
import { createPushSender } from "./push.js";

describe("delivery honesty", () => {
  it("reports email as skipped when SMTP is not configured", async () => {
    const sender = createEmailSender({});
    expect(sender.configured).toBe(false);
    expect(await sender.send({ to: "a@example.com", subject: "s", text: "t" })).toEqual({
      status: "skipped",
      reason: "smtp_unconfigured",
    });
  });

  it("reports push as skipped when VAPID is not configured", async () => {
    const sender = createPushSender({});
    expect(sender.configured).toBe(false);
    expect(
      await sender.send(
        { endpoint: "https://push.example/1", keys: { p256dh: "p", auth: "a" } },
        "{}",
      ),
    ).toEqual({ status: "skipped", reason: "vapid_unconfigured" });
  });

  it("treats a sender without SMTP_HOST as unconfigured", () => {
    expect(createEmailSender({ from: "lume@example.com" }).configured).toBe(false);
    expect(createEmailSender({ host: "smtp.example.com" }).configured).toBe(false);
    expect(createEmailSender({ host: "smtp.example.com", from: "lume@example.com" }).configured).toBe(true);
  });

  it("requires the full VAPID triple", () => {
    const publicKey = Buffer.alloc(65, 1).toString("base64url");
    const privateKey = Buffer.alloc(32, 2).toString("base64url");
    expect(createPushSender({ publicKey, privateKey }).configured).toBe(false);
    expect(
      createPushSender({ publicKey, privateKey, subject: "mailto:a@example.com" }).configured,
    ).toBe(true);
  });
});
