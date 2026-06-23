"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Crown } from "lucide-react";
import { CopyableText } from "@/components/CopyableText";
import { GameIcon } from "@/components/GameIcon";
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
        <h2 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
          <GameIcon gameId={room.gameId} size={28} className="text-pink-500" />
          {getGameMeta(room.gameId).name}
        </h2>
        <p className="mb-6 opacity-60">Comparte el código con tu pareja</p>

        <CopyableText
          text={room.code}
          label="Código copiado!"
          className="bg-white border-2 border-pink-300 rounded-2xl px-10 py-6 text-5xl font-mono font-bold tracking-widest shadow-lg mb-6 hover:border-pink-400"
        />

        <p className="text-sm opacity-50 mb-2">O comparte este link (clic para copiar):</p>
        <CopyableText
          text={joinUrl}
          label="Link copiado!"
          className="text-sm font-medium bg-pink-50 px-4 py-2 rounded-lg border border-pink-200 break-all hover:bg-pink-100"
        />

        <div className="mt-8 flex gap-3 items-center">
          {room.players.map((p) => (
            <div
              key={p.id}
              className="bg-pink-100 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-1"
            >
              {p.nickname}
              {p.isHost ? (
                <Crown size={14} className="text-yellow-600" aria-label="Anfitrión" />
              ) : (
                <GameIcon brand size={14} className="text-pink-500" />
              )}
            </div>
          ))}
          {room.players.length < 2 && (
            <div className="opacity-40 text-sm animate-pulse">
              Esperando pareja...
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-3xl font-bold mb-1 flex items-center justify-center gap-2">
        <GameIcon gameId={gameId} size={28} className="text-pink-500" />
        {gameMeta.name}
      </h2>
      <p className="opacity-60 mb-8">Nueva partida</p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <input
          type="text"
          placeholder="Tu nickname"
          value={nickname}
          maxLength={20}
          onChange={(e) => setNickname(filterPlainText(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && createRoom()}
          className="border-2 border-pink-200 rounded-xl px-4 py-3 text-center text-lg outline-none focus:border-pink-400"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          onClick={createRoom}
          disabled={!isPlainTextValid(nickname)}
          className="bg-pink-400 hover:bg-pink-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors"
        >
          Crear partida
        </button>
      </div>
    </main>
  );
}
