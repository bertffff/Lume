import { useCallback, useEffect, useState } from "react";
import type { Achievement, Engagement, HostStats, Favourite, Friend, HistoryItem, LeaderboardRow, PublicProfile } from "./types.js";

const emptyBoards = { messages: [] as LeaderboardRow[], reactions: [] as LeaderboardRow[], voice: [] as LeaderboardRow[] };

async function getJson<T>(apiUrl: string, token: string, path: string): Promise<T | null> {
  try {
    const response = await fetch(`${apiUrl}${path}`, { headers: { authorization: `Bearer ${token}` } });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Everything the profile shows, loaded once per visit and reloaded after a friend request is answered. */
export function useProfileData(token: string | undefined, apiUrl: string | undefined, userId: string | undefined) {
  const [version, setVersion] = useState(0);
  const [data, setData] = useState({
    favourites: [] as Favourite[], history: [] as HistoryItem[], achievements: [] as Achievement[],
    level: 1, totalXp: 0, nextLevelXp: 0, totalAchievements: 0, engagement: null as Engagement | null,
    platforms: [] as Array<{ source: string; count: number }>, topFriends: [] as Array<{ partnerId: string; seconds: number }>,
    friends: [] as Friend[], incoming: [] as Friend[], bio: "", heat: [] as Array<{ day: string; score: number }>, boards: emptyBoards, hostStats: null as HostStats | null,
  });

  useEffect(() => {
    if (!token || !apiUrl) return;
    let current = true;
    void Promise.all([
      getJson<Partial<typeof emptyBoards>>(apiUrl, token, "/stats/leaderboard"),
      getJson<{ platforms?: Array<{ source: string; count: number }>; topFriends?: Array<{ partnerId: string; seconds: number }>; heatmap?: Array<{ day: string; score: number }> }>(apiUrl, token, "/me/studio"),
      getJson<{ friends?: Friend[]; incoming?: Friend[] }>(apiUrl, token, "/friends"),
      getJson<{ bio?: string | null }>(apiUrl, token, "/me"),
      getJson<{ items?: Favourite[] }>(apiUrl, token, "/me/favourites"),
      getJson<{ all?: Achievement[]; level?: number; totalXp?: number; nextLevelXp?: number; total?: number }>(apiUrl, token, "/me/achievements"),
      userId ? getJson<{ items?: HistoryItem[] }>(apiUrl, token, `/users/${userId}/watch-history`) : Promise.resolve(null),
      userId ? getJson<Engagement>(apiUrl, token, `/users/${userId}/engagement`) : Promise.resolve(null),
      getJson<HostStats>(apiUrl, token, "/me/host-stats"),
    ]).then(([boards, studio, friends, me, favourites, awards, history, engagement, hostStats]) => {
      if (!current) return;
      setData({
        boards: { messages: boards?.messages ?? [], reactions: boards?.reactions ?? [], voice: boards?.voice ?? [] },
        platforms: studio?.platforms ?? [], topFriends: studio?.topFriends ?? [], heat: Array.isArray(studio?.heatmap) ? studio.heatmap : [],
        friends: friends?.friends ?? [], incoming: friends?.incoming ?? [], bio: me?.bio ?? "", favourites: favourites?.items ?? [],
        achievements: Array.isArray(awards?.all) ? awards.all : [], level: typeof awards?.level === "number" ? awards.level : 1,
        totalXp: awards?.totalXp ?? 0, nextLevelXp: awards?.nextLevelXp ?? 0, totalAchievements: awards?.total ?? 0,
        history: history?.items ?? [], engagement, hostStats: hostStats && hostStats.roomsHosted > 0 ? hostStats : null,
      });
    });
    return () => { current = false; };
  }, [token, apiUrl, userId, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { ...data, reload };
}

export type ProfileData = ReturnType<typeof useProfileData>;

export function usePeople(token: string | undefined, apiUrl: string | undefined) {
  const [found, setFound] = useState<Array<{ id: string; displayName: string }>>([]);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);

  async function search(query: string) {
    const text = query.trim();
    if (!token || !apiUrl || !text) { setFound([]); return; }
    const payload = await getJson<{ users?: Array<{ id: string; displayName: string }> }>(apiUrl, token, `/users/search?q=${encodeURIComponent(text)}`);
    setFound(payload?.users ?? []);
  }
  async function openProfile(personId: string) {
    if (!token || !apiUrl) return;
    setPublicProfile(await getJson<PublicProfile>(apiUrl, token, `/users/profile/${personId}`));
  }
  function post(path: string, body?: unknown) {
    if (!token || !apiUrl) return Promise.resolve();
    return fetch(`${apiUrl}${path}`, { method: "POST", headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }).then(() => undefined);
  }
  return {
    found, publicProfile, closeProfile: () => setPublicProfile(null), search, openProfile,
    addFriend: (personId: string) => post("/friends/request", { userId: personId }),
    answerFriend: (id: string, action: "accept" | "decline") => post(`/friends/${id}/${action}`),
    inviteFriend: (roomId: string, friendId: string) => post(`/rooms/${roomId}/invite`, { userId: friendId }),
  };
}
