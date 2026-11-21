import webpush from "web-push";
import type {
  DeliveryResult,
  PushConfig,
  PushSender,
  PushSubscriptionInput,
} from "./index.js";

export function vapidConfigured(config: PushConfig = {}): boolean {
  return Boolean(config.publicKey && config.privateKey && config.subject);
}

export function createPushSender(config: PushConfig = {}): PushSender {
  const configured = vapidConfigured(config);
  if (configured) {
    webpush.setVapidDetails(
      config.subject as string,
      config.publicKey as string,
      config.privateKey as string,
    );
  }

  return {
    configured,
    async send(subscription: PushSubscriptionInput, payload: string): Promise<DeliveryResult> {
      if (!configured) {
        return { status: "skipped", reason: "vapid_unconfigured" };
      }
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
          },
          payload,
        );
        return { status: "sent" };
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        return {
          status: "failed",
          error: statusCode ? `push_${statusCode}` : error instanceof Error ? error.message : "push_failed",
        };
      }
    },
  };
}
