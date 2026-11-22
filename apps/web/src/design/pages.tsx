import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { favouriteLine, linkedLabel, roomPresetById, roomPresets, viewerPermissionKeys, type RoomPresetId } from "@lume/contracts";
import { permissionLabel } from "./copy.js";
import { useI18n } from "../i18n/context.js";
import { Modal } from "../ui/index.js";
import { initials, personHue, type ModeId, type StyleId } from "./theme.js";
import { RoomCodeInput } from "./RoomCodeInput.js";
import { AppearanceControls } from "./AppearanceControls.js";
import { ProfileView } from "./ProfileView.js";

export function SettingsScreen({
  style,
  mode,
  onStyle,
  onMode,
  token,
  apiUrl,
  blocked = [],
  onUnblock,
  globalBans = [],
  onRemoveGlobalBan,
}: {
  style: StyleId;
  mode: ModeId;
  onStyle: (style: StyleId) => void;
  onMode: (mode: ModeId) => void;
  token?: string;
  apiUrl?: string;
  blocked?: Array<{ id: string; displayName: string }>;
  onUnblock?: (id: string) => void;
  globalBans?: Array<{ id: string; userId: string; displayName: string; reason: string | null }>;
  onRemoveGlobalBan?: (userId: string) => void;
}) {
  const { t } = useI18n();
  const [telegramId, setTelegramId] = useState("");
  const [linked, setLinked] = useState(() => t("settings.linkedNone"));
  const [services, setServices] = useState<string[]>([]);
  const [friendsPublic, setFriendsPublic] = useState(true);
  const [historyPublic, setHistoryPublic] = useState(true);
  const [hideOther, setHideOther] = useState(false);
  useEffect(() => {
    if (!apiUrl) return;
    void fetch(`${apiUrl}/video/services`).then((response) => response.json()).then((payload: { services?: string[] }) => setServices(payload.services ?? [])).catch(() => setServices([]));
    if (!token) return;
    void fetch(`${apiUrl}/auth/linked-accounts`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { email?: boolean; telegram?: boolean }) => {
        setLinked(linkedLabel({ email: Boolean(payload.email), telegram: Boolean(payload.telegram) }));
      })
      .catch(() => setLinked(t("settings.linkedNo")));
    void fetch(`${apiUrl}/me`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { isFriendsPublic?: boolean; isWatchHistoryPublic?: boolean; hideOtherReactions?: boolean }) => {
        if (typeof payload.isFriendsPublic === "boolean") setFriendsPublic(payload.isFriendsPublic);
        if (typeof payload.isWatchHistoryPublic === "boolean") setHistoryPublic(payload.isWatchHistoryPublic);
        if (typeof payload.hideOtherReactions === "boolean") setHideOther(payload.hideOtherReactions);
      })
      .catch(() => undefined);
  }, [token, apiUrl, t]);
  return (
    <div className="settings-wrap">
      <aside>
        {([
          [t("settings.sectionAppearance"), "settings-appearance"],
          [t("settings.sectionAccount"), "settings-account"],
          [t("settings.sectionNotifications"), "settings-notifications"],
          [t("settings.sectionPrivacy"), "settings-privacy"],
          [t("settings.sectionLanguage"), "settings-language"],
          [t("settings.sectionPlayer"), "settings-player"],
          [t("settings.sectionVoice"), "settings-voice"],
        ] as const).map(([label, id], index) => (
          <button
            key={id}
            type="button"
            className={index === 0 ? "slink on" : "slink"}
            onClick={() => document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" })}
          >
            {label}
          </button>
        ))}
      </aside>
      <div className="panel" id="settings-appearance">
        <h2>{t("settings.appearanceTitle")}</h2>
        <p className="lead">{t("settings.appearanceBody")}</p>
        <AppearanceControls style={style} mode={mode} onStyle={onStyle} onMode={onMode} />
        <div className="set-row" id="settings-account">
          <div><b>Telegram</b><small>{linked}. {t("settings.unlinkHint")}</small></div>
          <div className="inline-actions">
            <input value={telegramId} onChange={(event) => setTelegramId(event.target.value)} placeholder="Telegram ID" aria-label="Telegram ID" />
            <button type="button" onClick={() => { if (!token || !apiUrl) return; void fetch(`${apiUrl}/auth/link-telegram`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ telegramId }) }); }}>{t("settings.link")}</button>
            <button type="button" onClick={() => { if (!token || !apiUrl) return; void fetch(`${apiUrl}/auth/unlink-telegram`, { method: "POST", headers: { authorization: `Bearer ${token}` } }); }}>{t("settings.unlink")}</button>
          </div>
        </div>
        <div className="set-row" id="settings-notifications"><div><b>{t("settings.sectionNotifications")}</b><small>{t("settings.notificationsHint")}</small></div></div>
        <div className="set-row" id="settings-privacy">
          <div><b>{t("settings.sectionPrivacy")}</b><small>{t("settings.privacyHint")}</small></div>
          <label className="check">
            <input
              data-testid="privacy-friends"
              type="checkbox"
              checked={friendsPublic}
              onChange={(event) => {
                const next = event.target.checked;
                setFriendsPublic(next);
                if (!token || !apiUrl) return;
                void fetch(`${apiUrl}/me`, { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ isFriendsPublic: next }) }).catch(() => setFriendsPublic(!next));
              }}
            />
            {t("settings.friendsVisible")}
          </label>
          <label className="check">
            <input
              data-testid="privacy-history"
              type="checkbox"
              checked={historyPublic}
              onChange={(event) => {
                const next = event.target.checked;
                setHistoryPublic(next);
                if (!token || !apiUrl) return;
                void fetch(`${apiUrl}/me`, { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ isWatchHistoryPublic: next }) }).catch(() => setHistoryPublic(!next));
              }}
            />
            {t("settings.historyVisible")}
          </label>
        </div>
        <div className="set-row">
          <div><b>{t("settings.blockedFriends")}</b><small>{t("settings.blockedFriendsHint")}</small>{blocked.map((row) => <small key={row.id}>{row.displayName} <button type="button" onClick={() => onUnblock?.(row.id)}>{t("settings.remove")}</button></small>)}{blocked.length === 0 ? <small>{t("settings.empty")}</small> : null}</div>
        </div>
        <div className="set-row" data-testid="global-blacklist">
          <div>
            <b>{t("settings.globalBlacklist")}</b>
            <small>{t("settings.globalBlacklistHint")}</small>
            {globalBans.length === 0 ? <small data-testid="global-blacklist-empty">{t("settings.empty")}</small> : null}
            {globalBans.map((row) => (
              <small key={row.id} data-testid="global-ban-row" data-user-id={row.userId}>
                {row.displayName}{row.reason ? ` · ${row.reason}` : ""}{" "}
                <button type="button" data-testid="global-ban-remove" onClick={() => onRemoveGlobalBan?.(row.userId)}>{t("settings.remove")}</button>
              </small>
            ))}
          </div>
        </div>
        <div className="set-row" id="settings-language"><div><b>{t("settings.language")}</b><small>{t("settings.russian")}</small></div></div>
        <div className="set-row"><div><b>{t("settings.services")}</b><small>{services.length === 0 ? t("settings.cobaltMissing") : services.join(", ")}</small></div></div>
        <div className="set-row" id="settings-voice"><div><b>{t("settings.sectionVoice")}</b><small>{t("settings.voiceHint")}</small></div></div>
        <div className="set-row"><div><b>HLS</b><small>{t("settings.hlsHint")}</small></div></div>
        <div className="set-row"><div><b>{t("settings.reactions")}</b><button type="button" onClick={() => { if (!token || !apiUrl) return; const next = !hideOther; setHideOther(next); void fetch(`${apiUrl}/me`, { method: "PATCH", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ hideOtherReactions: next }) }).catch(() => setHideOther(!next)); }}>{hideOther ? t("room.showOthers") : t("room.hideOthers")}</button></div></div>
        <div className="set-row"><div><b>Telegram</b><small>{linked.includes("Telegram") ? t("settings.telegramOn") : t("settings.telegramOff")}</small></div></div>
        <div className="set-row" id="settings-player"><div><b>{t("settings.sectionPlayer")}</b><small>{t("settings.playerHint")}</small></div></div>
        <div className="set-row">
          <div><b>{t("settings.deleteAccount")}</b><small>{t("settings.deleteHint")}</small></div>
          <button type="button" onClick={() => { if (!token || !apiUrl) return; if (!window.confirm(t("settings.deleteConfirm"))) return; void fetch(`${apiUrl}/me/delete`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ confirmation: "DELETE" }) }).catch(() => undefined); }}>{t("settings.delete")}</button>
          <button type="button" onClick={() => { if (!token || !apiUrl) return; void fetch(`${apiUrl}/me/restore`, { method: "POST", headers: { authorization: `Bearer ${token}` } }); }}>{t("settings.restore")}</button>
        </div>
      </div>
    </div>
  );
}

