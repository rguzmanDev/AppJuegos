"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CopyableText } from "@/components/CopyableText";
import { MascotIcon } from "@/components/GameIcon";
import { Button } from "@/components/ui/Button";
import { GameTitle } from "@/components/ui/GameTitle";
import { getSocket } from "@/lib/socket";
import { savePlayerIdentity, saveRoomToSession } from "@/lib/useRoom";
import { getGameMeta } from "@/lib/gameMeta";
import { filterPlainText, isPlainTextValid } from "@/lib/validation";
import type { Room, GameId } from "@/lib/types";

export default function NewLobbyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameId = (searchParams.get("game") ?? "ppt") as GameId;
  const gameMeta = getGameMeta(gameId);

  const [nickname, setNickname] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const socket = getSocket();
    socket.connect();

    socket.on("room:updated", (r) => {
      setRoom(r);
      saveRoomToSession(r);
    });
    socket.on("error", (msg) => setError(msg));

    return () => {
      socket.off("room:updated");
      socket.off("error");
    };
  }, []);

  function createRoom() {
    if (!isPlainTextValid(nickname)) return;
    const trimmed = nickname.trim();
    savePlayerIdentity({ nickname: trimmed, isHost: true });
    const socket = getSocket();
    socket.emit("room:create", { gameId, nickname: trimmed });
  }

  useEffect(() => {
    if (room && room.players.length === 2) {
      router.push(`/game/${room.gameId}?code=${room.code}`);
    }
  }, [room, router]);

  if (room) {
    const joinUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/lobby/join?code=${room.code}`
        : "";

    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <GameTitle gameId={room.gameId} title={getGameMeta(room.gameId).name} iconSize={32} />
        <p className="mb-6 text-muted mt-2">Comparte el código con tu pareja</p>

        <CopyableText
          text={room.code}
          label="Código copiado!"
          className="card font-mono text-5xl font-bold tracking-widest mb-6"
        />

        <p className="text-sm text-muted mb-2">O comparte este link (clic para copiar):</p>
        <CopyableText
          text={joinUrl}
          label="Link copiado!"
          className="text-sm card py-2 break-all w-full max-w-sm"
        />

        <div className="mt-8 flex gap-3 items-center flex-wrap justify-center">
          {room.players.map((p) => (
            <div
              key={p.id}
              className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
                p.isHost ? "badge-host" : "badge-guest"
              }`}
            >
              <MascotIcon variant={p.isHost ? "pollito" : "pinguinito"} size={20} />
              <span>{p.nickname}</span>
            </div>
          ))}
          {room.players.length < 2 && (
            <div className="text-sm text-muted animate-pulse flex items-center gap-1.5">
              <MascotIcon variant="pinguinito" size={18} />
              Esperando pareja...
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <GameTitle gameId={gameId} title={gameMeta.name} iconSize={32} />
      <p className="text-muted mb-8 mt-2">Nueva partida</p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <input
          type="text"
          placeholder="Tu nickname"
          value={nickname}
          maxLength={20}
          onChange={(e) => setNickname(filterPlainText(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && createRoom()}
          className="input-field text-lg"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <Button onClick={createRoom} disabled={!isPlainTextValid(nickname)} fullWidth>
          Crear partida
        </Button>
      </div>
    </main>
  );
}
