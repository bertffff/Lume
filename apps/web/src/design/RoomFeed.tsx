import { Film, Music2, UsersRound, Video } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Badge, Button, Chip, ChipGroup, CodeBadge, Icon, Poster, Skeleton, State } from "../ds/index.js";
import { cx } from "../ds/cx.js";
import { useI18n } from "../i18n/context.js";
import type { RoomFeedFilter, RoomFeedLoader, RoomFeedRoom, RoomFeedStyle } from "./useRoomFeed.js";
import { useRoomFeed } from "./useRoomFeed.js";
import styles from "./RoomFeed.module.css";

export type { RoomFeedFilter, RoomFeedLoader, RoomFeedPage, RoomFeedRoom, RoomFeedStyle } from "./useRoomFeed.js";

export interface RoomFeedProps {
  id?: string;
  initialFilter?: RoomFeedFilter;
  style?: RoomFeedStyle;
  signedIn: boolean;
  loadPage: RoomFeedLoader;
  onOpenRoom: (room: RoomFeedRoom) => void;
  onSignIn: () => void;
  onCreate?: () => void;
}

const labels = { film: "feed.film", music: "feed.music", vlog: "feed.vlog", other: "feed.other" } as const;

const filters = [
  { id: "all", label: "feed.all", icon: undefined },
  { id: "friends", label: "feed.friends", icon: UsersRound },
  { id: "film", label: labels.film, icon: Film },
  { id: "music", label: labels.music, icon: Music2 },
  { id: "vlog", label: labels.vlog, icon: Video },
] as const;

function RoomCard({ room, onOpenRoom }: { room: RoomFeedRoom; onOpenRoom: RoomFeedProps["onOpenRoom"] }) {
  const { t } = useI18n();
  const nowPlaying = room.mediaPreview?.title;
  return (
    <li className={cx(styles.card, room.isFull && styles.full)} data-testid="room-feed-card" data-room-id={room.id}>
      <Poster src={room.mediaPreview?.thumbnailUrl} category={room.category} className={styles.poster}>
        {room.memberCount !== undefined ? (
          <Badge tone="media"><Icon icon={UsersRound} size="sm" />{t("feed.memberCount", { count: room.memberCount })}</Badge>
        ) : null}
      </Poster>
      <div className={styles.body}>
        <h3 className={styles.title}>{room.title}</h3>
        {nowPlaying ? <p className={styles.playing}>{nowPlaying}</p> : null}
        <div className={styles.meta}>
          <span>{t(labels[room.category])}</span>
          <CodeBadge code={room.code} className={styles.code} />
          {room.isFull ? <Badge tone="warn">{t("feed.full")}</Badge> : null}
        </div>
      </div>
      {room.isFull ? null : (
        <button className={styles.join} type="button" aria-label={t("feed.openRoom", { title: room.title })} onClick={() => onOpenRoom(room)}>
          {t("auth.login")}
        </button>
      )}
    </li>
  );
}

function FeedResults({ filter, loadPage, onOpenRoom, onCreate }: Pick<RoomFeedProps, "loadPage" | "onOpenRoom" | "onCreate"> & { filter: RoomFeedFilter }) {
  const { t } = useI18n();
  const { state, requestPage } = useRoomFeed(filter, loadPage);
  const sentinel = useRef<HTMLDivElement>(null);
  const listId = useId();
  const { rooms, nextCursor, phase } = state;
  const failed = phase === "error";
  const retrying = phase === "retrying";
  const loading = phase === "loading" || retrying;
  const empty = !failed && !loading && rooms.length === 0 && nextCursor === null;

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

  return (
    <div className={styles.results}>
      <ul id={listId} className={styles.grid} role="list" aria-label={t("feed.rooms")} aria-busy={loading} hidden={rooms.length === 0}>
        {rooms.map((room) => <RoomCard key={room.id} room={room} onOpenRoom={onOpenRoom} />)}
      </ul>
      {loading && rooms.length === 0 ? (
        <div className={styles.grid} aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className={styles.skeleton}><Skeleton shape="poster" /><Skeleton shape="title" /><Skeleton /></div>
          ))}
        </div>
      ) : null}
      {loading ? <p role="status" className={styles.note}>{t(nextCursor === null ? "feed.loading" : "feed.loadingMore")}</p> : null}
      {empty ? (
        <State
          kind="empty"
          title={t(filter === "all" ? "feed.empty" : "feed.emptyFilter")}
          body={t(filter === "all" ? "feed.emptyBody" : "feed.emptyFilterBody")}
          action={onCreate ? <Button size="sm" onClick={onCreate}>{t("feed.createRoom")}</Button> : undefined}
        />
      ) : null}
      {failed ? <State kind="error" compact={rooms.length > 0} title={t("feed.failed")} body={t("feed.failedBody")} /> : null}
      {nextCursor !== null ? <div ref={sentinel} aria-hidden="true" data-testid="room-feed-sentinel" className={styles.sentinel} /> : null}
      {failed || retrying || nextCursor !== null ? (
        <div className={styles.more}>
          <Button aria-controls={listId} aria-disabled={loading} onClick={() => { if (!loading) void requestPage("manual"); }}>
            {t(failed || retrying ? "feed.retry" : "feed.loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function RoomFeed({ id, initialFilter = "all", style, signedIn, loadPage, onOpenRoom, onSignIn, onCreate }: RoomFeedProps) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<RoomFeedFilter>(initialFilter);
  const headingId = useId();
  return (
    <section id={id} className={styles.root} data-testid="room-feed" data-feed-style={style} aria-labelledby={headingId}>
      <div className={styles.head}>
        <h2 id={headingId} className={styles.heading}>{t("feed.title")}</h2>
        <ChipGroup label={t("feed.filters")}>
          {filters.map(({ id: value, label, icon }) => (
            <Chip key={value} icon={icon} selected={filter === value} onClick={() => setFilter(value)}>{t(label)}</Chip>
          ))}
        </ChipGroup>
      </div>
      {filter === "friends" && !signedIn ? (
        <State kind="forbidden" title={t("feed.guest")} action={<Button size="sm" onClick={onSignIn}>{t("auth.login")}</Button>} />
      ) : (
        <FeedResults key={`${filter}:${signedIn}`} filter={filter} loadPage={loadPage} onOpenRoom={onOpenRoom} onCreate={onCreate} />
      )}
    </section>
  );
}
