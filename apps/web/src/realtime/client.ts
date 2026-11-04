import type { Socket } from "socket.io-client";

export const realtimeUrl = import.meta.env.VITE_REALTIME_URL || "http://127.0.0.1:3002";

export async function connectRealtime(url: string, token: string): Promise<Socket> {
  const { io } = await import("socket.io-client");
  return io(url, { auth: { token }, transports: ["websocket", "polling"] });
}
