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
      <main className="app-main flex flex-col items-center px-5 py-10">
        <div className="w-full max-w-md text-center">
          <GameTitle gameId={room.gameId} title={getGameMeta(room.gameId).name} iconSize={28} />
          <p className="text-muted mt-2 mb-8 text-sm">Comparte el código con tu pareja</p>

          <CopyableText
            text={room.code}
            label="Código copiado!"
            className="panel-code text-4xl font-bold mb-4 mx-auto block text-center"
          />

          <p className="text-xs text-muted mb-2">Link para unirse (clic para copiar)</p>
          <CopyableText
            text={joinUrl}
            label="Link copiado!"
            className="panel-inset w-full text-left"
          />

          <div className="mt-8 flex gap-2 items-center flex-wrap justify-center">
            {room.players.map((p) => (
              <div
                key={p.id}
                className={p.isHost ? "badge-host" : "badge-guest"}
              >
                <MascotIcon variant={p.isHost ? "pollito" : "pinguinito"} size={18} />
                <span>{p.nickname}</span>
              </div>
            ))}
            {room.players.length < 2 && (
              <span className="text-sm text-muted flex items-center gap-1.5">
                <MascotIcon variant="pinguinito" size={16} />
                Esperando pareja…
              </span>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-main flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-xs text-center">
        <GameTitle gameId={gameId} title={gameMeta.name} iconSize={28} />
        <p className="text-muted mt-2 mb-8 text-sm">Nueva partida</p>

        <div className="flex flex-col gap-3 text-left">
          <label className="text-xs font-medium uppercase tracking-widest text-muted">
            Tu nombre
          </label>
          <input
            type="text"
            placeholder="Nickname"
            value={nickname}
            maxLength={20}
            onChange={(e) => setNickname(filterPlainText(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && createRoom()}
            className="input-field"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <Button onClick={createRoom} disabled={!isPlainTextValid(nickname)} fullWidth>
            Crear partida
          </Button>
        </div>
      </div>
    </main>
  );
}
