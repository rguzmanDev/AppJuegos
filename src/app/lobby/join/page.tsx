"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { saveRoomToSession } from "@/lib/useRoom";
import { filterPlainText, isPlainTextValid } from "@/lib/validation";
import type { Room } from "@/lib/types";

export default function JoinLobbyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const socket = getSocket();
    socket.connect();

    socket.on("room:updated", (room: Room) => {
      saveRoomToSession(room);
      if (room.players.length === 2) {
        router.push(`/game/${room.gameId}?code=${room.code}`);
      }
    });
    socket.on("error", (msg: string) => {
      setError(msg);
      if (msg === "Código de partida no encontrado.") {
        setTimeout(() => router.push("/"), 2000);
      }
    });

    return () => {
      socket.off("room:updated");
      socket.off("error");
    };
  }, [router]);

  function join() {
    if (!isPlainTextValid(nickname) || !code.trim()) return;
    const socket = getSocket();
    socket.emit("room:join", { code: code.trim().toUpperCase(), nickname: nickname.trim() });
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-3xl font-bold mb-1">Unirse a partida</h2>
      <p className="opacity-60 mb-8">Ingresa el código que te compartieron</p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <input
          type="text"
          placeholder="Código de partida"
          value={code}
          maxLength={6}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="border-2 border-pink-200 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest outline-none focus:border-pink-400 uppercase"
        />
        <input
          type="text"
          placeholder="Tu nickname"
          value={nickname}
          maxLength={20}
          onChange={(e) => setNickname(filterPlainText(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && join()}
          className="border-2 border-pink-200 rounded-xl px-4 py-3 text-center text-lg outline-none focus:border-pink-400"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          onClick={join}
          disabled={!isPlainTextValid(nickname) || !code.trim()}
          className="bg-pink-400 hover:bg-pink-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors"
        >
          Unirse
        </button>
      </div>
    </main>
  );
}
