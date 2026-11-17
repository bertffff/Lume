import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api, apiUrl, ClientError } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import { legacyText } from "../i18n/legacy.js";
import { PeopleScreen } from "../screens/PeopleScreen.js";
import type { ClientSession } from "../session.js";
import { copy } from "./copy.js";
import { posterFor } from "./posters.js";
import { applyAppearance, initials, personHue, readStoredMode, readStoredStyle, type ModeId, type StyleId } from "./theme.js";

type View =
  | "home"
  | "room"
  | "search"
  | "create"
  | "join"
  | "settings"
  | "room-settings"
  | "members"
  | "queue"
  | "profile"
  | "premium"
  | "auth"
  | "onboarding"
  | "notifications"
  | "missing"
  | "offline"
  | "unavailable";

const views = new Set<View>([
  "home", "room", "search", "create", "join", "settings", "room-settings", "members", "queue",
  "profile", "premium", "auth", "onboarding", "notifications", "missing", "offline", "unavailable",
]);

function viewFromPath(path: string): View {
  const name = path.replace(/^\//, "").split("/")[0] ?? "";
  if (name === "room-settings") return "room-settings";
  return views.has(name as View) ? (name as View) : "home";
}

export function DesignApp({
  session,
  onSession,
  onSignOut,
  roomId,
  onOpen,
  onLeave,
  room,
}: {
  session: ClientSession | null;
  onSession: (session: ClientSession) => void;
  onSignOut: () => void;
  roomId: string | null;
  onOpen: (roomId: string) => void;
  onLeave: () => void;
  room: ReactNode;
}) {
  const { locale, t } = useI18n();
  const text = copy(locale);
  const [path, setPath] = useState(() => window.location.pathname);
  const [shot] = useState(() => new URLSearchParams(window.location.search).get("shot"));
  const params = new URLSearchParams(window.location.search);
  const [style, setStyle] = useState<StyleId>(params.get("style") === "gruvbox" ? "gruvbox" : readStoredStyle);
  const [mode, setMode] = useState<ModeId>(params.get("mode") === "light" || params.get("mode") === "system" || params.get("mode") === "dark" ? params.get("mode") as ModeId : readStoredMode);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Array<{ id: string; title: string; code: string; memberCount?: number }>>([]);
  const [friends, setFriends] = useState<Array<{ id: string; userId: string; displayName: string; roomId?: string | null; roomTitle?: string | null }>>([]);
  const [blocked, setBlocked] = useState<Array<{ id: string; displayName: string }>>([]);
  const [notes, setNotes] = useState<Array<{ id: string; title: string; body: string }>>([]);
  const [heat, setHeat] = useState<Array<{ day: string; score: number }>>([]);
  const [level, setLevel] = useState(1);
  const [ranks, setRanks] = useState<Array<{ id: string; displayName: string; xp: number; totalMessages: number; totalReactions: number; totalVoiceSeconds: number }>>([]);
  const [resume, setResume] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "friends" | "film" | "music">("all");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Array<{ title: string; url: string }>>([]);
  const [ice, setIce] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [linked, setLinked] = useState<string>("off");
  const [offline, setOffline] = useState(() => !window.navigator.onLine);

  useEffect(() => {
    applyAppearance(style, mode);
  }, [style, mode]);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    const onOff = () => setOffline(true);
    const onOn = () => setOffline(false);
    window.addEventListener("popstate", onPop);
    window.addEventListener("offline", onOff);
    window.addEventListener("online", onOn);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("offline", onOff);
      window.removeEventListener("online", onOn);
    };
  }, []);

  useEffect(() => {
    void api.listRooms().then((payload) => setRooms(payload.rooms)).catch(() => setRooms([]));
    void fetch(`${apiUrl}/ice-servers`).then((response) => response.json()).then((payload: { iceServers?: Array<{ urls?: string }> }) => setIce(payload.iceServers?.[0]?.urls ?? null)).catch(() => setIce(null));
  }, []);

  useEffect(() => {
    if (!session) return;
    void api.friends(session.accessToken).then((list) => {
      setFriends(list.friends);
      setBlocked(list.blocked ?? []);
    }).catch(() => undefined);
    void api.notifications(session.accessToken).then((feed) => setNotes(feed.notifications)).catch(() => undefined);
    void api.resume(session.accessToken).then((card) => setResume(card.resume?.title ?? null)).catch(() => undefined);
    void fetch(`${apiUrl}/me/studio`, { headers: { authorization: `Bearer ${session.accessToken}` } })
      .then((response) => response.json())
      .then((payload: { level?: number; heatmap?: Array<{ day: string; score: number }> }) => {
        if (typeof payload.level === "number") setLevel(payload.level);
        if (Array.isArray(payload.heatmap)) setHeat(payload.heatmap);
      })
      .catch(() => undefined);
    void fetch(`${apiUrl}/stats/leaderboard`, { headers: { authorization: `Bearer ${session.accessToken}` } })
      .then((response) => response.json())
      .then((payload: { users?: typeof ranks }) => setRanks(payload.users ?? []))
      .catch(() => undefined);
    void fetch(`${apiUrl}/me`, { headers: { authorization: `Bearer ${session.accessToken}` } })
      .then((response) => response.json())
      .then((payload: { uiStyle?: StyleId; uiMode?: ModeId; telegramId?: string | null }) => {
        if (payload.uiStyle === "cinema" || payload.uiStyle === "gruvbox") setStyle(payload.uiStyle);
        if (payload.uiMode === "dark" || payload.uiMode === "light" || payload.uiMode === "system") setMode(payload.uiMode);
        setLinked(payload.telegramId ? "on" : "off");
      })
      .catch(() => undefined);
  }, [session]);

  function go(next: string) {
    window.history.pushState({}, "", next);
    setPath(next);
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api.devLogin(name.trim() || "Гость");
      onSession({ accessToken: result.accessToken, ...(result.refreshToken ? { refreshToken: result.refreshToken } : {}), user: result.user });
    } catch (caught) {
      setError(caught instanceof ClientError ? caught.code : "request_failed");
    }
  }

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    const result = await api.createRoom(session.accessToken, title.trim() || "Кинозал", true);
    if (title.includes("модерац")) {
      await fetch(`${apiUrl}/rooms/${result.room.id}/slow-mode`, {
        method: "POST",
        headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ seconds: 10 }),
      });
    }
    onOpen(result.room.id);
    go("/");
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    const result = await api.joinRoom(session.accessToken, code.trim());
    onOpen(result.room.id);
    go("/");
  }

  async function saveAppearance(nextStyle: StyleId, nextMode: ModeId) {
    setStyle(nextStyle);
    setMode(nextMode);
    applyAppearance(nextStyle, nextMode);
    if (!session) return;
    await fetch(`${apiUrl}/me`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ uiStyle: nextStyle, uiMode: nextMode }),
    });
  }

  const view: View = shot && views.has(shot as View) ? (shot as View) : offline ? "offline" : roomId ? "room" : viewFromPath(path);
  const hue = personHue(session?.user.id ?? "me");
  const shownRooms = rooms.filter((roomItem) => {
    const q = query.trim().toLowerCase();
    if (q && !roomItem.title.toLowerCase().includes(q) && !roomItem.code.includes(q)) return false;
    if (filter === "film") return /кино|film/i.test(roomItem.title);
    if (filter === "music") return /звук|music|концерт/i.test(roomItem.title);
    return true;
  });

  return (
    <div className="design-app" data-view={view}>
      {style === "gruvbox" ? <GruvboxBar view={view} onGo={go} text={text} /> : (
        <nav className="nav">
          <button type="button" className="logo" onClick={() => { onLeave(); go("/"); }}><i className="dot" />lume</button>
          <label className="search-lg">
            <input aria-label={text.search} placeholder={text.search} value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => go("/search")} />
            <span className="kbd">/</span>
          </label>
          <div style={{ flex: 1 }} />
          <button type="button" className="icon-btn" onClick={() => go("/notifications")} aria-label={text.notifications}>•</button>
          <button type="button" className="theme-btn" onClick={() => void saveAppearance(style, mode === "dark" ? "light" : "dark")} aria-label={text.mode}>{mode === "light" ? "☾" : "☀"}</button>
          <button type="button" className="me" onClick={() => go("/profile")}>
            <span className={`av p-${hue}`}>{initials(session?.user.displayName ?? "?")}</span>
            <span className={`nm p-${hue}`}>{session?.user.displayName ?? text.signIn}</span>
          </button>
        </nav>
      )}
      {view === "room" && roomId ? room : null}
      {view === "room" && !roomId ? <RoomPreview /> : null}
      {view === "home" ? (
        <div className={style === "gruvbox" ? "wrap screen-scroll g-home" : "wrap screen-scroll"}>
          <main>
            <div className="greet">
              <h1>{text.evening}{session ? `, ${session.user.displayName}` : ""}</h1>
              <p className="sub">{legacyText(locale, "common", "nav.home")} · {text.friendsWatching}</p>
            </div>
            {!session ? (
              <form className="acts" onSubmit={(event) => void signIn(event)}>
                <label className="tile">
                  {text.name}
                  <input data-testid="lobby-name" value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <button type="submit" className="tile create" data-testid="lobby-sign-in">{text.signIn}</button>
                <button type="button" className="tile join" onClick={() => go("/auth")}>{text.telegram}</button>
              </form>
            ) : (
              <div className="acts">
                <button type="button" className="tile resume" style={{ background: "url(/dev-seed/desert.jpg) center/cover" }} onClick={() => {
                  void fetch(`${apiUrl}/rooms/resume-last`, { method: "POST", headers: { authorization: `Bearer ${session.accessToken}` } })
                    .then((response) => response.json())
                    .then((payload: { room?: { id: string } }) => { if (payload.room) onOpen(payload.room.id); });
                }}>
                  <div className="c"><div className="eyebrow">{text.resume}</div><h2>{resume ?? text.empty}</h2></div>
                </button>
                <form className="tile create" onSubmit={(event) => void createRoom(event)}>
                  <h3>{text.create}</h3>
                  <p>{text.createHint}</p>
                  <input data-testid="lobby-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={text.create} />
                  <button type="submit" data-testid="lobby-create">{text.create}</button>
                  <span className="chips">
                    <button type="button" className="pill" onClick={() => setTitle("Киноночь")}>Киноночь</button>
                    <button type="button" className="pill" onClick={() => setTitle("Вечеринка")}>Вечеринка</button>
                    <button type="button" className="pill" onClick={() => setTitle("Закрытый")}>Закрытый</button>
                    <button type="button" className="pill" onClick={() => setTitle("С модерацией")}>С модерацией</button>
                  </span>
                </form>
                <form className="tile join" onSubmit={(event) => void joinRoom(event)}>
                  <h3>{text.join}</h3>
                  <p>{text.joinHint}</p>
                  <input data-testid="lobby-code" value={code} onChange={(event) => setCode(event.target.value)} className="mono" />
                  <button type="submit" className="go" data-testid="lobby-join">{text.enter}</button>
                </form>
              </div>
            )}
            <div className="sec">
              <h3>{text.rooms}</h3>
              <div className="chips">
                {(["all", "friends", "film", "music"] as const).map((item) => (
                  <button key={item} type="button" className={filter === item ? "pill on" : "pill"} onClick={() => setFilter(item)}>{text[item]}</button>
                ))}
              </div>
            </div>
            <div className="rooms">
              {shownRooms.map((item) => (
                <button key={item.id} type="button" className="rc" onClick={() => { if (!session) return; void api.joinRoom(session.accessToken, item.code).then((result) => onOpen(result.room.id)); }}>
                  <div className="th" style={{ backgroundImage: `url(${posterFor(item.id)})` }}><span className="tag">{item.memberCount ?? 0}</span></div>
                  <div className="bd"><b>{item.title}</b><small className="mono">{item.code}</small></div>
                </button>
              ))}
            </div>
          </main>
          <aside className="side">
            <section className="card">
              <h3>{text.online}</h3>
              {friends.map((row) => (
                <div className="fr" key={row.id}>
                  <span className={`av lg p-${personHue(row.userId)}`}>{initials(row.displayName)}</span>
                  <div><div className={`n p-${personHue(row.userId)}`}>{row.displayName}</div><small>{row.roomTitle ?? text.empty}</small></div>
                  <button type="button" className="mini" onClick={() => void fetch(`${apiUrl}/friends/${row.id}`, { method: "DELETE", headers: { authorization: `Bearer ${session?.accessToken ?? ""}` } })}>{text.block}</button>
                </div>
              ))}
            </section>
            <section className="card">
              <div className="lvl"><div className="mark">{level}</div><div><b>{text.level} {level}</b></div></div>
            </section>
            <section className="card">
              <h3>{text.reminders}</h3>
              {notes.slice(0, 3).map((note) => <p key={note.id}>{note.title}</p>)}
            </section>
            <section className="card heat-wrap heat-compact" aria-label={text.season}>
              <div className="heat-top"><h3>{text.season}</h3></div>
              <div className="heat-grid">
                {heat.slice(-119).map((cell) => <i key={cell.day} className={cell.score > 6 ? "a4" : cell.score > 3 ? "a3" : cell.score > 1 ? "a2" : cell.score > 0 ? "a1" : ""} data-tip={cell.day} />)}
              </div>
            </section>
          </aside>
        </div>
      ) : null}
      {view !== "home" && view !== "room" ? (
        <Page title={view} onClose={() => go("/")}>
          {view === "search" ? (
            <form onSubmit={(event) => { event.preventDefault(); void fetch(`${apiUrl}/video/search?q=${encodeURIComponent(query)}`).then((r) => r.json()).then((p: { results?: Array<{ title: string; url: string }> }) => setFound(p.results ?? [])); }}>
              <input className="inbox" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.search} />
              <div className="results">{found.map((item) => <button key={item.url} type="button" className="res" onClick={() => go("/")}><b>{item.title || item.url}</b></button>)}</div>
            </form>
          ) : null}
          {view === "create" && session ? (
            <form onSubmit={(event) => void createRoom(event)}>
              <input className="inbox" value={title} onChange={(event) => setTitle(event.target.value)} />
              <button className="btn btn-primary" type="submit">{text.create}</button>
            </form>
          ) : null}
          {view === "join" && session ? (
            <form onSubmit={(event) => void joinRoom(event)}>
              <input className="inbox mono" value={code} onChange={(event) => setCode(event.target.value)} />
              <button className="btn btn-social" type="submit">{text.enter}</button>
            </form>
          ) : null}
          {view === "settings" ? (
            <div className="settings-grid">
              <aside>
                <div className="slink on">{text.style}</div>
                <button type="button" className="slink" onClick={() => go("/notifications")}>{text.notifications}</button>
                <button type="button" className="slink" onClick={() => go("/profile")}>{text.profile}</button>
              </aside>
              <div className="panel">
                <h2>{text.style}</h2>
                <p className="lead">{locale === "en" ? "Cinema is the main style. Gruvbox is a separate layout." : "Стиль и тема. Основной стиль — Кинозал, Gruvbox подключается отдельно."}</p>
                <div className="set-row">
                  <div><b>{text.style}</b><small>{text.cinema} / {text.gruvbox}</small></div>
                  <div className="seg">
                    <button type="button" className={style === "cinema" ? "on" : ""} onClick={() => void saveAppearance("cinema", mode)}>{text.cinema}</button>
                    <button type="button" className={style === "gruvbox" ? "on" : ""} onClick={() => void saveAppearance("gruvbox", mode)}>{text.gruvbox}</button>
                  </div>
                </div>
                <div className="set-row">
                  <div><b>{text.mode}</b></div>
                  <div className="seg">
                    {(["dark", "light", "system"] as const).map((item) => (
                      <button key={item} type="button" className={mode === item ? "on" : ""} onClick={() => void saveAppearance(style, item)}>{text[item]}</button>
                    ))}
                  </div>
                </div>
                <p>Telegram: {linked}</p>
                <button type="button" onClick={onSignOut}>{t("lobby.signOut")}</button>
              </div>
            </div>
          ) : null}
          {view === "profile" && session ? <PeopleScreen session={session} onOpen={onOpen} /> : null}
          {view === "profile" ? (
            <div>
              <h2 className={`nm p-${hue}`}>{session?.user.displayName}</h2>
              <p>{text.level} {level}</p>
              <div className="heat-grid">{heat.slice(-60).map((cell) => <i key={cell.day} className={cell.score > 0 ? "a3" : ""} />)}</div>
              <h3>{text.leaderboard}</h3>
              <ul>{ranks.map((row) => <li key={row.id}>{row.displayName} · {row.xp} · {row.totalMessages}/{row.totalReactions}/{row.totalVoiceSeconds}</li>)}</ul>
              <h3>{text.blacklist}</h3>
              <ul>{blocked.map((row) => <li key={row.id}>{row.displayName} <button type="button" onClick={() => void fetch(`${apiUrl}/friends/${row.id}`, { method: "DELETE", headers: { authorization: `Bearer ${session?.accessToken ?? ""}` } })}>{text.block}</button></li>)}</ul>
            </div>
          ) : null}
          {view === "premium" ? (
            <div className="shop">
              {["theme.aurora", "frame.film", "badge.night"].map((sku) => (
                <article key={sku} className="sku"><b>{sku}</b><span className="price">Blink</span></article>
              ))}
            </div>
          ) : null}
          {view === "notifications" ? <ul>{notes.map((note) => <li key={note.id}><b>{note.title}</b> {note.body}</li>)}</ul> : null}
          {view === "onboarding" ? <div className="empty"><h2>{text.onboarding}</h2><p>{text.onboardingBody}</p><button type="button" className="btn btn-primary" onClick={() => { window.localStorage.setItem("lume-onboarded", "1"); go("/"); }}>{text.save}</button></div> : null}
          {view === "auth" ? (
            <>
            <form className="auth-card" onSubmit={(event) => {
              event.preventDefault();
              void fetch(`${apiUrl}/auth/magic-link`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: name }) });
            }}>
              <h2>{text.telegram}</h2>
              <button type="button" className="tg-btn" onClick={() => void signIn({ preventDefault() {} } as FormEvent)}>{text.telegram}</button>
              <div className="or">email</div>
              <input className="inbox" value={name} onChange={(event) => setName(event.target.value)} placeholder="email" />
              <button className="btn btn-primary" type="submit">{text.signIn}</button>
            </form>
            <form className="auth-card" onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void fetch(`${apiUrl}/auth/telegram-widget`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(data.entries())) });
            }}>
              <input name="id" placeholder="id" />
              <input name="auth_date" placeholder="auth_date" />
              <input name="hash" placeholder="hash" />
              <input name="first_name" placeholder="first_name" />
              <button type="submit">Telegram</button>
            </form>
            </>
          ) : null}
          {view === "missing" ? <div className="empty"><h2>{text.missing}</h2><button type="button" onClick={() => go("/")}>{text.enter}</button></div> : null}
          {view === "offline" ? <div className="empty"><h2>{text.offline}</h2><button type="button" onClick={() => window.location.reload()}>{text.refresh}</button></div> : null}
          {view === "unavailable" ? (
            <div className="empty">
              <h2>{text.unavailable}</h2>
              <p>{text.unavailableBody}</p>
              <button type="button" className="btn btn-primary" onClick={() => go("/")}>{text.refresh}</button>
              <button type="button" onClick={() => go("/search")}>{text.replace}</button>
            </div>
          ) : null}
          {view === "members" ? (
            <div>
              <p>{ice}</p>
              <button type="button" onClick={() => void navigator.mediaDevices?.getUserMedia({ audio: true }).then((stream) => stream.getTracks().forEach((track) => track.stop()))}>{text.voiceTest}</button>
              <label>{text.report}<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            </div>
          ) : null}
          {view === "room-settings" && session && roomId ? (
            <form onSubmit={(event) => { event.preventDefault(); void fetch(`${apiUrl}/rooms/${roomId}/defaults`, { method: "POST", headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ canChat: true, canSpeak: true }) }); }}>
              <p>{text.defaults}</p>
              <button className="btn btn-primary" type="submit">{text.save}</button>
            </form>
          ) : null}
          {view === "queue" ? <p>{text.search}</p> : null}
        </Page>
      ) : null}
      {style === "gruvbox" ? (
        <footer className="status">
          <span className="sl-mode">{view.toUpperCase()}</span>
          <span className="sl-file">lume/{view}</span>
          <span className="sl-mid">{error ?? ice ?? ""}</span>
          <span className="sl-keys"><b>:</b>{view}</span>
        </footer>
      ) : null}
      {error ? <p className="tr-note">{error}</p> : null}
    </div>
  );
}

