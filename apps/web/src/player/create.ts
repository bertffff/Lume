import { playerKind, type PlayerAdapter, type QueueItem } from "@lume/contracts";

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
  if (kind === "vk" || kind === "rutube") {
    const { createLimitedEmbedAdapter } = await import("./limited.js");
    return createLimitedEmbedAdapter(kind, item.externalId, mount, parentHost);
  }
  const { createHtml5Adapter } = await import("./html5.js");
  return createHtml5Adapter(item.url, mount, kind === "hls");
}
