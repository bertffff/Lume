/** Provider CDN hosts that the stream and manifest proxies may read by default. */
export const defaultStreamAllowlist = [
  "youtube.com",
  "googlevideo.com",
  "ytimg.com",
  "vk.com",
  "vkvideo.ru",
  "userapi.com",
  "rutube.ru",
  "twitch.tv",
  "ttvnw.net",
  "vimeo.com",
  "akamaized.net",
  "cloudfront.net",
  "dailymotion.com",
  "dmcdn.net",
  "soundcloud.com",
  "sndcdn.com",
  "mux.com",
] as const;

export function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) {
    return [...defaultStreamAllowlist];
  }
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase().replace(/^\*?\./, ""))
    .filter((value) => value.length > 0);
}

/** Exact host or any subdomain of an allowed host. */
export function hostAllowed(hostname: string, allowlist: readonly string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, "");
  return allowlist.some((entry) => {
    const allowed = entry.toLowerCase().replace(/^\*?\./, "");
    return host === allowed || host.endsWith(`.${allowed}`);
  });
}
