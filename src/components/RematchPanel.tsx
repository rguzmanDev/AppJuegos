"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { GameNavLink } from "@/components/GameNavLink";

const REMATCH_SECONDS = 10;

export type RematchResetHandler = () => void;

interface UseRematchOptions {
  socket: Socket;
  isLoser: boolean;
  isWinner: boolean;
  isTie?: boolean;
  enabled?: boolean;
  onAccept: RematchResetHandler;
}

export function useRematch({
  socket,
  isLoser,
  isWinner,
  isTie = false,
  enabled = true,
  onAccept,
}: UseRematchOptions) {
  const [iRequested, setIRequested] = useState(false);
  const [theyRequested, setTheyRequested] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [wasRejected, setWasRejected] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(REMATCH_SECONDS);
  const [expired, setExpired] = useState(false);
  const iRequestedRef = useRef(false);
  const onAcceptRef = useRef(onAccept);

  useEffect(() => { iRequestedRef.current = iRequested; }, [iRequested]);
  useEffect(() => { onAcceptRef.current = onAccept; }, [onAccept]);

  const canRequest = (isLoser || isTie) && !expired && !rejected && !wasRejected && !iRequested;

  useEffect(() => {
    if (!enabled) return;
    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setExpired(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [enabled]);

  useEffect(() => {
    const handler = (event: { type: string; payload: unknown; _from?: string }) => {
      if (event.type !== "game:rematch") return;
      const p = event.payload as { action: string };
      const fromOpponent = event._from !== socket.id;

      if (p.action === "request" && fromOpponent) setTheyRequested(true);
      if (p.action === "reject" && fromOpponent) {
        setRejected(true);
        if (iRequestedRef.current) setWasRejected(true);
      }
      if (p.action === "accept") {
        setIRequested(false);
        setTheyRequested(false);
        setRejected(false);
        setWasRejected(false);
        setExpired(false);
        setSecondsLeft(REMATCH_SECONDS);
        onAcceptRef.current();
      }
    };

    socket.on("game:event", handler);
    return () => { socket.off("game:event", handler); };
  }, [socket]);

  function requestRematch() {
    if (!canRequest) return;
    setIRequested(true);
    socket.emit("game:action", { type: "game:rematch", payload: { action: "request" } });
  }

  function acceptRematch() {
    socket.emit("game:action", { type: "game:rematch", payload: { action: "accept" } });
  }

  function rejectRematch() {
    socket.emit("game:action", { type: "game:rematch", payload: { action: "reject" } });
    setRejected(true);
  }

  return {
    iRequested,
    theyRequested,
    wasRejected,
    rejected,
    expired,
    secondsLeft,
    canRequest,
    requestRematch,
    acceptRematch,
    rejectRematch,
  };
}

interface RematchPanelProps {
  oppName: string;
  isWinner: boolean;
  isLoser: boolean;
  isTie?: boolean;
  rematch: ReturnType<typeof useRematch>;
}

export function RematchPanel({
  oppName,
  isWinner,
  isLoser,
  isTie = false,
  rematch,
}: RematchPanelProps) {
  const {
    iRequested,
    theyRequested,
    wasRejected,
    rejected,
    expired,
    secondsLeft,
    canRequest,
    requestRematch,
    acceptRematch,
    rejectRematch,
  } = rematch;

  const showAcceptReject = theyRequested && (isWinner || (isTie && !iRequested)) && !rejected;

  return (
    <div className="flex flex-col items-center gap-3 mt-2">
      {wasRejected && (
        <p className="text-sm text-red-500">{oppName} rechazó la revancha</p>
      )}

      {showAcceptReject ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={acceptRematch}
            className="btn-primary rounded-xl"
          >
            {oppName} quiere revancha — Aceptar
          </button>
          <button
            onClick={rejectRematch}
            className="btn-cute bg-pink-100 text-pink-600 hover:bg-pink-200 rounded-xl"
          >
            Rechazar
          </button>
        </div>
      ) : iRequested ? (
        <p className="text-sm animate-pulse opacity-50">
          Esperando respuesta de {oppName}...
        </p>
      ) : canRequest ? (
        <button
          onClick={requestRematch}
          className="btn-primary rounded-xl"
        >
          Pedir revancha ({secondsLeft}s)
        </button>
      ) : isWinner && !isTie && !theyRequested && !expired ? (
        <p className="text-sm opacity-40">
          Espera a que {oppName} pida revancha... ({secondsLeft}s)
        </p>
      ) : expired && !iRequested && !theyRequested ? (
        <p className="text-sm opacity-40">Tiempo de revancha agotado</p>
      ) : null}

      <GameNavLink
        variant="button"
        className="btn-cute bg-pink-50 text-pink-500 hover:bg-pink-100 rounded-xl"
      >
        Inicio
      </GameNavLink>
    </div>
  );
}
