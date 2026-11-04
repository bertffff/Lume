import type { MemberRole } from "@lume/contracts";
import { createContext, useContext, type ReactNode } from "react";
import type { LiveRoom } from "../realtime/useRoomChannel.js";

export interface RoomActions {
  state: LiveRoom;
  positionMs: number;
  canControl: boolean;
  selfId: string;
  sendChat: (body: string, replyToId?: string | null) => void;
  react: (messageId: string, emoji: string) => void;
  addQueue: (url: string) => void;
  playNext: () => void;
  togglePlayback: () => void;
  seekForward: () => void;
  kick: (userId: string) => void;
  mute: (userId: string, muted: boolean) => void;
  promote: (userId: string) => void;
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
