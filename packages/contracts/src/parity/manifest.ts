function absoluteUrl(reference: string, base: string): string {
  return new URL(reference, base).toString();
}

function proxyLine(target: string, source: string, endpoint: string): string {
  const params = new URLSearchParams({ url: target, source });
  return `${endpoint}?${params.toString()}`;
}

/** Rewrite HLS segment, variant, and URI lines through the proxy. */
export function rewriteHlsManifest(body: string, baseUrl: string, source: string, endpoint: string): string {
  const lines = body.split(/\r?\n/);
  const master = lines.some((line) => line.startsWith("#EXT-X-STREAM-INF"));
  const rewritten = lines.map((line) => {
    if (line.startsWith("#")) {
      return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
        return `URI="${proxyLine(absoluteUrl(uri, baseUrl), source, endpoint)}"`;
      });
    }
    if (!line.trim()) {
      return line;
    }
    return proxyLine(absoluteUrl(line.trim(), baseUrl), source, endpoint);
  });
  if (!master && source === "rutube") {
    if (!rewritten.some((line) => line.startsWith("#EXT-X-PLAYLIST-TYPE"))) {
      const header = rewritten.findIndex((line) => line.startsWith("#EXTM3U"));
      rewritten.splice(header + 1, 0, "#EXT-X-PLAYLIST-TYPE:VOD");
    }
    if (!rewritten.some((line) => line.startsWith("#EXT-X-ENDLIST"))) {
      rewritten.push("#EXT-X-ENDLIST");
    }
  }
  return rewritten.join("\n");
}
