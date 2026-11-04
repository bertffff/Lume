import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/context.js";
import { containSize } from "../contain.js";

const aspects = [
  { id: "16:9", value: 16 / 9 },
  { id: "4:3", value: 4 / 3 },
  { id: "1:1", value: 1 },
  { id: "9:16", value: 9 / 16 },
] as const;

function nearestAspect(aspect: number) {
  return aspects.reduce((best, item) =>
    Math.abs(item.value - aspect) < Math.abs(best.value - aspect) ? item : best,
  );
}

function clock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function PlayerPanel({
  aspect,
  synced,
  onAspect,
}: {
  aspect: number;
  synced: boolean;
  onAspect: (aspect: number) => void;
}) {
  const { t } = useI18n();
  const frameRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const current = nearestAspect(aspect);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setBox(containSize(rect.width, rect.height, aspect));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [aspect]);

  useEffect(() => {
    if (!playing) {
      return;
    }
    const timer = window.setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing]);

  function cycleAspect() {
    const index = aspects.findIndex((item) => item.id === current.id);
    const next = aspects[(index + 1) % aspects.length];
    if (next) {
      onAspect(next.value);
    }
  }

  return (
    <section className="tr-panel tr-player" aria-label={t("player.stage")}>
      <header className="tr-panel-bar">
        <span>{t("player.stage")}</span>
        <span className="tr-chip">{synced ? t("player.synced") : t("player.local")}</span>
      </header>
      <div className="tr-frame" ref={frameRef}>
        <div className="tr-stage" style={{ width: box.width, height: box.height }}>
          <button
            type="button"
            className="tr-play"
            onClick={() => setPlaying((value) => !value)}
            aria-label={playing ? t("player.pause") : t("player.play")}
          >
            {playing ? "II" : "▶"}
          </button>
          <span className="tr-timecode">{clock(elapsed)}</span>
        </div>
      </div>
      <footer className="tr-panel-bar">
        <button type="button" className="tr-text-button" onClick={cycleAspect}>
          {t("player.aspect")} {current.id}
        </button>
      </footer>
    </section>
  );
}