function RoomPreview() {
  const gruv = document.documentElement.dataset.style === "gruvbox";
  return (
    <div className={gruv ? "g-room" : "cinema-room"}>
      {gruv ? (
        <header className="tabline"><span className="brand"><span className="dot" />LUME</span><div className="bufs"><span className="buf on"><span className="nr">1</span>room</span></div></header>
      ) : (
        <header className="top"><span className="logo"><i className="dot" />lume</span><div className="crumb"><b>Ночной кинозал</b><span className="slate mono">7KQ-2M</span></div></header>
      )}
      <div className="body">
        <section className="player-col">
          <div className="stage-card" style={{ background: "url(/dev-seed/desert.jpg) center/cover", minHeight: 320 }} />
          <div className="low">
            <div className="card" style={{ minHeight: 120 }} />
            <div className="card" style={{ display: "flex", gap: 8, padding: 12 }}>
              <div style={{ width: 140, height: 84, background: "url(/dev-seed/rain.jpg) center/cover" }} />
              <div style={{ width: 140, height: 84, background: "url(/dev-seed/forest.jpg) center/cover" }} />
            </div>
          </div>
        </section>
        <aside className={gruv ? "pane irc" : "rail"} style={{ minHeight: 240 }} />
      </div>
      {gruv ? <footer className="status"><span className="sl-mode">ROOM</span><span className="sl-mid">:</span></footer> : null}
    </div>
  );
}

function Page({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="overlay">
      <section className="modal" role="dialog" aria-label={title}>
        <header className="mh"><h2>{title}</h2><span className="sp" /><button type="button" onClick={onClose}>×</button></header>
        <div className="mb">{children}</div>
      </section>
    </div>
  );
}

function GruvboxBar({ view, onGo, text }: { view: View; onGo: (path: string) => void; text: ReturnType<typeof copy> }) {
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
    </div>
  );
}
