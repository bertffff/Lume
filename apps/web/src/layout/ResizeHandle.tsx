import { cx } from "../ds/cx.js";
import styles from "./ResizeHandle.module.css";
import { useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

export function ResizeHandle({
  axis,
  label,
  onPointerDown,
  onDrag,
  onEnd,
  onKey,
}: {
  axis: "x" | "y";
  label: string;
  onPointerDown: (client: number) => void;
  onDrag: (client: number) => void;
  onEnd: () => void;
  onKey: (delta: number) => void;
}) {
  const dragging = useRef(false);
  const previousUserSelect = useRef("");

  function stop() {
    dragging.current = false;
    document.body.style.userSelect = previousUserSelect.current;
    onEnd();
  }
  const coordinate = (event: ReactPointerEvent<HTMLDivElement>) =>
    axis === "x" ? event.clientX : event.clientY;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 0.06 : 0.02;
    if (axis === "x" && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      onKey(event.key === "ArrowRight" ? step : -step);
    }
    if (axis === "y" && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      onKey(event.key === "ArrowDown" ? step : -step);
    }
  }

  return (
    <div
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      aria-label={label}
      tabIndex={0}
      className={cx(styles.handle, styles[axis])}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragging.current = true;
        previousUserSelect.current = document.body.style.userSelect;
        document.body.style.userSelect = "none";
        onPointerDown(coordinate(event));
      }}
      onPointerMove={(event) => {
        if (!dragging.current) {
          return;
        }
        onDrag(coordinate(event));
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onKeyDown={onKeyDown}
    />
  );
}