export function ProfileScreen({ token, apiUrl, userId, displayName, appearance }: { token?: string; apiUrl?: string; userId?: string; displayName?: string; appearance?: ReactNode } = {}) {
  const { locale, t } = useI18n();
  const [favourites, setFavourites] = useState<Array<{ url: string; title: string | null; watchCount: number }>>([]);
  const [history, setHistory] = useState<Array<{ url: string; title: string | null; watchCount: number; lastWatchedAt: string }>>([]);
  const [achievements, setAchievements] = useState<Array<{ key: string; title: string; icon: string; earned: boolean }>>([]);
  const [level, setLevel] = useState(1);
  const [totalXp, setTotalXp] = useState(0);
  const [nextLevelXp, setNextLevelXp] = useState(0);
  const [totalAchievements, setTotalAchievements] = useState(0);
  const [engagement, setEngagement] = useState<{
    watchSeconds: number;
    voiceSeconds: number;
    messages: number;
    reactions: number;
    totalSeconds: number;
    activity: number;
  } | null>(null);
  const [platforms, setPlatforms] = useState<Array<{ source: string; count: number }>>([]);
  const [friendsWatch, setFriendsWatch] = useState<Array<{ partnerId: string; seconds: number }>>([]);
  const [friends, setFriends] = useState<Array<{ id: string; userId: string; displayName: string; roomId?: string | null; roomTitle?: string | null }>>([]);
  const [incoming, setIncoming] = useState<Array<{ id: string; userId: string; displayName: string }>>([]);
  const [bio, setBio] = useState("");
  const [heat, setHeat] = useState<Array<{ day: string; score: number }>>([]);
  const [boards, setBoards] = useState<{ messages: LeaderboardRow[]; reactions: LeaderboardRow[]; voice: LeaderboardRow[] }>({ messages: [], reactions: [], voice: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [found, setFound] = useState<Array<{ id: string; displayName: string }>>([]);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [friendsVersion, setFriendsVersion] = useState(0);
  useEffect(() => {
    if (!token || !apiUrl) return;
    void fetch(`${apiUrl}/stats/leaderboard`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { messages?: LeaderboardRow[]; reactions?: LeaderboardRow[]; voice?: LeaderboardRow[] }) => setBoards({
        messages: payload.messages ?? [],
        reactions: payload.reactions ?? [],
        voice: payload.voice ?? [],
      }))
      .catch(() => setBoards({ messages: [], reactions: [], voice: [] }));
    void fetch(`${apiUrl}/me/studio`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { platforms?: Array<{ source: string; count: number }>; topFriends?: Array<{ partnerId: string; seconds: number }>; heatmap?: Array<{ day: string; score: number }> }) => {
        setPlatforms(payload.platforms ?? []);
        setFriendsWatch(payload.topFriends ?? []);
        setHeat(Array.isArray(payload.heatmap) ? payload.heatmap : []);
      })
      .catch(() => undefined);
    void fetch(`${apiUrl}/friends`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { friends?: typeof friends; incoming?: typeof incoming }) => {
        setFriends(payload.friends ?? []);
        setIncoming(payload.incoming ?? []);
      })
      .catch(() => {
        setFriends([]);
        setIncoming([]);
      });
    void fetch(`${apiUrl}/me`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { bio?: string | null }) => setBio(payload.bio ?? ""))
      .catch(() => setBio(""));
    void fetch(`${apiUrl}/me/favourites`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { items?: Array<{ url: string; title: string | null; watchCount: number }> }) => setFavourites(payload.items ?? []))
      .catch(() => setFavourites([]));
    void fetch(`${apiUrl}/me/achievements`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: {
        all?: Array<{ key: string; title: string; icon: string; earned: boolean }>;
        level?: number;
        totalXp?: number;
        nextLevelXp?: number;
        total?: number;
      }) => {
        if (Array.isArray(payload.all)) setAchievements(payload.all);
        if (typeof payload.level === "number") setLevel(payload.level);
        if (typeof payload.totalXp === "number") setTotalXp(payload.totalXp);
        if (typeof payload.nextLevelXp === "number") setNextLevelXp(payload.nextLevelXp);
        if (typeof payload.total === "number") setTotalAchievements(payload.total);
      })
      .catch(() => undefined);
    if (!userId) return;
    void fetch(`${apiUrl}/users/${userId}/watch-history`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => response.json())
      .then((payload: { items?: Array<{ url: string; title: string | null; watchCount: number; lastWatchedAt: string }> }) => setHistory(payload.items ?? []))
      .catch(() => setHistory([]));
    void fetch(`${apiUrl}/users/${userId}/engagement`, { headers: { authorization: `Bearer ${token}` } })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: typeof engagement) => setEngagement(payload))
      .catch(() => setEngagement(null));
  }, [token, apiUrl, userId, friendsVersion]);
  const earnedCount = achievements.filter((item) => item.earned).length;

  async function searchPeople(event: FormEvent) {
    event.preventDefault();
    if (!token || !apiUrl) return;
    const query = searchQuery.trim();
    if (!query) {
      setFound([]);
      return;
    }
    const response = await fetch(`${apiUrl}/users/search?q=${encodeURIComponent(query)}`, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) {
      setFound([]);
      return;
    }
    const payload = (await response.json()) as { users?: Array<{ id: string; displayName: string }> };
    setFound(payload.users ?? []);
  }

  async function openPublicProfile(personId: string) {
    if (!token || !apiUrl) return;
    const response = await fetch(`${apiUrl}/users/profile/${personId}`, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) {
      setPublicProfile(null);
      return;
    }
    setPublicProfile((await response.json()) as PublicProfile);
  }

  function addFriend(personId: string) {
    if (!token || !apiUrl) return;
    void fetch(`${apiUrl}/friends/request`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ userId: personId }),
    });
  }

  function answerFriend(id: string, action: "accept" | "decline") {
    if (!token || !apiUrl) return;
    void fetch(`${apiUrl}/friends/${id}/${action}`, { method: "POST", headers: { authorization: `Bearer ${token}` } })
      .then(() => setFriendsVersion((value) => value + 1));
  }

  function inviteFriend(roomId: string, friendId: string) {
    if (!token || !apiUrl) return;
    void fetch(`${apiUrl}/rooms/${roomId}/invite`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ userId: friendId }),
    });
  }

  const profileCard = (
        <div className="card" style={{ textAlign: "center" }}>
          <span className="av p-me ring" style={{ width: 80, height: 80, fontSize: 26, margin: "0 auto 10px" }}>{initials(displayName ?? t("profile.youFallback"))}</span>
          <b className="nm p-me" style={{ display: "block", font: "600 18px/22px var(--font-display)" }}>{displayName ?? t("profile.youFallback")}</b>
          <div style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4 }}>
            <span data-testid="profile-level">{t("profile.level", { level })}</span> · <span data-testid="profile-xp">{totalXp} XP</span>
          </div>
          <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 6 }} data-testid="profile-next-level">{t("profile.nextLevel", { xp: Math.max(0, nextLevelXp - totalXp) })}</p>
          {bio ? <p style={{ color: "var(--text-2)", fontSize: 12, marginTop: 6 }}>{bio}</p> : null}
        </div>
  );
  const awardCards = (items: typeof achievements, complete: boolean) => (
        <div className="card">
          <h3>{t("profile.achievements")}</h3>
          <ul className="profile-achievements-grid" data-testid={complete ? "profile-achievements" : undefined}>
            {items.map((item) => (
              <li key={item.key} className={item.earned ? "got" : ""} data-testid={complete ? "profile-achievement" : undefined} data-key={item.key} data-earned={String(item.earned)}>
                <span aria-hidden="true">{item.icon}</span><strong>{item.title.startsWith(item.icon) ? item.title.slice(item.icon.length).trim() : item.title}</strong>
                <small>{t(item.earned ? "profile.awardEarned" : "profile.awardLocked")}</small>
              </li>
            ))}
          </ul>
          <div className="dim" data-testid={complete ? "profile-achievements-count" : undefined}>{t("profile.openCount", { earned: earnedCount, total: totalAchievements })}</div>
        </div>
  );
  const friendsPanel = (<>
        <div className="card">
          <h3>{t("profile.friends")}</h3>
          {friends.length > 0 ? friends.slice(0, 5).map((friend) => (
            <div className="fr" key={friend.id}>
              <span className={`av lg p-${personHue(friend.userId)}`}>{initials(friend.displayName)}</span>
              <div><div className={`n p-${personHue(friend.userId)}`}>{friend.displayName}</div><div className="s">{friend.roomTitle ? t("profile.inRoomTitle", { title: friend.roomTitle }) : t("profile.inLume")}</div></div>
            </div>
          )) : <p className="empty-note">{t("profile.noFriends")}</p>}
        </div>
        {incoming.length > 0 ? (
          <div className="card">
            <h3>{t("profile.requests")}</h3>
            {incoming.map((row) => (
              <div className="fr" key={row.id}>
                <span className={`av lg p-${personHue(row.userId)}`}>{initials(row.displayName)}</span>
                <div><div className={`n p-${personHue(row.userId)}`}>{row.displayName}</div><div className="s">{t("profile.wantsToBeFriends")}</div></div>
                <span className="fr-actions">
                  <button type="button" className="mini" onClick={() => answerFriend(row.id, "accept")}>{t("profile.accept")}</button>
                  <button type="button" className="mini" onClick={() => answerFriend(row.id, "decline")}>{t("profile.decline")}</button>
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="card">
          <div className="heat-top"><h3>{t("profile.people")}</h3></div>
          <form className="friend-search-row" onSubmit={(event) => void searchPeople(event)}>
            <input data-testid="friend-search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t("profile.searchPeople")} aria-label={t("profile.searchPeopleAria")} />
            <button type="submit" className="btn btn-outline">{t("profile.search")}</button>
          </form>
          {found.length > 0 ? (
            <div className="people-results">
              {found.map((person) => (
                <div className="fr" key={person.id} data-testid="friend-result">
                  <span className={`av lg p-${personHue(person.id)}`}>{initials(person.displayName)}</span>
                  <div><div className={`n p-${personHue(person.id)}`}>{person.displayName}</div><div className="s">{t("profile.foundInLume")}</div></div>
                  <span className="fr-actions">
                    <button type="button" className="mini" data-testid="people-open-profile" onClick={() => void openPublicProfile(person.id)}>{t("profile.profileAction")}</button>
                    <button type="button" className="mini go" onClick={() => addFriend(person.id)}>{t("profile.addFriendAction")}</button>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {publicProfile ? (
            <section className="card public-profile" data-testid="public-profile">
              <h3 data-testid="public-profile-name">{publicProfile.displayName}</h3>
              <p data-testid="public-profile-level">{t("profile.level", { level: publicProfile.level })}{publicProfile.username && !publicProfile.username.includes(":") ? ` · ${publicProfile.username}` : ""}</p>
              {publicProfile.bio ? <p>{publicProfile.bio}</p> : null}
              <div data-testid="public-profile-history">
                <b>{t("profile.watchHistory")}</b>
                {publicProfile.watchHistory === null ? <p>{t("profile.hidden")}</p> : publicProfile.watchHistory.length === 0 ? <p>{t("profile.nothingYet")}</p> : (
                  <ul>
                    {publicProfile.watchHistory.map((item) => (
                      <li key={item.url} data-testid="public-profile-history-item" data-url={item.url}>{item.title || item.url} · {item.watchCount}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div data-testid="public-profile-friends">
                <b>{t("profile.friendsTitle")}</b>
                {publicProfile.friends === null ? <p>{t("profile.hidden")}</p> : publicProfile.friends.length === 0 ? <p>{t("profile.nothingYet")}</p> : (
                  <ul>{publicProfile.friends.map((friend) => <li key={friend.id}>{friend.displayName}</li>)}</ul>
                )}
              </div>
            </section>
          ) : null}
          {friends.length > 0 ? (
            <div className="people-results">
              {friends.map((friend) => (
                <div className="fr" key={friend.id}>
                  <span className={`av lg p-${personHue(friend.userId)}`}>{initials(friend.displayName)}</span>
                  <div><div className={`n p-${personHue(friend.userId)}`}>{friend.displayName}</div><div className="s">{friend.roomTitle ? t("profile.inRoomTitle", { title: friend.roomTitle }) : t("profile.inLume")}</div></div>
                  {friend.roomId ? <button type="button" className="mini" onClick={() => inviteFriend(friend.roomId!, friend.userId)}>{t("profile.invite")}</button> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
  </>);
  const overview = (<>
        <div className="card" data-testid="profile-engagement">
          <h3>{t("profile.engagement")}</h3>
          <dl className="grid3">
            <div><dt>{t("profile.watchSeconds")}</dt><dd data-testid="engagement-watch" data-seconds={engagement?.watchSeconds ?? 0}>{engagement ? formatSeconds(engagement.watchSeconds, t) : "—"}</dd></div>
            <div><dt>{t("profile.voiceSeconds")}</dt><dd data-testid="engagement-voice" data-seconds={engagement?.voiceSeconds ?? 0}>{engagement ? formatSeconds(engagement.voiceSeconds, t) : "—"}</dd></div>
            <div><dt>{t("profile.messages")}</dt><dd data-testid="engagement-messages" data-count={engagement?.messages ?? 0}>{engagement?.messages ?? "—"}</dd></div>
            <div><dt>{t("profile.reactions")}</dt><dd data-testid="engagement-reactions" data-count={engagement?.reactions ?? 0}>{engagement?.reactions ?? "—"}</dd></div>
          </dl>
          {engagement ? <div className="stats" data-testid="engagement-total" data-seconds={engagement.totalSeconds}>
            {t("profile.totalActions", { time: formatSeconds(engagement.totalSeconds, t), count: engagement.activity })}
          </div> : null}
        </div>
        <div data-testid="leaderboards">
          <h3>{t("profile.board")}</h3>
          {(["messages", "reactions", "voice"] as const).map((board) => (
            <div key={board} data-testid={`profile-leaderboard-${board}`}>
              <b>{board === "messages" ? t("profile.boardMessages") : board === "reactions" ? t("profile.boardReactions") : t("profile.boardVoice")}</b>
              {boards[board].length === 0 ? <p>{t("profile.nothingYet")}</p> : boards[board].map((row) => (
                <p key={row.userId} data-testid={`leaderboard-${board}-row`} data-user-id={row.userId} data-value={row.value}>{row.displayName} · {row.value}</p>
              ))}
            </div>
          ))}
        </div>
  </>);
  const historyPanel = (<div className="card profile-history-panel">
        <h3>{t("profile.watchHistory")}</h3>
        <ul data-testid="profile-history">
          {history.length === 0 ? <li>{t("profile.nothingYet")}</li> : history.map((item) => (
            <li key={item.url} data-testid="profile-history-item" data-url={item.url} data-watch-count={item.watchCount}>
              {item.title || item.url} · {item.watchCount} · {new Date(item.lastWatchedAt).toLocaleDateString("ru-RU")}
            </li>
          ))}
        </ul>
        <h3>{t("profile.platforms")}</h3>
        {platforms.length === 0 ? <p>{t("profile.nothingYet")}</p> : platforms.map((item) => <p key={item.source}>{item.source} · {item.count}</p>)}
        <h3>{t("profile.sessionsWithFriends")}</h3>
        {friendsWatch.length === 0 ? <p>{t("profile.nothingYet")}</p> : friendsWatch.map((item) => <p key={item.partnerId}>{item.partnerId} · {t("profile.secondsShort", { seconds: item.seconds })}</p>)}
        <h3>{t("profile.favourites")}</h3>
        <div data-testid="profile-favourites">
          {favourites.length === 0 ? <p>{t("profile.nothingYet")}</p> : favourites.map((item) => (
            <p key={item.url} data-testid="profile-favourite" data-url={item.url} data-watch-count={item.watchCount}>
              {favouriteLine(item.title, item.watchCount)}
            </p>
          ))}
        </div>
        <h3>{t("profile.recentVideos")}</h3>
        {history.length > 0 ? (
          <div className="rooms">
            {history.slice(0, 3).map((item) => (
              <div key={item.url} className="rc"><div className="th" /><div className="bd"><b>{item.title || item.url}</b><div className="meta"><span className="viewers">{t("profile.watchedTimes", { count: item.watchCount })}</span></div></div></div>
            ))}
          </div>
        ) : <p className="empty-note">{t("profile.noRecentRooms")}</p>}
  </div>);

  return (
    <ProfileView
      locale={locale}
      labels={{ tabsLabel: t("profile.sections"), tabs: { overview: t("profile.overviewTab"), history: t("profile.historyTab"), friends: t("profile.friends"), awards: t("profile.achievements") }, season: t("profile.season"), seasonEmpty: t("gruvbox.seasonEmpty"), seasonScore: (score) => t("profile.seasonScore", { score }) }}
      profileCard={profileCard}
      achievements={awardCards(achievements.slice(0, 4), false)}
      kpis={[
        { label: t("profile.levelLabel"), value: level },
        { label: t("profile.xpLabel"), value: `${totalXp} XP` },
        { label: t("profile.achievementsLabel"), value: t("profile.earnedOf", { earned: earnedCount, total: totalAchievements }) },
      ]}
      season={heat.some((cell) => cell.score > 0) ? heat.slice(-119) : []}
      settings={appearance}
      overviewExtra={overview}
      history={historyPanel}
      friends={friendsPanel}
      awards={awardCards(achievements, true)}
    />
  );
}

interface LeaderboardRow {
  userId: string;
  displayName: string;
  value: number;
}

interface PublicProfile {
  id: string;
  displayName: string;
  username: string | null;
  bio: string | null;
  level: number;
  watchHistory: Array<{ url: string; title: string | null; watchCount: number }> | null;
  friends: Array<{ id: string; displayName: string }> | null;
}

function formatSeconds(seconds: number, t: (key: "time.minutesSeconds" | "time.seconds", params?: Record<string, number>) => string): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return minutes > 0 ? t("time.minutesSeconds", { minutes, seconds: rest }) : t("time.seconds", { seconds: rest });
}

export function AuthScreen({ onTelegram, name, onName, onEmail, onRegister }: {
  onTelegram: () => void;
  name: string;
  onName: (value: string) => void;
  onEmail: (event: FormEvent) => void;
  onRegister: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [password, setPassword] = useState("");
  return (
    <div className="auth-wrap">
      <div className="brand">
        <div className="logo"><i className="spot" />lume</div>
        <h1>{t("auth.heroTitle")}</h1>
        <p>{t("auth.heroBody")}</p>
      </div>
      <form className="auth-card" onSubmit={tab === "register" ? onRegister : onEmail}>
        <div className="tabs2">
          <button type="button" className={tab === "login" ? "tab on" : "tab"} onClick={() => setTab("login")}>{t("auth.loginTab")}</button>
          <button type="button" className={tab === "register" ? "tab on" : "tab"} onClick={() => setTab("register")}>{t("auth.registerTab")}</button>
        </div>
        <button type="button" className="tg-btn" onClick={onTelegram}>{t("mobile.telegram")}</button>
        <div className="or">{t("auth.orEmail")}</div>
        <label className="field">{t("auth.email")}<input data-testid="lobby-name" value={name} onChange={(event) => onName(event.target.value)} placeholder="albert@example.com" /></label>
        <label className="field">{t("auth.password")}<input name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {tab === "register" ? <label className="field">{t("auth.name")}<input name="displayName" defaultValue={name.split("@")[0] || t("auth.guest")} /></label> : null}
        <button className="btn btn-primary" type="submit" data-testid="lobby-sign-in">{tab === "register" ? t("auth.register") : t("auth.login")}</button>
      </form>
    </div>
  );
}

export function PremiumScreen() {
  const { t } = useI18n();
  return (
    <div className="wrap shop-wrap">
      <h1>{t("premium.title")}</h1>
      <p className="lead">{t("premium.body")}</p>
      <div className="empty">
        <h2>{t("premium.emptyTitle")}</h2>
        <p>{t("premium.emptyBody")}</p>
      </div>
    </div>
  );
}

export function NotificationsScreen({ items }: { items: Array<{ id: string; kind: string; title: string; body: string }> }) {
  const { t } = useI18n();
  return (
    <div className="notifications-page">
      <aside className="npanel">
        <div className="mh"><h2>{t("notifications.title")}</h2><span className="sp" /><span>{items.length}</span></div>
        {items.length === 0 ? <p className="empty-note">{t("profile.noNotifications")}</p> : items.map((item) => (
          <div className="nitem" key={item.id} data-kind={item.kind}><div><div className="t">{item.title}</div><div className="s">{item.body}</div></div></div>
        ))}
      </aside>
    </div>
  );
}

export function CreateScreen({ title, onTitle, preset, onPreset, onSubmit, onCancel, busy = false }: {
  title: string;
  onTitle: (value: string) => void;
  preset: RoomPresetId | null;
  onPreset: (value: RoomPresetId) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const { t } = useI18n();
  const chosen = preset ? roomPresetById(preset) : null;
  return (
    <Modal
      open
      title={t("create.title")}
      onClose={() => onCancel?.()}
      lg
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>{t("join.back")}</button>
          <button className="btn btn-primary" type="submit" form="create-room-form" data-testid="lobby-create" disabled={busy}>
            {busy ? t("create.creating") : t("create.submit")}
          </button>
        </>
      }
    >
      <form id="create-room-form" onSubmit={onSubmit} className="create-form">
        <p className="lead">{t("create.step")}</p>
        <div className="steps"><span className="on" /><span className="on" /><span /></div>
        <label className="field">{t("create.roomName")}
          <input data-testid="lobby-title" value={title} onChange={(event) => onTitle(event.target.value)} placeholder={t("create.namePlaceholder")} autoFocus />
        </label>
        <div>
          <div className="choice-label">{t("create.preset")}</div>
          <div className="chips" data-testid="create-presets">
            {roomPresets.map((item) => (
              <button
                key={item.id}
                type="button"
                className={preset === item.id ? "pill on" : "pill"}
                data-testid={`create-preset-${item.id}`}
                onClick={() => {
                  onPreset(item.id);
                  onTitle(item.title);
                }}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="choice-label">{t("create.who")}</div>
          <div className="choices">
            <div className={chosen && !chosen.isPublic ? "choice on" : "choice"}><b>{t("create.byCode")}</b><p>{t("create.byCodeHint")}</p></div>
            <div className={chosen?.isPublic ? "choice on" : "choice"}><b>{t("create.public")}</b><p>{t("create.publicHint")}</p></div>
          </div>
        </div>
        {chosen ? (
          <p className="lead" data-testid="create-preset-summary" data-max={chosen.maxMembers} data-public={chosen.isPublic ? "true" : "false"} data-slow={chosen.slowModeSeconds}>
            {chosen.hint} · {t("create.limit", { count: chosen.maxMembers })}
          </p>
        ) : null}
        <div>
          <div className="choice-label">{t("create.rights")}</div>
          <div className="choices" data-testid="create-preset-rights">
            {viewerPermissionKeys.map((key) => (
              <div key={key} className={chosen?.defaults[key] ? "choice on" : "choice"}>
                <b>{permissionLabel(key, t)}</b>
                <p>{chosen ? (chosen.defaults[key] ? t("create.allowed") : t("create.denied")) : t("create.fromPreset")}</p>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function JoinScreen({ code, codeInvalid, onCode, onSubmit, onCancel }: { code: string; codeInvalid: boolean; onCode: (value: string) => void; onSubmit: (event: FormEvent) => void; onCancel?: () => void }) {
  const { t } = useI18n();
  return (
    <Modal
      open
      title={t("join.title")}
      onClose={() => onCancel?.()}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>{t("common.cancel")}</button>
          <button className="btn btn-primary" type="submit" form="join-room-form" data-testid="lobby-join">{t("auth.login")}</button>
        </>
      }
    >
      <form id="join-room-form" onSubmit={onSubmit}>
        <p className="lead">{t("join.subtitle")}</p>
        <RoomCodeInput value={code} onChange={onCode} invalid={codeInvalid} autoFocus />
        <p className="lead">{t("join.hint")}</p>
      </form>
    </Modal>
  );
}

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  return (
    <div className="overlay docked"><div className="modal">
      <div className="mh"><h2>{t("onboarding.welcome")}</h2><span>{t("onboarding.step")}</span></div>
      <div className="mb">
        <div className="steps"><span className="on" /><span /><span /></div>
        <h3>{t("onboarding.title")}</h3>
        <p>{t("onboarding.body")}</p>
      </div>
      <div className="mf"><button type="button" className="btn btn-ghost" onClick={onDone}>{t("join.skip")}</button><button type="button" className="btn btn-primary" onClick={onDone}>{t("join.next")}</button></div>
    </div></div>
  );
}

export function EmptyScreen({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="page-body"><div className="empty"><h2>{title}</h2>{body ? <p>{body}</p> : null}{action}</div></div>
  );
}

