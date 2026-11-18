import { hlsProxyUrl, playerKind, type PlayerAdapter, type QueueItem } from "@lume/contracts";

export async function createPlayerAdapter(
  item: Pick<QueueItem, "provider" | "externalId" | "url">,
  mount: HTMLElement,
  parentHost: string,
): Promise<PlayerAdapter> {
  const kind = playerKind(item);
  if (kind === "youtube") {
    const { createYouTubeAdapter } = await import("./youtube.js");
    return createYouTubeAdapter(item.externalId, mount);
  }
  if (kind === "vimeo") {
    const { createVimeoAdapter } = await import("./vimeo.js");
    return createVimeoAdapter(item.url, mount);
  }
  if (kind === "twitch") {
    const { createTwitchAdapter } = await import("./twitch.js");
    return createTwitchAdapter(item.externalId, mount, parentHost);
  }
  if (kind === "vk") {
    const { createVkAdapter } = await import("./vk.js");
    return createVkAdapter(item.externalId, mount, parentHost);
  }
  if (kind === "rutube") {
    const { createRutubeAdapter } = await import("./rutube.js");
    return createRutubeAdapter(item.externalId, mount, parentHost);
  }
  if (kind === "dash") {
    const { createDashAdapter } = await import("./dash.js");
    return createDashAdapter(item.url, mount);
  }
  const { createHtml5Adapter } = await import("./html5.js");
  const source = kind === "hls" ? hlsProxyUrl(import.meta.env.VITE_API_URL || "http://127.0.0.1:3001", item.url) : item.url;
  return createHtml5Adapter(source, mount, kind === "hls");
}
