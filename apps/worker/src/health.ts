import { createServer, type Server } from "node:http";

export function listenHealth(
  host: string,
  port: number,
  status: () => Record<string, unknown>,
): Server {
  const server = createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }
    if (request.url === "/ready") {
      const body = status();
      const ready = body.redis === "up";
      response.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  server.listen(port, host);
  return server;
}
