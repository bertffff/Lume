import type { View } from "./DesignApp.js";
import { type FormEvent, type ReactNode } from "react";
import { formatRoomCode } from "@lume/contracts";
import { useI18n } from "../i18n/context.js";
import type { ClientSession } from "../session.js";
import { copy } from "./copy.js";
import { RoomCodeInput } from "./RoomCodeInput.js";
import { initials, personHue } from "./theme.js";
import { posterClasses, shotPeople } from "./shot-fixtures.js";

export function GruvboxHome({
  session,
  rooms,
  heat,
  resume,
  onResume,
  isShot,
  name,
  onName,
  onSignIn,
  onGo,
  code,
  codeInvalid,
  onCode,
  onJoin,
  onOpen,
  catalog,
  friends,
  onJoinFriend,
  onInviteFriend,
}: {
  session: ClientSession | null;
  rooms: Array<{ id: string; title: string; code: string; memberCount?: number }>;
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
  onOpen: (room: { id: string; title: string; code: string; memberCount?: number }) => void;
  catalog: ReactNode;
  friends: Array<{ id: string; userId: string; displayName: string; roomId?: string | null; roomTitle?: string | null }>;
  onJoinFriend: (roomId: string) => void;
  onInviteFriend: (friendId: string) => void;
}) {
  const { t } = useI18n();
  const rows = rooms.slice(0, 7);
  return (
    <div className="g-home wrap">
      <section className="pane">
        <div className="pt">{t("sessions.title")} <span className="dim">{rows.length}</span></div>
        {rows.length === 0 ? <p className="lead">{t("home.noRooms")}</p> : rows.map((item, index) => (
          <button key={item.id} type="button" className={index === 0 ? "srow on" : "srow"} onClick={() => onOpen(item)}>
            <span className={`g-th ${posterClasses[index % posterClasses.length]}`} aria-hidden="true" />
            <b>{item.title}</b>
            <span className="mono">{item.memberCount ?? 0} live</span>
            <span className="mono dim">{formatRoomCode(item.code)}</span>
          </button>
        ))}
      </section>
      <section className="pane">
        <div className="pt">{t("gruvbox.resume")}</div>
        <h2>{resume ?? t("resume.empty")}</h2>
        <p className="dim">{isShot ? t("gruvbox.resumeMeta") : t("gruvbox.resumeHint")}</p>
        {isShot ? <p className="dim">{t("gruvbox.resumeMetaTwo")}</p> : null}
        {onResume ? <button type="button" className="go" onClick={onResume}>{t("gruvbox.enterRoom")}</button> : null}
      </section>
      <section className="pane">
        <div className="pt">{t("gruvbox.new")}</div>
        <h3>{t("gruvbox.newTitle")}</h3>
        <p>{t("gruvbox.newBody")}</p>
        <button type="button" className="go" data-testid="home-create-open" onClick={() => onGo(session ? "/create" : "/auth")}>{t("gruvbox.newAction")}</button>
      </section>
      <section className="pane">
        <div className="pt">{t("gruvbox.join")}</div>
        <h3>{t("gruvbox.joinTitle")}</h3>
        <form onSubmit={onJoin}>
          <RoomCodeInput value={code} onChange={onCode} invalid={codeInvalid} />
          <button type="submit" className="go" data-testid="lobby-join">{t("auth.login")}</button>
        </form>
      </section>
      <section className="pane">
        <div className="pt">{t("gruvbox.season")}</div>
        {isShot ? <p className="dim">{t("gruvbox.seasonMeta")}</p> : null}
        {heat.length > 0 ? <div className="heat-grid">{heat.slice(-49).map((cell) => <i key={cell.day} className={cell.score > 3 ? "a3" : cell.score > 0 ? "a1" : ""} />)}</div> : <p className="lead">{t("gruvbox.seasonEmpty")}</p>}
      </section>
      {!session ? (
        <section className="pane">
          <div className="pt">{t("gruvbox.login")}</div>
          <form onSubmit={onSignIn}>
            <label>{t("gruvbox.nameLabel")}<input data-testid="lobby-name" value={name} onChange={(event) => onName(event.target.value)} placeholder={t("name.placeholder")} /></label>
            <button type="submit" className="go" data-testid="lobby-sign-in">{t("auth.login")}</button>
          </form>
        </section>
      ) : null}
      <section className="pane">
        {catalog}
        <p className="dim">{t("gruvbox.billHint")}</p>
      </section>
      <section className="pane">
        <div className="pt">{t("gruvbox.friends")}</div>
        {isShot ? shotPeople.map((person) => (
          <div key={person.id} className="g-friend">
            <span className={`av p-${personHue(person.id)}`}>{initials(person.name)}</span>
            <b>{person.name}</b>
            <span className="dim">{t("gruvbox.inRoom")}</span>
          </div>
        )) : friends.length ? friends.map((person) => (
          <div key={person.id} className="g-friend">
            <span className={`av p-${personHue(person.userId)}`}>{initials(person.displayName)}</span>
            <b>{person.displayName}</b><span className="dim">{person.roomTitle ?? t("home.notInRoom")}</span>
            {person.roomId ? <button type="button" className="go" onClick={() => { if (person.roomId) onJoinFriend(person.roomId); }}>{t("gruvbox.enter")}</button>
              : <button type="button" className="go" onClick={() => onInviteFriend(person.userId)}>{t("room.invite")}</button>}
          </div>
        )) : <p className="lead">{t("profile.noFriends")}</p>}
      </section>
    </div>
  );
}

export function GruvboxBar({ view, onGo, text, actions }: { view: View; onGo: (path: string) => void; text: ReturnType<typeof copy>; actions: ReactNode }) {
  const tabs: Array<[View | "home", string]> = [["home", "home"], ["search", "search"], ["room", "room"], ["profile", "profile"]];
  return (
    <div className="tabline">
      <span className="brand"><i className="dot" />LUME</span>
      <div className="bufs">
        {tabs.map(([id, label], index) => (
          <button key={id} type="button" className={view === id || (id === "home" && view === "home") ? "buf on" : "buf"} onClick={() => onGo(id === "home" ? "/" : `/${id}`)}>
            <span className="nr">{index + 1}</span>{label}
          </button>
        ))}
      </div>
      <label className="search-lg"><input aria-label={text.search} placeholder={text.search} onFocus={() => onGo("/search")} /></label>
      <div className="nav-actions">{actions}</div>
    </div>
  );
}
