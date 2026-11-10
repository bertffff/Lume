import type { MemberRole } from "@lume/contracts";
import { createContext, useContext, type ReactNode } from "react";
import type { LiveRoom } from "../realtime/useRoomChannel.js";

export interface RoomActions {
  state: LiveRoom;
  positionMs: number;
  offsetMs: number;
  canControl: boolean;
  selfId: string;
  sendChat: (body: string, replyToId?: string | null) => void;
  react: (messageId: string, emoji: string) => void;
  addQueue: (url: string) => void;
  playNext: () => void;
  setPlayback: (mode: "play" | "pause" | "seek", positionMs: number) => void;
  reportViewer: (phase: "buffering" | "ready") => void;
  accessToken: string;
  voiceForce: { id: number; userId: string; action: "mute" | "disconnect" } | null;
  joinVoicePresence: () => void;
  leaveVoicePresence: () => void;
  reportVoice: (muted: boolean, speaking: boolean) => void;
  muteVoices: (userId?: string) => void;
  disconnectVoice: (userId: string) => void;
  kick: (userId: string) => void;
  mute: (userId: string, muted: boolean) => void;
  promote: (userId: string) => void;
  clockOffset: number;
  skip: { votes: number; needed: number };
  typingName: string | null;
  typingNames: string[];
  heartbeatAt: number | null;
  heartbeat: () => void;
  floats: Array<{ id: string; emoji: string; x: number; y: number; userId: string }>;
  voteSkip: (withdraw?: boolean) => void;
  sendTyping: () => void;
  sendFloat: (emoji: string) => void;
}

const RoomContext = createContext<RoomActions | null>(null);

export function RoomProvider({ value, children }: { value: RoomActions; children: ReactNode }) {
  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoomActions(): RoomActions | null {
  return useContext(RoomContext);
}

export function roleLabel(role: MemberRole, t: (key: "room.host" | "member.mod" | "member.viewer") => string): string {
  if (role === "host") {
    return t("room.host");
  }
  if (role === "mod") {
    return t("member.mod");
  }
  return t("member.viewer");
}
