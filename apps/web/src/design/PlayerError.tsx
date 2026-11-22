import { TriangleAlert } from "lucide-react";
import { Button, Icon, Input } from "../ds/index.js";
import { useI18n } from "../i18n/context.js";
import styles from "./PlayerError.module.css";

/** Sits on the stage when the source fails: what happened, then the three ways out. */
export function PlayerError({ url, refreshState, onRetry, onOpen, onReplace }: {
  url: string;
  refreshState: "idle" | "busy" | "error";
  onRetry: () => void;
  onOpen: () => void;
  onReplace: (url: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={styles.root} data-testid="player-error" role="alert">
      <span className={styles.glyph}><Icon icon={TriangleAlert} size="lg" /></span>
      <h2 className={styles.title}>{t("room.videoUnavailable")}</h2>
      <div className={styles.actions}>
        <Button size="sm" data-testid="player-retry" onClick={onRetry}>{t(refreshState === "error" ? "room.refreshFailed" : "room.refreshLink")}</Button>
        <Button size="sm" data-testid="player-open" onClick={onOpen}>{t("room.openPlatform")}</Button>
      </div>
      <form className={styles.replace} data-url={url} onSubmit={(event) => {
        event.preventDefault();
        const next = String(new FormData(event.currentTarget).get("url") ?? "").trim();
        if (next) onReplace(next);
      }}>
        <Input name="url" type="url" required aria-label={t("room.newLink")} placeholder={t("room.newLink")} data-testid="player-replace-url" />
        <Button type="submit" variant="primary" size="sm" data-testid="player-replace">{t("room.replaceVideo")}</Button>
      </form>
    </div>
  );
}
