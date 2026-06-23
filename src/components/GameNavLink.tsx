"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRoom } from "@/lib/useRoom";
import { clsx } from "clsx";

interface GameNavLinkProps {
  children: React.ReactNode;
  className?: string;
  variant?: "link" | "button";
  notifyOpponent?: boolean;
}

/** Navega a inicio y opcionalmente notifica al oponente que la partida terminó. */
export function GameNavLink({
  children,
  className,
  variant = "link",
  notifyOpponent = true,
}: GameNavLinkProps) {
  const router = useRouter();
  const { socket } = useRoom();

  function handleLeave(e: React.MouseEvent) {
    e.preventDefault();
    if (notifyOpponent) {
      socket.emit("game:action", { type: "game:end", payload: {} });
    }
    router.push("/");
  }

  if (variant === "button") {
    return (
      <button type="button" onClick={handleLeave} className={className}>
        {children}
      </button>
    );
  }

  return (
    <Link href="/" onClick={handleLeave} className={clsx(className)}>
      {children}
    </Link>
  );
}

/** Para pantallas de lobby sin socket de partida activa. */
export function LobbyExitLink({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href="/" className={className}>
      {children}
    </Link>
  );
}
