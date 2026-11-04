import type { RoomLayout as RoomLayoutModel } from "@lume/contracts";
import { useI18n } from "../i18n/context.js";
import { RoomLayoutView } from "../layout/RoomLayout.js";

export function RoomScreen({
  title,
  displayName,
  layout,
  onLayout,
  onLeave,
}: {
  title: string;
  displayName: string;
  layout: RoomLayoutModel;
  onLayout: (next: RoomLayoutModel) => void;
  onLeave: () => void;
}) {
  const { t } = useI18n();
  return (
    <section className="tr-room">
      <div className="tr-room-bar">
        <div>
          <strong>{title}</strong>
          <span>
            {displayName} · {t("room.host")}
          </span>
        </div>
        <button type="button" className="tr-text-button" onClick={onLeave}>
          {t("room.leave")}
        </button>
      </div>
      <RoomLayoutView layout={layout} synced={false} onLayout={onLayout} />
    </section>
  );
}
