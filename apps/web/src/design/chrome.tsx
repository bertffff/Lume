import { type ReactNode } from "react";
import { Bell, KeyRound, Moon, Plus, Search, Sun, UserRound } from "lucide-react";
import { useI18n } from "../i18n/context.js";
import { EmptyScreen } from "../screens/entry/EmptyScreen.js";

export function RoomPreview({ unavailable = false, onGo }: { unavailable?: boolean; onGo: (path: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="wrap screen-scroll">
      <main>
        <EmptyScreen
          title={unavailable ? t("room.previewUnavailable") : t("room.previewNone")}
          body={unavailable
            ? t("room.previewUnavailableBody")
            : t("room.previewNoneBody")}
          action={<button type="button" className="btn btn-primary" onClick={() => onGo("/")}>{t("empty.home")}</button>}
        />
      </main>
    </div>
  );
}

export function Page({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="screen-fill" data-page={title}>
      <div className="page-head">
        <button type="button" className="page-back" onClick={onClose} aria-label={t("page.back")}>{t("page.backShort")}</button>
      </div>
      {children}
    </div>
  );
}

export const icons = { search: Search, bell: Bell, sun: Sun, moon: Moon, plus: Plus, key: KeyRound, user: UserRound } as const;

export function Icon({ name }: { name: keyof typeof icons }) {
  const Glyph = icons[name];
  return <Glyph className={`icon icon-${name}`} aria-hidden="true" strokeWidth={1.8} />;
}
