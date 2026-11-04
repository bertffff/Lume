export function commandEmbed(
  iframe: HTMLIFrameElement | null,
  provider: string,
  action: "play" | "pause",
  positionMs: number,
): void {
  const target = iframe?.contentWindow;
  if (!target) {
    return;
  }
  if (provider === "youtube") {
    const func = action === "play" ? "playVideo" : "pauseVideo";
    target.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
    target.postMessage(
      JSON.stringify({ event: "command", func: "seekTo", args: [positionMs / 1000, true] }),
      "*",
    );
  }
  if (provider === "vimeo") {
    target.postMessage(JSON.stringify({ method: action === "play" ? "play" : "pause" }), "*");
  }
}
