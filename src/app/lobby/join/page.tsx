"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { savePlayerIdentity, saveRoomToSession } from "@/lib/useRoom";
import { filterPlainText, isPlainTextValid } from "@/lib/validation";
import type { Room } from "@/lib/types";
import { CoupleMascots } from "@/components/mascots/CoupleMascots";

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
    const trimmed = nickname.trim();
    savePlayerIdentity({ nickname: trimmed, isHost: false });
    const socket = getSocket();
    socket.emit("room:join", { code: code.trim().toUpperCase(), nickname: trimmed });
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <CoupleMascots size={56} className="mb-4" />
      <h2 className="text-3xl font-extrabold mb-1 text-pink-900">Unirse a partida</h2>
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
          className="btn-primary w-full rounded-xl"
        >
          Unirse
        </button>
      </div>
    </main>
  );
}
