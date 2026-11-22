import { Plus } from "lucide-react";
import { Card, Icon } from "../../ds/index.js";
import { useI18n } from "../../i18n/context.js";
import { copy } from "../../design/copy.js";
import styles from "./CreateTile.module.css";

/** The one accent-filled block on the home screen. */
export function CreateTile({ onCreate }: { onCreate: () => void }) {
  const { locale } = useI18n();
  const text = copy(locale);
  return (
    <Card as="button" type="button" tone="accent" pad="lg" interactive className={styles.tile} data-testid="home-create-open" onClick={onCreate}>
      <span className={styles.plus}><Icon icon={Plus} size="lg" /></span>
      <span className={styles.copy}>
        <span className={styles.title}>{text.create}</span>
        <span className={styles.hint}>{text.createHint}</span>
      </span>
    </Card>
  );
}
