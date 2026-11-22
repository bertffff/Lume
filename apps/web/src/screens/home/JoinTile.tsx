import { KeyRound } from "lucide-react";
import { Button, Card, Icon } from "../../ds/index.js";
import { RoomCodeInput } from "../../design/RoomCodeInput.js";
import { useI18n } from "../../i18n/context.js";
import { copy } from "../../design/copy.js";
import type { HomeProps } from "./types.js";
import styles from "./JoinTile.module.css";

export function JoinTile({ join }: { join: HomeProps["join"] }) {
  const { locale } = useI18n();
  const text = copy(locale);
  return (
    <Card as="form" pad="lg" className={styles.tile} onSubmit={join.onSubmit}>
      <div className={styles.head}>
        <span className={styles.glyph}><Icon icon={KeyRound} size="md" /></span>
        <div className={styles.copy}>
          <h2 className={styles.title}>{text.join}</h2>
          <p className={styles.hint}>{text.joinHint}</p>
        </div>
      </div>
      <RoomCodeInput value={join.code} onChange={join.onCode} invalid={join.invalid} hideLabel />
      <Button type="submit" block data-testid="lobby-join">{text.enter}</Button>
    </Card>
  );
}
