import { useState, type FormEvent } from "react";
import { Avatar, Button, Card, Input, List, ListRow } from "../../ds/index.js";
import { useI18n } from "../../i18n/context.js";
import type { ProfileData, usePeople } from "./useProfileData.js";
import styles from "./panels.module.css";

type People = ReturnType<typeof usePeople>;

function Hidden({ children, text }: { children: React.ReactNode; text: string }) {
  return <>{children ?? <p className={styles.muted}>{text}</p>}</>;
}

export function FriendsPanel({ data, people }: { data: ProfileData; people: People }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const profile = people.publicProfile;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void people.search(query);
  };
  const subtitle = (roomTitle?: string | null) => (roomTitle ? t("profile.inRoomTitle", { title: roomTitle }) : t("profile.inLume"));
  return (
    <div className={styles.stack}>
      {data.incoming.length > 0 ? (
        <Card as="section" aria-label={t("profile.requests")}>
          <h2 className={styles.heading}>{t("profile.requests")}</h2>
          <List label={t("profile.requests")}>
            {data.incoming.map((row) => (
              <ListRow
                key={row.id}
                leading={<Avatar name={row.displayName} />}
                title={row.displayName}
                subtitle={t("profile.wantsToBeFriends")}
                trailing={<span className={styles.actions}>
                  <Button size="sm" variant="primary" onClick={() => void people.answerFriend(row.id, "accept").then(data.reload)}>{t("profile.accept")}</Button>
                  <Button size="sm" onClick={() => void people.answerFriend(row.id, "decline").then(data.reload)}>{t("profile.decline")}</Button>
                </span>}
              />
            ))}
          </List>
        </Card>
      ) : null}
      <Card as="section" aria-label={t("profile.friends")}>
        <h2 className={styles.heading}>{t("profile.friends")}</h2>
        {data.friends.length === 0 ? <p className={styles.muted}>{t("profile.noFriends")}</p> : (
          <List label={t("profile.friends")}>
            {data.friends.map((friend) => (
              <ListRow
                key={friend.id}
                leading={<Avatar name={friend.displayName} />}
                title={friend.displayName}
                subtitle={subtitle(friend.roomTitle)}
                trailing={friend.roomId ? <Button size="sm" onClick={() => void people.inviteFriend(friend.roomId!, friend.userId)}>{t("profile.invite")}</Button> : undefined}
              />
            ))}
          </List>
        )}
      </Card>
      <Card as="section" aria-label={t("profile.people")}>
        <h2 className={styles.heading}>{t("profile.people")}</h2>
        <form className={styles.search} onSubmit={submit}>
          <div className={styles.searchField}>
            <Input data-testid="friend-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("profile.searchPeople")} aria-label={t("profile.searchPeopleAria")} />
          </div>
          <Button type="submit">{t("profile.search")}</Button>
        </form>
        {people.found.length > 0 ? (
          <List label={t("profile.people")}>
            {people.found.map((person) => (
              <ListRow
                key={person.id}
                attrs={{ "data-testid": "friend-result" }}
                leading={<Avatar name={person.displayName} />}
                title={person.displayName}
                subtitle={t("profile.foundInLume")}
                trailing={<span className={styles.actions}>
                  <Button size="sm" data-testid="people-open-profile" onClick={() => void people.openProfile(person.id)}>{t("profile.profileAction")}</Button>
                  <Button size="sm" variant="primary" onClick={() => void people.addFriend(person.id)}>{t("profile.addFriendAction")}</Button>
                </span>}
              />
            ))}
          </List>
        ) : null}
        {profile ? (
          <section className={styles.public} data-testid="public-profile" aria-label={profile.displayName}>
            <h3 className={styles.publicName} data-testid="public-profile-name">{profile.displayName}</h3>
            <p className={styles.muted} data-testid="public-profile-level">{t("profile.level", { level: profile.level })}{profile.username && !profile.username.includes(":") ? ` · ${profile.username}` : ""}</p>
            {profile.bio ? <p className={styles.muted}>{profile.bio}</p> : null}
            <div data-testid="public-profile-history">
              <b>{t("profile.watchHistory")}</b>
              <Hidden text={t("profile.hidden")}>
                {profile.watchHistory === null ? null : profile.watchHistory.length === 0 ? <p className={styles.muted}>{t("profile.nothingYet")}</p> : (
                  <ul className={styles.plain}>{profile.watchHistory.map((item) => <li key={item.url} data-testid="public-profile-history-item" data-url={item.url}>{item.title || item.url} · {item.watchCount}</li>)}</ul>
                )}
              </Hidden>
            </div>
            <div data-testid="public-profile-friends">
              <b>{t("profile.friendsTitle")}</b>
              <Hidden text={t("profile.hidden")}>
                {profile.friends === null ? null : profile.friends.length === 0 ? <p className={styles.muted}>{t("profile.nothingYet")}</p> : (
                  <ul className={styles.plain}>{profile.friends.map((friend) => <li key={friend.id}>{friend.displayName}</li>)}</ul>
                )}
              </Hidden>
            </div>
          </section>
        ) : null}
      </Card>
    </div>
  );
}
