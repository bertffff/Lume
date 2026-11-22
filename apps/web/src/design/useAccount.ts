import { useEffect, useState } from "react";
import { api, apiUrl } from "../api/client.js";
import type { ClientSession } from "../session.js";
import { isStyleId, isThemeMode, type StyleId, type ThemeMode } from "./theme.js";
import { shotRooms } from "./shot-fixtures.js";

type Friends = Awaited<ReturnType<typeof api.friends>>["friends"];
type ResumeCard = Awaited<ReturnType<typeof api.resume>>["resume"];
export interface RoomRow { id: string; title: string; code: string; memberCount?: number }

/** Everything the signed-in shell loads about the person: rooms, friends, resume card, progress, bans and saved appearance. */
export function useAccount({ session, path, roomId, shot, query, setStyle, setMode }: {
  session: ClientSession | null;
  path: string;
  roomId: string | null;
  shot: string | null;
  query: string;
  setStyle: (style: StyleId) => void;
  setMode: (mode: ThemeMode) => void;
}) {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [friendFeed, setFriendFeed] = useState<{ ownerId: string; items: Friends }>();
  const [blocked, setBlocked] = useState<Array<{ id: string; displayName: string }>>([]);
  const [globalBans, setGlobalBans] = useState<Array<{ id: string; userId: string; displayName: string; reason: string | null }>>([]);
  const [heat, setHeat] = useState<Array<{ day: string; score: number }>>([]);
  const [level, setLevel] = useState(1);
  const [resumeFeed, setResumeFeed] = useState<{ ownerId: string; card: ResumeCard }>();
  const friends = friendFeed && friendFeed.ownerId === session?.user.id ? friendFeed.items : [];
  const resume = resumeFeed && resumeFeed.ownerId === session?.user.id ? resumeFeed.card : null;

  useEffect(() => {
    if (shot) {
      setRooms(shotRooms);
      return;
    }
    void api.listRooms(query).then((payload) => setRooms(payload.rooms)).catch(() => setRooms([]));
  }, [query, path, roomId, shot]);

  useEffect(() => {
    if (!session) return;
    let current = true;
    void api.friends(session.accessToken).then((list) => {
      if (!current) return;
      setFriendFeed({ ownerId: session.user.id, items: list.friends });
      setBlocked(list.blocked ?? []);
    }).catch(() => undefined);
    void api.resume(session.accessToken).then((card) => {
      if (current) setResumeFeed({ ownerId: session.user.id, card: card.resume });
    }).catch(() => { if (current) setResumeFeed(undefined); });
    void fetch(`${apiUrl}/me/studio`, { headers: { authorization: `Bearer ${session.accessToken}` } })
      .then((response) => response.json())
      .then((payload: { level?: number; heatmap?: Array<{ day: string; score: number }> }) => {
        if (typeof payload.level === "number") setLevel(payload.level);
        if (Array.isArray(payload.heatmap)) setHeat(payload.heatmap);
      })
      .catch(() => undefined);
    void fetch(`${apiUrl}/me`, { headers: { authorization: `Bearer ${session.accessToken}` } })
      .then((response) => response.json())
      .then((payload: { uiStyle?: unknown; uiMode?: unknown }) => {
        if (isStyleId(payload.uiStyle)) setStyle(payload.uiStyle);
        if (isThemeMode(payload.uiMode)) setMode(payload.uiMode);
      })
      .catch(() => undefined);
    return () => { current = false; };
  }, [session, setMode, setStyle]);

  useEffect(() => {
    if (!session || !path.startsWith("/settings")) return;
    let stopped = false;
    void fetch(`${apiUrl}/users/${session.user.id}/blacklist`, { headers: { authorization: `Bearer ${session.accessToken}` } })
      .then((response) => response.json())
      .then((payload: { entries?: Array<{ id: string; userId: string; displayName: string; reason: string | null }> }) => {
        if (!stopped) setGlobalBans(payload.entries ?? []);
      })
      .catch(() => {
        if (!stopped) setGlobalBans([]);
      });
    return () => {
      stopped = true;
    };
  }, [path, session]);

  const unblock = (id: string) => {
    setBlocked((rows) => rows.filter((row) => row.id !== id));
    if (!session) return;
    void fetch(`${apiUrl}/friends/${id}`, { method: "DELETE", headers: { authorization: `Bearer ${session.accessToken}` } }).catch(() => undefined);
  };
  const removeGlobalBan = (bannedUserId: string) => {
    if (!session) return;
    const previous = globalBans;
    setGlobalBans((rows) => rows.filter((row) => row.userId !== bannedUserId));
    void fetch(`${apiUrl}/users/${session.user.id}/blacklist/remove`, { method: "POST", headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ bannedUserId }) })
      .then((response) => { if (!response.ok) setGlobalBans(previous); })
      .catch(() => setGlobalBans(previous));
  };
  const removeFriend = (friendshipId: string) => setFriendFeed((current) => current && { ...current, items: current.items.filter((row) => row.id !== friendshipId) });
  return { rooms, friends, blocked, globalBans, heat, level, resume, removeFriend, unblock, removeGlobalBan };
}
