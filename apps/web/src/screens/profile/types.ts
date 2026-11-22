export interface LeaderboardRow { userId: string; displayName: string; value: number }
export interface Achievement { key: string; title: string; icon: string; earned: boolean }
export interface HistoryItem { url: string; title: string | null; watchCount: number; lastWatchedAt: string }
export interface Favourite { url: string; title: string | null; watchCount: number }
export interface Friend { id: string; userId: string; displayName: string; roomId?: string | null; roomTitle?: string | null }
export interface Engagement { watchSeconds: number; voiceSeconds: number; messages: number; reactions: number; totalSeconds: number; activity: number }
export interface PublicProfile {
  id: string;
  displayName: string;
  username: string | null;
  bio: string | null;
  level: number;
  watchHistory: Array<{ url: string; title: string | null; watchCount: number }> | null;
  friends: Array<{ id: string; displayName: string }> | null;
}
export interface HostStats { roomsHosted: number; uniqueViewers: number; videosPlayed: number; topVideos: Array<{ title: string; count: number }> }
