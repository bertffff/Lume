import type { RoomSummary } from "@lume/contracts";
import { useEffect, useState, type FormEvent } from "react";
import { api, ClientError } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import type { ClientSession } from "../session.js";

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
  const [error, setError] = useState<string | null>(null);

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
      onSession({ accessToken: result.accessToken, user: result.user });
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
    <section className="tr-lobby">
      <p className="tr-kicker">{t("lobby.kicker")}</p>
      <h1>{t("lobby.title")}</h1>
      <p className="tr-lead">{t("lobby.body")}</p>
      {session ? (
        <p>
          {session.user.displayName}{" "}
          <button type="button" className="tr-text-button" onClick={onSignOut}>
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
      {session ? (
        <div className="tr-lobby-grid">
          <form onSubmit={(event) => void create(event)}>
            <label>
              {t("lobby.roomTitle")}
              <input data-testid="lobby-title" value={title} onChange={(event) => setTitle(event.target.value)} />
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
        {rooms.length === 0 ? <p className="tr-empty">{t("lobby.emptyRooms")}</p> : null}
        <div className="tr-public-list">
          {rooms.map((room) => (
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
