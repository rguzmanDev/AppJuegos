import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "./types";

const HOST_WS_URLS: Record<string, string> = {
  "appjuegos.fly.dev": "https://appjuegos-ws.fly.dev",
  "cuddle.rgcore.dev": "https://ws-cuddle.rgcore.dev",
};

function resolveWsUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_WS_URL;
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined") {
    const mapped = HOST_WS_URLS[window.location.hostname];
    if (mapped) return mapped;
  }

  return "http://localhost:3001";
}

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    socket = io(resolveWsUrl(), { autoConnect: false });
  }
  return socket;
}
