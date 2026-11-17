import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api, apiUrl, ClientError } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import { legacyText } from "../i18n/legacy.js";
import { PeopleScreen } from "../screens/PeopleScreen.js";
import type { ClientSession } from "../session.js";
import { copy } from "./copy.js";
import { demoFriends, demoMessages, demoRooms, heatCells } from "./fixtures.js";
import { AuthScreen, CreateScreen, EmptyScreen, JoinScreen, MembersScreen, MobileHome, NotificationsScreen, OnboardingScreen, PremiumScreen, ProfileScreen, QueueScreen, RoomSettingsScreen, SettingsScreen } from "./pages.js";
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
  const demo = params.get("demo") === "1";
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
  const [narrow, setNarrow] = useState(() => window.innerWidth < 800);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 800);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
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
    void api.listRooms(query).then((payload) => setRooms(payload.rooms)).catch(() => setRooms([]));
    void fetch(`${apiUrl}/ice-servers`).then((response) => response.json()).then((payload: { iceServers?: Array<{ urls?: string }> }) => setIce(payload.iceServers?.[0]?.urls ?? null)).catch(() => setIce(null));
  }, [query]);

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
    <div className={narrow ? "design-app is-narrow" : "design-app"} data-view={view}>
      {view === "room" || view === "auth" ? null : style === "gruvbox" ? <GruvboxBar view={view} onGo={go} text={text} /> : (
        <nav className="nav">
          <button type="button" className="logo" onClick={() => { onLeave(); go("/"); }}><i />lume</button>
          {demo ? (
            <div className="search-lg"><Icon name="search" />Найти видео или комнату<span className="kbd">/</span></div>
          ) : (
            <label className="search-lg">
              <input aria-label={text.search} placeholder={text.search} value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => go("/search")} />
              <span className="kbd">/</span>
            </label>
          )}
          <div style={{ flex: 1 }} />
          <button type="button" className="icon-btn bell" onClick={() => go("/notifications")} aria-label={text.notifications}><Icon name="bell" /><span className="badge-dot" /></button>
          <button type="button" className="theme-btn" onClick={() => void saveAppearance(style, mode === "dark" ? "light" : "dark")} aria-label={text.mode}><Icon name="sun" /><Icon name="moon" /></button>
          <button type="button" className="me" onClick={() => go("/profile")}>
            <span className="av p-me">{demo ? "АВ" : initials(session?.user.displayName ?? "?")}</span>
            <span className="nm p-me">{demo ? "Альберт" : session?.user.displayName ?? text.signIn}</span>
          </button>
        </nav>
      )}
      {view === "room" && roomId ? room : null}
      {(view === "room" || view === "notifications" || view === "members" || view === "queue" || view === "unavailable") && !roomId ? (
        <RoomPreview rail={view === "members" ? "people" : view === "queue" ? "queue" : "chat"} unavailable={view === "unavailable"} />
      ) : null}
      {view === "home" && style === "gruvbox" ? <GruvboxHome demo={demo} /> : null}
      {view === "home" && narrow && style !== "gruvbox" ? <MobileHome /> : null}
      {(view === "home" || view === "create" || view === "join" || view === "onboarding") && style !== "gruvbox" && !narrow ? (
        <div className="wrap screen-scroll">
          <main>
            <div className="greet">
              <h1>{text.evening}{demo ? ", Альберт" : session ? `, ${session.user.displayName}` : ""}</h1>
              <p className="sub">{demo ? "Трое друзей сейчас смотрят — можно зайти к ним" : `${legacyText(locale, "common", "nav.home")} · ${text.friendsWatching}`}</p>
            </div>
            {demo ? (
              <div className="stories">
                <div className="st new"><div className="ring">+</div>Своя</div>
                <div className="st p-lisa"><div className="ring"><div className="face" style={{ backgroundImage: "url(/dev-seed/desert.jpg)" }}><span className="av p-lisa">Л</span></div></div>Лиза</div>
                <div className="st p-sonya"><div className="ring"><div className="face" style={{ backgroundImage: "url(/dev-seed/concert.jpg)" }}><span className="av p-sonya">С</span></div></div>Соня</div>
                <div className="st p-dasha"><div className="ring"><div className="face" style={{ backgroundImage: "url(/dev-seed/forest.jpg)" }}><span className="av p-dasha">Д</span></div></div>Даша</div>
                <div className="st p-nick"><div className="ring"><div className="face" style={{ backgroundImage: "url(/dev-seed/rain.jpg)" }}><span className="av p-nick">Н</span></div></div>Ник</div>
              </div>
            ) : null}
            {!session && !demo ? (
              <div className="acts">
                <form className="tile" onSubmit={(event) => void signIn(event)}>
                  <div className="eyebrow">{text.signIn}</div>
                  <label>
                    {text.name}
                    <input data-testid="lobby-name" value={name} onChange={(event) => setName(event.target.value)} />
                  </label>
                  <button type="submit" className="go" data-testid="lobby-sign-in">{text.signIn}</button>
                </form>
                <button type="button" className="tile create" onClick={() => document.querySelector<HTMLInputElement>("[data-testid=lobby-name]")?.focus()}>
                  <h3>{text.create}</h3>
                  <p>{text.createHint}</p>
                </button>
                <form className="tile join" onSubmit={(event) => { event.preventDefault(); go("/auth"); }}>
                  <h3>{text.join}</h3>
                  <p>{text.joinHint}</p>
                  <div className="codein"><i className="blank">·</i><i className="blank">·</i><i className="blank">·</i><span className="dash">–</span><i className="blank">·</i><i className="blank">·</i></div>
                  <button type="submit" className="go">{text.telegram}</button>
                </form>
              </div>
            ) : (
              <div className="acts">
                <button type="button" className="tile resume" onClick={() => {
                  if (!session) return;
                  void fetch(`${apiUrl}/rooms/resume-last`, { method: "POST", headers: { authorization: `Bearer ${session.accessToken}` } })
                    .then((response) => response.json())
                    .then((payload: { room?: { id: string } }) => { if (payload.room) onOpen(payload.room.id); });
                }}>
                  <div className="c">
                    <div className="eyebrow">{text.resume}</div>
                    <h2>{demo ? "Пустая дорога — режиссёрская версия" : resume ?? text.empty}</h2>
                    {demo ? <div className="sub">Ночной кинозал · 6 зрителей · 01:12:44 / 02:03:10</div> : null}
                    {demo ? <div className="pb"><i /></div> : null}
                  </div>
                </button>
                <form className="tile create" onSubmit={(event) => void createRoom(event)}>
                  <div className="ic"><Icon name="plus" /></div>
                  <h3>{text.create}</h3>
                  <p>{text.createHint}</p>
                  {demo ? null : <input data-testid="lobby-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={text.create} />}
                  {demo ? null : <button type="submit" data-testid="lobby-create">{text.create}</button>}
                </form>
                <form className="tile join" onSubmit={(event) => void joinRoom(event)}>
                  <div className="ic"><Icon name="key" /></div>
                  <h3>{text.join}</h3>
                  <p>{demo ? "Код комнаты из шести знаков" : text.joinHint}</p>
                  {demo ? (
                    <div className="codein"><i>7</i><i>K</i><i>Q</i><span className="dash">–</span><i className="blank">2</i><i className="blank">M</i></div>
                  ) : (
                    <input data-testid="lobby-code" value={code} onChange={(event) => setCode(event.target.value)} className="mono" />
                  )}
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
              {demo ? (
                <>
                  <div className="rc"><div className="th" style={{ backgroundImage: "url(/dev-seed/concert.jpg)" }}><span className="tag"><i className="d" />38 смотрят</span></div><div className="bd"><div><b>Пятничный звук</b><small>Концерт на крыше</small></div><div className="stack"><span className="av sm p-sonya">С</span><span className="av sm p-katya">К</span></div></div></div>
                  <div className="rc"><div className="th" style={{ backgroundImage: "url(/dev-seed/rain.jpg)" }}><span className="tag"><i className="d" />12 смотрят</span></div><div className="bd"><div><b>Нуар по средам</b><small>Город после дождя</small></div><div className="stack"><span className="av sm p-nick">Н</span></div></div></div>
                  <div className="rc"><div className="th" style={{ backgroundImage: "url(/dev-seed/forest.jpg)" }}><span className="tag">в 22:00</span></div><div className="bd"><div><b>Документалки</b><small>Лес, который помнит</small></div><div className="stack"><span className="av sm p-dasha">Д</span></div></div></div>
                </>
              ) : shownRooms.map((item) => (
                <button key={item.id} type="button" className="rc" onClick={() => { if (!session) return; void api.joinRoom(session.accessToken, item.code).then((result) => onOpen(result.room.id)); }}>
                  <div className="th" style={{ backgroundImage: `url(${posterFor(item.id)})` }}><span className="tag">{item.memberCount ?? 0}</span></div>
                  <div className="bd"><b>{item.title}</b><small className="mono">{item.code}</small></div>
                </button>
              ))}
            </div>
          </main>
          <aside className="side">
            <section className="card">
              <h3>Друзья онлайн <span>14</span></h3>
              {demo ? (
                <>
                  <div className="fr"><span className="av lg p-lisa">ЛМ<span className="pres" /></span><div><div className="n p-lisa">Лиза</div><div className="s">ведёт «Ночной кинозал»</div></div><button type="button" className="mini go">Зайти</button></div>
                  <div className="fr"><span className="av lg p-artem">АТ<span className="pres" /></span><div><div className="n p-artem">Артём</div><div className="s">в «Ночном кинозале»</div></div><button type="button" className="mini go">Зайти</button></div>
                  <div className="fr"><span className="av lg p-sonya">СН<span className="pres" /></span><div><div className="n p-sonya">Соня</div><div className="s">в «Пятничном звуке»</div></div><button type="button" className="mini">Зайти</button></div>
                  <div className="fr"><span className="av lg p-nick">НК<span className="pres idle" /></span><div><div className="n p-nick">Ник</div><div className="s">был час назад</div></div><button type="button" className="mini">Позвать</button></div>
                </>
              ) : friends.map((row) => (
                <div className="fr" key={row.id}>
                  <span className={`av lg p-${personHue(row.userId)}`}>{initials(row.displayName)}</span>
                  <div><div className={`n p-${personHue(row.userId)}`}>{row.displayName}</div><small>{row.roomTitle ?? text.empty}</small></div>
                  <button type="button" className="mini" onClick={() => void fetch(`${apiUrl}/friends/${row.id}`, { method: "DELETE", headers: { authorization: `Bearer ${session?.accessToken ?? ""}` } })}>{text.block}</button>
                </div>
              ))}
            </section>
            <section className="card">
              <div className="lvl"><div className="mark">{demo ? 7 : level}</div><div><b>{demo ? "Уровень 7" : `${text.level} ${level}`}</b><small>{demo ? "2 340 XP · до 8-го ещё 660" : ""}</small></div></div>
              {demo ? <div className="xp"><i /></div> : null}
              {demo ? <div className="ach"><span className="got">🎞</span><span className="got">☾</span><span className="got">☺</span><span>♛</span><span>⚡</span></div> : null}
            </section>
            <section className="card">
              <h3>Напоминания <span>2</span></h3>
              {demo ? (
                <>
                  <div className="ev"><div className="d">сегодня<b>22:00</b></div><div><div className="t">Лес, который помнит</div><div className="h">комната <span className="nm p-dasha">Даши</span></div></div></div>
                  <div className="ev"><div className="d">вт<b>20:30</b></div><div><div className="t">Сериальный вторник</div><div className="h"><span className="nm p-sonya">Соня</span> приглашает</div></div></div>
                </>
              ) : notes.slice(0, 3).map((note) => <p key={note.id}>{note.title}</p>)}
            </section>
            <section className="card heat-wrap heat-compact" aria-label={text.season}>
              <div className="heat-top"><h3>{text.season}</h3></div>
              {demo ? <div className="stats"><b>14 дней</b> подряд · 142 сеанса</div> : null}
              {demo ? (
                <div className="heat-cal">
                  <div />
                  <div className="heat-months"><span>июл</span><span /><span>авг</span><span /><span /><span /><span /><span>сен</span><span /><span /><span /><span>окт</span><span /><span /><span /><span>ноя</span><span /></div>
                  <div className="heat-days"><span>пн</span><span>вт</span><span>ср</span><span>чт</span><span>пт</span><span>сб</span><span>вс</span></div>
                  <div className="heat-grid">{heatCells.map((name, index) => <i key={index} className={name} />)}</div>
                </div>
              ) : (
                <div className="heat-grid">{heat.slice(-119).map((cell) => <i key={cell.day} className={cell.score > 3 ? "a3" : cell.score > 0 ? "a1" : ""} />)}</div>
              )}
              {demo ? <div className="heat-leg">меньше <i /><i className="a1" /><i className="a2" /><i className="a3" /><i className="a4" /> больше</div> : null}
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
          {view === "create" ? <CreateScreen title={title} onTitle={setTitle} onSubmit={(event) => void createRoom(event)} /> : null}
          {view === "join" ? <JoinScreen code={code} onCode={setCode} onSubmit={(event) => void joinRoom(event)} /> : null}
          {view === "settings" ? <SettingsScreen style={style} mode={mode} onStyle={(next) => void saveAppearance(next, mode)} onMode={(next) => void saveAppearance(style, next)} token={session?.accessToken} apiUrl={apiUrl} blocked={blocked} onUnblock={(id) => { setBlocked((rows) => rows.filter((row) => row.id !== id)); if (!session) return; void fetch(`${apiUrl}/friends/${id}`, { method: "DELETE", headers: { authorization: `Bearer ${session.accessToken}` } }); }} /> : null}
          {view === "profile" && session ? <PeopleScreen session={session} onOpen={onOpen} /> : null}
          {view === "profile" ? <ProfileScreen /> : null}
          {view === "premium" ? <PremiumScreen /> : null}
          {view === "notifications" ? <NotificationsScreen /> : null}
          {view === "onboarding" ? <OnboardingScreen onDone={() => { window.localStorage.setItem("lume-onboarded", "1"); go("/"); }} /> : null}
          {view === "auth" ? (
            <AuthScreen name={name} onName={setName} onTelegram={() => void signIn({ preventDefault() {} } as FormEvent)} onEmail={(event) => { event.preventDefault(); void fetch(`${apiUrl}/auth/magic-link`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: name }) }); }} onRegister={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void fetch(`${apiUrl}/auth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: name, password: String(data.get("password") ?? ""), displayName: String(data.get("displayName") ?? name) }) })
                .then((response) => response.json())
                .then((payload: { accessToken?: string; refreshToken?: string; user?: { id: string; displayName: string } }) => {
                  if (payload.accessToken && payload.user) {
                    onSession({
                      accessToken: payload.accessToken,
                      ...(payload.refreshToken ? { refreshToken: payload.refreshToken } : {}),
                      user: { id: payload.user.id, displayName: payload.user.displayName, telegramId: null, username: null, locale: "ru", themeId: "ember" },
                    });
                  }
                });
            }} />
          ) : null}
          {view === "missing" ? <EmptyScreen title="Комната не найдена" body="Кода 7KQ-2M нет или сеанс уже закончился. Проверьте приглашение или создайте свою." action={<><button type="button" className="btn btn-outline" onClick={() => go("/")}>На главную</button><button type="button" className="btn btn-primary" onClick={() => go("/create")}>Создать комнату</button></>} /> : null}
          {view === "offline" ? <EmptyScreen title="Нет соединения" body="Похоже, вы офлайн. Проверьте сеть — комната дождётся, когда вы вернётесь." action={<button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Повторить</button>} /> : null}
          {view === "members" ? null : null}
          {view === "room-settings" ? (
            <RoomSettingsScreen token={session?.accessToken} apiUrl={apiUrl} roomId={roomId} onSave={(event) => { event.preventDefault(); if (!session || !roomId) return; void fetch(`${apiUrl}/rooms/${roomId}/defaults`, { method: "POST", headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" }, body: JSON.stringify({ canChat: true, canSpeak: true }) }); }} />
          ) : null}
          {view === "queue" ? null : null}
        </Page>
      ) : null}
      {narrow && view === "home" ? (
        <nav className="tabbar">
          <button type="button" onClick={() => go("/")}>Главная</button>
          <button type="button" onClick={() => go("/search")}>Поиск</button>
          <button type="button" onClick={() => go("/notifications")}>Звонок</button>
          <button type="button" onClick={() => go("/profile")}>Я</button>
        </nav>
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

function RoomPreview({ rail = "chat", unavailable = false }: { rail?: "chat" | "people" | "queue"; unavailable?: boolean }) {
  const gruv = document.documentElement.dataset.style === "gruvbox";
  return (
    <div className={gruv ? "g-room" : "cinema-room"}>
      {gruv ? (
        <header className="tabline">
          <span className="brand"><span className="dot" />LUME</span>
          <div className="bufs"><span className="buf on"><span className="nr">0</span>room</span><span className="buf"><span className="nr">1</span>чат</span><span className="buf"><span className="nr">2</span>очередь</span></div>
          <span className="hash">#7KQ-2M</span>
        </header>
      ) : (
        <header className="top">
          <span className="logo"><i />lume</span>
          <div className="crumb"><b>Ночной кинозал</b><span className="slate mono">7KQ-2M</span></div>
          <span className="spacer" />
          <div className="sync"><span className="dot" /><b>Синхронно</b> <span className="mono">±40 мс</span></div>
          <div className="who"><div className="stack"><span className="av sm p-lisa">ЛМ</span><span className="av sm p-artem">АТ</span><span className="av sm p-mark">МК</span><span className="av sm p-dasha">ДС</span></div>смотрят</div>
          <button type="button" className="btn btn-outline">Позвать</button>
        </header>
      )}
      <div className={gruv ? "body g-tiled" : "body"}>
        {gruv ? (
          <>
            <div className="col-l">
              <section className="pane stage-pane"><div className="pt">~stage</div><div className="stage" /></section>
              <section className="pane">
                <div className="pt">#очередь <span className="dim">3</span> <span className="vote">пропуск 2/4</span></div>
                <div className="qrow"><span className="nr">01</span><span className="th" style={{ backgroundImage: "url(/dev-seed/rain.jpg)" }} /><div><b>Город после дождя</b><small>1:48:02</small></div></div>
                <div className="qrow"><span className="nr">02</span><span className="th" style={{ backgroundImage: "url(/dev-seed/forest.jpg)" }} /><div><b>Лес, который помнит</b><small>52:10</small></div></div>
                <div className="qrow add"><span className="nr">--</span><span className="th">+</span><div><b>:add</b></div></div>
              </section>
            </div>
            <div className="col-r">
              <section className="pane">
                <div className="pt">#чат <span className="dim">12</span></div>
                <div className="log">
                  <div className="msg"><span className="ts">21:02</span><span className="nick n p-dasha">Даша</span><div>я с попкорном, начинайте</div></div>
                  <div className="msg"><span className="ts">21:08</span><span className="nick n p-artem">Артём</span><div>вот этот кадр с фарами</div></div>
                  <div className="msg mine"><span className="ts">21:09</span><span className="nick n p-me">Альберт</span><div>Ого, не знал</div></div>
                </div>
              </section>
              <section className="pane">
                <div className="pt">#голос <span className="dim">4/6</span></div>
                <div className="voice"><div className="vp spk"><span className="av lg p-lisa">ЛМ</span>Лиза</div><div className="vp"><span className="av lg p-artem">АТ</span>Артём</div></div>
              </section>
              <div className="comp"><span className="prompt">:</span><span className="in">написать в комнату_</span></div>
            </div>
          </>
        ) : null}
        {gruv ? null : <section className="player-col">
          <div className="stage-card">
            <div className="top-ov"><span className="pill">Пустая дорога — режиссёрская версия</span></div>
            {unavailable ? (
              <div className="unavail">
                <h2>Видео недоступно</h2>
                <p>Источник не отвечает. Ведущая может обновить ссылку или заменить ролик.</p>
                <div className="inbox">https://youtu.be/…</div>
                <button type="button" className="btn btn-outline" onClick={() => void fetch(`${apiUrl}/video/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: "https://youtu.be/dQw4w9WgXcQ", positionMs: 4_364_000, playing: true }) })}>Повторить</button>
                <button type="button" className="btn btn-outline" onClick={() => window.open("https://youtu.be/dQw4w9WgXcQ", "_blank", "noopener")}>Открыть на платформе</button>
                <button type="button" className="btn btn-primary">Заменить видео</button>
              </div>
            ) : null}
          </div>
          <div className="ctl">
            <button type="button" className="play">II</button>
            <span className="time">01:12:44 <span>/ 02:03:10</span></span>
            <div className="tlw"><div className="track"><div className="buf" /><div className="prog" /></div><div className="head" /></div>
            <span className="pill mono">1×</span>
            <span className="pill">1080p</span>
          </div>
          <div className="low">
            <div className="card">
              <div className="ct">Голосовой</div>
              <div className="voice">
                <div className="vp spk"><span className="av p-lisa speak">ЛМ</span><span className="name">Лиза</span></div>
                <div className="vp"><span className="av p-artem">АТ</span>Артём</div>
                <div className="vp"><span className="av p-mark">МК</span>Марк</div>
              </div>
            </div>
            <div className="card">
              <div className="ct">Дальше в очереди <small>3 видео</small><span className="pill">Пропуск 2 из 4</span></div>
              <div className="q">
                <div className="qi"><div className="im" style={{ backgroundImage: "url(/dev-seed/rain.jpg)" }}><span>1:48:02</span></div><b>Город после дождя</b></div>
                <div className="qi"><div className="im" style={{ backgroundImage: "url(/dev-seed/forest.jpg)" }}><span>52:10</span></div><b>Лес, который помнит</b></div>
                <div className="qi add"><div className="im">+</div><b>Добавить</b></div>
              </div>
            </div>
          </div>
        </section>}
        {gruv ? null : <aside className="rail">
          <div className="tabs">
            <span className={rail === "chat" ? "tab on" : "tab"}>Чат <span className="n">12</span></span>
            <span className={rail === "people" ? "tab on" : "tab"}>Люди <span className="n">6</span></span>
            <span className={rail === "queue" ? "tab on" : "tab"}>Очередь <span className="n">3</span></span>
          </div>
          {rail === "people" ? (
            <div className="rail-list">
              <div className="eyebrow">Ведущая</div>
              <div className="row"><span className="av p-lisa">ЛМ</span><div><b className="n p-lisa">Лиза</b><small>говорит · ведущая</small></div></div>
              <div className="eyebrow">В комнате</div>
              <div className="row"><span className="av p-me">АВ</span><div><b className="n p-me">Альберт</b><small>вы · в голосе</small></div></div>
              <div className="row"><span className="av p-artem">АТ</span><div><b className="n p-artem">Артём</b><small>в голосе</small></div></div>
              <div className="row"><span className="av p-mark">МК</span><div><b className="n p-mark">Марк</b><small>микрофон выкл</small></div></div>
              <form className="row" onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const reason = String(data.get("reason") ?? "");
                if (!reason.trim()) return;
                void fetch(`${apiUrl}/reports`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetKind: "user", targetId: "mark", reason }) });
              }}>
                <input name="reason" placeholder="Жалоба, до 500 знаков" aria-label="report" />
                <button type="submit">Пожаловаться</button>
              </form>
            </div>
          ) : null}
          {rail === "queue" ? (
            <div className="rail-list">
              <button type="button" className="btn btn-primary">Добавить видео</button>
              <div className="eyebrow">Сейчас</div>
              <div className="row"><b>Пустая дорога</b><small>01:12:44 / 02:03:10 · Лиза</small></div>
              <div className="eyebrow">Дальше · пропуск 2 из 4</div>
              <div className="row"><b>Город после дождя</b><small>Артём · 4 голоса</small></div>
              <div className="row"><b>Лес, который помнит</b><small>Даша · 2 голоса</small></div>
            </div>
          ) : null}
          {rail === "chat" ? <>
          <div className="pin"><span className="bar" /><div><b>Закреплено · Лиза</b>После фильма — голосуем за следующий в очереди</div></div>
          <div className="log">
            {demoMessages.map((message, index) => "system" in message && message.system ? (
              <span className="sys" key={index}>{message.text}</span>
            ) : (
              <div className={"mine" in message && message.mine ? "m mine" : "m"} key={index}>
                {"name" in message ? <span className={`av p-${message.hue}`}>{initials(message.name)}</span> : null}
                <div className="bu">{"name" in message ? <div className={`n p-${message.hue}`}>{message.name}</div> : null}{"body" in message ? message.body : ""}</div>
              </div>
            ))}
          </div>
          </> : null}
        </aside>}
      </div>
      {gruv ? <footer className="status"><span className="sl-mode">ROOM</span><span className="sl-mid">:</span></footer> : null}
    </div>
  );
}

