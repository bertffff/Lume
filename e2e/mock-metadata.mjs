import { createServer } from "node:http";

const port = Number(process.env.MOCK_METADATA_PORT ?? 3099);

function titleFor(source) {
  try {
    const host = new URL(source).hostname;
    return host.replace(/^www\./, "");
  } catch {
    return "metadata fixture";
  }
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (url.pathname === "/oembed") {
    const source = url.searchParams.get("url") ?? "";
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
