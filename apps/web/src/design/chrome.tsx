import { Button } from "../ds/index.js";
import { useI18n } from "../i18n/context.js";
import { EmptyScreen } from "../screens/entry/EmptyScreen.js";

export function RoomPreview({ unavailable = false, onGo }: { unavailable?: boolean; onGo: (path: string) => void }) {
  const { t } = useI18n();
  return (
    <EmptyScreen
      title={unavailable ? t("room.previewUnavailable") : t("room.previewNone")}
      body={unavailable ? t("room.previewUnavailableBody") : t("room.previewNoneBody")}
      action={<Button variant="primary" onClick={() => onGo("/")}>{t("empty.home")}</Button>}
    />
  );
}
