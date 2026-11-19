import { imageKind, notificationChannels, notificationKinds } from "@lume/contracts";
import { useEffect, useCallback, useState, type FormEvent } from "react";
import { api, apiUrl, ClientError } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import type { ClientSession } from "../session.js";
import { AdminScreen } from "./AdminScreen.js";

export function PeopleScreen({ session, onOpen }: { session: ClientSession; onOpen?: (roomId: string) => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Array<{ id: string; displayName: string }>>([]);
  const [incoming, setIncoming] = useState<Array<{ id: string; displayName: string }>>([]);
  const [friends, setFriends] = useState<Array<{ id: string; userId: string; displayName: string; roomId?: string | null; roomTitle?: string | null }>>([]);
  const [heatmap, setHeatmap] = useState<Array<{ day: string; score: number }>>([]);
  const [platforms, setPlatforms] = useState<Array<{ source: string; count: number }>>([]);
  const [hostRooms, setHostRooms] = useState(0);
  const [achievements, setAchievements] = useState<Array<{ key: string; title: string; pinSlot: number | null }>>([]);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [topFriends, setTopFriends] = useState<Array<{ partnerId: string; seconds: number }>>([]);
  const [digestCount, setDigestCount] = useState(0);
  const [boards, setBoards] = useState<Leaderboards>({ messages: [], reactions: [], voice: [] });
  const [bio, setBio] = useState("");
  const [notes, setNotes] = useState<Array<{ id: string; title: string; body: string }>>([]);
  const [resume, setResume] = useState<string | null>(null);
  const [favourites, setFavourites] = useState<Array<{ url: string; title: string | null }>>([]);
  const [studio, setStudio] = useState<string | null>(null);
  const [admin, setAdmin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<{ email: boolean; telegram: boolean } | null>(null);
  const [telegramId, setTelegramId] = useState("");

  const reload = useCallback(async () => {
    const [list, feed, card, profile] = await Promise.all([
      api.friends(session.accessToken),
      api.notifications(session.accessToken),
      api.resume(session.accessToken),
      fetch(`${apiUrl}/me/studio`, { headers: { authorization: `Bearer ${session.accessToken}` } }).then((response) => response.json()),
    ]);
    void api.linkedAccounts(session.accessToken).then(setLinked).catch(() => undefined);
    void fetch(`${apiUrl}/me/favourites`, { headers: { authorization: `Bearer ${session.accessToken}` } })
      .then((response) => response.json())
      .then((payload: { items?: Array<{ url: string; title: string | null }> }) => setFavourites(payload.items ?? []))
      .catch(() => setFavourites([]));
    setStudio(typeof profile.level === "number" ? `${t("studio.title")} ${profile.level}` : null);
    setHeatmap(Array.isArray(profile.heatmap) ? profile.heatmap : []);
    setPlatforms(Array.isArray(profile.platforms) ? profile.platforms : []);
    setHostRooms(profile.host?.roomsHosted ?? 0);
    setAchievements(Array.isArray(profile.achievements) ? profile.achievements : []);
    setTopFriends(Array.isArray(profile.topFriends) ? profile.topFriends : []);
    setBio(typeof profile.bio === "string" ? profile.bio : "");
    const preview = await fetch(`${apiUrl}/notifications/digest-preview`, { headers: { authorization: `Bearer ${session.accessToken}` } }).then((response) => response.json());
    setDigestCount(preview.count ?? 0);
    void fetch(`${apiUrl}/stats/leaderboard`, { headers: { authorization: `Bearer ${session.accessToken}` } })
      .then((response) => response.json())
      .then((payload: Partial<Leaderboards>) => setBoards({
        messages: Array.isArray(payload.messages) ? payload.messages : [],
        reactions: Array.isArray(payload.reactions) ? payload.reactions : [],
        voice: Array.isArray(payload.voice) ? payload.voice : [],
      }))
      .catch(() => setBoards({ messages: [], reactions: [], voice: [] }));
    if (profile.role === "ADMIN" || profile.role === "SUPERADMIN") {
      const overview = await fetch(`${apiUrl}/admin/overview`, { headers: { authorization: `Bearer ${session.accessToken}` } }).then((response) => response.json());
      setAdmin(`${t("admin.title")} ${overview.users ?? 0}`);
    }
    setIncoming(list.incoming);
    setFriends(list.friends);
    setNotes(feed.notifications.filter((item) => !item.read));
    setResume(card.resume ? `${card.resume.title} · ${card.resume.queueCount}` : null);
  }, [session.accessToken, t]);

  useEffect(() => {
    void reload().catch(() => setError("request_failed"));
    const pending = sessionStorage.getItem("lume-pending-user");
    if (!pending) return;
    sessionStorage.removeItem("lume-pending-user");
    void fetch(`${apiUrl}/users/${pending}`)
      .then((response) => response.json())
      .then((payload: { displayName?: string }) => {
        setProfileName(payload.displayName ?? null);
      })
      .catch(() => setProfileName(null));
  }, [reload]);

  async function search(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const result = await api.searchUsers(session.accessToken, query.trim());
      setFound(result.users);
    } catch (caught) {
      setError(caught instanceof ClientError ? caught.code : "request_failed");
    }
  }

  async function openPublicProfile(userId: string) {
    setError(null);
    const response = await fetch(`${apiUrl}/users/profile/${userId}`, {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    if (!response.ok) {
      setError(response.status === 403 ? "private" : "request_failed");
      return;
    }
    setPublicProfile((await response.json()) as PublicProfile);
  }

  return (
    <section className="tr-lobby" data-testid="people">
      <h2>{t("people.title")}</h2>
      {resume ? (
        <p data-testid="resume-card">
          {t("people.resume")} {resume}{" "}
          <button type="button" className="tr-text-button" onClick={() => {
            void fetch(`${apiUrl}/rooms/resume-last`, { method: "POST", headers: { authorization: `Bearer ${session.accessToken}` } })
              .then((response) => response.json())
              .then((payload: { room?: { id: string } }) => { if (payload.room && onOpen) onOpen(payload.room.id); });
          }}>{t("people.resume")}</button>
        </p>
      ) : <p className="tr-empty">{t("people.noResume")}</p>}
      <button type="button" className="tr-text-button" onClick={() => void fetch(`${apiUrl}/me/restore`, { method: "POST", headers: { authorization: `Bearer ${session.accessToken}` } })}>
        {t("people.restore")}
      </button>
      {studio ? <p data-testid="studio">{studio}</p> : null}
      {favourites.map((item) => <p key={item.url}>{item.title || item.url}</p>)}
      {admin ? <AdminScreen token={session.accessToken} /> : null}
      <div data-testid="heatmap" aria-label={t("studio.heat")}>
        {heatmap.filter((day) => day.score > 0).slice(0, 12).map((day) => (
          <i key={day.day} title={`${day.day} ${day.score}`} />
        ))}
      </div>
      <ul data-testid="platforms">
        {platforms.map((item) => <li key={item.source}>{item.source} {item.count}</li>)}
      </ul>
      <p data-testid="host-stats">{t("studio.hosted")} {hostRooms}</p>
      <section data-testid="leaderboards">
        <h3>{t("people.leaderboard")}</h3>
        {(["messages", "reactions", "voice"] as const).map((board) => (
          <div key={board} data-testid={`leaderboard-${board}`}>
            <b>{board === "messages" ? t("people.leaderboardMessages") : board === "reactions" ? t("people.leaderboardReactions") : t("people.leaderboardVoice")}</b>
            {boards[board].length === 0 ? <p className="tr-empty">{t("people.empty")}</p> : (
              <ol>
                {boards[board].map((row) => (
                  <li key={row.userId} data-testid={`leaderboard-${board}-row`} data-user-id={row.userId} data-value={row.value}>
                    {row.displayName} · {row.value}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </section>
      <ul data-testid="top-friends">
        {topFriends.map((friend) => <li key={friend.partnerId}>{friend.partnerId} {friend.seconds}</li>)}
      </ul>
      <p data-testid="digest-count">{t("people.digest")} {digestCount}</p>
      <div data-testid="notify-grid">
        {notificationChannels.flatMap((channel) => notificationKinds.map((kind) => (
          <label key={`${channel}-${kind}`} className="tr-check">
            <input
              type="checkbox"
              defaultChecked
              onChange={(event) => {
                void fetch(`${apiUrl}/me/notification-preferences`, {
                  method: "PUT",
                  headers: { "content-type": "application/json", authorization: `Bearer ${session.accessToken}` },
                  body: JSON.stringify({ channel, kind, enabled: event.target.checked }),
                });
              }}
            />
            {channel} {kind}
          </label>
        )))}
      </div>
      <form onSubmit={(event) => {
        event.preventDefault();
        void fetch(`${apiUrl}/me`, {
          method: "PATCH",
          headers: { "content-type": "application/json", authorization: `Bearer ${session.accessToken}` },
          body: JSON.stringify({ bio }),
        });
      }}>
        <label>
          {t("studio.bio")}
          <input value={bio} onChange={(event) => setBio(event.target.value)} maxLength={100} />
        </label>
      </form>
      <div data-testid="pin-slots">
        {[0, 1, 2].map((slot) => {
          const pinned = achievements.find((item) => item.pinSlot === slot);
          const next = achievements.find((item) => item.pinSlot === null);
          return (
            <button
              key={slot}
              type="button"
              className="tr-text-button"
              onClick={() => {
                if (!next) return;
                void fetch(`${apiUrl}/me/achievements/${next.key}/pin`, {
                  method: "PATCH",
                  headers: { "content-type": "application/json", authorization: `Bearer ${session.accessToken}` },
                  body: JSON.stringify({ slot }),
                }).then(() => reload());
              }}
            >
              {pinned?.title ?? `${t("studio.pin")} ${slot + 1}`}
            </button>
          );
        })}
      </div>
      <label>
        {t("studio.avatar")}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void cropAndUpload(file, session.accessToken).then(() => reload());
          }}
        />
      </label>
      {profileName ? <p data-testid="public-profile">{profileName}</p> : null}
      <button
        type="button"
        className="tr-text-button"
        onClick={() => {
          void fetch(`${apiUrl}/me/export`, { method: "POST", headers: { authorization: `Bearer ${session.accessToken}` } })
            .then((response) => response.json())
            .then((payload: { token?: string }) => {
              if (payload.token) window.location.assign(`${apiUrl}/me/export/${payload.token}`);
            });
        }}
      >
        {t("people.export")}
      </button>
      <p>{linked?.email ? "email" : ""} {linked?.telegram ? "Telegram" : ""}</p>
      <label>
        Telegram
        <input value={telegramId} onChange={(event) => setTelegramId(event.target.value)} />
      </label>
      <button type="button" className="tr-text-button" onClick={() => void api.linkTelegram(session.accessToken, telegramId).then(() => reload())}>
        Telegram
      </button>
      <button type="button" className="tr-text-button" onClick={() => void api.unlinkTelegram(session.accessToken).then(() => reload())}>
        {t("lobby.signOut")}
      </button>
      <label className="tr-check">
        <input
          type="checkbox"
          onChange={(event) => {
            void fetch(`${apiUrl}/me/notification-preferences`, {
              method: "PUT",
              headers: { "content-type": "application/json", authorization: `Bearer ${session.accessToken}` },
              body: JSON.stringify({
                channel: "telegram",
                kind: "ROOM_INVITE",
                enabled: true,
                quietHoursEnabled: event.target.checked,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              }),
            });
          }}
        />
        {t("people.quiet")}
      </label>
      <form onSubmit={(event) => {
        event.preventDefault();
        const minutes = Number(new FormData(event.currentTarget).get("minutes"));
        if (Number.isFinite(minutes)) {
          void fetch(`${apiUrl}/rooms/${session.user.id}/reminders`, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${session.accessToken}` },
            body: JSON.stringify({ minutes }),
          });
        }
      }}>
        <label>
          {t("people.remind")}
          <input name="minutes" type="number" min={5} max={10080} defaultValue={60} />
        </label>
      </form>
      <form onSubmit={(event) => void search(event)}>
        <label>
          {t("people.search")}
          <input data-testid="friend-search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button type="submit" className="tr-text-button">{t("people.find")}</button>
      </form>
      {error ? <p className="tr-note">{error}</p> : null}
      <ul>
        {found.map((user) => (
          <li key={user.id}>
            {user.displayName}{" "}
            <button type="button" className="tr-text-button" data-testid="people-open-profile" onClick={() => void openPublicProfile(user.id)}>
              {t("people.profile")}
            </button>
            <button type="button" className="tr-text-button" onClick={() => void api.requestFriend(session.accessToken, user.id).then(reload)}>
              {t("people.request")}
            </button>
          </li>
        ))}
      </ul>
      {publicProfile ? (
        <section className="card" data-testid="public-profile">
          <h3 data-testid="public-profile-name">{publicProfile.displayName}</h3>
          <p data-testid="public-profile-level">
            {t("people.level")} {publicProfile.level}
            {publicProfile.username ? ` · ${publicProfile.username}` : ""}
          </p>
          {publicProfile.bio ? <p>{publicProfile.bio}</p> : null}
          <div data-testid="public-profile-history">
            <b>{t("people.history")}</b>
            {publicProfile.watchHistory === null ? <p>{t("people.hidden")}</p> : publicProfile.watchHistory.length === 0 ? <p>{t("people.empty")}</p> : (
              <ul>
                {publicProfile.watchHistory.map((item) => (
                  <li key={item.url} data-testid="public-profile-history-item" data-url={item.url}>
                    {item.title || item.url} · {item.watchCount}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div data-testid="public-profile-friends">
            <b>{t("people.friendsLabel")}</b>
            {publicProfile.friends === null ? <p>{t("people.hidden")}</p> : publicProfile.friends.length === 0 ? <p>{t("people.empty")}</p> : (
              <ul>
                {publicProfile.friends.map((friend) => <li key={friend.id}>{friend.displayName}</li>)}
              </ul>
            )}
          </div>
        </section>
      ) : null}
      <h3>{t("people.incoming")}</h3>
      {incoming.length === 0 ? <p className="tr-empty">{t("people.none")}</p> : null}
      <ul>
        {incoming.map((row) => (
          <li key={row.id}>
            {row.displayName}{" "}
            <button type="button" className="tr-text-button" data-testid="friend-accept" onClick={() => void api.acceptFriend(session.accessToken, row.id).then(reload)}>
              {t("people.accept")}
            </button>
            <button type="button" className="tr-text-button" onClick={() => void api.declineFriend(session.accessToken, row.id).then(reload)}>
              {t("people.decline")}
            </button>
          </li>
        ))}
      </ul>
      <h3>{t("people.friends")}</h3>
      {friends.length === 0 ? <p className="tr-empty">{t("people.none")}</p> : null}
      <ul data-testid="friend-list">
        {friends.map((row) => (
          <li key={row.id}>
            {row.displayName}
            {row.roomTitle ? <span> {t("people.inRoom")} {row.roomTitle}</span> : null}
            <button type="button" className="tr-text-button" onClick={() => void fetch(`${apiUrl}/rooms/${row.roomId ?? "none"}/invite`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session.accessToken}` }, body: JSON.stringify({ userId: row.userId }) })}>
              {t("people.invite")}
            </button>
          </li>
        ))}
      </ul>
      <h3>{t("people.inbox")}</h3>
      {notes.length === 0 ? <p className="tr-empty">{t("people.none")}</p> : null}
      <ul data-testid="inbox">
        {notes.map((note) => (
          <li key={note.id}>{note.title}: {note.body}</li>
        ))}
      </ul>
    </section>
  );
}

interface LeaderboardRow {
  userId: string;
  displayName: string;
  value: number;
}

interface Leaderboards {
  messages: LeaderboardRow[];
  reactions: LeaderboardRow[];
  voice: LeaderboardRow[];
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

async function cropAndUpload(file: File, token: string) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!imageKind(bytes)) return;
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) return;
  const raw = new Uint8Array(await blob.arrayBuffer());
  let dataBase64 = "";
  for (const byte of raw) dataBase64 += String.fromCharCode(byte);
  const uploaded = await fetch(`${apiUrl}/uploads`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ dataBase64: btoa(dataBase64) }),
  });
  const payload = (await uploaded.json()) as { url?: string };
  if (!payload.url) return;
  await fetch(`${apiUrl}/me`, {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ avatarUrl: `${apiUrl}${payload.url}` }),
  });
}
