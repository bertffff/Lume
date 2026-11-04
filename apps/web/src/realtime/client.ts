import type { Socket } from "socket.io-client";

export async function connectRealtime(url: string): Promise<Socket> {
  const { io } = await import("socket.io-client");
  return io(url, { transports: ["websocket", "polling"] });
}
