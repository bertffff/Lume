import { RoomServiceClient, TrackSource, type ParticipantInfo } from "livekit-server-sdk";
import { liveKitHttpHost, liveKitRoomName } from "./livekit.js";

export function createRoomAdmin(env: { LIVEKIT_URL: string; LIVEKIT_API_KEY: string; LIVEKIT_API_SECRET: string }) {
  return new RoomServiceClient(liveKitHttpHost(env.LIVEKIT_URL), env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
}

async function muteIdentity(client: RoomServiceClient, room: string, identity: string): Promise<void> {
  let participant: ParticipantInfo;
  try {
    participant = await client.getParticipant(room, identity);
  } catch {
    return;
  }
  for (const track of participant.tracks) {
    if (track.source === TrackSource.MICROPHONE) {
      await client.mutePublishedTrack(room, identity, track.sid, true);
    }
  }
}

export async function muteVoiceIdentities(
  env: { LIVEKIT_URL: string; LIVEKIT_API_KEY: string; LIVEKIT_API_SECRET: string },
  roomId: string,
  identities: string[],
): Promise<void> {
  const client = createRoomAdmin(env);
  const room = liveKitRoomName(roomId);
  for (const identity of identities) {
    await muteIdentity(client, room, identity);
  }
}

export async function disconnectVoiceIdentity(
  env: { LIVEKIT_URL: string; LIVEKIT_API_KEY: string; LIVEKIT_API_SECRET: string },
  roomId: string,
  identity: string,
): Promise<void> {
  const client = createRoomAdmin(env);
  try {
    await client.removeParticipant(liveKitRoomName(roomId), identity);
  } catch {
    // Already gone from the LiveKit room.
  }
}
