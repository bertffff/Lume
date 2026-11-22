import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { applyAppearance, type ModeId, type StyleId } from "../design/theme.js";
import { Chip, ChipGroup } from "../ds/index.js";
import { ControlSections } from "./ControlSections.js";
import { DataSections } from "./DataSections.js";
import { OverlaySections } from "./OverlaySections.js";
import { StateSections } from "./StateSections.js";
import { TokenSections } from "./TokenSections.js";
import styles from "./gallery.module.css";

const styleLabels: Array<[StyleId, string]> = [["cinema", "Кинозал"], ["gruvbox", "Gruvbox"], ["telerave", "TeleRave-v2"]];
const modeLabels: Array<[Exclude<ModeId, "system">, string]> = [["dark", "Тёмная"], ["light", "Светлая"]];

function initial<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const value = new URLSearchParams(window.location.search).get(key);
  return allowed.find((item) => item === value) ?? fallback;
}

/** Dev-only specimen sheet: every primitive, in the active style and theme. Never persists the choice. */
export function Gallery() {
  const [style, setStyle] = useState<StyleId>(() => initial("style", ["cinema", "gruvbox", "telerave"], "cinema"));
  const [mode, setMode] = useState<Exclude<ModeId, "system">>(() => initial("mode", ["dark", "light"], "dark"));
  const openModal = new URLSearchParams(window.location.search).get("modal") === "1";

  useEffect(() => {
    applyAppearance(style, mode);
  }, [style, mode]);

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <h1 className={styles.h1}>Дизайн-система Lume</h1>
          <p className={styles.lead}>Токены и примитивы. Один акцент на экране, три личности над одной структурой.</p>
        </div>
        <div className={styles.switches}>
          <ChipGroup label="Стиль">
            {styleLabels.map(([id, label]) => <Chip key={id} selected={style === id} onClick={() => setStyle(id)}>{label}</Chip>)}
          </ChipGroup>
          <ChipGroup label="Тема">
            {modeLabels.map(([id, label]) => <Chip key={id} selected={mode === id} icon={id === "dark" ? Moon : Sun} onClick={() => setMode(id)}>{label}</Chip>)}
          </ChipGroup>
        </div>
      </header>
      <main className={styles.grid}>
        <TokenSections />
        <ControlSections />
        <DataSections />
        <OverlaySections defaultModalOpen={openModal} />
        <StateSections />
      </main>
    </div>
  );
}
