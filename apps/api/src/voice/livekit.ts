import { AccessToken } from "livekit-server-sdk";

export function liveKitConfigured(env: {
  LIVEKIT_URL?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
}): boolean {
  return Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
}

export async function mintLiveKitToken(input: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  name: string;
  roomName: string;
  ttlSeconds: number;
}): Promise<string> {
  const token = new AccessToken(input.apiKey, input.apiSecret, {
    identity: input.identity,
    name: input.name,
    ttl: input.ttlSeconds,
    metadata: JSON.stringify({ "voice.priority": false }),
  });
  token.addGrant({
    roomJoin: true,
    room: input.roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return token.toJwt();
}

/** LiveKit room name is the Lume room id, prefixed so it cannot collide with other apps. */
export function liveKitRoomName(roomId: string): string {
  return `lume_${roomId}`;
}

/** RoomServiceClient wants https. Cloud URLs are usually wss. */
export function liveKitHttpHost(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol === "wss:") {
    parsed.protocol = "https:";
  } else if (parsed.protocol === "ws:") {
    parsed.protocol = "http:";
  }
  return parsed.origin;
}
