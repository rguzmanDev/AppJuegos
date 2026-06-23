"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CoupleMascots } from "@/components/mascots/Mascots";
import { Button } from "@/components/ui/Button";
import { getSocket } from "@/lib/socket";
import { savePlayerIdentity, saveRoomToSession } from "@/lib/useRoom";
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
    const trimmed = nickname.trim();
    savePlayerIdentity({ nickname: trimmed, isHost: false });
    const socket = getSocket();
    socket.emit("room:join", { code: code.trim().toUpperCase(), nickname: trimmed });
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <CoupleMascots size={48} className="mb-3 justify-center" />
          <h2 className="font-display text-2xl font-bold">Unirse</h2>
          <p className="text-muted text-sm mt-1">Ingresa el código que te compartieron</p>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-widest text-muted block mb-1.5">
              Código
            </label>
            <input
              type="text"
              placeholder="ABCDEF"
              value={code}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="input-field text-2xl font-mono tracking-[0.25em] uppercase text-center"
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-widest text-muted block mb-1.5">
              Tu nombre
            </label>
            <input
              type="text"
              placeholder="Nickname"
              value={nickname}
              maxLength={20}
              onChange={(e) => setNickname(filterPlainText(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && join()}
              className="input-field"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <Button onClick={join} disabled={!isPlainTextValid(nickname) || !code.trim()} fullWidth>
            Entrar
          </Button>
        </div>
      </div>
    </main>
  );
}
