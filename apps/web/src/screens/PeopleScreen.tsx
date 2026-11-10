import { useEffect, useState, type FormEvent } from "react";
import { api, ClientError } from "../api/client.js";
import { useI18n } from "../i18n/context.js";
import type { ClientSession } from "../session.js";

export function PeopleScreen({ session }: { session: ClientSession }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Array<{ id: string; displayName: string }>>([]);
  const [incoming, setIncoming] = useState<Array<{ id: string; displayName: string }>>([]);
  const [friends, setFriends] = useState<Array<{ id: string; displayName: string }>>([]);
  const [notes, setNotes] = useState<Array<{ id: string; title: string; body: string }>>([]);
  const [resume, setResume] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const [list, feed, card] = await Promise.all([
      api.friends(session.accessToken),
      api.notifications(session.accessToken),
      api.resume(session.accessToken),
    ]);
    setIncoming(list.incoming);
    setFriends(list.friends);
    setNotes(feed.notifications.filter((item) => !item.read));
    setResume(card.resume ? `${card.resume.title} · ${card.resume.queueCount}` : null);
  }

  useEffect(() => {
    void reload().catch(() => setError("request_failed"));
  }, [session.accessToken]);

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

  return (
    <section className="tr-lobby" data-testid="people">
      <h2>{t("people.title")}</h2>
      {resume ? <p data-testid="resume-card">{t("people.resume")} {resume}</p> : <p className="tr-empty">{t("people.noResume")}</p>}
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
            <button type="button" className="tr-text-button" onClick={() => void api.requestFriend(session.accessToken, user.id).then(reload)}>
              {t("people.request")}
            </button>
          </li>
        ))}
      </ul>
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
          <li key={row.id}>{row.displayName}</li>
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