function Page({ title, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="screen-fill" data-page={title}>{children}</div>;
}

function Icon({ name }: { name: "search" | "bell" | "sun" | "moon" | "plus" | "key" }) {
  const path = {
    search: "M11 11l4 4M7.5 11a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z",
    bell: "M12 20a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zm6-5V10a6 6 0 1 0-12 0v5l-2 2h16z",
    sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0-4v2m0 12v2M4 12H2m20 0h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19",
    moon: "M16 14.5A6.5 6.5 0 0 1 9.5 4 6.5 6.5 0 1 0 16 14.5z",
    plus: "M12 5v14M5 12h14",
    key: "M14 8a4 4 0 1 0-3.2 6.4L8 17v2H6v2H4v-2.8l6.1-6.1A4 4 0 0 0 14 8z",
  }[name];
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GruvboxHome({ demo }: { demo: boolean }) {
  if (!demo) return <p className="lead">Войдите, чтобы открыть сессии.</p>;
  return (
    <div className="g-home wrap">
      <section className="pane"><div className="pt">#сессии <span className="dim">4</span></div>
        <div className="srow on"><span>&gt;</span><b>Ночной кинозал</b><span>6</span><span>live</span></div>
        <div className="srow"><b>Пятничный звук</b><span>38</span><span>live</span></div>
        <div className="srow"><b>Нуар по средам</b><span>12</span><span>live</span></div>
        <div className="srow"><b>Документалки</b><span>--</span><span>22:00</span></div>
      </section>
      <section className="pane"><div className="pt">~продолжить</div>
        <h2>Пустая дорога — режиссёрская версия</h2>
        <p>ночной кинозал · 6 · 01:12:44</p>
      </section>
      <section className="pane"><div className="pt">:new</div><h3>создать комнату</h3><p>:new</p></section>
      <section className="pane"><div className="pt">:join</div><h3>войти по коду</h3><p>7KQ-2M</p></section>
      <section className="pane"><div className="pt">#сезон</div><div className="heat-grid">{heatCells.slice(0, 49).map((name, index) => <i key={index} className={name} />)}</div></section>
      <section className="pane"><div className="pt">#афиша</div><p>Пятничный звук · 38</p></section>
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
