import { formatRoomCode } from "@lume/contracts";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Avatar, Button, Input } from "../../ds/index.js";
import { cx } from "../../ds/cx.js";
import { RoomCodeInput } from "../../design/RoomCodeInput.js";
import { shotPeople } from "../../design/shot-fixtures.js";
import { useI18n } from "../../i18n/context.js";
import type { ClientSession } from "../../session.js";
import { SeasonHeatmap } from "../profile/SeasonHeatmap.js";
import { Pane } from "./Pane.js";
import styles from "./GruvboxHome.module.css";

interface RoomRow { id: string; title: string; code: string; memberCount?: number }
interface FriendRow { id: string; userId: string; displayName: string; roomId?: string | null; roomTitle?: string | null }

export interface GruvboxHomeProps {
  session: ClientSession | null;
  rooms: RoomRow[];
  heat: Array<{ day: string; score: number }>;
  resume: string | null;
  onResume?: () => void;
  isShot: boolean;
  name: string;
  onName: (value: string) => void;
  onSignIn: (event: FormEvent) => void;
  onGo: (path: string) => void;
  code: string;
  codeInvalid: boolean;
  onCode: (value: string) => void;
  onJoin: (event: FormEvent) => void;
  onOpen: (room: RoomRow) => void;
  catalog: ReactNode;
  friends: FriendRow[];
  onJoinFriend: (roomId: string) => void;
  onInviteFriend: (friendId: string) => void;
}

const typing = (target: EventTarget | null) => target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);

/** Home as a tmux session: rooms on the left, the five small panes on the right, a status line below. */
export function GruvboxHome(props: GruvboxHomeProps) {
  const { session, rooms, heat, resume, onResume, isShot, onGo, onOpen, friends } = props;
  const { t, locale } = useI18n();
  const rows = rooms.slice(0, 12);
  const [cursor, setCursor] = useState(0);
  const people = isShot ? shotPeople.map((person) => ({ id: person.id, userId: person.id, displayName: person.name, roomId: null, roomTitle: t("gruvbox.inRoom") })) : friends;
  
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (typing(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "j") setCursor((value) => Math.min(rows.length - 1, value + 1));
      else if (event.key === "k") setCursor((value) => Math.max(0, value - 1));
      else if (event.key === "Enter" && rows[cursor] && !(event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement)) onOpen(rows[cursor]);
      else if (event.key === "n") onGo(session ? "/create" : "/auth");
      else if (event.key === "/") { event.preventDefault(); onGo("/search"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, cursor, onOpen, onGo, session]);

  return (
    <div className={styles.root} data-testid="home-screen">
      <div className={styles.grid}>
        <div className={styles.left}>
          <Pane index={1} title={t("sessions.title")} meta={rows.length} grow>
            {rows.length === 0 ? <p className={styles.note}>{t("home.noRooms")}</p> : (
              <ul className={styles.list}>
                {rows.map((item, index) => (
                  <li key={item.id}>
                    <button type="button" className={cx(styles.row, index === cursor && styles.on)} onClick={() => onOpen(item)} onMouseEnter={() => setCursor(index)}>
                      <span className={styles.caret} aria-hidden="true">{index === cursor ? ">" : " "}</span>
                      <b className={styles.rowTitle}>{item.title}</b>
                      <span className={styles.live}>{item.memberCount ?? 0} live</span>
                      <span className={styles.code}>{formatRoomCode(item.code)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Pane>
          <Pane index={2} title={t("gruvbox.catalog")} grow>
            {props.catalog}
          </Pane>
        </div>
        <div className={styles.right}>
          <Pane index={3} title={t("gruvbox.resume")}>
            <h2 className={styles.big}>{resume ?? t("resume.empty")}</h2>
            <p className={styles.note}>{isShot ? t("gruvbox.resumeMeta") : t("gruvbox.resumeHint")}</p>
            {onResume ? <Button variant="primary" size="sm" onClick={onResume}>{t("gruvbox.enterRoom")}</Button> : null}
          </Pane>
          <Pane index={4} title={t("gruvbox.new")}>
            <p className={styles.note}>{t("gruvbox.newBody")}</p>
            <Button variant="primary" size="sm" data-testid="home-create-open" onClick={() => onGo(session ? "/create" : "/auth")}>{t("gruvbox.newAction")}</Button>
          </Pane>
          <Pane index={5} title={t("gruvbox.join")}>
            <form className={styles.form} onSubmit={props.onJoin}>
              <RoomCodeInput value={props.code} onChange={props.onCode} invalid={props.codeInvalid} hideLabel />
              <Button type="submit" size="sm" variant="primary" data-testid="lobby-join">{t("auth.login")}</Button>
            </form>
          </Pane>
          <Pane index={6} title={t("gruvbox.season")}>
            <SeasonHeatmap bare title={t("gruvbox.season")} days={heat.slice(-182)} locale={locale} lessLabel={t("profile.less")} moreLabel={t("profile.more")} emptyText={t("gruvbox.seasonEmpty")}
              scoreText={(score) => (score > 0 ? t("profile.seasonNone") : t("profile.seasonNone"))} summaryText={(count) => t("profile.activeDays", { count })} />
          </Pane>
          {!session ? (
            <Pane index={7} title={t("gruvbox.login")}>
              <form className={styles.form} onSubmit={props.onSignIn}>
                <Input data-testid="lobby-name" aria-label={t("gruvbox.nameLabel")} value={props.name} onChange={(event) => props.onName(event.target.value)} placeholder={t("name.placeholder")} />
                <Button type="submit" size="sm" variant="primary" data-testid="lobby-sign-in">{t("auth.login")}</Button>
              </form>
            </Pane>
          ) : (
            <Pane index={7} title={t("gruvbox.friends")} meta={people.length}>
              {people.length === 0 ? <p className={styles.note}>{t("profile.noFriends")}</p> : (
                <ul className={styles.list}>
                  {people.slice(0, 6).map((person) => (
                    <li key={person.id} className={styles.friend}>
                      <Avatar name={person.displayName} size="sm" />
                      <b className={styles.rowTitle}>{person.displayName}</b>
                      <span className={styles.live}>{person.roomTitle ?? t("home.notInRoom")}</span>
                      {person.roomId
                        ? <Button size="sm" onClick={() => { if (person.roomId) props.onJoinFriend(person.roomId); }}>{t("gruvbox.enter")}</Button>
                        : <Button size="sm" onClick={() => props.onInviteFriend(person.userId)}>{t("room.invite")}</Button>}
                    </li>
                  ))}
                </ul>
              )}
            </Pane>
          )}
        </div>
      </div>
    </div>
  );
}
