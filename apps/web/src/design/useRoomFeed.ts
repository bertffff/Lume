import { useCallback, useEffect, useRef, useState } from "react";

export type RoomFeedFilter = "all" | "friends" | "film" | "music" | "vlog";
export type RoomFeedStyle = "cinema" | "gruvbox" | "telerave";

export interface RoomFeedRoom {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly category: "film" | "music" | "vlog" | "other";
  readonly memberCount?: number;
  readonly isFull: boolean;
  readonly mediaPreview?: { thumbnailUrl: string | null; title?: string | null } | null;
}

export interface RoomFeedPage {
  readonly rooms: readonly RoomFeedRoom[];
  readonly nextCursor: string | null;
}

export type RoomFeedLoader = (filter: RoomFeedFilter, cursor: string | null, signal: AbortSignal) => Promise<RoomFeedPage>;

export type FeedState = RoomFeedPage & { phase: "loading" | "retrying" | "ready" | "error" };
const initialState: FeedState = { phase: "loading", rooms: [], nextCursor: null };

function appendUnique(previous: readonly RoomFeedRoom[], incoming: readonly RoomFeedRoom[]) {
  const seen = new Set(previous.map(({ id }) => id));
  return [...previous, ...incoming.filter(({ id }) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  })];
}

export function useRoomFeed(filter: RoomFeedFilter, loadPage: RoomFeedLoader) {
  const [state, setState] = useState(initialState);
  // Request gates must change synchronously: an observer and a click can arrive before React paints.
  const latest = useRef(initialState);
  const loader = useRef(loadPage);
  const activeRequest = useRef<AbortController | null>(null);
  const completedCursors = useRef(new Set<string>());

  useEffect(() => { loader.current = loadPage; }, [loadPage]);

  const requestPage = useCallback(async (source: "initial" | "manual" | "observer") => {
    const previous = latest.current;
    if (activeRequest.current || (source === "observer" && previous.phase !== "ready")) return;
    if (source !== "initial" && previous.phase !== "error" && previous.nextCursor === null) return;

    const controller = new AbortController();
    const cursor = previous.nextCursor;
    activeRequest.current = controller;
    const publish = (next: FeedState) => {
      latest.current = next;
      setState(next);
    };
    publish({ ...previous, phase: previous.phase === "error" ? "retrying" : "loading" });
    try {
      const page = await loader.current(filter, cursor, controller.signal);
      if (controller.signal.aborted || activeRequest.current !== controller) return;
      if (cursor !== null) completedCursors.current.add(cursor);
      const nextCursor = page.nextCursor !== null && completedCursors.current.has(page.nextCursor)
        ? null : page.nextCursor;
      publish({ phase: "ready", rooms: appendUnique(previous.rooms, page.rooms), nextCursor });
    } catch {
      if (!controller.signal.aborted && activeRequest.current === controller) publish({ ...previous, phase: "error" });
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }, [filter]);

  useEffect(() => {
    void requestPage("initial");
    return () => {
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [requestPage]);

  return { state, requestPage };
}


