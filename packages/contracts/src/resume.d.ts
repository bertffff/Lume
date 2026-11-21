/**
 * Resume response contract (declaration only — no runtime export, no dist
 * rebuild required). Field names and nullability match the API responses.
 */
export interface ResumeCard {
  title: string;
  /** Null when no authoritative server playback anchor was available. */
  positionMs: number | null;
  /** Null when trusted media metadata has no known duration. */
  durationMs: number | null;
  /** Null when trusted media metadata has no valid poster URL. */
  posterUrl: string | null;
  queueCount: number;
  historyCount: number;
}

export interface ResumeSnapshotInput {
  title?: string;
  description?: string;
  isPublic?: boolean;
  maxMembers?: number;
  videoUrl?: string | null;
  /** Older snapshots used `0` for "unknown"; newer ones may omit the field. */
  positionMs?: number | null;
  posterUrl?: string | null;
  durationMs?: number | null;
  queue?: Array<{ url?: string; title?: string }> | null;
  historyCount?: number | null;
  categorySelection?: unknown;
  inferredCategory?: unknown;
}

export interface ResumePlayback {
  status: "paused";
  /** Known, clamped position for the restored paused playback state. */
  positionMs: number;
}
