import type { RoomSummary } from "@lume/contracts";
import { useEffect, useState, type FormEvent } from "react";
import { api, ClientError } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import type { ClientSession } from "../session.js";
import { PeopleScreen } from "./PeopleScreen.js";

export function Lobby({
  session,
  onSession,
  onSignOut,
  onOpen,
}: {
  session: ClientSession | null;
  onSession: (session: ClientSession) => void;
  onSignOut: () => void;
  onOpen: (roomId: string) => void;
}) {
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [code, setCode] = useState("");
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [browseQuery, setBrowseQuery] = useState("");
  const [browseSort, setBrowseSort] = useState<"new" | "title">("new");
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  const [magicToken, setMagicToken] = useState("");

  useEffect(() => {
    const pending = sessionStorage.getItem("lume-pending-room");
    const fromQuery = new URLSearchParams(window.location.search).get("code");
    if (fromQuery) setCode(fromQuery);
    else if (pending) setCode(pending);
  }, []);

  useEffect(() => {
    let stopped = false;
    void api
      .listRooms()
      .then((result) => {
        if (!stopped) {
          setRooms(result.rooms);
        }
      })
      .catch(() => {
        if (!stopped) {
          setRooms([]);
        }
      });
    return () => {
      stopped = true;
    };
  }, [session?.user.id]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const result = await api.devLogin(displayName.trim() || t("voice.you"));
      onSession({
        accessToken: result.accessToken,
        ...(result.refreshToken ? { refreshToken: result.refreshToken } : {}),
        user: result.user,
      });
    } catch (caught) {
      setError(caught instanceof ClientError ? caught.code : "request_failed");
    }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      return;
    }
    setError(null);
    try {
      const result = await api.createRoom(session.accessToken, title.trim() || t("lobby.kicker"), isPublic);
      onOpen(result.room.id);
    } catch (caught) {
      setError(caught instanceof ClientError ? caught.code : "request_failed");
    }
  }

  async function join(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      return;
    }
    setError(null);
    try {
      const result = await api.joinRoom(session.accessToken, code.trim());
      onOpen(result.room.id);
    } catch (caught) {
      setError(caught instanceof ClientError ? caught.code : "request_failed");
    }
  }

  return (
    <section className="tr-lobby" data-testid={session ? "home" : "landing"}>
      <p className="tr-kicker">{t("lobby.kicker")}</p>
      <h1>{t("lobby.title")}</h1>
      <p className="tr-lead">{t("lobby.body")}</p>
      {session ? (
        <p>
          {session.user.displayName}{" "}
          <button type="button" className="tr-text-button" data-testid="open-people" onClick={() => setPeople((value) => !value)}>
            {t("people.title")}
          </button>{" "}
          <button type="button" className="tr-text-button" onClick={() => { window.history.pushState({}, "", "/admin"); window.dispatchEvent(new PopStateEvent("popstate")); }}>
            {t("admin.title")}
          </button>{" "}
          <button type="button" className="tr-text-button" onClick={() => {
            if (session.refreshToken) void api.logout(session.refreshToken).catch(() => undefined);
            onSignOut();
          }}>
            {t("lobby.signOut")}
          </button>
        </p>
      ) : (
        <form onSubmit={(event) => void signIn(event)}>
          <label>
            {t("lobby.displayName")}
            <input
              data-testid="lobby-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <button type="submit" className="tr-primary" data-testid="lobby-sign-in">
            {t("lobby.signIn")}
          </button>
        </form>
      )}
      {!session ? (
        <form onSubmit={(event) => {
          event.preventDefault();
          void fetch(`${import.meta.env.VITE_API_URL || "http://127.0.0.1:3001"}/auth/magic-link`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: magicEmail }),
          }).then(async (response) => {
            const body = (await response.json()) as { magicLink?: string };
            const token = body.magicLink?.split("magic=")[1] ?? "";
            if (token) setMagicToken(token);
          });
        }}>
          <label>
            {t("lobby.magic")}
            <input type="email" value={magicEmail} onChange={(event) => setMagicEmail(event.target.value)} />
          </label>
          {magicToken ? (
            <button type="button" onClick={() => void api.verifyMagic(magicToken).then((next) => onSession(next))}>
              {t("lobby.signIn")}
            </button>
          ) : null}
        </form>
      ) : null}
      {!session ? (
        <form onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          void fetch(`${import.meta.env.VITE_API_URL || "http://127.0.0.1:3001"}/auth/telegram-widget`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(Object.fromEntries(data.entries())),
          });
        }}>
          <input name="id" placeholder="id" />
          <input name="auth_date" placeholder="auth_date" />
          <input name="hash" placeholder="hash" />
          <input name="first_name" placeholder="first_name" />
          <button type="submit">Telegram</button>
        </form>
      ) : null}
      {session && !window.localStorage.getItem("lume-onboarded") ? (
        <div data-testid="onboarding">
          <p>{t("onboard.1")}</p>
          <p>{t("onboard.2")}</p>
          <p>{t("onboard.3")}</p>
          <button
            type="button"
            className="tr-text-button"
            onClick={() => {
              window.localStorage.setItem("lume-onboarded", "1");
              void fetch(`${import.meta.env.VITE_API_URL || "http://127.0.0.1:3001"}/me`, {
                method: "PATCH",
                headers: { "content-type": "application/json", authorization: `Bearer ${session.accessToken}` },
                body: JSON.stringify({ onboardingComplete: true }),
              });
            }}
          >
            {t("onboard.done")}
          </button>
        </div>
      ) : null}
      {session && people ? <PeopleScreen session={session} onOpen={onOpen} /> : null}
      {session ? (
        <div className="tr-lobby-grid">
          <form onSubmit={(event) => void create(event)}>
            <label>
              {t("lobby.roomTitle")}
              <input data-testid="lobby-title" value={title} onChange={(event) => setTitle(event.target.value)} />
              <span className="tr-inline-actions">
                <button type="button" className="tr-text-button" onClick={() => { setTitle("Киноночь"); setIsPublic(true); }}>Киноночь</button>
                <button type="button" className="tr-text-button" onClick={() => { setTitle("Вечеринка"); setIsPublic(true); }}>Вечеринка</button>
                <button type="button" className="tr-text-button" onClick={() => { setTitle("Закрытый"); setIsPublic(false); }}>Закрытый</button>
                <button type="button" className="tr-text-button" onClick={() => { setTitle("С модерацией"); setIsPublic(true); }}>С модерацией</button>
              </span>
            </label>
            <label className="tr-check">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
              />
              {t("lobby.public")}
            </label>
            <button type="submit" className="tr-primary" data-testid="lobby-create">
              {t("lobby.create")}
            </button>
          </form>
          <form onSubmit={(event) => void join(event)}>
            <label>
              {t("lobby.code")}
              <input data-testid="lobby-code" value={code} onChange={(event) => setCode(event.target.value)} />
            </label>
            <button type="submit" className="tr-primary" data-testid="lobby-join">
              {t("lobby.join")}
            </button>
          </form>
        </div>
      ) : null}
      <div>
        <p className="tr-kicker">{t("lobby.browse")}</p>
        <input value={browseQuery} onChange={(event) => setBrowseQuery(event.target.value)} placeholder={t("lobby.browse")} />
        <button type="button" className="tr-text-button" onClick={() => setBrowseSort((value) => value === "new" ? "title" : "new")}>{browseSort}</button>
        {rooms.length === 0 ? <p className="tr-empty">{t("lobby.emptyRooms")}</p> : null}
        <div className="tr-public-list">
          {rooms.filter((room) => room.title.toLowerCase().includes(browseQuery.toLowerCase()) || room.code.includes(browseQuery.toLowerCase())).sort((left, right) => browseSort === "title" ? left.title.localeCompare(right.title) : 0).map((room) => (
            <button
              key={room.id}
              type="button"
              className="tr-text-button"
              onClick={() => {
                if (!session) {
                  return;
                }
                void api
                  .joinRoom(session.accessToken, room.code)
                  .then((result) => onOpen(result.room.id))
                  .catch((caught: unknown) =>
                    setError(caught instanceof ClientError ? caught.code : "request_failed"),
                  );
              }}
            >
              {room.title} · {room.code}
            </button>
          ))}
        </div>
      </div>
      {error ? (
        <p className="tr-note" data-testid="lobby-error">
          {error}
        </p>
      ) : (
        <p className="tr-note">{t("lobby.note")}</p>
      )}
    </section>
  );
}
