import { Search, X } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, Field, IconButton, Input, List, ListRow, State } from "../../ds/index.js";
import { useI18n } from "../../i18n/context.js";
import type { HomeProps } from "./types.js";
import styles from "./FriendsCard.module.css";

const VISIBLE = 5;

export function FriendsCard({ signedIn, friends, people, onSearchPeople, onJoinFriend, onInviteFriend, onRemoveFriend, onAll }: Pick<HomeProps, "friends" | "people" | "onSearchPeople" | "onJoinFriend" | "onInviteFriend" | "onRemoveFriend"> & { signedIn: boolean; onAll: () => void }) {
  const { t } = useI18n();
  const inRooms = friends.filter((row) => row.roomId).length;
  const ordered = [...friends].sort((a, b) => Number(Boolean(b.roomId)) - Number(Boolean(a.roomId)));
  const shown = ordered.slice(0, VISIBLE);
  return (
    <Card as="section" aria-label={t("home.friendsOnline")}>
      <CardHeader
        title={t("home.friendsOnline")}
        meta={<Badge tone={inRooms > 0 ? "success" : "neutral"}>{inRooms}</Badge>}
        action={friends.length > VISIBLE ? <Button size="sm" variant="ghost" onClick={onAll}>{t("home.allFriends")}</Button> : undefined}
      />
      {signedIn ? (
        <form className={styles.search} onSubmit={(event) => {
          event.preventDefault();
          const query = String(new FormData(event.currentTarget).get("q") ?? "").trim();
          if (query) onSearchPeople(query);
        }}>
          <div className={styles.field}>
            <Field label={t("profile.searchPeopleAria")} hideLabel>
              <Input icon={Search} name="q" data-testid="friend-search" placeholder={t("home.friendSearch")} />
            </Field>
          </div>
          <Button type="submit" size="md" data-testid="friend-search-go">{t("home.find")}</Button>
        </form>
      ) : null}
      {people.length > 0 ? (
        <List label={t("home.found")} dividers={false}>
          {people.map((person) => (
            <li key={person.id} data-testid="friend-result" className={styles.found}>
              <Avatar name={person.displayName} size="sm" />
              <span className={styles.foundName}>{person.displayName}</span>
              <Badge tone="info">{t("home.found")}</Badge>
            </li>
          ))}
        </List>
      ) : null}
      {shown.length > 0 ? (
        <List label={t("home.friendsOnline")}>
          {shown.map((row) => (
            <ListRow
              key={row.id}
              leading={<Avatar name={row.displayName} presence={row.roomId ? "online" : "offline"} />}
              title={row.displayName}
              subtitle={row.roomTitle ?? t("home.notInRoom")}
              trailing={
                <>
                  {row.roomId ? (
                    <Button size="sm" onClick={() => row.roomId && onJoinFriend(row.roomId)}>{t("home.enterRoom")}</Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => onInviteFriend(row.userId)}>{t("room.invite")}</Button>
                  )}
                  <IconButton icon={X} size="sm" variant="ghost" className={styles.remove} label={t("home.remove")} onClick={() => onRemoveFriend(row.id)} />
                </>
              }
            />
          ))}
        </List>
      ) : (
        <State compact bare kind="empty" title={signedIn ? t("home.friendsEmptyTitle") : t("home.signInForFriends")} body={signedIn ? t("home.noFriendsOnline") : undefined} />
      )}
    </Card>
  );
}
