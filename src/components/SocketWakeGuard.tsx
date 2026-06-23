"use client";

import { useEffect, useState } from "react";
import { NapSplash } from "@/components/NapSplash";
import { getSocket } from "@/lib/socket";

const WAKE_DELAY_MS = 1200;

/** Muestra la siesta si el WebSocket tarda en conectar (p. ej. Render despertando). */
export function SocketWakeGuard({ children }: { children: React.ReactNode }) {
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    if (socket.connected) return;

    let showTimer: ReturnType<typeof setTimeout> | undefined;
    const onConnect = () => {
      clearTimeout(showTimer);
      setWaking(false);
    };

    showTimer = setTimeout(() => {
      if (!socket.connected) setWaking(true);
    }, WAKE_DELAY_MS);

    socket.on("connect", onConnect);
    if (!socket.connected) socket.connect();

    return () => {
      clearTimeout(showTimer);
      socket.off("connect", onConnect);
    };
  }, []);

  return (
    <>
      {waking && <NapSplash variant="overlay" />}
      {children}
    </>
  );
}
