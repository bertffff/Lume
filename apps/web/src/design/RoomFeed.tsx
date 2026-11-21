import { Clapperboard, DoorOpen, Film, Music2, UsersRound, Video } from "lucide-react";
import { formatRoomCode, parseRoomCode } from "@lume/contracts";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useI18n } from "../i18n/context.js";
import "./room-feed.css";

export type RoomFeedFilter = "all" | "friends" | "film" | "music" | "vlog";
export type RoomFeedStyle = "cinema" | "gruvbox" | "telerave";

export interface RoomFeedRoom {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly category: "film" | "music" | "vlog" | "other";
  readonly memberCount?: number;
  readonly isFull: boolean;
  readonly mediaPreview?: { thumbnailUrl: string | null } | null;
}

export interface RoomFeedPage {
  readonly rooms: readonly RoomFeedRoom[];
  readonly nextCursor: string | null;
}

export type RoomFeedLoader = (filter: RoomFeedFilter, cursor: string | null, signal: AbortSignal) => Promise<RoomFeedPage>;

export interface RoomFeedProps {
  id?: string;
  initialFilter?: RoomFeedFilter;
  style?: RoomFeedStyle;
  signedIn: boolean;
  loadPage: RoomFeedLoader;
  onOpenRoom: (room: RoomFeedRoom) => void;
  onSignIn: () => void;
}

const categories = {
  film: { label: "feed.film", Icon: Film },
  music: { label: "feed.music", Icon: Music2 },
  vlog: { label: "feed.vlog", Icon: Video },
  other: { label: "feed.other", Icon: DoorOpen },
} as const;

const filters = [
  { id: "all", label: "feed.all" },
  { id: "friends", label: "feed.friends" },
  { id: "film", label: categories.film.label },
  { id: "music", label: categories.music.label },
  { id: "vlog", label: categories.vlog.label },
] as const;

type FeedState = RoomFeedPage & { phase: "loading" | "retrying" | "ready" | "error" };
const initialState: FeedState = { phase: "loading", rooms: [], nextCursor: null };

function appendUnique(previous: readonly RoomFeedRoom[], incoming: readonly RoomFeedRoom[]) {
  const seen = new Set(previous.map(({ id }) => id));
  return [...previous, ...incoming.filter(({ id }) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  })];
}

function useRoomFeed(filter: RoomFeedFilter, loadPage: RoomFeedLoader) {
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

function RoomFeedCard({ room, onOpenRoom }: { room: RoomFeedRoom; onOpenRoom: RoomFeedProps["onOpenRoom"] }) {
  const { t } = useI18n();
  const { label, Icon } = categories[room.category];
  const code = parseRoomCode(room.code);
  const artwork = room.mediaPreview?.thumbnailUrl;
  const showArtwork = Boolean(artwork && /^https?:\/\//i.test(artwork));
  return (
    <li className="room-feed__card" data-room-id={room.id}>
      <div className="room-feed__emblem" aria-hidden="true">{showArtwork ? <img src={artwork ?? undefined} alt="" loading="lazy" /> : <Icon size={22} strokeWidth={1.6} />}</div>
      <div className="room-feed__details">
        <h3>{room.title}</h3>
        <div className="room-feed__meta">
          <span>{t(label)}</span>
          {code ? <span className="mono">{formatRoomCode(code)}</span> : null}
          {room.memberCount !== undefined && <span><UsersRound size={14} aria-hidden="true" /> {t("feed.memberCount", { count: room.memberCount })}</span>}
        </div>
      </div>
      {room.isFull ? <span className="room-feed__capacity">{t("feed.full")}</span> : (
        <button className="room-feed__join" type="button" aria-label={t("feed.openRoom", { title: room.title })} onClick={() => onOpenRoom(room)}>
          {t("auth.login")}
        </button>
      )}
    </li>
  );
}

function RoomFeedResults({ filter, loadPage, onOpenRoom }: Pick<RoomFeedProps, "loadPage" | "onOpenRoom"> & { filter: RoomFeedFilter }) {
  const { t } = useI18n();
  const { state, requestPage } = useRoomFeed(filter, loadPage);
  const sentinel = useRef<HTMLDivElement>(null);
  const listId = useId();
  const errorId = useId();
  const { rooms, nextCursor, phase } = state;
  const failed = phase === "error";
  const retrying = phase === "retrying";
  const loading = phase === "loading" || retrying;

  useEffect(() => {
    if (phase !== "ready" || nextCursor === null || !sentinel.current || typeof IntersectionObserver !== "function") return;
    let listening = true;
    const observer = new IntersectionObserver((entries) => {
      if (listening && entries.some((entry) => entry.isIntersecting)) void requestPage("observer");
    }, { rootMargin: "0px 0px 200px 0px" });
    observer.observe(sentinel.current);
    return () => {
      listening = false;
      observer.disconnect();
    };
  }, [phase, nextCursor, requestPage]);

  let status = "";
  if (loading) status = t(nextCursor === null ? "feed.loading" : "feed.loadingMore");
  else if (!failed && rooms.length === 0 && nextCursor === null) {
    status = t(filter === "all" ? "feed.empty" : "feed.emptyFilter");
  }

  return (
    <>
      <ul id={listId} className="room-feed__list" role="list" aria-label={t("feed.rooms")} aria-busy={loading} hidden={rooms.length === 0}>
        {rooms.map((room) => <RoomFeedCard key={room.id} room={room} onOpenRoom={onOpenRoom} />)}
      </ul>
      <p role="status" className="room-feed__notice">{status}</p>
      {failed && <p id={errorId} role="alert" className="room-feed__notice room-feed__error">{t("feed.failed")}</p>}
      {nextCursor !== null && <div ref={sentinel} aria-hidden="true" data-testid="room-feed-sentinel" className="room-feed__sentinel" />}
      {(failed || retrying || nextCursor !== null) && (
        <button type="button" aria-controls={listId} aria-describedby={failed ? errorId : undefined} aria-disabled={loading}
          onClick={() => { if (!loading) void requestPage("manual"); }}>
          {t(failed || retrying ? "feed.retry" : "feed.loadMore")}
        </button>
      )}
    </>
  );
}

export function RoomFeed({ id, initialFilter = "all", style, signedIn, loadPage, onOpenRoom, onSignIn }: RoomFeedProps) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<RoomFeedFilter>(initialFilter);
  const headingId = useId();
  return (
    <section id={id} className="room-feed" data-feed-style={style} aria-labelledby={headingId}>
      <h2 id={headingId} className="room-feed__heading"><Clapperboard size={22} aria-hidden="true" /> {t("feed.title")}</h2>
      <div className="room-feed__filters" role="group" aria-label={t("feed.filters")}>
        {filters.map(({ id: value, label }) => (
          <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{t(label)}</button>
        ))}
      </div>
      {filter === "friends" && !signedIn ? (
        <div className="room-feed__guest">
          <p>{t("feed.guest")}</p>
          <button type="button" onClick={onSignIn}>{t("auth.login")}</button>
        </div>
      ) : (
        <RoomFeedResults key={`${filter}:${signedIn}`} filter={filter} loadPage={loadPage} onOpenRoom={onOpenRoom} />
      )}
    </section>
  );
}
