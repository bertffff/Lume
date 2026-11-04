import type { RoomLayout as RoomLayoutModel, SidePanelId } from "@lume/contracts";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/context.js";
import { ChatPanel } from "./panels/ChatPanel.js";
import { PlayerPanel } from "./panels/PlayerPanel.js";
import { QueuePanel } from "./panels/QueuePanel.js";
import { VoicePanel } from "./panels/VoicePanel.js";
import { ResizeHandle } from "./ResizeHandle.js";
import { resolveFlow } from "./reflow.js";
import { clamp, resizePair } from "./weights.js";

const panels: readonly SidePanelId[] = ["chat", "voice", "queue"];
const minRatio = 0.35;
const maxRatio = 0.8;

interface DragSession {
  kind: "main" | "pair";
  origin: number;
  size: number;
  prev?: SidePanelId;
  curr?: SidePanelId;
  weightA?: number;
  weightB?: number;
}

export function RoomLayoutView({
  layout,
  synced,
  onLayout,
}: {
  layout: RoomLayoutModel;
  synced: boolean;
  onLayout: (next: RoomLayoutModel) => void;
}) {
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  const [viewportWidth, setViewportWidth] = useState(1200);
  const flow = resolveFlow({ viewportWidth, videoAspect: layout.videoAspect });

  useEffect(() => {
    const element = rootRef.current;
    if (!element) {
      return;
    }
    const measure = () => setViewportWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function commit(next: RoomLayoutModel, custom: boolean) {
    onLayout(custom ? { ...next, preset: "custom" } : next);
  }

  function toggle(id: SidePanelId) {
    commit(
      { ...layout, collapsed: { ...layout.collapsed, [id]: !layout.collapsed[id] } },
      true,
    );
  }

  function applyDrag(client: number) {
    const session = dragRef.current;
    if (!session || session.size <= 0) {
      return;
    }
    if (session.kind === "main") {
      const ratio = clamp((client - session.origin) / session.size, minRatio, maxRatio);
      commit({ ...layout, playerRatio: ratio }, true);
      return;
    }
    if (!session.prev || !session.curr || session.weightA === undefined || session.weightB === undefined) {
      return;
    }
    const next = resizePair(session.weightA, session.weightB, (client - session.origin) / session.size);
    commit(
      {
        ...layout,
        sideWeights: {
          ...layout.sideWeights,
          [session.prev]: next.a,
          [session.curr]: next.b,
        },
      },
      true,
    );
  }

  function beginMain(client: number) {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const horizontal = flow === "side";
    dragRef.current = {
      kind: "main",
      origin: horizontal ? rect.left : rect.top,
      size: horizontal ? rect.width : rect.height,
    };
    applyDrag(client);
  }

  function beginPair(prev: SidePanelId, curr: SidePanelId, client: number) {
    const root = rootRef.current;
    const start = root?.querySelector(`[data-panel="${prev}"]`)?.getBoundingClientRect();
    const end = root?.querySelector(`[data-panel="${curr}"]`)?.getBoundingClientRect();
    if (!start || !end) {
      return;
    }
    const column = flow === "side";
    dragRef.current = {
      kind: "pair",
      origin: column ? start.top : start.left,
      size: (column ? end.bottom : end.right) - (column ? start.top : start.left),
      prev,
      curr,
      weightA: layout.sideWeights[prev],
      weightB: layout.sideWeights[curr],
    };
    applyDrag(client);
  }

  function renderPanel(id: SidePanelId, collapsible: boolean) {
    const collapsed = collapsible && layout.collapsed[id];
    const props = { collapsed, collapsible, onToggle: () => toggle(id) };
    if (id === "chat") {
      return <ChatPanel {...props} />;
    }
    if (id === "voice") {
      return <VoicePanel {...props} />;
    }
    return <QueuePanel {...props} />;
  }

  function renderSide(collapsible: boolean) {
    const nodes: ReactNode[] = [];
    let previous: SidePanelId | null = null;
    for (const id of panels) {
      const collapsed = collapsible && layout.collapsed[id];
      if (!collapsed && previous) {
        const prev = previous;
        nodes.push(
          <ResizeHandle
            key={`handle-${id}`}
            axis={flow === "side" ? "y" : "x"}
            label={t("layout.resize")}
            onPointerDown={(client) => beginPair(prev, id, client)}
            onDrag={applyDrag}
            onEnd={() => {
              dragRef.current = null;
            }}
            onKey={(delta) => {
              const next = resizePair(
                layout.sideWeights[prev],
                layout.sideWeights[id],
                0.5 + delta,
              );
              commit(
                {
                  ...layout,
                  sideWeights: { ...layout.sideWeights, [prev]: next.a, [id]: next.b },
                },
                true,
              );
            }}
          />,
        );
      }
      nodes.push(
        <div
          key={id}
          data-panel={id}
          className={collapsed ? "tr-slot is-collapsed" : "tr-slot"}
          style={collapsed ? undefined : { flexGrow: layout.sideWeights[id] }}
        >
          {renderPanel(id, collapsible)}
        </div>,
      );
      if (!collapsed) {
        previous = id;
      }
    }
    return <div className={flow === "side" ? "tr-side tr-side-column" : "tr-side tr-side-row"}>{nodes}</div>;
  }

  if (flow === "stack") {
    return (
      <div ref={rootRef} className="tr-layout tr-layout-stack">
        <PlayerPanel
          aspect={layout.videoAspect}
          synced={synced}
          onAspect={(videoAspect) => commit({ ...layout, videoAspect }, false)}
        />
        {panels.map((id) => (
          <div key={id} className="tr-stack-panel">
            {renderPanel(id, false)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={flow === "side" ? "tr-layout tr-split tr-split-row" : "tr-layout tr-split tr-split-column"}
    >
      <div className="tr-player-slot" style={{ flexGrow: layout.playerRatio }}>
        <PlayerPanel
          aspect={layout.videoAspect}
          synced={synced}
          onAspect={(videoAspect) => commit({ ...layout, videoAspect }, false)}
        />
      </div>
      <ResizeHandle
        axis={flow === "side" ? "x" : "y"}
        label={t("layout.resize")}
        onPointerDown={beginMain}
        onDrag={applyDrag}
        onEnd={() => {
          dragRef.current = null;
        }}
        onKey={(delta) =>
          commit(
            { ...layout, playerRatio: clamp(layout.playerRatio + delta, minRatio, maxRatio) },
            true,
          )
        }
      />
      <div className="tr-side-slot" style={{ flexGrow: 1 - layout.playerRatio }}>
        {renderSide(true)}
      </div>
    </div>
  );
}
