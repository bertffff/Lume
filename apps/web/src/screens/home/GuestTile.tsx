import { Send } from "lucide-react";
import { Button, Card, Field, Input } from "../../ds/index.js";
import { useI18n } from "../../i18n/context.js";
import { copy } from "../../design/copy.js";
import type { HomeProps } from "./types.js";
import styles from "./GuestTile.module.css";

/** Signed-out entry: signing in is the primary action, creating a room needs it first. */
export function GuestTile({ guest, onCreate }: { guest: HomeProps["guest"]; onCreate: () => void }) {
  const { t, locale } = useI18n();
  const text = copy(locale);
  return (
    <Card as="form" tone="raised" pad="lg" className={styles.tile} onSubmit={guest.onSignIn}>
      <div className={styles.copy}>
        <h2 className={styles.title}>{t("home.authTitle")}</h2>
        <p className={styles.body}>{t("home.authBody")}</p>
      </div>
      <Field label={t("home.nameLabel")}>
        <Input data-testid="lobby-name" value={guest.name} onChange={(event) => guest.onName(event.target.value)} placeholder={t("home.namePlaceholder")} autoComplete="nickname" />
      </Field>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" data-testid="lobby-sign-in">{t("auth.login")}</Button>
        <Button icon={Send} onClick={guest.onTelegram}>{text.telegram}</Button>
        <Button variant="ghost" data-testid="home-create-guest" onClick={onCreate}>{text.create}</Button>
      </div>
      <p className={styles.note}>{t("home.signInFirst")}</p>
    </Card>
  );
}
