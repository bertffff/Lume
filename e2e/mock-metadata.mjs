import { createServer } from "node:http";

const port = Number(process.env.MOCK_METADATA_PORT ?? 3099);

function titleFor(source) {
  try {
    const parsed = new URL(source);
    if (parsed.pathname.includes("recommend.mp4")) {
      return "Рекомендованный фильм";
    }
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "metadata fixture";
  }
}

const seenRecommendations = new Set();

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (url.pathname === "/manifest.mpd") {
    response.writeHead(200, { "content-type": "application/dash+xml" });
    response.end(`<?xml version="1.0"?><MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static"><BaseURL>dash/</BaseURL><Period><AdaptationSet><Representation><SegmentTemplate media="seg-$Number$.m4s" initialization="init.mp4" /></Representation></AdaptationSet></Period></MPD>`);
    return;
  }
  if (url.pathname === "/master.m3u8") {
    response.writeHead(200, { "content-type": "application/vnd.apple.mpegurl" });
    response.end("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000\nvariant.m3u8\n");
    return;
  }
  if (url.pathname === "/variant.m3u8") {
    response.writeHead(200, { "content-type": "application/vnd.apple.mpegurl" });
    response.end("#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXTINF:4,\nseg.ts\n#EXT-X-ENDLIST\n");
    return;
  }
  if (url.pathname === "/seg.ts") {
    response.writeHead(200, { "content-type": "video/mp2t" });
    response.end(Buffer.from([0, 1, 2, 255, 10]));
    return;
  }
  if (url.pathname === "/stream.mp4") {
    const body = Buffer.from("range-body-fixture");
    const range = request.headers.range;
    if (typeof range === "string") {
      const match = range.match(/bytes=(\d+)-(\d*)/);
      const start = Number(match?.[1] ?? 0);
      const end = Math.min(body.length - 1, match?.[2] ? Number(match[2]) : body.length - 1);
      response.writeHead(206, {
        "content-type": "video/mp4",
        "content-range": `bytes ${start}-${end}/${body.length}`,
        "content-length": String(end - start + 1),
        "accept-ranges": "bytes",
      });
      response.end(body.subarray(start, end + 1));
      return;
    }
    response.writeHead(200, { "content-type": "video/mp4", "content-length": String(body.length), "accept-ranges": "bytes" });
    response.end(body);
    return;
  }
  if (url.pathname === "/oembed") {
    const source = url.searchParams.get("url") ?? "";
    if (source.includes("recommend.mp4")) {
      const firstRead = !seenRecommendations.has(source);
      seenRecommendations.add(source);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(firstRead ? { title: "Рекомендованный фильм", duration: 60 } : {}));
      return;
    }
    if (source.includes("metadata-fixture")) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        title: "Метаданные с сервера",
        thumbnail_url: "https://cdn.example.com/metadata-poster.jpg",
        duration: 754,
      }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      title: titleFor(source),
      duration: 60,
    }));
    return;
  }
  response.writeHead(404);
  response.end();
});

server.listen(port, "127.0.0.1");
