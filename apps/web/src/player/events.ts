import type { PlayerObservation } from "@lume/contracts";

export function createObserver() {
  const listeners = new Set<(state: PlayerObservation) => void>();
  return {
    emit(state: PlayerObservation) {
      for (const listener of listeners) {
        listener(state);
      }
    },
    onState(listener: (state: PlayerObservation) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function fillMount(mount: HTMLElement) {
  mount.replaceChildren();
  const frame = document.createElement("div");
  frame.style.width = "100%";
  frame.style.height = "100%";
  mount.appendChild(frame);
  return frame;
}
