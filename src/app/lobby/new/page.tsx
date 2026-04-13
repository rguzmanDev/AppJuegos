"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { saveRoomToSession } from "@/lib/useRoom";
import type { Room, GameId } from "@/lib/types";

const GAME_LABELS: Record<GameId, string> = {
  ppt: "Piedra Papel Tijera ✂️",
  ahorcado: "Ahorcado 🐧",
  stop: "Bachillerato / Stop 🐣",
  dibuja: "Dibuja y Adivina 🐥",
};

export default function NewLobbyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameId = (searchParams.get("game") ?? "ppt") as GameId;

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
    if (!nickname.trim()) return;
    const socket = getSocket();
    socket.emit("room:create", { gameId, nickname: nickname.trim() });
  }

  useEffect(() => {
    if (room && room.players.length === 2) {
      router.push(`/game/${room.gameId}?code=${room.code}`);
    }
  }, [room, router]);

  if (room) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-3xl font-bold mb-2">{GAME_LABELS[room.gameId]}</h2>
        <p className="mb-6 opacity-60">Comparte el código con tu pareja</p>

        <div className="bg-white border-2 border-pink-300 rounded-2xl px-10 py-6 text-5xl font-mono font-bold tracking-widest shadow-lg mb-6">
          {room.code}
        </div>

        <p className="text-sm opacity-50 mb-2">O comparte este link:</p>
        <p className="text-sm font-medium bg-pink-50 px-4 py-2 rounded-lg border border-pink-200 break-all">
          {typeof window !== "undefined"
            ? `${window.location.origin}/lobby/join?code=${room.code}`
            : ""}
        </p>

        <div className="mt-8 flex gap-3 items-center">
          {room.players.map((p) => (
            <div
              key={p.id}
              className="bg-pink-100 px-4 py-2 rounded-full text-sm font-medium"
            >
              {p.nickname} {p.isHost ? "👑" : "🐥"}
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
      <h2 className="text-3xl font-bold mb-1">{GAME_LABELS[gameId]}</h2>
      <p className="opacity-60 mb-8">Nueva partida</p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <input
          type="text"
          placeholder="Tu nickname 🐥"
          value={nickname}
          maxLength={20}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createRoom()}
          className="border-2 border-pink-200 rounded-xl px-4 py-3 text-center text-lg outline-none focus:border-pink-400"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          onClick={createRoom}
          disabled={!nickname.trim()}
          className="bg-pink-400 hover:bg-pink-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors"
        >
          Crear partida
        </button>
      </div>
    </main>
  );
}
