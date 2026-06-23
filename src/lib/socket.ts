import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "./types";

const HOST_WS_URLS: Record<string, string> = {
  "appjuegos.fly.dev": "https://appjuegos-ws.fly.dev",
  "cuddle.rgcore.dev": "https://ws-cuddle.rgcore.dev",
};

function resolveWsUrl(): string {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    const mapped = HOST_WS_URLS[hostname];
    if (mapped) return mapped;

    // On a deployed site, ignore a build-time localhost URL
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      const fromEnv = process.env.NEXT_PUBLIC_WS_URL;
      if (fromEnv && !fromEnv.includes("localhost")) return fromEnv;
      if (hostname.endsWith(".fly.dev")) return "https://appjuegos-ws.fly.dev";
    }
  }

  return process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3001";
}

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (!socket) {
    socket = io(resolveWsUrl(), { autoConnect: false });
  }
  return socket;
}
