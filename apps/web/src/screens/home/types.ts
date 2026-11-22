import type { FormEvent, ReactNode } from "react";

export interface HomeFriend {
  id: string;
  userId: string;
  displayName: string;
  roomId?: string | null;
  roomTitle?: string | null;
}

export interface HomeResume {
  title: string;
  positionMs: number | null;
  durationMs: number | null;
  posterUrl: string | null;
}

export interface HomeReminder {
  id: string;
  title: string;
  body: string;
}

export interface HomeStats {
  usersOnline: number;
  activeRooms: number;
  totalVideos: number;
  totalWatchHours: number;
}

export interface HomeProps {
  displayName: string | null;
  friends: readonly HomeFriend[];
  resume: HomeResume | null;
  resuming: boolean;
  onResume: () => void;
  catalog: ReactNode;
  level: number;
  heat: ReadonlyArray<{ day: string; score: number }>;
  reminders: readonly HomeReminder[];
  stats: HomeStats;
  statsReady: boolean;
  guest: { name: string; onName: (value: string) => void; onSignIn: (event: FormEvent) => void; onTelegram: () => void };
  join: { code: string; invalid: boolean; onCode: (value: string) => void; onSubmit: (event: FormEvent) => void };
  people: ReadonlyArray<{ id: string; displayName: string }>;
  onSearchPeople: (query: string) => void;
  onCreate: () => void;
  onGo: (path: string) => void;
  onJoinFriend: (roomId: string) => void;
  onInviteFriend: (userId: string) => void;
  onRemoveFriend: (friendshipId: string) => void;
}
